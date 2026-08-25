import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AccountDashboard } from '@/components/account/account-dashboard'
import FeedbackForm from "@/components/FeedbackForm"
import { UserRound } from 'lucide-react'
import { ProductHeader, ProductPage } from '@/components/product/product-page'

type SubscriptionRecord = {
  dodo_subscription_id: string | null
  status: string | null
  cancel_at_period_end: boolean | null
  next_billing_date: string | null
  current_period_end: string | null
  canceled_at: string | null
  metadata: {
    raw?: {
      next_billing_date?: string
      cancel_at_next_billing_date?: boolean
    }
    next_billing_date?: string
    cancel_at_next_billing_date?: boolean
  } | null
  price_snapshot: number | null
  currency_snapshot: string | null
  dodo_pricing_plans: { name?: string | null } | { name?: string | null }[] | null
}

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
  const subscriptionRow = activeSub as unknown as SubscriptionRecord | null
  const planRelation = subscriptionRow?.dodo_pricing_plans
  const planName = Array.isArray(planRelation)
    ? planRelation[0]?.name
    : planRelation?.name
  const rawStatus = String(subscriptionRow?.status ?? 'pending').toLowerCase()
  const normalizedStatus =
    rawStatus === 'active'
      ? 'active'
      : rawStatus === 'cancelled' || rawStatus === 'canceled'
        ? 'cancelled'
        : rawStatus === 'expired'
          ? 'expired'
          : 'pending'

  const subscription =
    subscriptionRow
      ? {
        subscription_id: String(subscriptionRow.dodo_subscription_id || ''),
        status: normalizedStatus as 'pending' | 'active' | 'cancelled' | 'expired',
        plan_name: planName || undefined,
        next_billing_date:
          subscriptionRow.next_billing_date ||
          subscriptionRow.metadata?.raw?.next_billing_date ||
          subscriptionRow.metadata?.next_billing_date ||
          undefined,
        cancel_at_period_end:
          typeof subscriptionRow.cancel_at_period_end === 'boolean'
            ? subscriptionRow.cancel_at_period_end
            : Boolean(
              subscriptionRow.metadata?.raw?.cancel_at_next_billing_date ??
              subscriptionRow.metadata?.cancel_at_next_billing_date ??
              false,
            ),
        current_period_end:
          subscriptionRow.current_period_end || undefined,
        canceled_at:
          subscriptionRow.canceled_at || undefined,
        price_snapshot: subscriptionRow.price_snapshot ?? null,
        currency_snapshot: subscriptionRow.currency_snapshot ?? null,
      }
      : null

  return (
    <ProductPage width="reading">
      <ProductHeader
        eyebrow="Workspace administration"
        icon={UserRound}
        title="Account"
        description="Manage your profile, recurring subscription, billing schedule, and invoice history."
      />
      <div className="mt-6">
        <AccountDashboard
          user={user}
          payments={payments || []}
          subscription={subscription}
        />
        <FeedbackForm userId={user.id} />
      </div>
    </ProductPage>
  )
}

export const metadata = {
  title: 'Account',
  description: 'Manage your account, recurring subscription, and invoice history',
}
