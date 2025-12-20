import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDodoClient } from '@/lib/dodopayments-server'

/**
 * POST /api/dodopayments/subscription/cancel
 * Cancels the user's subscription at the next billing date.
 *
 * Request body (optional):
 * { "subscription_id": "sub_123" }  // If omitted, we'll resolve the user's active subscription locally.
 *
 * Behavior:
 * - Authenticates the current user
 * - Resolves the target subscription_id (from body or user's active local subscription)
 * - Calls Dodo Payments Subscriptions API to set cancel_at_next_billing_date = true
 * - Updates local dodo_subscriptions.metadata to reflect the cancellation intent
 * - Inserts an audit row in dodo_subscription_changes (change_type: 'cancellation', status: 'pending')
 *
 * Docs:
 * - Subscriptions update (cancel at next billing date):
 *   https://github.com/dodopayments/dodopayments-node/blob/main/api.md
 * - Manage subscription example (cancel_at_next_billing_date):
 *   https://context7.com/dodopayments/dodopayments-node/llms.txt
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json().catch(() => ({}))
        let { subscription_id } = body || {}

        // Resolve the user's active subscription if not provided
        if (!subscription_id) {
            const { data: activeSub, error: subErr } = await supabase
                .from('dodo_subscriptions')
                .select('dodo_subscription_id, metadata')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .maybeSingle()

            if (subErr) {
                return NextResponse.json({ error: 'Failed to resolve subscription' }, { status: 500 })
            }

            subscription_id = activeSub?.dodo_subscription_id
            if (!subscription_id) {
                return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
            }
        }

        // Call Dodo Payments API to set cancel at next billing
        const client = getDodoClient()
        const updated = await client.subscriptions.update(subscription_id, {
            cancel_at_next_billing_date: true,
        })

        // Update local metadata to reflect cancellation intent
        const { data: existingLocal } = await supabase
            .from('dodo_subscriptions')
            .select('id, metadata')
            .eq('dodo_subscription_id', subscription_id)
            .maybeSingle()

        const newMetadata = {
            ...(existingLocal?.metadata ?? {}),
            cancel_at_next_billing_date: true,
        }

        await supabase
            .from('dodo_subscriptions')
            .update({ metadata: newMetadata })
            .eq('dodo_subscription_id', subscription_id)

        // Audit row (non-blocking)
        try {
            await (supabase as any).from('dodo_subscription_changes').insert({
                user_id: user.id,
                from_plan_id: null,
                to_plan_id: null,
                checkout_session_id: null,
                status: 'pending',
                change_type: 'cancellation',
                reason: 'User requested cancellation at next billing date',
                metadata: {
                    dodo_subscription_id: subscription_id,
                    source: 'api.dodopayments.subscription.cancel',
                },
            })
        } catch (auditErr) {
            console.warn('dodo_subscription_changes insert failed (non-blocking):', auditErr)
        }

        return NextResponse.json(
            {
                ok: true,
                subscription_id,
                remote: updated,
            },
            { status: 200 },
        )
    } catch (err: any) {
        console.error('Cancel subscription error:', err)
        const message =
            (err && (err.message || err.error || err.toString())) ||
            'Failed to schedule subscription cancellation'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}