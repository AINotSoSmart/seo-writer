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

        // Prefer local metadata->raw to fetch customer_id (populated from webhook)
        let customer_id: string | undefined
        try {
            const { data: localSub } = await supabase
                .from('dodo_subscriptions')
                .select('metadata')
                .eq('dodo_subscription_id', subscription_id)
                .maybeSingle()
            customer_id =
                (localSub as any)?.metadata?.raw?.customer?.customer_id ||
                (localSub as any)?.metadata?.customer?.customer_id
        } catch { /* ignore */ }

        // Fallback: retrieve from Dodo if not present locally
        if (!customer_id) {
            const remoteSub: any = await client.subscriptions.retrieve(subscription_id)
            customer_id = remoteSub?.customer_id || remoteSub?.customer?.customer_id
        }

        if (!customer_id) {
            return NextResponse.json({ error: 'No customer_id associated with subscription' }, { status: 400 })
        }

        // Create Customer Portal session.
        // Note: SDK exposes `send_email` only; response type is CustomerPortalSession { link: string }
        // https://github.com/dodopayments/dodopayments-node/blob/main/api.md
        const portal = await client.customers.customerPortal.create(customer_id, { send_email: false } as any)

        const link = (portal as any)?.link || (portal as any)?.url
        if (!link) {
            // Fallback: ask Dodo to email a secure link to the customer instead of returning a URL
            try {
                await client.customers.customerPortal.create(customer_id, { send_email: true } as any)
                return NextResponse.json(
                    {
                        url: '',
                        emailed: true,
                        message: 'A secure payment method update link was emailed to you.',
                    },
                    { status: 200 },
                )
            } catch (e) {
                console.error('Customer portal creation failed (no link, email fallback also failed)', {
                    customer_id,
                    subscription_id,
                    error: (e as any)?.message || String(e),
                })
                return NextResponse.json({ error: 'Failed to create customer portal session' }, { status: 500 })
            }
        }

        // Success: return the portal link for client-side redirect
        return NextResponse.json({ url: link }, { status: 200 })
    } catch (err: any) {
        // Surface more detail to client for quicker diagnosis (no secrets)
        const msg = (err?.message || err?.error || '').toString() || 'Failed to create payment method update session'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}