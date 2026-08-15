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
 *
 * ## Two ways in
 *
 * `auditId` probes an audit that already exists — a re-run from the dashboard.
 *
 * `brandId` is the onboarding path, and it opens the audit itself. Onboarding
 * has a confirmed brand and confirmed prompts but no audit record, and the old
 * answer — run the Google harvest to get one — meant the questions the customer
 * had just reviewed were never asked. `create_customer_audit_with_scope` is the
 * whole bridge: it writes the `topical_audits` row and freezes
 * `brand_scope_families` into `audit_scope_families` in one transaction, and it
 * does not start the harvest (the old route triggers that separately). The
 * probe then finalizes the same row through `finalize_audit_run`, so a
 * visibility run produces a normal completed audit that `/audit` and
 * `/content-plan` already know how to read.
 */

import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@trigger.dev/sdk/v3"
import { randomBytes } from "crypto"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import {
    auditRetryState,
    failAuditRun,
    reclaimStaleAuditRuns,
} from "@/lib/audit/run-guards"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import type { CapabilityContract } from "@/lib/writer/article-contract"
import {
    cloroConfigured,
    configuredEngines,
    ENGINE_SPECS,
    estimateCredits,
    type AiEngine,
} from "@/lib/visibility/engines"
import {
    DEFAULT_PROMPTS_PER_RUN,
    MAX_PROMPTS_PER_RUN,
} from "@/lib/visibility/prompt-builder"
import { bindPromptsToAuditScope } from "@/lib/visibility/prompt-binding"
import type { runProbeTask } from "@/trigger/run-probe"

export const maxDuration = 60

/** A run with no writer for this long is abandoned, not slow. */
const PROBE_STALE_AFTER_MINUTES = 45

/**
 * Recorded on the audit row this route opens. `finalize_audit_run` overwrites
 * it with the same value, so the policy version of a visibility audit reads the
 * same whether it is inspected mid-run or after.
 */
const PROBE_POLICY_VERSION = "ai-probe-v1.0.0"

interface ProbeRequest {
    /** Probe an existing audit. Either this or `brandId` is required. */
    auditId?: string
    /** Open a fresh audit from the brand's confirmed scope, then probe it. */
    brandId?: string
    engines?: AiEngine[]
    maxPrompts?: number
    /** User-confirmed buyer prompts. If omitted, prompts will be built from scope families. */
    prompts?: import("@/lib/visibility/prompt-builder").BuyerPrompt[]
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

/**
 * Opens the audit an onboarding probe will write into.
 *
 * Reuses a `running` row whose scope still matches rather than creating a
 * second one: `create_customer_audit_with_scope` refuses outright while one
 * exists, so without this a probe that failed to enqueue would lock the brand
 * out of every audit path — Google harvest included — until the stale sweep
 * caught up 40 minutes later.
 */
async function openAuditForBrand(
    db: any,
    userId: string,
    brandId: string,
): Promise<
    | { ok: true; auditId: string; opened: boolean }
    | { ok: false; status: number; body: Record<string, unknown> }
> {
    const { error: readinessError } = await db.rpc("assert_harvest_schema_ready")
    if (readinessError) {
        console.error("[Probe API] Database contract is not ready:", readinessError)
        return {
            ok: false,
            status: 503,
            body: {
                error:
                    "The audit service is temporarily unavailable while its database is being updated. No probe was started.",
            },
        }
    }

    const { data: brand } = await db
        .from("brand_details")
        .select("id, scope_confirmed_at, scope_contract_version, scope_hash")
        .eq("id", brandId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle()
    if (!brand) {
        return { ok: false, status: 404, body: { error: "Brand not found" } }
    }

    if (!brand.scope_confirmed_at || !brand.scope_hash) {
        return {
            ok: false,
            status: 422,
            body: {
                error:
                    "Confirm the product and service areas before probing. Prompts built from an unconfirmed scope measure the wrong business.",
                reason: "no_scope",
            },
        }
    }
    if (brand.scope_contract_version !== "confirmed-business-scope-v2") {
        return {
            ok: false,
            status: 409,
            body: {
                error:
                    "Your saved product-area review predates verified business mechanics. Review and confirm it once before probing.",
                reason: "stale_scope_contract",
            },
        }
    }

    // A run the worker never picked up must become a retryable failure before
    // anything here reads or creates.
    await reclaimStaleAuditRuns(db, userId, brandId)

    const { data: running } = await db
        .from("topical_audits")
        .select("id, scope_hash")
        .eq("user_id", userId)
        .eq("brand_id", brandId)
        .eq("run_status", "running")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (running?.id) {
        // Same brand, same confirmed scope, no results yet: adopt it. A
        // mismatched hash would fail at finalize with "Brand scope changed
        // while the audit was running", so close it now with a reason rather
        // than 40 minutes from now with a cryptic one.
        if (running.scope_hash === brand.scope_hash) {
            return { ok: true, auditId: running.id, opened: false }
        }
        await failAuditRun(
            db,
            running.id,
            "scope_changed",
            "The confirmed product areas changed while this audit was open, so it was closed without results. Nothing was charged.",
        )
    }

    // Repeated failures must not become repeated Cloro credits. Shared with the
    // harvest route so one brand has one budget, not one per entry point.
    const retry = await auditRetryState(db, userId, brandId)
    if (retry.retryBlocked) {
        return {
            ok: false,
            status: 429,
            body: {
                error:
                    "This audit has failed several times. We have stopped retrying so it cannot keep consuming resources. Email support@flipaeo.com and we will look at the run.",
                ...retry,
            },
        }
    }
    if (retry.retryAfterSeconds > 0) {
        return {
            ok: false,
            status: 429,
            body: {
                error: `A previous audit failed. You can try again in ${Math.ceil(retry.retryAfterSeconds / 60)} minute(s).`,
                ...retry,
            },
        }
    }

    const { data: auditId, error: createError } = await db.rpc(
        "create_customer_audit_with_scope",
        {
            p_user_id: userId,
            p_brand_id: brandId,
            p_public_token: randomBytes(24).toString("hex"),
            p_policy_version: PROBE_POLICY_VERSION,
        },
    )
    if (createError || !auditId) {
        console.error("[Probe API] Could not open the audit:", createError)
        return {
            ok: false,
            status: 500,
            body: {
                error: `Could not open an audit for this brand: ${createError?.message ?? "unknown error"}`,
            },
        }
    }

    // The RPC is shared with the harvest, so it opens on that pipeline's first
    // phase. A visibility run never does competitor discovery; say what is
    // actually happening, or the audit row narrates a pipeline that is not
    // running.
    await db
        .from("topical_audits")
        .update({ generation_phase: "probing_ai_answers", updated_at: new Date().toISOString() })
        .eq("id", auditId)

    return { ok: true, auditId: String(auditId), opened: true }
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
    if (!body.auditId && !body.brandId) {
        return NextResponse.json(
            { error: "auditId or brandId is required" },
            { status: 400 },
        )
    }
    // An omitted `prompts` means "build them from the confirmed scope"; an empty
    // array means the caller confirmed nothing, and quietly generating a set
    // nobody reviewed is the exact substitution this endpoint exists to stop.
    if (Array.isArray(body.prompts) && body.prompts.length === 0) {
        return NextResponse.json(
            {
                error:
                    "Confirm at least one buyer question before probing. An empty confirmation cannot be replaced with questions nobody reviewed.",
                reason: "no_prompts",
            },
            { status: 400 },
        )
    }

    const engines = body.engines?.length
        ? body.engines
        : configuredEngines({ allowApiSurface: body.allowApiSurface })

    // Checked before anything is created. An unconfigured engine must not leave
    // an open audit row behind that blocks the next attempt.
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

    // Resolve the audit — adopted, or opened here from the confirmed brand.
    let auditId: string
    let openedAuditHere = false
    if (body.auditId) {
        auditId = body.auditId
    } else {
        const opened = await openAuditForBrand(admin, user.id, body.brandId!)
        if (!opened.ok) {
            return NextResponse.json(opened.body, { status: opened.status })
        }
        auditId = opened.auditId
        openedAuditHere = opened.opened
    }

    const { data: audit } = await admin
        .from("topical_audits")
        .select("id, user_id, brand_id, input_competitors")
        .eq("id", auditId)
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
        .eq("audit_id", auditId)
        .eq("status", "running")
        .gte(
            "started_at",
            new Date(Date.now() - PROBE_STALE_AFTER_MINUTES * 60_000).toISOString(),
        )
        .maybeSingle()
    if (live) {
        return NextResponse.json(
            { runId: live.id, auditId, alreadyRunning: true },
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
            "id, brand_scope_family_id, name, description, seed_keywords, priority, parent_scope_family_id, capability_contract",
        )
        .eq("audit_id", auditId)
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

    /**
     * Confirmed prompts arrive carrying whatever id the onboarding screen had —
     * a brand family uuid, a `family-1` placeholder, or the family's name — and
     * none of those is the `audit_scope_families.id` the persistence path
     * requires. Rebinding here is what makes the confirmed questions reach the
     * delivery tables; without it every gap is rejected by `finalize_audit_run`
     * inside a catch, and the run reports success having written nothing.
     */
    let confirmedPrompts = body.prompts
    if (confirmedPrompts?.length) {
        const { bound, unbound } = bindPromptsToAuditScope(
            confirmedPrompts,
            scopeRows.map((row: any) => ({
                id: row.id,
                brandScopeFamilyId: row.brand_scope_family_id ?? null,
                name: row.name,
                seedKeywords: Array.isArray(row.seed_keywords) ? row.seed_keywords : [],
            })),
        )
        if (unbound.length > 0) {
            if (openedAuditHere) {
                await failAuditRun(
                    admin,
                    auditId,
                    "prompts_unbound",
                    "Confirmed questions could not be matched to the confirmed product areas.",
                )
            }
            return NextResponse.json(
                {
                    error:
                        `${unbound.length} confirmed question${unbound.length === 1 ? "" : "s"} could not be matched to a confirmed product area, so the run was not started. Regenerate the questions for those areas and try again.`,
                    reason: "unbound_prompts",
                    unboundPrompts: unbound.map((prompt) => prompt.text),
                },
                { status: 409 },
            )
        }
        confirmedPrompts = bound
    }

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
    // Default small, ceiling high: a caller can ask for more once the questions
    // have been eyeballed, but an omitted field never spends 60 prompts' worth
    // of credits by accident.
    const maxPrompts = Math.min(
        body.maxPrompts ?? DEFAULT_PROMPTS_PER_RUN,
        MAX_PROMPTS_PER_RUN,
    )

    const { data: run, error: runError } = await admin
        .from("ai_probe_runs")
        .insert({
            user_id: user.id,
            brand_id: brand.id,
            audit_id: auditId,
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
        if (openedAuditHere) {
            await failAuditRun(
                admin,
                auditId,
                "probe_run_not_created",
                `Could not open a probe run: ${runError?.message ?? "unknown"}`,
            )
        }
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
            auditId,
            subjectName: brand.product_name || subjectHost || "the brand",
            subjectDomains: subjectHost ? [subjectHost] : [],
            subjectType: brand.product_identity?.literally || "Product or service",
            competitors,
            families,
            engines,
            maxPrompts,
            prompts: confirmedPrompts,
        })

        await admin
            .from("ai_probe_runs")
            .update({ trigger_run_id: handle.id })
            .eq("id", run.id)

        return NextResponse.json(
            {
                runId: run.id,
                auditId,
                publicToken: run.public_token,
                engines: engines.map((engine) => ({
                    id: engine,
                    label: ENGINE_SPECS[engine].label,
                    surface: ENGINE_SPECS[engine].surface,
                })),
                estimatedCredits: estimateCredits(
                    confirmedPrompts?.length || maxPrompts,
                    engines,
                ),
                maxPrompts,
            },
            { status: 202 },
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await admin
            .from("ai_probe_runs")
            .update({
                status: "failed",
                failure_reason: `Could not enqueue: ${message}`,
                completed_at: new Date().toISOString(),
            })
            .eq("id", run.id)
        // An audit opened for a probe that never enqueued would otherwise stay
        // `running` and block every audit path for this brand.
        if (openedAuditHere) {
            await failAuditRun(
                admin,
                auditId,
                "queue_failed",
                `The probe could not be queued: ${message}`,
            )
        }
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
            "id, audit_id, status, phase, phase_detail, failure_reason, prompt_count, answer_count, gap_prompt_count, credits_used, engine_ledger, started_at, completed_at, duration_ms",
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
