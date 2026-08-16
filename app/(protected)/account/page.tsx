import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AccountDashboard } from '@/components/account/account-dashboard'
import FeedbackForm from "@/components/FeedbackForm"
import { GlobalCard } from '@/components/ui/global-card'

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // Fetch user's payment history
  const { data: payments } = await supabase
    .from('dodo_payments')
    .select(`
      *,
      pricing_plan:dodo_pricing_plans(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch user's active subscription summary
  const { data: activeSub } = await supabase
    .from('dodo_subscriptions')
    .select('dodo_subscription_id, status, cancel_at_period_end, next_billing_date, current_period_end, canceled_at, metadata, price_snapshot, currency_snapshot, dodo_pricing_plans(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Normalize status to a strict union and coerce booleans
  const rawStatus = String((activeSub as any)?.status ?? 'pending').toLowerCase()
  const normalizedStatus =
    rawStatus === 'active'
      ? 'active'
      : rawStatus === 'cancelled' || rawStatus === 'canceled'
        ? 'cancelled'
        : rawStatus === 'expired'
          ? 'expired'
          : 'pending'

  const subscription =
    activeSub
      ? {
        subscription_id: String((activeSub as any)?.dodo_subscription_id || ''),
        status: normalizedStatus as 'pending' | 'active' | 'cancelled' | 'expired',
        plan_name: (activeSub as any)?.dodo_pricing_plans?.name as string | undefined,
        next_billing_date:
          (activeSub as any)?.next_billing_date ||
          (activeSub as any)?.metadata?.raw?.next_billing_date ||
          (activeSub as any)?.metadata?.next_billing_date ||
          undefined,
        cancel_at_period_end:
          typeof (activeSub as any)?.cancel_at_period_end === 'boolean'
            ? (activeSub as any).cancel_at_period_end
            : Boolean(
              (activeSub as any)?.metadata?.raw?.cancel_at_next_billing_date ??
              (activeSub as any)?.metadata?.cancel_at_next_billing_date ??
              false,
            ),
        current_period_end:
          (activeSub as any)?.current_period_end || undefined,
        canceled_at:
          (activeSub as any)?.canceled_at || undefined,
        price_snapshot: (activeSub as any)?.price_snapshot ?? null,
        currency_snapshot: (activeSub as any)?.currency_snapshot ?? null,
      }
      : null

  return (
    <div className="container mx-auto">
      <GlobalCard contentClassName="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Account</h1>
          <p className="text-muted-foreground mt-2">
            Manage your profile, recurring subscription, and invoice history
          </p>
        </div>

        <AccountDashboard
          user={user}
          payments={payments || []}
          subscription={subscription}
        />
        <FeedbackForm userId={user.id} />
      </GlobalCard>
    </div>
  )
}

export const metadata = {
  title: 'Account',
  description: 'Manage your account, recurring subscription, and invoice history',
}
