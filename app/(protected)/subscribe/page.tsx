import { cookies } from "next/headers"
import { Sparkles } from "lucide-react"

import ManageSubscription from "@/components/subscribe/ManageSubscription"
import RealtimeSubscriptionSync from "@/components/subscribe/RealtimeSubscriptionSync"
import SubscribeButton from "@/components/subscribe/SubscribeButton"
import { GlobalCard } from "@/components/ui/global-card"
import { PRODUCT_TRUTH } from "@/config/product-truth"
import { defaultPublicationPattern } from "@/lib/subscription/publication-pattern"
import { createAdminClient } from "@/utils/supabase/admin"
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
    if (!user) {
        return {
            user: null,
            plans: [],
            subscription: null,
            brand: null,
            promptCount: 0,
        }
    }

    const [{ data: plans }, { data: subscription }, { data: brands }] = await Promise.all([
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
        supabase
            .from("brand_details")
            .select("id, website_url")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .limit(2),
    ])

    const brand = brands?.length === 1 ? brands[0] : null
    let promptCount = 0
    if (brand) {
        const { count } = await supabase
            .from("tracked_prompts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("brand_id", brand.id)
            .eq("tracking_status", "active")
            .is("retired_at", null)
        promptCount = count || 0
    }

    const visiblePlans = [...(plans || [])]
    if (
        subscription?.pricing_plan_id &&
        !visiblePlans.some((plan) => plan.id === subscription.pricing_plan_id)
    ) {
        // Active checkout plans are public under RLS; an inactive historical
        // plan is loaded only by the exact id on this user's own subscription.
        const admin = createAdminClient()
        const { data: historicalPlan } = await admin
            .from("dodo_pricing_plans")
            .select("id, name, description, price, currency, dodo_product_id")
            .eq("id", subscription.pricing_plan_id)
            .maybeSingle()
        if (historicalPlan) visiblePlans.push(historicalPlan)
    }

    return {
        user,
        plans: visiblePlans.map((plan) => ({
            ...plan,
            dodo_product_id: plan.dodo_product_id || "",
        })) as PlanRow[],
        subscription,
        brand,
        promptCount,
    }
}

export default async function SubscribePage() {
    await cookies()
    const { user, plans, subscription, brand, promptCount } = await loadPageData()

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

    if (subscription?.status === "pending") {
        return (
            <main className="flex min-h-screen items-center justify-center py-8 text-stone-900">
                <RealtimeSubscriptionSync userId={user?.id} />
                <GlobalCard className="w-full max-w-2xl">
                    <section className="px-6 py-14 text-center sm:px-12">
                        <Sparkles className="mx-auto h-7 w-7 text-amber-600" />
                        <h1 className="mt-4 font-serif text-4xl tracking-tight">
                            Activating your subscription
                        </h1>
                        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-stone-600">
                            Payment confirmation is still being reconciled. This page updates
                            automatically; do not open a second checkout.
                        </p>
                    </section>
                </GlobalCard>
            </main>
        )
    }

    const checkoutConfigured =
        process.env.FOUNDING_CHECKOUT_ENABLED === "true" &&
        Boolean(process.env.DODO_FOUNDING_PRODUCT_ID?.trim()) &&
        Boolean(process.env.DODO_FOUNDING_DISCOUNT_CODE?.trim())
    const disabledReason = !brand
        ? "Complete onboarding for exactly one website before checkout."
        : promptCount === 0 || promptCount > PRODUCT_TRUTH.trackedPromptAllowance
          ? `Confirm up to ${PRODUCT_TRUTH.trackedPromptAllowance} buyer questions first (${promptCount} currently active).`
          : !checkoutConfigured
            ? "Checkout is code-complete but remains closed until the sandbox price phase is configured and verified."
            : null

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
                        One site, up to {PRODUCT_TRUTH.trackedPromptAllowance} tracked buyer questions, ChatGPT and Google AI Mode,
                        and up to eight prioritised create or refresh actions in each
                        billing cycle. Findings that cannot be solved with owned content
                        remain visible without consuming a production slot.
                    </p>
                    <div className="mx-auto mt-8 max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
                        <strong>${PRODUCT_TRUTH.introductoryPrice}/month</strong> for billing
                        periods 1–{PRODUCT_TRUTH.introductoryPeriods}, then
                        {" "}<strong>${PRODUCT_TRUTH.continuingPrice}/month</strong> from
                        period {PRODUCT_TRUTH.introductoryPeriods + 1}. Cancel anytime;
                        completed reports and drafts remain available.
                    </div>
                    <div className="mx-auto mt-6 max-w-lg">
                        <SubscribeButton
                            defaultPublicationUrlPattern={defaultPublicationPattern(
                                brand?.website_url || "",
                            )}
                            disabledReason={disabledReason}
                            className="w-full rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                        />
                    </div>
                </section>
            </GlobalCard>
        </main>
    )
}
