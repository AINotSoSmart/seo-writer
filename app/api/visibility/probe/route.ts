/**
 * POST /api/visibility/probe — run an AI-visibility probe for one audit.
 * GET  /api/visibility/probe?runId=… — read a finished run.
 *
 * The probe reads the audit's *confirmed* scope families, which is what keeps
 * this honest: the prompts measure the business the customer confirmed, not a
 * business a model inferred from the homepage.
 */

import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import type { CapabilityContract } from "@/lib/writer/article-contract"
import { configuredEngines, type AiEngine } from "@/lib/visibility/engines"
import { ProbeError, runVisibilityProbe } from "@/lib/visibility/run-probe"
import { MAX_PROMPTS_PER_RUN } from "@/lib/visibility/prompt-builder"

/** Probing 60 prompts across 4 engines is minutes of wall clock, not seconds. */
export const maxDuration = 800

interface ProbeRequest {
    auditId: string
    engines?: AiEngine[]
    maxPrompts?: number
}

function hostOf(url: string): string | null {
    try {
        return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
            .toLowerCase()
            .replace(/^www\./, "")
    } catch {
        return null
    }
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    let body: ProbeRequest
    try {
        body = (await req.json()) as ProbeRequest
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!body.auditId) {
        return NextResponse.json({ error: "auditId is required" }, { status: 400 })
    }

    const engines = body.engines?.length ? body.engines : configuredEngines()
    if (engines.length === 0) {
        return NextResponse.json(
            {
                error:
                    "No answer engine is configured. Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY or PERPLEXITY_API_KEY.",
            },
            { status: 503 },
        )
    }

    const admin = createAdminClient() as any

    const { data: audit } = await admin
        .from("topical_audits")
        .select("id, user_id, brand_id, status, input_competitors")
        .eq("id", body.auditId)
        .eq("user_id", user.id)
        .single()
    if (!audit) {
        return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    }

    const { data: brand } = await admin
        .from("brand_details")
        .select("id, product_name, website_url, product_identity, discovered_competitors")
        .eq("id", audit.brand_id)
        .single()
    if (!brand) {
        return NextResponse.json({ error: "Brand not found" }, { status: 404 })
    }

    const { data: scopeRows } = await admin
        .from("audit_scope_families")
        .select(
            "id, name, description, seed_keywords, priority, parent_scope_family_id, capability_contract",
        )
        .eq("audit_id", body.auditId)
        .eq("user_id", user.id)
        .order("priority", { ascending: true })

    if (!scopeRows?.length) {
        return NextResponse.json(
            {
                error:
                    "This audit has no confirmed business scope. Confirm scope before probing — prompts built from an unconfirmed scope measure the wrong business.",
            },
            { status: 409 },
        )
    }

    const families: AuditScopeFamily[] = scopeRows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        seedKeywords: Array.isArray(row.seed_keywords) ? row.seed_keywords : [],
        priority: row.priority ?? 0,
        parentScopeFamilyId: row.parent_scope_family_id ?? null,
        capabilityContract: row.capability_contract as CapabilityContract,
    }))

    // Competitors come from the audit's own working set — the ones that
    // actually produced readable coverage, persisted by `run-audit.ts` — so the
    // leaderboard names the same rivals the rest of the report does. Falling
    // back to `input_competitors` covers an audit whose crawl is still pending.
    const discovered: Array<{ name?: string; url?: string }> = Array.isArray(
        brand.discovered_competitors,
    )
        ? brand.discovered_competitors
        : []
    const fallback: string[] = Array.isArray(audit.input_competitors)
        ? audit.input_competitors
        : []

    const competitorSource = discovered.length
        ? discovered
        : fallback.map((url) => ({ url, name: hostOf(url) ?? url }))

    const competitors = competitorSource
        .map((competitor) => {
            const domain = hostOf(competitor.url || "")
            return {
                // No competitor table exists, so the domain is the stable
                // identity. `parseAnswer` only needs ids to be unique per run.
                id: domain ?? String(competitor.url ?? competitor.name ?? ""),
                name: competitor.name || domain || "",
                domain,
            }
        })
        .filter((competitor) => competitor.name.length > 0)

    const subjectHost = hostOf(brand.website_url || "")

    try {
        const result = await runVisibilityProbe(families, {
            userId: user.id,
            brandId: brand.id,
            auditId: body.auditId,
            subjectName: brand.product_name || subjectHost || "the brand",
            subjectDomains: subjectHost ? [subjectHost] : [],
            subjectType: brand.product_identity?.literally || "Product or service",
            competitors,
            engines,
            maxPrompts: Math.min(body.maxPrompts ?? MAX_PROMPTS_PER_RUN, MAX_PROMPTS_PER_RUN),
        })

        return NextResponse.json({
            runId: result.runId,
            publicToken: result.publicToken,
            summary: result.summary,
            engineLedger: result.engineLedger,
            promptBuildErrors: result.promptBuildErrors,
            durationMs: result.durationMs,
            clusters: result.clusters.map((cluster) => ({
                name: cluster.name,
                scopeFamilyId: cluster.scopeFamilyId,
                articleCount: cluster.articles.length,
                articles: cluster.articles.map((article) => ({
                    title: article.title,
                    mainKeyword: article.mainKeyword,
                    articleType: article.articleType,
                    sourceQueryIds: article.sourceQueryIds,
                })),
            })),
        })
    } catch (error) {
        if (error instanceof ProbeError) {
            const status = error.reason === "no_engines" ? 503 : 422
            return NextResponse.json(
                { error: error.message, reason: error.reason },
                { status },
            )
        }
        console.error("[visibility/probe] failed", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Probe failed" },
            { status: 500 },
        )
    }
}

export async function GET(req: NextRequest) {
    const runId = req.nextUrl.searchParams.get("runId")
    if (!runId) {
        return NextResponse.json({ error: "runId is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const { data: run } = await admin
        .from("ai_probe_runs")
        .select("*")
        .eq("id", runId)
        .eq("user_id", user.id)
        .single()
    if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    const { data: prompts } = await admin
        .from("ai_probe_prompts")
        .select("id, prompt, intent, article_type, verdict, answers_total, answers_present, mean_mention_position, scope_family_id")
        .eq("run_id", runId)
        .order("verdict", { ascending: true })

    return NextResponse.json({ run, prompts: prompts || [] })
}
