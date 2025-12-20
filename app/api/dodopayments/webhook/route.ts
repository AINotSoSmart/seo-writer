import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createHmac, timingSafeEqual, createHash } from 'crypto'
import { Webhook } from 'standardwebhooks'

export const runtime = 'nodejs'

// Helpers
function safeEqualsBase64(aB64: string, bB64: string): boolean {
    try {
        const aBuf = Buffer.from(aB64, 'base64')
        const bBuf = Buffer.from(bB64, 'base64')
        if (aBuf.length !== bBuf.length) return false
        return timingSafeEqual(aBuf, bBuf)
    } catch {
        return false
    }
}
function extractSignatureCandidate(header: string): {
    provided: string
    format: 'v1_eq' | 'v1_comma' | 'raw' | 'empty'
} {
    const h = (header || '').trim()
    if (!h) return { provided: '', format: 'empty' }

    const eqMatch = h.match(/v1=([^,]+)/)
    if (eqMatch && eqMatch[1]) {
        return { provided: eqMatch[1].trim(), format: 'v1_eq' }
    }

    if (h.includes(',')) {
        const parts = h.split(',').map(s => s.trim()).filter(Boolean)
        const idx = parts.findIndex(p => p.toLowerCase() === 'v1')
        const provided = idx >= 0 ? (parts[idx + 1] || '') : (parts.find(p => p.toLowerCase() !== 'v1') || '')
        return { provided: (provided || '').trim(), format: 'v1_comma' }
    }

    return { provided: h, format: 'raw' }
}

function verifySignature({
    secret,
    id,
    timestamp,
    payload,
    signatureHeader,
}: {
    secret: string
    id: string
    timestamp: string
    payload: string
    signatureHeader: string
}): boolean {
    const header = (signatureHeader || '').trim()
    const { provided } = extractSignatureCandidate(header)
    if (!provided) return false

    // Helper: constant-time compare of provided signature against a raw digest
    const compareProvidedToRawDigest = (prov: string, rawDigest: Buffer): boolean => {
        const digestB64 = rawDigest.toString('base64')
        const digestB64NoPad = digestB64.replace(/=+$/, '')
        const digestB64Url = digestB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

        const looksHex = /^[0-9a-f]{64}$/i.test(prov)

        try {
            if (looksHex) {
                const provBuf = Buffer.from(prov, 'hex')
                return provBuf.length === rawDigest.length && timingSafeEqual(provBuf, rawDigest)
            } else {
                // Normalize possible url-safe base64 to standard base64 with padding
                const norm = prov.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
                const padded = norm.length % 4 === 0 ? norm : norm + '='.repeat(4 - (norm.length % 4))

                // Compare bytes
                const provBuf = Buffer.from(padded, 'base64')
                if (provBuf.length === rawDigest.length && timingSafeEqual(provBuf, rawDigest)) return true

                // Compare base64 encodings as strings in constant time
                const candidates = [digestB64, digestB64NoPad, digestB64Url]
                for (const c of candidates) {
                    const a = Buffer.from(c)
                    const b = Buffer.from(padded)
                    if (a.length === b.length && timingSafeEqual(a, b)) return true
                }
                return false
            }
        } catch {
            return false
        }
    }

    // Compute HMAC over two possible message formats to be robust:
    // 1) id.timestamp.payload (per docs)
    // 2) timestamp.payload (some providers omit id in the signed message)
    const msg1 = Buffer.from(`${id}.${timestamp}.${payload}`, 'utf8')
    const raw1 = createHmac('sha256', secret).update(msg1).digest()
    if (compareProvidedToRawDigest(provided, raw1)) return true

    const msg2 = Buffer.from(`${timestamp}.${payload}`, 'utf8')
    const raw2 = createHmac('sha256', secret).update(msg2).digest()
    if (compareProvidedToRawDigest(provided, raw2)) return true

    return false
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

/**
 * Mark the most recent pending subscription change for a user as completed.
 * Optionally narrow by to_plan_id and attach metadata (e.g., dodo_subscription_id).
 */
async function completeLatestPendingChange(
    supabase: ReturnType<typeof createAdminClient>,
    user_id: string,
    to_plan_id?: string | null,
    meta?: any,
) {
    let query: any = (supabase as any)
        .from('dodo_subscription_changes')
        .select('id')
        .eq('user_id', user_id)
        .eq('status', 'pending')

    if (to_plan_id) {
        query = query.eq('to_plan_id', to_plan_id)
    }

    const { data: rows } = await query
        .order('created_at', { ascending: false })
        .limit(1)

    const row = rows?.[0]
    if (row?.id) {
        const update: any = {
            status: 'completed',
            completed_at: new Date().toISOString(),
        }
        if (meta) {
            update.metadata = meta
        }
        await (supabase as any)
            .from('dodo_subscription_changes')
            .update(update)
            .eq('id', row.id)
    }
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
            mappedPricingPlanId = (plan as any).id as string
            // Coerce numeric string to number
            // @ts-ignore
            const pc = Number((plan as any).credits)
            // @ts-ignore
            planCredits = Number.isFinite(pc) ? pc : null
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
        const pc2 = Number((planById as any)?.credits)
        // @ts-ignore
        planCredits = Number.isFinite(pc2) ? pc2 : null
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
    if (typeof planCredits !== 'number' || !Number.isFinite(planCredits) || planCredits < 0) return

    // Update-first strategy to avoid requiring a unique constraint on user_id
    const { data: existing } = await supabase
        .from('credits')
        .select('user_id')
        .eq('user_id', user_id)
        .maybeSingle()

    if (existing) {
        await supabase
            .from('credits')
            .update({ credits: planCredits })
            .eq('user_id', user_id)
    } else {
        await supabase
            .from('credits')
            .insert({ user_id, credits: planCredits })
    }
}

export async function POST(req: NextRequest) {
    // Read raw body FIRST for signature verification
    const rawBody = await req.text()

    const webhookId = req.headers.get('webhook-id') || ''
    const sigWH = req.headers.get('webhook-signature')
    const sigDodoLower = req.headers.get('dodo-signature')
    const sigDodoCase = req.headers.get('Dodo-Signature')
    const webhookSignature = (sigWH || sigDodoLower || sigDodoCase || '') as string
    const sigHeaderSource =
        sigWH ? 'webhook-signature' :
            (sigDodoLower ? 'dodo-signature' :
                (sigDodoCase ? 'Dodo-Signature' : 'none'))
    const webhookTimestamp = req.headers.get('webhook-timestamp') || ''

    const secret = (
        process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
        process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
        process.env.DODO_WEBHOOK_SECRET ||
        ''
    ).trim()

    if (!secret) {
        console.error('Missing Dodo Payments webhook secret environment variable')
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
        return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 400 })
    }

    // Verify signature (prefer StandardWebhooks, fallback to manual) + diagnostics
    const webhookHeaders = {
        'webhook-id': webhookId,
        'webhook-signature': webhookSignature,
        'webhook-timestamp': webhookTimestamp,
    }

    let verified = false as boolean
    let verifiedBy: 'standardwebhooks' | 'manual' | 'manual-trim' | null = null

    // Try StandardWebhooks verifier (recommended by Dodo)
    try {
        const verifier = new Webhook(secret)
        await verifier.verify(rawBody, webhookHeaders as any)
        verified = true
        verifiedBy = 'standardwebhooks'
    } catch {
        // Fallback: manual verification (Standard Webhooks spec)
        const sigInfo = extractSignatureCandidate(webhookSignature)
        const rawNoNL = rawBody.replace(/[\r\n]+$/, '')

        const validPrimary = verifySignature({
            secret,
            id: webhookId,
            timestamp: webhookTimestamp,
            payload: rawBody,
            signatureHeader: webhookSignature,
        })
        let validTrim = false
        if (!validPrimary && rawNoNL !== rawBody) {
            validTrim = verifySignature({
                secret,
                id: webhookId,
                timestamp: webhookTimestamp,
                payload: rawNoNL,
                signatureHeader: webhookSignature,
            })
        }

        verified = validPrimary || validTrim
        verifiedBy = validPrimary ? 'manual' : (validTrim ? 'manual-trim' : null)

        // Optional debug diagnostics (does not log raw payload)
        if ((process.env.DEBUG_DODO_WEBHOOK || '').toLowerCase() === 'true' || process.env.DEBUG_DODO_WEBHOOK === '1') {
            const hashRaw = (() => { try { return createHash('sha256').update(rawBody).digest('hex') } catch { return '' } })()
            const hashTrim = rawNoNL !== rawBody ? (() => { try { return createHash('sha256').update(rawNoNL).digest('hex') } catch { return '' } })() : ''
            console.log('[Dodo Webhook][debug] signature verification', {
                id: webhookId,
                ts: webhookTimestamp,
                hasSecret: Boolean(process.env.DODO_PAYMENTS_WEBHOOK_SECRET || process.env.DODO_PAYMENTS_WEBHOOK_KEY || process.env.DODO_WEBHOOK_SECRET),
                sigHeaderSource,
                sigFormat: sigInfo.format,
                sigProvidedLen: (sigInfo.provided || '').length,
                bodyLen: rawBody.length,
                bodySha256: hashRaw,
                trimmedDifferent: rawNoNL !== rawBody,
                trimmedBodyLen: rawNoNL.length,
                trimmedBodySha256: hashTrim,
                verifiedBy,
            })
        }
    }

    if (!verified) {
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
        if (eventType === 'subscription.created' || eventType === 'subscription.activated' || eventType === 'subscription.active') {
            if (!effective_user_id || !dodo_subscription_id) {
                // Store as unprocessed with error for later manual replay
                await markFailed(supabase, webhookId, 'Missing user_id or subscription_id for subscription.created/activated')
                return NextResponse.json({ ok: true, note: 'missing user_id or subscription_id' }, { status: 200 })
            }

            const status = eventType === 'subscription.activated' ? 'active' : 'pending'
            const { planCredits, pricing_plan_id } = await upsertSubscriptionFromEvent(supabase, {
                user_id: effective_user_id,
                dodo_subscription_id,
                dodo_product_id: dodo_product_id ?? null,
                status,
                raw: subscriptionObj,
            })

            // Complete the latest pending change on activation
            if (status === 'active') {
                try {
                    await completeLatestPendingChange(
                        supabase,
                        effective_user_id,
                        pricing_plan_id ?? null,
                        { dodo_subscription_id, completed_by: eventType },
                    )
                } catch { }
            }

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

            // Coerce numeric strings from PostgREST
            // @ts-ignore
            const planCredits: number | null = (() => {
                const v = (activeSub as any)?.dodo_pricing_plans?.credits
                const n = Number(v)
                return Number.isFinite(n) ? n : null
            })()
            await setUserCreditsToPlanCredits(supabase, effective_user_id, planCredits)
            // Also complete the latest pending change if any
            try {
                await completeLatestPendingChange(supabase, effective_user_id, null, { completed_by: eventType })
            } catch { }
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
        } else if (eventType === 'subscription.plan_changed') {
            // Plan changed mid-cycle: update mapping/status, do not reset credits
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
                const { pricing_plan_id } = await upsertSubscriptionFromEvent(supabase, {
                    user_id: effective_user_id,
                    dodo_subscription_id,
                    dodo_product_id: dodo_product_id ?? null,
                    status: mapped,
                    raw: subscriptionObj,
                })
                if (mapped === 'active') {
                    try {
                        await completeLatestPendingChange(
                            supabase,
                            effective_user_id,
                            pricing_plan_id ?? null,
                            { completed_by: eventType },
                        )
                    } catch { }
                }
            }
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
                const { planCredits, pricing_plan_id } = await upsertSubscriptionFromEvent(supabase, {
                    user_id: effective_user_id,
                    dodo_subscription_id,
                    dodo_product_id: dodo_product_id ?? null,
                    status: mapped,
                    raw: subscriptionObj,
                })
                if (mapped === 'active') {
                    await setUserCreditsToPlanCredits(supabase, effective_user_id, planCredits ?? null)
                    try {
                        await completeLatestPendingChange(
                            supabase,
                            effective_user_id,
                            pricing_plan_id ?? null,
                            { completed_by: eventType },
                        )
                    } catch { }
                }
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