import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { tasks } from "@trigger.dev/sdk/v3"
import type { runAuditTask } from "@/trigger/run-audit"
import { randomBytes } from "crypto"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import { createAdminClient } from "@/utils/supabase/admin"

// ============================================================
// Topical Audit API — Thin trigger + GET status endpoint
// All heavy logic is in trigger/run-audit.ts
// ============================================================

/**
 * A failed audit may be retried, but not on every page refresh. The crawl and
 * search work behind one run is the expensive part of the product, and a failed
 * run is neither `running` nor `completed` — so without a cooldown each refresh
 * silently started a new one.
 */
const AUDIT_RETRY_COOLDOWN_MINUTES = 15
const MAX_FAILURES_PER_COOLDOWN = 3

/**
 * A run older than this cannot still be alive: `runAuditTask` has
 * `maxDuration: 900` (15 minutes), so 20 gives generous headroom.
 */
const AUDIT_STALE_AFTER_MINUTES = 20

/**
 * Marks abandoned `running` rows as failed.
 *
 * A row is only advanced by the Trigger task itself, so if the task never
 * executes — a hard cancel, an OOM kill, a worker that never picked the run up,
 * or a `TRIGGER_SECRET_KEY` pointing at a different environment — the row stays
 * `running` forever. That was a permanent dead end: GET reported "running" so
 * the UI span an endless loader, and POST answered "Audit already running" so
 * the customer could never retry.
 *
 * Runs before every read and every trigger, so the stuck state self-heals into
 * a retryable failure instead of needing manual database surgery.
 */
async function reclaimStaleRuns(db: any, userId: string, brandId: string): Promise<number> {
    const staleBefore = new Date(
        Date.now() - AUDIT_STALE_AFTER_MINUTES * 60 * 1000,
    ).toISOString()

    const { data: reclaimed } = await db
        .from("topical_audits")
        .update({
            run_status: "failed",
            generation_status: "failed",
            generation_phase: null,
            failure_code: "worker_never_ran",
            generation_error:
                "The audit did not start within the expected time and was stopped. " +
                "No work was completed and nothing was charged.",
            failed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("brand_id", brandId)
        .eq("run_status", "running")
        .lt("started_at", staleBefore)
        .select("id")

    const count = reclaimed?.length || 0
    if (count > 0) {
        console.warn(
            `[Audit API] Reclaimed ${count} stale run(s) for brand ${brandId} — ` +
            `the background worker never advanced them.`,
        )
    }
    return count
}

type RetryState = {
    retryAfterSeconds: number
    attemptsRemaining: number
    retryBlocked: boolean
}

/**
 * Retry budget for a brand's recent failed audits.
 *
 * GET and POST both derive from this so the countdown a customer sees is the
 * same rule the endpoint enforces — a UI that offers a retry the server will
 * reject is worse than no button at all.
 */
async function retryState(db: any, userId: string, brandId: string): Promise<RetryState> {
    const cooldownAfter = new Date(
        Date.now() - AUDIT_RETRY_COOLDOWN_MINUTES * 60 * 1000,
    ).toISOString()

    const { data: failures } = await db
        .from("topical_audits")
        .select("created_at")
        .eq("user_id", userId)
        .eq("brand_id", brandId)
        .eq("audit_kind", "customer")
        .eq("run_status", "failed")
        .gte("created_at", cooldownAfter)
        .order("created_at", { ascending: false })

    const count = failures?.length || 0
    if (count === 0) {
        return {
            retryAfterSeconds: 0,
            attemptsRemaining: MAX_FAILURES_PER_COOLDOWN,
            retryBlocked: false,
        }
    }

    const readyAt =
        new Date(failures[0].created_at).getTime() +
        AUDIT_RETRY_COOLDOWN_MINUTES * 60 * 1000

    return {
        retryAfterSeconds: Math.max(0, Math.ceil((readyAt - Date.now()) / 1000)),
        attemptsRemaining: Math.max(0, MAX_FAILURES_PER_COOLDOWN - count),
        retryBlocked: count >= MAX_FAILURES_PER_COOLDOWN,
    }
}

/**
 * POST — Trigger a new audit
 * Creates/upserts the audit row, then triggers the background task
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { brandId } = await req.json()

        if (!brandId) {
            return NextResponse.json({ error: "Brand ID required" }, { status: 400 })
        }

        // Authentication is checked with the request client; immutable run
        // creation/mutation is service-side only.
        const db = createAdminClient() as any

        // Fail before reading scope-specific columns or spending on research.
        const { error: readinessError } = await db.rpc(
            "assert_harvest_schema_ready",
        )
        if (readinessError) {
            console.error("[Audit API] Database contract is not ready:", readinessError)
            return NextResponse.json(
                {
                    error:
                        "The audit service is temporarily unavailable while its database is being updated. No audit was started.",
                },
                { status: 503 },
            )
        }

        const { data: brand, error: brandError } = await db
            .from("brand_details")
            .select(
                "id, website_url, brand_data, discovered_competitors, scope_confirmed_at, scope_contract_version, scope_hash",
            )
            .eq("id", brandId)
            .eq("user_id", user.id)
            .single()
        if (brandError || !brand) {
            return NextResponse.json({ error: "Brand not found" }, { status: 404 })
        }

        const brandData = brand.brand_data
        const brandUrl = brand.website_url
        const { data: scopeFamilies, error: scopeError } = await db
            .from("brand_scope_families")
            .select(
                "id, name, description, seed_keywords, evidence, source, priority",
            )
            .eq("brand_id", brandId)
            .eq("user_id", user.id)
            .eq("enabled", true)
            .order("priority", { ascending: true })

        if (
            scopeError ||
            !brand.scope_confirmed_at ||
            !brand.scope_hash ||
            !Array.isArray(scopeFamilies) ||
            scopeFamilies.length === 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "Confirm the product and service areas before running the audit. No research was started.",
                },
                { status: 422 },
            )
        }
        // One immutable run may execute per brand at a time.
        // Clear abandoned runs first, otherwise a dead row blocks every retry.
        await reclaimStaleRuns(db, user.id, brandId)

        const { data: existing } = await db
            .from("topical_audits")
            .select("id")
            .eq("user_id", user.id)
            .eq("brand_id", brandId)
            .eq("run_status", "running")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existing?.id) {
            return NextResponse.json({
                message: "Audit already running",
                status: "running",
                auditId: existing.id,
            })
        }

        // The evidence audit is free, but the external crawl/search work is
        // expensive. Reuse a still-current completed run instead of allowing
        // repeated POSTs (including crafted requests) to burn the same cost.
        // This matches the checkout freshness window: after 30 days a fresh
        // immutable run may be created.
        const freshAfter = new Date(
            Date.now() - HARVEST_POLICY.checkoutFreshnessDays * 24 * 60 * 60 * 1000,
        ).toISOString()
        const { data: recentCompletedCandidates } = await db
            .from("topical_audits")
            .select("id, input_competitors")
            .eq("user_id", user.id)
            .eq("brand_id", brandId)
            .eq("audit_kind", "customer")
            .eq("run_status", "completed")
            .eq("requires_reaudit", false)
            .eq("scope_hash", brand.scope_hash)
            .eq("subject_url", brandUrl)
            .gte("completed_at", freshAfter)
            .order("completed_at", { ascending: false })
            .limit(20)

        const normalizeCompetitorSet = (values: unknown): string[] =>
            (Array.isArray(values) ? values : [])
                .map((value: any) =>
                    typeof value === "string" ? value : value?.url,
                )
                .filter((value: unknown): value is string => Boolean(value))
                .map((value) => {
                    try {
                        return new URL(value).hostname
                            .toLowerCase()
                            .replace(/^www\./, "")
                    } catch {
                        return value.toLowerCase()
                    }
                })
                .sort()
        const configuredCompetitors = normalizeCompetitorSet(
            brand.discovered_competitors,
        )
        const recentCompleted = (recentCompletedCandidates || []).find(
            (candidate: any) =>
                JSON.stringify(
                    normalizeCompetitorSet(candidate.input_competitors),
                ) === JSON.stringify(configuredCompetitors),
        )

        if (recentCompleted?.id) {
            return NextResponse.json({
                message: "Your current evidence audit is still valid",
                status: "completed",
                auditId: recentCompleted.id,
                reused: true,
            })
        }

        // Repeated failures must not become a repeated bill. A failed audit is
        // neither `running` nor `completed`, so without this guard every retry —
        // including an automatic one from a page refresh — created a new row and
        // ran the full crawl/search pipeline again, unbounded.
        const retry = await retryState(db, user.id, brandId)

        if (retry.retryBlocked) {
            return NextResponse.json(
                {
                    error:
                        "This audit has failed several times. We have stopped retrying so it cannot " +
                        "keep consuming resources. Email support@flipaeo.com and we will look at the run.",
                    status: "failed",
                    ...retry,
                },
                { status: 429 },
            )
        }

        if (retry.retryAfterSeconds > 0) {
            return NextResponse.json(
                {
                    error: `A previous audit failed. You can try again in ${Math.ceil(retry.retryAfterSeconds / 60)} minute(s).`,
                    status: "failed",
                    ...retry,
                },
                {
                    status: 429,
                    headers: { "Retry-After": String(retry.retryAfterSeconds) },
                },
            )
        }

        const publicToken = randomBytes(24).toString("hex")
        const { data: auditId, error: insertError } = await db.rpc(
            "create_customer_audit_with_scope",
            {
                p_user_id: user.id,
                p_brand_id: brandId,
                p_public_token: publicToken,
                p_policy_version: HARVEST_POLICY.version,
            },
        )

        if (insertError || !auditId) {
            console.error("[Audit API] Insert failed:", insertError)
            throw new Error(`Failed to create audit record: ${insertError?.message || "unknown error"}`)
        }

        // Trigger the background task
        let handle
        try {
            handle = await tasks.trigger<typeof runAuditTask>("run-topical-audit", {
                userId: user.id,
                brandId,
                brandData,
                brandUrl,
                auditId,
            })
        } catch (queueError) {
            await db
                .from("topical_audits")
                .update({
                    run_status: "failed",
                    generation_status: "failed",
                    generation_phase: null,
                    failure_code: "queue_failed",
                    generation_error:
                        queueError instanceof Error
                            ? queueError.message
                            : "Audit queue failed",
                    failed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", auditId)
                .eq("user_id", user.id)
            throw queueError
        }

        console.log(`[Audit API] Triggered audit task: ${handle.id}`)

        return NextResponse.json({
            message: "Audit started",
            status: "running",
            taskId: handle.id,
            auditId,
        })

    } catch (error: any) {
        console.error("[Audit API] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * GET — Poll audit status + partial results
 * Frontend polls this every 3s during audit
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const brandId = req.nextUrl.searchParams.get("brandId")
        if (!brandId) {
            return NextResponse.json({ error: "brandId required" }, { status: 400 })
        }

        const db = supabase as any
        // Self-heal abandoned runs so the UI shows a retryable failure rather
        // than an endless loader.
        await reclaimStaleRuns(db, user.id, brandId)

        const { data: running } = await db
            .from("topical_audits")
            .select("id")
            .eq("user_id", user.id)
            .eq("brand_id", brandId)
            .eq("run_status", "running")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        const { data: brand } = await db
            .from("brand_details")
            .select("current_audit_id")
            .eq("id", brandId)
            .eq("user_id", user.id)
            .maybeSingle()

        // A failed run leaves no `running` row and never sets
        // `current_audit_id` (finalize_audit_run switches that pointer only on
        // success). Without this lookup GET answered "not_found", the console
        // treated that as "never ran", and every page refresh started a brand
        // new expensive audit. Report the failure instead.
        let failed: { id: string } | null = null
        if (!running?.id && !brand?.current_audit_id) {
            const { data } = await db
                .from("topical_audits")
                .select("id")
                .eq("user_id", user.id)
                .eq("brand_id", brandId)
                .eq("audit_kind", "customer")
                .eq("run_status", "failed")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
            failed = data || null
        }

        const auditId = running?.id || brand?.current_audit_id || failed?.id
        if (!auditId) {
            return NextResponse.json({ status: "not_found", audit: null })
        }

        const { data: audit, error } = await db
            .from("topical_audits")
            .select(`
                id,
                run_status,
                generation_status,
                generation_phase,
                generation_error,
                pool_size,
                article_count,
                cluster_count,
                authority_score,
                competitors_scanned,
                topics_analyzed,
                user_pages_scanned,
                public_token
            `)
            .eq("id", auditId)
            .eq("user_id", user.id)
            .single()

        if (error || !audit) {
            return NextResponse.json({
                status: "not_found",
                audit: null
            })
        }

        // A failed run must tell the client exactly when a retry is allowed and
        // how many remain, so the UI never offers a button the server refuses.
        const retry =
            audit.run_status === "failed"
                ? await retryState(db, user.id, brandId)
                : null

        // Build a response tailored to the current status
        return NextResponse.json({
            status: audit.run_status,
            ...(retry || {}),
            phase: audit.generation_phase,
            error: audit.generation_error,
            audit: audit.generation_status === "completed" ? {
                pool_size: audit.pool_size || 0,
                article_count: audit.article_count || 0,
                cluster_count: audit.cluster_count || 0,
                authority_score: audit.authority_score,
                public_token: audit.public_token || null,
            } : null,
            // Partial data for progress display
            partial: {
                topics_analyzed: audit.topics_analyzed || 0,
                user_pages_scanned: audit.user_pages_scanned || 0,
                competitors_scanned: audit.competitors_scanned || 0,
                pool_size: audit.pool_size || 0,
                article_count: audit.article_count || 0,
                cluster_count: audit.cluster_count || 0,
            }
        })

    } catch (error: any) {
        console.error("[Audit API] GET Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
