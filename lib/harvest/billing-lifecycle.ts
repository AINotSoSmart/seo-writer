import "server-only"

import { getDodoClient } from "@/lib/dodopayments-server"
import { EMAIL_FROM, resend } from "@/lib/emails/client"
import { createAdminClient } from "@/utils/supabase/admin"

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
    end: string | null
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
    return { start: start.toISOString(), end: end?.toISOString() || null }
}

export async function grantBillingPeriodOnce(input: {
    supabase: any
    dodoSubscriptionId: string
    userId: string
    programId: string | null
    allowance: number
    eventId: string
    resource: any
    eventTimestamp?: unknown
}): Promise<boolean> {
    const period = resolveBillingPeriod(input.resource, input.eventTimestamp)
    const { data, error } = await input.supabase.rpc("grant_subscription_period", {
        p_dodo_subscription_id: input.dodoSubscriptionId,
        p_user_id: input.userId,
        p_program_id: input.programId,
        p_period_start: period.start,
        p_period_end: period.end,
        p_allowance: input.allowance,
        p_source_event_id: input.eventId,
    })
    if (error) throw new Error(`Billing-period grant failed: ${error.message}`)
    return Boolean(data)
}

export async function scheduleEndOfScopeCancellation(programId: string): Promise<void> {
    const supabase = createAdminClient() as any
    const { data: program, error } = await supabase
        .from("programs")
        .select(
            "id, dodo_subscription_id, scope_status, cancellation_status, cancellation_requested_at",
        )
        .eq("id", programId)
        .single()
    if (error || !program?.dodo_subscription_id) {
        throw new Error(error?.message || "Program has no Dodo subscription.")
    }
    if (program.cancellation_status === "scheduled" || program.cancellation_status === "ended") {
        return
    }
    if (
        program.cancellation_status === "request_pending" &&
        program.cancellation_requested_at &&
        Date.now() - new Date(program.cancellation_requested_at).getTime() <
            2 * 60 * 60 * 1000
    ) {
        return
    }

    const { error: pendingError } = await supabase
        .from("programs")
        .update({
            scope_status: "scope_delivered",
            status: "completed",
            completed_at: new Date().toISOString(),
            cancellation_status: "request_pending",
            cancellation_requested_at: new Date().toISOString(),
            cancellation_error: null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", programId)
    if (pendingError) {
        throw new Error(
            `Could not record pending cancellation: ${pendingError.message}`,
        )
    }

    try {
        const client = getDodoClient()
        await client.subscriptions.update(program.dodo_subscription_id, {
            cancel_at_next_billing_date: true,
        })
        // Remain request_pending until a Dodo webhook confirms the remote flag.
        // This prevents the UI from promising cancellation based only on a
        // successful request acknowledgement.
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Cancellation request failed"
        await supabase
            .from("programs")
            .update({
                cancellation_status: "error",
                cancellation_error: message.slice(0, 1000),
                updated_at: new Date().toISOString(),
            })
            .eq("id", programId)
        const founderEmail = process.env.FOUNDER_ALERT_EMAIL
        if (founderEmail && process.env.RESEND_API_KEY) {
            try {
                await resend.emails.send({
                    from: EMAIL_FROM,
                    to: founderEmail,
                    subject: `FlipAEO cancellation retry required: ${programId}`,
                    text:
                        `Program ${programId} could not schedule end-of-period cancellation. ` +
                        `The lifecycle worker will retry. Error: ${message.slice(0, 500)}`,
                })
            } catch (alertError) {
                console.error(
                    `[BillingLifecycle] Founder cancellation alert failed for ${programId}:`,
                    alertError,
                )
            }
        }
        throw error
    }
}
