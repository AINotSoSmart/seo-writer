import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
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

        // Resolve user's active subscription if not provided
        if (!subscription_id) {
            const { data: activeSub, error: subErr } = await supabase
                .from('dodo_subscriptions')
                .select('dodo_subscription_id')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .maybeSingle()

            if (subErr) {
                console.error('Active subscription lookup error:', subErr)
                return NextResponse.json({ error: 'Failed to resolve subscription' }, { status: 500 })
            }

            subscription_id = activeSub?.dodo_subscription_id || undefined
            if (!subscription_id) {
                return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
            }
        }

        const client = getDodoClient()

        // Retrieve subscription to get customer_id
        const remoteSub = await client.subscriptions.retrieve(subscription_id)
        const customer_id: string | undefined =
            (remoteSub && (remoteSub.customer_id || remoteSub.customer?.customer_id)) || undefined

        if (!customer_id) {
            return NextResponse.json({ error: 'No customer_id associated with subscription' }, { status: 400 })
        }

        const portal = await client.customers.customerPortal.create(customer_id, {
            return_url: return_url || `${process.env.NEXT_PUBLIC_APP_URL || ''}/account`,
        })

        if (!portal?.url) {
            return NextResponse.json({ error: 'Failed to create customer portal session' }, { status: 500 })
        }

        return NextResponse.json(
            { url: portal.url },
            { status: 200 },
        )
    } catch (err: any) {
        console.error('Update payment method error:', err)
        const msg = err?.message || err?.error || 'Failed to create payment method update session'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}