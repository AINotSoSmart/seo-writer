import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDodoClient } from '@/lib/dodopayments-server'

/**
 * POST /api/dodopayments/subscription/update-payment-method
 * Creates a Customer Portal session so the user can update their default payment method.
 *
 * Request body (optional):
 * {
 *   "subscription_id": "sub_123",          // If omitted, resolve active local subscription
 *   "return_url": "https://app.example.com/account" // Optional return URL (defaults to /account)
 * }
 *
 * Flow:
 * - Auth user with Supabase
 * - Resolve subscription_id (from body or local active subscription)
 * - Retrieve subscription from Dodo to get customer_id
 * - Create Customer Portal session for that customer_id
 * - Return { url } to redirect the user
 *
 * Docs:
 * - Retrieve Subscription: https://github.com/dodopayments/dodopayments-node/blob/main/api.md
 * - Create Customer Portal Session: https://github.com/dodopayments/dodopayments-node/blob/main/api.md
 * - Example (Context7): https://context7.com/dodopayments/dodopayments-node/llms.txt
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json().catch(() => ({}))
        let { subscription_id, return_url } = (body || {}) as {
            subscription_id?: string
            return_url?: string
        }

        // Resolve user's most recent subscription if not provided (no strict status requirement)
        if (!subscription_id) {
            const { data: latestSub, error: subErr } = await supabase
                .from('dodo_subscriptions')
                .select('dodo_subscription_id, status, user_id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (subErr) {
                return NextResponse.json({ error: 'Failed to resolve subscription' }, { status: 500 })
            }

            if (!latestSub?.dodo_subscription_id) {
                // Fallback with admin client (bypass RLS) but still constrained by user_id
                try {
                    const admin = createAdminClient()
                    const { data: adminLatest } = await admin
                        .from('dodo_subscriptions')
                        .select('dodo_subscription_id, status, user_id')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()

                    if (adminLatest?.dodo_subscription_id) {
                        subscription_id = adminLatest.dodo_subscription_id
                    } else {
                        // Second attempt with explicit active status
                        const { data: adminActive } = await admin
                            .from('dodo_subscriptions')
                            .select('dodo_subscription_id, user_id')
                            .eq('user_id', user.id)
                            .eq('status', 'active')
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle()

                        if (adminActive?.dodo_subscription_id) {
                            subscription_id = adminActive.dodo_subscription_id
                        }
                    }
                } catch {
                    // ignore admin fallback errors; we'll 404 below if unresolved
                }
            } else {
                subscription_id = latestSub.dodo_subscription_id
            }

            if (!subscription_id) {
                return NextResponse.json({ error: 'No subscription found for user' }, { status: 404 })
            }
        }

        const client = getDodoClient()

        // Use Dodo's hosted payment method update (short flow) with a return_url back into the app
        const effectiveReturnUrl =
            return_url && typeof return_url === 'string' && return_url.length > 0
                ? return_url
                : `${process.env.NEXT_PUBLIC_APP_URL || ''}/account`

        let response: any
        try {
            response = await client.subscriptions.updatePaymentMethod(
                subscription_id,
                { type: 'new', return_url: effectiveReturnUrl } as any,
            )
        } catch (e) {
            console.error('updatePaymentMethod failed', {
                subscription_id,
                error: (e as any)?.message || String(e),
            })
            return NextResponse.json({ error: 'Failed to initiate payment method update' }, { status: 500 })
        }

        const link = response?.payment_link || response?.url || response?.link
        if (!link) {
            // Some gateways may return client_secret/payment_id to finish the flow; surface a generic message
            return NextResponse.json(
                {
                    url: '',
                    emailed: false,
                    message:
                        'Payment method update initiated. If no redirect link is shown, please try again shortly or check your email.',
                },
                { status: 200 },
            )
        }

        // Success: return the hosted update link for client-side redirect
        return NextResponse.json({ url: link }, { status: 200 })
    } catch (err: any) {
        // Surface more detail to client for quicker diagnosis (no secrets)
        const msg = (err?.message || err?.error || '').toString() || 'Failed to create payment method update session'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}