import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AccountDashboard } from '@/components/account/account-dashboard'
import FeedbackForm from "@/components/FeedbackForm"

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

  // Get user's current credit balance
  const { data: credits } = await supabase
    .from('credits')
    .select('credits')
    .eq('user_id', user.id)
    .single()

  // Fetch user's active subscription summary
  const { data: activeSub } = await supabase
    .from('dodo_subscriptions')
    .select('dodo_subscription_id, status, metadata, dodo_pricing_plans(name, credits)')
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
          (activeSub as any)?.metadata?.raw?.next_billing_date ||
          (activeSub as any)?.metadata?.next_billing_date ||
          undefined,
        cancel_at_period_end: Boolean(
          (activeSub as any)?.metadata?.raw?.cancel_at_next_billing_date ??
          (activeSub as any)?.metadata?.cancel_at_next_billing_date ??
          false,
        ),
      }
      : null

  // Calculate total credits purchased from completed payments
  const totalCreditsPurchased = payments
    ?.filter(payment => payment.status === 'completed')
    ?.reduce((sum, payment) => sum + payment.credits, 0) || 0

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Account</h1>
        <p className="text-muted-foreground mt-2">
          Manage your profile, view payment history, and track your credits
        </p>
      </div>

      <AccountDashboard
        user={user}
        payments={payments || []}
        currentCredits={credits?.credits || 0}
        totalCreditsPurchased={totalCreditsPurchased}
        subscription={subscription}
      />
      <FeedbackForm userId={user.id} />
    </div>
  )
}

export const metadata = {
  title: 'Account',
  description: 'Manage your account, view payment history, and track credits',
}