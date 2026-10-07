/* eslint-disable @typescript-eslint/no-explicit-any -- admin client relations are untyped here, as in the probe route this was moved from. */
import "server-only"

import {
    auditRetryState,
    failAuditRun,
    reclaimStaleAuditRuns,
} from "@/lib/audit/run-guards"
import { probeFailureCopy } from "@/lib/visibility/failure-copy"

/**
 * Recorded on the audit row this opens. `finalize_audit_run` overwrites it with
 * the same value, so the policy version reads the same mid-run or after.
 */
export const PROBE_POLICY_VERSION = "ai-probe-v1.0.0"

/**
 * Opens the audit an onboarding probe will write into.
 *
 * Reuses a `running` row whose scope still matches rather than creating a
 * second one: `create_customer_audit_with_scope` refuses outright while one
 * exists, so without this a probe that failed to enqueue would lock the brand
 * out of every audit path — Google harvest included — until the stale sweep
 * caught up 40 minutes later.
 */
export async function openAuditForBrand(
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

