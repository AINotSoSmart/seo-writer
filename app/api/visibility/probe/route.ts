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
    DEFAULT_ENGINES,
    ENGINE_SPECS,
    estimateCredits,
    type AiEngine,
} from "@/lib/visibility/engines"
import {
    DEFAULT_PROMPTS_PER_RUN,
    type BuyerPrompt,
} from "@/lib/visibility/prompt-builder"
import { bindPromptsToAuditScope } from "@/lib/visibility/prompt-binding"
import {
    isSelectionClass,
    UNKNOWN_SELECTION_CLASS,
} from "@/lib/visibility/selection-class"
import { resolveLanguage, resolveRegion } from "@/lib/target-market"
import {
    decodeProbeFailureCode,
    probeFailureCopy,
} from "@/lib/visibility/failure-copy"
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
    /**
     * Rejected, not read. Kept in the type so the guard below has something to
     * name, and so nobody re-adds it as a working field.
     *
     * It used to opt this run into the provider APIs. That made engine choice a
     * browser-controlled input ten lines after the route declared engine choice
     * is "deployment configuration, never a browser-controlled input" — the
     * same rule enforced at one door and left open at the one beside it.
     */
    allowApiSurface?: never
}

/**
 * Self-hosters without a Cloro key opt into the provider APIs here, in the
 * deployment, where the other engine configuration already lives.
 *
 * WHY THIS IS NOT A REQUEST FIELD. Without it, a missing `CLORO_API_KEY` yields
 * an empty engine list and the route returns 503 before anything is created —
 * a loud, correct refusal. Read from the request body, the same missing key
 * instead produced a *successful* run on a surface that diverges from the
 * consumer app by up to 32 points. That converts a loud failure into a quiet
 * wrong answer, and because tracked questions are durable and re-run monthly,
 * the wrong answer becomes the baseline every later cycle is compared against.
 */
function apiSurfaceAllowedByDeployment(): boolean {
    return String(process.env.PROBE_ALLOW_API_SURFACE || "").trim() === "true"
}

function resolveProbeEngines(): {
    engines: AiEngine[]
    configurationError?: string
} {
    const normalEngines = configuredEngines({
        allowApiSurface: apiSurfaceAllowedByDeployment(),
    })
    const sandboxEngine = String(process.env.CLORO_SANDBOX_ENGINE || "").trim()
    if (!sandboxEngine) return { engines: normalEngines }

    // This override exists solely to exercise a deployed payment-to-batch
    // journey without buying a full two-engine baseline. Fail closed if it is
    // accidentally carried into live billing.
    if (process.env.DODO_ENVIRONMENT !== "test_mode") {
        return {
            engines: [],
            configurationError:
                "CLORO_SANDBOX_ENGINE is only allowed while DODO_ENVIRONMENT=test_mode.",
        }
    }
    if (!cloroConfigured()) {
        return {
            engines: [],
            configurationError:
                "CLORO_SANDBOX_ENGINE requires CLORO_API_KEY.",
        }
    }
    if (!DEFAULT_ENGINES.includes(sandboxEngine as AiEngine)) {
        return {
            engines: [],
            configurationError:
                "CLORO_SANDBOX_ENGINE must be chatgpt-web or google-aimode.",
        }
    }

    return { engines: [sandboxEngine as AiEngine] }
}

interface ActiveTrackedPromptRow {
    id: string
    scope_family_id: string
    prompt: string
    prompt_norm: string
    intent: BuyerPrompt["intent"]
    article_type: BuyerPrompt["articleType"]
    source_seed: string
    position: number
    selection_class: string | null
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

    // Every column here is a real column — the persona lives in `brand_data`.
    // The error is read rather than discarded for the reason documented at the
    // second lookup: a swallowed PostgREST error reads as a missing brand.
    const { data: brand, error: brandError } = await db
        .from("brand_details")
        .select("id, scope_confirmed_at, scope_contract_version, scope_hash")
        .eq("id", brandId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle()
    if (brandError) {
        console.error(`[Probe API] Could not read brand ${brandId}:`, brandError)
        return {
            ok: false,
            status: 500,
            body: {
                error: probeFailureCopy("brand_unreadable").message,
                reason: "brand_unreadable",
            },
        }
    }
    if (!brand) {
        return {
            ok: false,
            status: 404,
            body: { error: "That brand no longer exists. Start again by adding a website." },
        }
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

    // See the matching call in app/api/topical-audit/route.ts: customer audits
    // get no unauthenticated share token.
    const { data: auditId, error: createError } = await db.rpc(
        "create_customer_audit_with_scope",
        {
            p_user_id: userId,
            p_brand_id: brandId,
            p_public_token: null,
            p_policy_version: PROBE_POLICY_VERSION,
        },
    )
    if (createError || !auditId) {
        console.error("[Probe API] Could not open the audit:", createError)
        return {
            ok: false,
            status: 500,
            body: {
                error:
                    "We couldn't open an audit for this brand, so nothing was started and nothing was charged.",
                reason: "audit_open_failed",
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
    // Phase 1 moved question ownership out of browser state. Accepting a prompt
    // array here would let a caller measure a different set from the one the
    // customer confirmed, destroying month-to-month identity.
    if (
        Object.prototype.hasOwnProperty.call(body, "prompts") ||
        Object.prototype.hasOwnProperty.call(body, "maxPrompts")
    ) {
        return NextResponse.json(
            {
                error:
                    "The probe only measures the brand's saved tracked questions. Confirm the generated question set before starting it.",
                reason: "client_prompts_forbidden",
            },
            { status: 400 },
        )
    }

    // Engine choice changes both the evidence contract and provider spend. It
    // is deployment configuration, never a browser-controlled input.
    // `allowApiSurface` sits here beside `engines` because it does the same
    // thing: it changes which engines run. Blocking one and reading the other
    // made the rule above false.
    for (const forbidden of ["engines", "allowApiSurface"] as const) {
        if (Object.prototype.hasOwnProperty.call(body, forbidden)) {
            return NextResponse.json(
                {
                    error: "Answer engines are configured by the service.",
                    reason: "client_engines_forbidden",
                },
                { status: 400 },
            )
        }
    }

    const engineConfiguration = resolveProbeEngines()
    const engines = engineConfiguration.engines

    if (engineConfiguration.configurationError) {
        return NextResponse.json(
            {
                error: engineConfiguration.configurationError,
                reason: "invalid_engine_configuration",
            },
            { status: 503 },
        )
    }

    // Checked before anything is created. An unconfigured engine must not leave
    // an open audit row behind that blocks the next attempt.
    if (engines.length === 0) {
        return NextResponse.json(
            {
                error: cloroConfigured()
                    ? "No answer engine was selected for this run."
                    : probeFailureCopy("no_engines").message,
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

    /**
     * `brand_details` stores the persona inside `brand_data` (jsonb). It has no
     * `product_name` or `product_identity` column, and this select used to ask
     * for both — PostgREST rejected the whole query, the error was discarded,
     * and `!brand` surfaced to the customer as "Brand not found" on a brand that
     * was sitting in the table. The error is now read and logged, so the next
     * schema mistake reports itself instead of impersonating a missing record.
     */
    const { data: brand, error: brandError } = await admin
        .from("brand_details")
        .select("id, website_url, discovered_competitors, brand_data")
        .eq("id", audit.brand_id)
        .single()
    if (brandError || !brand) {
        console.error(
            `[Probe API] Could not load brand ${audit.brand_id}:`,
            brandError,
        )
        if (openedAuditHere) {
            await failAuditRun(
                admin,
                auditId,
                "brand_unreadable",
                `The brand record could not be read: ${brandError?.message ?? "no row returned"}`,
            )
        }
        return NextResponse.json(
            {
                error: brandError
                    ? probeFailureCopy("brand_unreadable").message
                    : "That brand no longer exists. Start again by adding a website.",
                reason: brandError ? "brand_unreadable" : "brand_missing",
            },
            { status: brandError ? 500 : 404 },
        )
    }

    const brandData = (brand.brand_data ?? {}) as {
        product_name?: string
        product_identity?: { literally?: string }
        target_region?: string
        target_language?: string
    }
    const subjectName = brandData.product_name?.trim() || ""

    /**
     * The market the answers are asked from.
     *
     * Cloro takes a country per request and `buildCloroPayload` falls back to
     * `"US"`, so until this was read every probe measured the United States
     * whoever the customer was — the parameter was plumbed the whole way and
     * simply never set. Not to be confused with `search_country`, which is the
     * Tavily research locale and a different question.
     */
    const countryCode = resolveRegion(brandData.target_region)

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

    const { data: trackedRows, error: trackedError } = await admin
        .from("tracked_prompts")
        .select(
            "id, scope_family_id, prompt, prompt_norm, intent, article_type, source_seed, position, selection_class",
        )
        .eq("brand_id", brand.id)
        .eq("user_id", user.id)
        .eq("tracking_status", "active")
        .order("position", { ascending: true })

    if (
        trackedError ||
        !trackedRows?.length ||
        trackedRows.length > DEFAULT_PROMPTS_PER_RUN
    ) {
        if (openedAuditHere) {
            await failAuditRun(
                admin,
                auditId,
                "tracked_prompts_incomplete",
                `Expected 1-${DEFAULT_PROMPTS_PER_RUN} active tracked questions; found ${trackedRows?.length ?? 0}.`,
            )
        }
        console.error("[Probe API] Could not load the durable tracked set:", trackedError)
        return NextResponse.json(
            {
                error:
                    `Confirm up to ${DEFAULT_PROMPTS_PER_RUN} tracked buyer questions before starting the measurement.`,
                reason: "tracked_prompts_incomplete",
            },
            { status: 409 },
        )
    }

    // The launch funnel is paid-first. Client routing is not an authorization
    // boundary: old onboarding tabs and direct requests must not spend Cloro
    // credits before Dodo has activated the subscription.
    const { data: paidSubscription } = await supabase
        .from("dodo_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()
    if (!paidSubscription) {
        return NextResponse.json(
            {
                error: "An active subscription is required before measurement starts.",
                reason: "subscription_required",
            },
            { status: 402 },
        )
    }

    /**
     * Durable questions reference brand scope. Each run observes the same
     * question against its immutable audit-scope snapshot, so only the family
     * id changes; trackedPromptId remains stable across every cycle.
     */
    const durablePrompts: BuyerPrompt[] = (trackedRows as ActiveTrackedPromptRow[]).map(
        (row) => ({
            trackedPromptId: row.id,
            text: row.prompt,
            textNorm: row.prompt_norm,
            scopeFamilyId: row.scope_family_id,
            intent: row.intent,
            articleType: row.article_type,
            // The class the question was classified under when confirmed. A run
            // keeps the class it was measured with, so reclassifying a question
            // later cannot retroactively move an old run between denominators.
            selectionClass: isSelectionClass(row.selection_class)
                ? row.selection_class
                : UNKNOWN_SELECTION_CLASS,
            sourceSeed: row.source_seed,
        }),
    )
    const { bound: confirmedPrompts, unbound } = bindPromptsToAuditScope(
        durablePrompts,
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
                "Tracked questions could not be matched to the audit's confirmed product areas.",
            )
        }
        return NextResponse.json(
            {
                error:
                    `${unbound.length} tracked question${unbound.length === 1 ? "" : "s"} no longer matches the confirmed product areas, so the run was not started. Review the tracked questions and try again.`,
                reason: "unbound_prompts",
                unboundPrompts: unbound.map((prompt) => prompt.text),
            },
            { status: 409 },
        )
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
    const now = new Date().toISOString()
    const { data: cycle, error: cycleError } = await admin
        .from("subscription_cycles")
        .select("id")
        .eq("user_id", user.id)
        .eq("brand_id", brand.id)
        .eq("state", "pending")
        .not("billing_grant_id", "is", null)
        .lte("period_start", now)
        .gt("period_end", now)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle()
    if (cycleError || !cycle) {
        if (openedAuditHere) {
            await failAuditRun(
                admin,
                auditId,
                "probe_run_not_created",
                `No current unclaimed subscription cycle was available: ${cycleError?.message ?? "none found"}`,
            )
        }
        console.error("[Probe API] No current unclaimed subscription cycle:", cycleError)
        return NextResponse.json(
            {
                error:
                    "No current delivery cycle is ready for measurement. If payment just completed, wait for the subscription renewal event and try again.",
                reason: "cycle_not_ready",
            },
            { status: 409 },
        )
    }

    const { data: runId, error: runError } = await admin.rpc(
        "begin_subscription_cycle_measurement",
        {
            p_cycle_id: cycle.id,
            p_user_id: user.id,
            p_brand_id: brand.id,
            p_audit_id: auditId,
            p_subject_name: subjectName || subjectHost || "the brand",
            p_subject_domains: subjectHost ? [subjectHost] : [],
            p_competitors: competitors,
            p_engines: engines,
            p_country_code: countryCode,
        },
    )
    if (runError || typeof runId !== "string" || !runId) {
        if (openedAuditHere) {
            await failAuditRun(
                admin,
                auditId,
                "probe_run_not_created",
                `Could not claim the subscription cycle: ${runError?.message ?? "no run id returned"}`,
            )
        }
        console.error("[Probe API] Could not claim subscription cycle:", runError)
        return NextResponse.json(
            { error: probeFailureCopy("queue_failed").message, reason: "queue_failed" },
            { status: 409 },
        )
    }

    try {
        const handle = await tasks.trigger<typeof runProbeTask>("run-visibility-probe", {
            runId,
            userId: user.id,
            brandId: brand.id,
            auditId,
            subjectName: subjectName || subjectHost || "the brand",
            subjectDomains: subjectHost ? [subjectHost] : [],
            subjectType: brandData.product_identity?.literally || "Product or service",
            competitors,
            families,
            engines,
            countryCode,
            language: resolveLanguage(brandData.target_language),
            maxPrompts: confirmedPrompts.length,
            prompts: confirmedPrompts,
        })

        await admin
            .from("ai_probe_runs")
            .update({ trigger_run_id: handle.id })
            .eq("id", runId)

        return NextResponse.json(
            {
                runId,
                auditId,
                engines: engines.map((engine) => ({
                    id: engine,
                    label: ENGINE_SPECS[engine].label,
                    surface: ENGINE_SPECS[engine].surface,
                })),
                estimatedCredits: estimateCredits(
                    confirmedPrompts.length,
                    engines,
                ),
                maxPrompts: confirmedPrompts.length,
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
            .eq("id", runId)
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
            { error: probeFailureCopy("queue_failed").message, reason: "queue_failed" },
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

    /**
     * `phase_detail` is two different things depending on status.
     *
     * While running it is progress the customer benefits from seeing — "20
     * queued", "10 prompts x 2 engines" — written by the phase reporter. On
     * failure the same column carries the tagged exception text, which must not
     * leave the server. So it is forwarded during a run and withheld on
     * failure, where the client gets the code and the customer-safe sentence
     * already stored in `failure_reason`.
     */
    const { phase_detail: phaseDetail, ...rest } = run
    const failed = run.status === "failed"
    const failureCode = failed ? decodeProbeFailureCode(phaseDetail) : null
    return NextResponse.json({
        ...rest,
        phase_detail: failed ? null : phaseDetail,
        failureCode,
        retryable: failureCode ? probeFailureCopy(failureCode).retryable : true,
        stale,
    })
}
