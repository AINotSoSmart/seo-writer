import { cookies } from "next/headers"
import { Sparkles } from "lucide-react"

import ManageSubscription from "@/components/subscribe/ManageSubscription"
import RealtimeSubscriptionSync from "@/components/subscribe/RealtimeSubscriptionSync"
import { GlobalCard } from "@/components/ui/global-card"
import { createClient } from "@/utils/supabase/server"

type PlanRow = {
    id: string
    name: string
    description: string | null
    price: number
    currency: string | null
    dodo_product_id: string
}

async function loadPageData() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { user: null, plans: [], subscription: null }

    const [{ data: plans }, { data: subscription }] = await Promise.all([
        supabase
            .from("dodo_pricing_plans")
            .select("id, name, description, price, currency, dodo_product_id")
            .eq("is_active", true)
            .order("price", { ascending: true }),
        supabase
            .from("dodo_subscriptions")
            .select(
                "dodo_subscription_id, status, pricing_plan_id, next_billing_date, cancel_at_period_end, current_period_end, canceled_at, price_snapshot, currency_snapshot",
            )
            .eq("user_id", user.id)
            .in("status", ["active", "pending"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ])

    return { user, plans: (plans || []) as PlanRow[], subscription }
}

export default async function SubscribePage() {
    await cookies()
    const { user, plans, subscription } = await loadPageData()

    if (subscription?.status === "active") {
        return (
            <main className="min-h-screen text-stone-900">
                <RealtimeSubscriptionSync userId={user?.id} />
                <ManageSubscription
                    subscription={{
                        subscription_id: subscription.dodo_subscription_id,
                        status: "active",
                        plan_name: plans.find((plan) => plan.id === subscription.pricing_plan_id)?.name,
                        next_billing_date: subscription.next_billing_date || undefined,
                        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
                        current_period_end: subscription.current_period_end || undefined,
                        canceled_at: subscription.canceled_at || undefined,
                        price_snapshot: subscription.price_snapshot ?? null,
                        currency_snapshot: subscription.currency_snapshot ?? null,
                    }}
                    plans={plans}
                    userEmail={user?.email || null}
                />
            </main>
        )
    }

    return (
        <main className="flex min-h-screen items-center justify-center py-8 text-stone-900">
            <GlobalCard className="w-full max-w-3xl" contentClassName="overflow-hidden">
                <section className="px-6 py-14 text-center sm:px-12">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-600">
                        <Sparkles className="h-3.5 w-3.5" /> Founding beta
                    </div>
                    <h1 className="font-serif text-4xl tracking-tight">
                        One recurring plan, built around measured work
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-stone-600 sm:text-base">
                        One site, 40 tracked buyer questions, ChatGPT and Google AI Mode,
                        and up to eight prioritised create or refresh actions in each
                        billing cycle. Findings that cannot be solved with owned content
                        remain visible without consuming a production slot.
                    </p>
                    <div className="mx-auto mt-8 max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
                        Checkout remains closed until the recurring payment-to-complete-batch
                        path passes end to end. No finite cluster plan can be purchased.
                    </div>
                </section>
            </GlobalCard>
        </main>
    )
}
