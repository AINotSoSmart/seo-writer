/**
 * The rules that decide whether a brand may start another audit run.
 *
 * There are now two entry points that open a `topical_audits` row — the Google
 * harvest (`POST /api/topical-audit`) and the AI-visibility probe
 * (`POST /api/visibility/probe`) — and both create the row through
 * `create_customer_audit_with_scope`, which refuses outright while a `running`
 * row exists. A stuck row therefore blocks *both* paths, and a failure on one
 * path must be visible to the other. That is why these live here rather than
 * inside one route: two copies of a cooldown drift, and the copy that drifts is
 * the one that lets a customer pay twice.
 *
 * Every helper takes a service-role client. Authentication belongs to the
 * caller; mutation of an immutable run is service-side only.
 */

/**
 * A failed audit may be retried, but not on every page refresh. The crawl,
 * search and answer-engine work behind one run is the expensive part of the
 * product, and a failed run is neither `running` nor `completed` — so without a
 * cooldown each refresh silently started a new one.
 */
export const AUDIT_RETRY_COOLDOWN_MINUTES = 15
export const MAX_FAILURES_PER_COOLDOWN = 3

/**
 * A run older than this cannot still be alive: `runAuditTask` has
 * `maxDuration: 1800` (30 minutes), so 40 gives generous headroom. The probe
 * task is 40 minutes and closes its own audit row on failure, so it does not
 * rely on this sweep — but a probe whose worker never ran at all does.
 */
export const AUDIT_STALE_AFTER_MINUTES = 40

export type RetryState = {
    retryAfterSeconds: number
    attemptsRemaining: number
    retryBlocked: boolean
}

/**
 * Marks abandoned `running` rows as failed.
 *
 * A row is only advanced by the background task itself, so if the task never
 * executes — a hard cancel, an OOM kill, a worker that never picked the run up,
 * or a `TRIGGER_SECRET_KEY` pointing at a different environment — the row stays
 * `running` forever. That was a permanent dead end: status reads reported
 * "running" so the UI span an endless loader, and starting a run answered
 * "already running" so the customer could never retry.
 *
 * Runs before every read and every trigger, so the stuck state self-heals into
 * a retryable failure instead of needing manual database surgery.
 */
export async function reclaimStaleAuditRuns(
    db: any,
    userId: string,
    brandId: string,
): Promise<number> {
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
            `[Audit guards] Reclaimed ${count} stale run(s) for brand ${brandId} — ` +
            `the background worker never advanced them.`,
        )
    }
    return count
}

/**
 * Retry budget for a brand's recent failed audits.
 *
 * Every caller derives from this so the countdown a customer sees is the same
 * rule the endpoint enforces — a UI that offers a retry the server will reject
 * is worse than no button at all.
 */
export async function auditRetryState(
    db: any,
    userId: string,
    brandId: string,
): Promise<RetryState> {
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
 * Closes a run that will never finish.
 *
 * Guarded on `run_status = 'running'` deliberately. A probe may be pointed at an
 * audit somebody else already finalized — re-running the report from the
 * dashboard, for instance — and a failure there must not reopen and destroy a
 * completed audit the customer is already looking at.
 */
export async function failAuditRun(
    db: any,
    auditId: string,
    failureCode: string,
    message: string,
): Promise<void> {
    await db
        .from("topical_audits")
        .update({
            run_status: "failed",
            generation_status: "failed",
            generation_phase: null,
            failure_code: failureCode,
            generation_error: message.slice(0, 1000),
            failed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", auditId)
        .eq("run_status", "running")
}
