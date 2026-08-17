/* eslint-disable @typescript-eslint/no-explicit-any -- external webhook payloads and forward Phase 3 RPCs are intentionally runtime-validated. */
import "server-only"
import { resolveBillingPeriod } from "./billing-period"

export { BillingPeriodError, resolveBillingPeriod } from "./billing-period"

export async function ensureBillingCycle(input: {
    supabase: any
    dodoSubscriptionId: string
    userId: string
    programId: string
    eventId: string
    resource: any
}): Promise<string> {
    const period = resolveBillingPeriod(input.resource)
    const { data, error } = await input.supabase.rpc("grant_subscription_period", {
        p_dodo_subscription_id: input.dodoSubscriptionId,
        p_user_id: input.userId,
        p_program_id: input.programId,
        p_period_start: period.start,
        p_period_end: period.end,
        p_source_event_id: input.eventId,
    })
    if (error) throw new Error(`Billing-period grant failed: ${error.message}`)
    if (typeof data !== "string" || !data) {
        throw new Error("Billing-period grant did not return a subscription cycle.")
    }
    return data
}
