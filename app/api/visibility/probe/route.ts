/**
 * POST /api/visibility/probe   — enqueue a probe, return a run id to poll.
 * GET  /api/visibility/probe?runId=… — run status and progress.
 *
 * The route does not run the probe. Cloro is an async queue and one task can
 * take minutes, so the work belongs to `trigger/run-probe.ts`; this creates the
 * run row (so the client has something to watch immediately) and hands it off.
 *
 * The probe reads the audit's *confirmed* scope families, which is what keeps
 * it honest: prompts measure the business the customer confirmed, not one a
 * model inferred from the homepage.
 */

import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@trigger.dev/sdk/v3"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import type { CapabilityContract } from "@/lib/writer/article-contract"
import {
    cloroConfigured,
    configuredEngines,
    ENGINE_SPECS,
    estimateCredits,
    type AiEngine,
} from "@/lib/visibility/engines"
import { MAX_PROMPTS_PER_RUN } from "@/lib/visibility/prompt-builder"
import type { runProbeTask } from "@/trigger/run-probe"

export const maxDuration = 60

/** A run with no writer for this long is abandoned, not slow. */
const PROBE_STALE_AFTER_MINUTES = 45

interface ProbeRequest {
    auditId: string
    engines?: AiEngine[]
    maxPrompts?: number
    /**
     * Opt in to the provider APIs when no Cloro key exists. Off by default:
     * the API surface diverges from the consumer app by up to 32 points, so
     * silently falling back to it would quietly replace the measurement the
     * customer is paying for with a materially different one.
     */
    allowApiSurface?: boolean
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

    const engines = body.engines?.length
        ? body.engines
        : configuredEngines({ allowApiSurface: body.allowApiSurface })

    if (engines.length === 0) {
        return NextResponse.json(
            {
                error: cloroConfigured()
                    ? "No engine selected."
                    : "CLORO_API_KEY is not configured. Cloro drives the real ChatGPT and Google AI Mode answers; the provider APIs measure a different surface and are opt-in via allowApiSurface.",
                reason: "no_engines",
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

    // One live probe per audit. Two concurrent runs would bill Cloro twice for
    // the same measurement and race each other's cluster plan.
    const { data: live } = await admin
        .from("ai_probe_runs")
        .select("id, started_at")
        .eq("audit_id", body.auditId)
        .eq("status", "running")
        .gte(
            "started_at",
            new Date(Date.now() - PROBE_STALE_AFTER_MINUTES * 60_000).toISOString(),
        )
        .maybeSingle()
    if (live) {
        return NextResponse.json(
            { runId: live.id, alreadyRunning: true },
            { status: 202 },
        )
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
                reason: "no_scope",
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
    // produced readable coverage, persisted by `run-audit.ts` — so the
    // leaderboard names the same rivals the rest of the report does.
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
                id: domain ?? String(competitor.url ?? competitor.name ?? ""),
                name: competitor.name || domain || "",
                domain,
            }
        })
        .filter((competitor) => competitor.name.length > 0)

    const subjectHost = hostOf(brand.website_url || "")
    const maxPrompts = Math.min(body.maxPrompts ?? MAX_PROMPTS_PER_RUN, MAX_PROMPTS_PER_RUN)

    const { data: run, error: runError } = await admin
        .from("ai_probe_runs")
        .insert({
            user_id: user.id,
            brand_id: brand.id,
            audit_id: body.auditId,
            subject_name: brand.product_name || subjectHost || "the brand",
            subject_domains: subjectHost ? [subjectHost] : [],
            competitors,
            engines,
            status: "running",
            phase: "queued",
        })
        .select("id, public_token")
        .single()
    if (runError || !run) {
        return NextResponse.json(
            { error: `Could not open a probe run: ${runError?.message ?? "unknown"}` },
            { status: 500 },
        )
    }

    try {
        const handle = await tasks.trigger<typeof runProbeTask>("run-visibility-probe", {
            runId: run.id,
            userId: user.id,
            brandId: brand.id,
            auditId: body.auditId,
            subjectName: brand.product_name || subjectHost || "the brand",
            subjectDomains: subjectHost ? [subjectHost] : [],
            subjectType: brand.product_identity?.literally || "Product or service",
            competitors,
            families,
            engines,
            maxPrompts,
        })

        await admin
            .from("ai_probe_runs")
            .update({ trigger_run_id: handle.id })
            .eq("id", run.id)

        return NextResponse.json(
            {
                runId: run.id,
                publicToken: run.public_token,
                engines: engines.map((engine) => ({
                    id: engine,
                    label: ENGINE_SPECS[engine].label,
                    surface: ENGINE_SPECS[engine].surface,
                })),
                estimatedCredits: estimateCredits(maxPrompts, engines),
                maxPrompts,
            },
            { status: 202 },
        )
    } catch (error) {
        await admin
            .from("ai_probe_runs")
            .update({
                status: "failed",
                failure_reason: `Could not enqueue: ${error instanceof Error ? error.message : String(error)}`,
                completed_at: new Date().toISOString(),
            })
            .eq("id", run.id)
        return NextResponse.json(
            { error: "Could not enqueue the probe." },
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
        .select(
            "id, status, phase, phase_detail, failure_reason, prompt_count, answer_count, gap_prompt_count, credits_used, engine_ledger, started_at, completed_at, duration_ms",
        )
        .eq("id", runId)
        .eq("user_id", user.id)
        .single()
    if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    // A Trigger job that never started must not show a loader forever — the
    // same failure the audit path hit before it grew an abandonment rule.
    const stale =
        run.status === "running" &&
        Date.now() - new Date(run.started_at).getTime() >
            PROBE_STALE_AFTER_MINUTES * 60_000

    return NextResponse.json({ ...run, stale })
}
