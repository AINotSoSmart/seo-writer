/* eslint-disable @typescript-eslint/no-explicit-any -- external webhook payloads and forward Phase 3 RPCs are intentionally runtime-validated. */
import "server-only"

function parseDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === "") return null
    const date =
        typeof value === "number"
            ? new Date(value < 1e12 ? value * 1000 : value)
            : new Date(String(value))
    return Number.isNaN(date.getTime()) ? null : date
}

function utcDay(value: Date): Date {
    return new Date(
        Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    )
}

export function resolveBillingPeriod(resource: any, eventTimestamp?: unknown): {
    start: string
    end: string
} {
    const explicitStart = parseDate(
        resource?.current_period_start ??
            resource?.current_period_start_at ??
            resource?.period_start,
    )
    const end = parseDate(
        resource?.current_period_end ??
            resource?.current_period_end_at ??
            resource?.next_billing_date ??
            resource?.period_end,
    )
    const fallbackEvent = parseDate(eventTimestamp) || new Date()
    const start =
        explicitStart ||
        (end ? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000) : utcDay(fallbackEvent))
    const resolvedEnd = end || new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)
    return { start: start.toISOString(), end: resolvedEnd.toISOString() }
}

export async function ensureBillingCycle(input: {
    supabase: any
    dodoSubscriptionId: string
    userId: string
    programId: string
    eventId: string
    resource: any
    eventTimestamp?: unknown
}): Promise<string> {
    const period = resolveBillingPeriod(input.resource, input.eventTimestamp)
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
