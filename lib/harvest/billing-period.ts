/** A cycle can exist only when Dodo supplied both boundaries. */
export class BillingPeriodError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "BillingPeriodError"
    }
}

function parseDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === "") return null
    const date =
        typeof value === "number"
            ? new Date(value < 1e12 ? value * 1000 : value)
            : new Date(String(value))
    return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Resolve the exact subscription interval carried by Dodo.
 *
 * `subscription.renewed` uses `previous_billing_date` as the new period start
 * and `next_billing_date` as its end. The current-period aliases keep this
 * compatible with subscription payloads, but an event timestamp is never a
 * billing boundary and no synthetic 30-day interval is permitted.
 */
export function resolveBillingPeriod(resource: unknown): {
    start: string
    end: string
} {
    const row = (resource ?? {}) as Record<string, unknown>
    const start = parseDate(
        row.previous_billing_date ??
            row.current_period_start ??
            row.current_period_start_at ??
            row.period_start,
    )
    const end = parseDate(
        row.next_billing_date ??
            row.current_period_end ??
            row.current_period_end_at ??
            row.period_end,
    )

    if (!start || !end) {
        throw new BillingPeriodError(
            "Dodo renewal did not include an authoritative billing-period start and end.",
        )
    }
    if (end.getTime() <= start.getTime()) {
        throw new BillingPeriodError(
            "Dodo renewal supplied an invalid billing period: the end must follow the start.",
        )
    }

    return { start: start.toISOString(), end: end.toISOString() }
}
