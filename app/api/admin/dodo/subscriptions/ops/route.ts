import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

function isAuthorized(req: NextRequest): boolean {
    const provided = (req.headers.get('x-admin-api-key') || '').trim()
    const expected = (process.env.ADMIN_API_KEY || '').trim()
    return Boolean(expected) && provided === expected
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = createAdminClient()
        const url = new URL(req.url)
        const limitParam = Number(url.searchParams.get('limit'))
        const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 1000 ? limitParam : 100

        const fields =
            'dodo_subscription_id, user_id, status, cancel_at_period_end, next_billing_date, current_period_end, canceled_at, dodo_pricing_plans(name)'

        const { data: scheduledCancellations, error: errScheduled } = await supabase
            .from('dodo_subscriptions')
            .select(fields)
            .eq('cancel_at_period_end', true)
            .order('next_billing_date', { ascending: true, nullsFirst: false })
            .limit(limit)

        const { data: upcomingRenewals, error: errUpcoming } = await supabase
            .from('dodo_subscriptions')
            .select(fields)
            .eq('status', 'active')
            // not null next_billing_date
            .not('next_billing_date', 'is', null as any)
            .order('next_billing_date', { ascending: true, nullsFirst: false })
            .limit(limit)

        const { data: recentCancelled, error: errRecent } = await supabase
            .from('dodo_subscriptions')
            .select(fields)
            .or('status.eq.cancelled,canceled_at.not.is.null')
            .order('canceled_at', { ascending: false, nullsFirst: false })
            .limit(limit)

        return NextResponse.json(
            {
                ok: true,
                scheduledCancellations: scheduledCancellations || [],
                upcomingRenewals: upcomingRenewals || [],
                recentCancelled: recentCancelled || [],
                warnings: [
                    ...(errScheduled ? [`scheduledCancellations: ${errScheduled.message}`] : []),
                    ...(errUpcoming ? [`upcomingRenewals: ${errUpcoming.message}`] : []),
                    ...(errRecent ? [`recentCancelled: ${errRecent.message}`] : []),
                ],
            },
            { status: 200 },
        )
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || 'Failed to fetch subscription operations' },
            { status: 500 },
        )
    }
}