import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDodoClient } from '@/lib/dodopayments-server'

/**
 * POST /api/dodopayments/subscription/restore
 * Removes cancel_at_next_billing_date so the subscription continues.
 *
 * Body:
 * { "subscription_id": "sub_123" } // optional; if omitted we try to resolve the latest for the user
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json().catch(() => ({}))
        let { subscription_id } = (body || {}) as { subscription_id?: string }

        // Resolve latest by user if not provided
        if (!subscription_id) {
            const { data: latestSub, error } = await supabase
                .from('dodo_subscriptions')
                .select('dodo_subscription_id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) {
                return NextResponse.json({ error: 'Failed to resolve subscription' }, { status: 500 })
            }
            subscription_id = latestSub?.dodo_subscription_id || undefined
            if (!subscription_id) {
                return NextResponse.json({ error: 'No subscription found for user' }, { status: 404 })
            }
        }

        const client = getDodoClient()

        // Remote: unset cancel_at_next_billing_date
        await client.subscriptions.update(subscription_id, {
            cancel_at_next_billing_date: false,
        })

        // Local: reflect in metadata for immediate UI feedback
        const { data: existing } = await supabase
            .from('dodo_subscriptions')
            .select('metadata')
            .eq('dodo_subscription_id', subscription_id)
            .maybeSingle()

        const newMetadata = {
            ...(existing?.metadata ?? {}),
            cancel_at_next_billing_date: false,
        }

        await supabase
            .from('dodo_subscriptions')
            .update({ metadata: newMetadata, cancel_at_period_end: false })
            .eq('dodo_subscription_id', subscription_id)

        return NextResponse.json({ ok: true, subscription_id }, { status: 200 })
    } catch (err: any) {
        const msg = (err?.message || err?.error || '').toString() || 'Failed to restore subscription'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}