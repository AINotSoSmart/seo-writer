import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createHmac, timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'

// Helpers
function safeEquals(a: string, b: string): boolean {
    try {
        const aBuf = Buffer.from(a, 'hex')
        const bBuf = Buffer.from(b, 'hex')
        if (aBuf.length !== bBuf.length) return false
        return timingSafeEqual(aBuf, bBuf)
    } catch {
        return false
    }
}

function verifySignature({
    secret,
    id,
    timestamp,
    payload,
    signature,
}: {
    secret: string
    id: string
    timestamp: string
    payload: string
    signature: string
}): boolean {
    const message = `${id}.${timestamp}.${payload}`
    const computed = createHmac('sha256', secret).update(message).digest('hex')
    return safeEquals(computed, signature)
}

async function recordEventOnce(supabase: ReturnType<typeof createAdminClient>, params: {
    dodo_event_id: string
    event_type: string
    data: any
}) {
    // Idempotency check
    const { data: existing } = await supabase
        .from('dodo_webhook_events')
        .select('*')
        .eq('dodo_event_id', params.dodo_event_id)
        .maybeSingle()

    if (existing && existing.processed) {
        return { alreadyProcessed: true, row: existing }
    }

    if (!existing) {
        await supabase.from('dodo_webhook_events').insert({
            dodo_event_id: params.dodo_event_id,
            event_type: params.event_type,
            data: params.data,
            processed: false,
            retry_count: 0,
        })
    }

    return { alreadyProcessed: false }
}

async function markProcessed(
    supabase: ReturnType<typeof createAdminClient>,
    dodo_event_id: string,
) {
    await supabase
        .from('dodo_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString(), error_message: null })
        .eq('dodo_event_id', dodo_event_id)
}

async function markFailed(
    supabase: ReturnType<typeof createAdminClient>,
    dodo_event_id: string,
    error_message: string,
) {
    // Increment retry_count safely
    let newRetry = 1
    try {
        const { data } = await supabase
            .from('dodo_webhook_events')
            .select('retry_count')
            .eq('dodo_event_id', dodo_event_id)
            .maybeSingle()
        newRetry = (data?.retry_count ?? 0) + 1
    } catch {
        newRetry = 1
    }

    await supabase
        .from('dodo_webhook_events')
        .update({
            processed: false,
            error_message,
            retry_count: newRetry,
        })
        .eq('dodo_event_id', dodo_event_id)
}

async function upsertSubscriptionFromEvent(supabase: ReturnType<typeof createAdminClient>, args: {
    user_id: string
    dodo_subscription_id: string
    dodo_product_id?: string | null
    status: 'pending' | 'active' | 'cancelled' | 'expired'
    raw?: any
}) {
    const { user_id, dodo_subscription_id, dodo_product_id, status, raw } = args

    // Try to map product -> local pricing_plan_id
    let mappedPricingPlanId: string | null = null
    let planCredits: number | null = null

    if (dodo_product_id) {
        const { data: plan } = await supabase
            .from('dodo_pricing_plans')
            .select('id, credits')
            .eq('dodo_product_id', dodo_product_id)
            .maybeSingle()

        if (plan) {
            // @ts-ignore
            mappedPricingPlanId = plan.id as string
            // @ts-ignore
            planCredits = typeof plan.credits === 'number' ? plan.credits : null
        }
    }

    // Check for an existing subscription to reuse pricing_plan_id if necessary
    const { data: existingSub } = await supabase
        .from('dodo_subscriptions')
        .select('pricing_plan_id')
        .eq('dodo_subscription_id', dodo_subscription_id)
        .maybeSingle()

    const finalPricingPlanId: string | null =
        mappedPricingPlanId ?? ((existingSub?.pricing_plan_id as string | undefined) ?? null)

    if (!finalPricingPlanId) {
        // Can't satisfy NOT NULL constraint on pricing_plan_id; record for reconciliation and skip upsert
        try {
            await (supabase as any).from('dodo_subscription_changes').insert({
                user_id,
                from_plan_id: null,
                to_plan_id: null,
                checkout_session_id: null,
                status: 'pending',
                change_type: 'new',
                reason: 'Missing pricing_plan_id mapping for subscription event',
                metadata: {
                    dodo_product_id: dodo_product_id ?? null,
                    dodo_subscription_id,
                    status,
                },
            })
        } catch {
            // non-blocking
        }
        return { pricing_plan_id: null, planCredits: null }
    }

    // Ensure planCredits if still null, derive from finalPricingPlanId
    if (planCredits == null) {
        const { data: planById } = await supabase
            .from('dodo_pricing_plans')
            .select('credits')
            .eq('id', finalPricingPlanId)
            .maybeSingle()
        // @ts-ignore
        planCredits = typeof planById?.credits === 'number' ? planById.credits : null
    }

    // Upsert subscription by unique dodo_subscription_id
    await supabase
        .from('dodo_subscriptions')
        .upsert(
            {
                user_id,
                dodo_subscription_id,
                pricing_plan_id: finalPricingPlanId,
                status,
                metadata: raw ? { source: 'webhook', raw } : { source: 'webhook' },
            },
            { onConflict: 'dodo_subscription_id' },
        )

    return { pricing_plan_id: finalPricingPlanId, planCredits }
}

async function setUserCreditsToPlanCredits(
    supabase: ReturnType<typeof createAdminClient>,
    user_id: string,
    planCredits: number | null,
) {
    if (typeof planCredits !== 'number' || planCredits < 0) return

    await supabase
        .from('credits')
        .upsert(
            { user_id, credits: planCredits },
            { onConflict: 'user_id' },
        )
}

export async function POST(req: NextRequest) {
    // Read raw body FIRST for signature verification
    const rawBody = await req.text()

    const webhookId = req.headers.get('webhook-id') || ''
    const webhookSignature = req.headers.get('webhook-signature') || ''
    const webhookTimestamp = req.headers.get('webhook-timestamp') || ''

    const secret =
        process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
        process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
        process.env.DODO_WEBHOOK_SECRET

    if (!secret) {
        console.error('Missing Dodo Payments webhook secret environment variable')
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
        return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 400 })
    }

    // Verify signature (Standard Webhooks spec)
    const valid = verifySignature({
        secret,
        id: webhookId,
        timestamp: webhookTimestamp,
        payload: rawBody,
        signature: webhookSignature,
    })

    if (!valid) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }

    // Parse after verification
    let payload: any
    try {
        payload = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Determine event type (be tolerant)
    const eventType: string =
        payload?.type ||
        payload?.event ||
        payload?.event_type ||
        'unknown'

    const supabase = createAdminClient()

    // Idempotency record
    try {
        const { alreadyProcessed } = await recordEventOnce(supabase, {
            dodo_event_id: webhookId,
            event_type: eventType,
            data: payload,
        })
        if (alreadyProcessed) {
            return NextResponse.json({ ok: true, idempotent: true })
        }
    } catch (e) {
        console.error('Idempotency record failure:', e)
        // Continue; do not block processing if insert raced
    }

    // Process known events
    try {
        // Extract common resource fields with graceful fallbacks
        const data = payload?.data ?? {}
        // Subscription-like shapes
        const subscriptionObj =
            data?.subscription ??
            payload?.subscription ??
            data

        const dodo_subscription_id: string | undefined =
            subscriptionObj?.id ||
            subscriptionObj?.subscription_id ||
            data?.id

        // Product mapping often comes via plan.product_id or direct product_id
        const dodo_product_id: string | undefined =
            subscriptionObj?.product_id ||
            subscriptionObj?.plan?.product_id ||
            data?.product_id

        // We set user_id during checkout metadata; retrieve it
        const meta = subscriptionObj?.metadata || data?.metadata || payload?.metadata || {}
        const user_id: string | undefined = meta?.user_id

        // Payment or invoice events may not have subscription payload; try alternative metadata root
        const rootUserId = payload?.metadata?.user_id
        const effective_user_id = user_id || rootUserId

        // Route on event type
        if (eventType === 'subscription.created' || eventType === 'subscription.activated') {
            if (!effective_user_id || !dodo_subscription_id) {
                // Store as unprocessed with error for later manual replay
                await markFailed(supabase, webhookId, 'Missing user_id or subscription_id for subscription.created/activated')
                return NextResponse.json({ ok: true, note: 'missing user_id or subscription_id' }, { status: 200 })
            }

            const status = eventType === 'subscription.activated' ? 'active' : 'pending'
            const { planCredits } = await upsertSubscriptionFromEvent(supabase, {
                user_id: effective_user_id,
                dodo_subscription_id,
                dodo_product_id: dodo_product_id ?? null,
                status,
                raw: subscriptionObj,
            })

            // If the subscription is already active on create (some providers send as active), also provision credits
            const remoteStatus = (subscriptionObj?.status ?? '').toString().toLowerCase()
            if (status === 'active' || remoteStatus === 'active') {
                // Non-rollover: reset to plan credits
                await setUserCreditsToPlanCredits(supabase, effective_user_id, planCredits ?? null)
            }
        } else if (eventType === 'payment.succeeded' || eventType === 'subscription.renewed' || eventType === 'invoice.paid') {
            // Credit provisioning on successful renewal/payment
            if (!effective_user_id) {
                await markFailed(supabase, webhookId, 'Missing user_id for payment/renewal event')
                return NextResponse.json({ ok: true, note: 'missing user_id' }, { status: 200 })
            }

            // Get active subscription and its plan credits
            const { data: activeSub } = await supabase
                .from('dodo_subscriptions')
                .select('pricing_plan_id, status, dodo_pricing_plans(credits)')
                .eq('user_id', effective_user_id)
                .eq('status', 'active')
                .maybeSingle()

            // @ts-ignore
            const planCredits: number | null = activeSub?.dodo_pricing_plans?.credits ?? null
            await setUserCreditsToPlanCredits(supabase, effective_user_id, planCredits)
        } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.canceled') {
            // Handle cancellation
            if (!effective_user_id || !dodo_subscription_id) {
                await markFailed(supabase, webhookId, 'Missing user_id or subscription_id for cancellation')
                return NextResponse.json({ ok: true, note: 'missing user_id or subscription_id' }, { status: 200 })
            }

            await upsertSubscriptionFromEvent(supabase, {
                user_id: effective_user_id,
                dodo_subscription_id,
                dodo_product_id: dodo_product_id ?? null,
                status: 'cancelled',
                raw: subscriptionObj,
            })
        } else if (eventType === 'subscription.updated') {
            // Track status transitions; if cancel_at_period_end included in subscriptionObj, we may update local status
            if (effective_user_id && dodo_subscription_id) {
                const remoteStatus = (subscriptionObj?.status ?? '').toString().toLowerCase()
                const statusMap: Record<string, 'pending' | 'active' | 'cancelled' | 'expired'> = {
                    pending: 'pending',
                    active: 'active',
                    canceled: 'cancelled',
                    cancelled: 'cancelled',
                    expired: 'expired',
                }
                const mapped = statusMap[remoteStatus] ?? 'pending'
                await upsertSubscriptionFromEvent(supabase, {
                    user_id: effective_user_id,
                    dodo_subscription_id,
                    dodo_product_id: dodo_product_id ?? null,
                    status: mapped,
                    raw: subscriptionObj,
                })
            }
        } else {
            // Unknown or unhandled event; accept for now
            // No-op; still mark processed to avoid retries
        }

        // Mark processed
        await markProcessed(supabase, webhookId)
        return NextResponse.json({ ok: true })
    } catch (err: any) {
        console.error('Webhook processing error:', err)
        try {
            await markFailed(createAdminClient(), webhookId, err?.message || 'Unknown processing error')
        } catch (e2) {
            console.error('Failed to mark webhook as failed:', e2)
        }
        // Return 500 to trigger a retry from Dodo Payments
        return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }
}

/**
 * Documentation references:
 * - DodoPayments Node SDK Webhooks management: https://github.com/dodopayments/dodopayments-node/blob/main/api.md
 * - Setup Webhooks + retrieve secret: https://context7.com/dodopayments/dodopayments-node/llms.txt
 * - Webhook signature verification (Standard Webhooks spec): https://docs.dodopayments.com/developer-resources/webhooks
 *   Headers used: webhook-id, webhook-signature, webhook-timestamp
 *   Signed payload: <webhook-id>.<webhook-timestamp>.<raw-body>, HMAC-SHA256 with your webhook secret
 */