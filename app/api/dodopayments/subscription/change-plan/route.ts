import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDodoClient } from '@/lib/dodopayments-server'

/**
 * POST /api/dodopayments/subscription/change-plan
 * Change plan for an existing subscription.
 *
 * Body:
 * {
 *   "subscription_id": "sub_123",            // optional; will resolve latest if omitted
 *   "product_id": "prod_ABC",                // required
 *   "proration_billing_mode": "prorated_immediately" | "none", // optional (default prorated_immediately)
 *   "quantity": 1                            // optional (default 1)
 * }
 *
 * Behavior:
 * - Auth user via Supabase
 * - Resolve subscription_id if not provided (latest, with admin fallback)
 * - Call Dodo SDK: client.subscriptions.changePlan(subscription_id, {...})
 * - Return 200 on success; webhook updates local mapping/credits
 *
 * Docs:
 * - https://github.com/dodopayments/dodopayments-node/blob/main/api.md#post-subscriptionssubscription_idchange-plan
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json().catch(() => ({}))
        let {
            subscription_id,
            product_id,
            proration_billing_mode,
            quantity,
        }: {
            subscription_id?: string
            product_id?: string
            proration_billing_mode?: 'prorated_immediately' | 'none'
            quantity?: number
        } = body || {}

        if (!product_id) {
            return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
        }

        // Resolve user's most recent subscription if not provided
        if (!subscription_id) {
            const { data: latestSub, error: subErr } = await supabase
                .from('dodo_subscriptions')
                .select('dodo_subscription_id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (subErr) {
                return NextResponse.json({ error: 'Failed to resolve subscription' }, { status: 500 })
            }

            if (latestSub?.dodo_subscription_id) {
                subscription_id = latestSub.dodo_subscription_id
            } else {
                // Admin fallback constrained by user_id
                try {
                    const admin = createAdminClient()
                    const { data: adminLatest } = await admin
                        .from('dodo_subscriptions')
                        .select('dodo_subscription_id')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()

                    if (adminLatest?.dodo_subscription_id) {
                        subscription_id = adminLatest.dodo_subscription_id
                    }
                } catch {
                    // ignore
                }
            }

            if (!subscription_id) {
                return NextResponse.json({ error: 'No subscription found for user' }, { status: 404 })
            }
        }

        const client = getDodoClient()

        await client.subscriptions.changePlan(subscription_id, {
            product_id,
            proration_billing_mode: proration_billing_mode ?? 'prorated_immediately',
            quantity: typeof quantity === 'number' && quantity > 0 ? quantity : 1,
        } as any)

        // Local DB updates handled by webhook; avoid race conditions here.
        return NextResponse.json({ ok: true, subscription_id }, { status: 200 })
    } catch (err: any) {
        const msg = (err?.message || err?.error || '').toString() || 'Failed to change subscription plan'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}