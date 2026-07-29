import { cookies } from "next/headers"
import Link from "next/link"
import { AlertCircle, Layers3, Sparkles } from "lucide-react"

import { getAuditScope } from "@/actions/harvest"
import { PRODUCT_TRUTH, type ProductTier } from "@/config/product-truth"
import { ProgramCheckout } from "@/components/subscribe/ProgramCheckout"
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
    if (!user) {
        return {
            user: null,
            brand: null,
            plans: [],
            subscription: null,
            scopeDelivered: false,
        }
    }

    const [{ data: brand }, { data: plans }, { data: subscription }] =
        await Promise.all([
            supabase
                .from("brand_details")
                .select("id, website_url, current_audit_id")
                .eq("user_id", user.id)
                .limit(1)
                .maybeSingle(),
            supabase
                .from("dodo_pricing_plans")
                .select(
                    "id, name, description, price, currency, dodo_product_id",
                )
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

    const { data: completedProgram } = subscription?.dodo_subscription_id
        ? await (supabase as any)
              .from("programs")
              .select("id")
              .eq("dodo_subscription_id", subscription.dodo_subscription_id)
              .eq("scope_status", "scope_delivered")
              .limit(1)
              .maybeSingle()
        : { data: null }

    return {
        user,
        brand,
        plans: (plans || []) as PlanRow[],
        subscription,
        scopeDelivered: Boolean(completedProgram),
    }
}

export default async function SubscribePage() {
    await cookies()
    const { user, brand, plans, subscription, scopeDelivered } =
        await loadPageData()

    if (subscription?.status === "active") {
        return (
            <main className="min-h-screen text-stone-900">
                <RealtimeSubscriptionSync userId={user?.id} />
                <ManageSubscription
                    subscription={{
                        subscription_id: subscription.dodo_subscription_id,
                        status: "active",
                        plan_name: plans.find(
                            (plan) => plan.id === subscription.pricing_plan_id,
                        )?.name,
                        next_billing_date: subscription.next_billing_date || undefined,
                        cancel_at_period_end: Boolean(
                            subscription.cancel_at_period_end,
                        ),
                        current_period_end:
                            subscription.current_period_end || undefined,
                        canceled_at: subscription.canceled_at || undefined,
                        price_snapshot: subscription.price_snapshot ?? null,
                        currency_snapshot: subscription.currency_snapshot ?? null,
                    }}
                    plans={plans}
                    userEmail={user?.email || null}
                    finiteScopeDelivered={scopeDelivered}
                />
            </main>
        )
    }

    const scope = brand?.id ? await getAuditScope(brand.id) : null
    const recognizedPlans = plans
        .map((plan) => {
            const tier = plan.name.toLowerCase() as ProductTier
            const truth = PRODUCT_TRUTH.tiers[tier]
            if (
                !truth ||
                Number(plan.price) !== truth.price ||
                String(plan.currency || "USD").toUpperCase() !== truth.currency
            ) {
                return null
            }
            return {
                id: plan.id,
                name: truth.label,
                price: truth.price,
                currency: truth.currency,
                tier,
                cadence: truth.cadence,
            }
        })
        .filter(Boolean) as Array<{
        id: string
        name: string
        price: number
        currency: string
        tier: ProductTier
        cadence: string
    }>

    return (
        <main className="flex min-h-screen items-center justify-center py-8 text-stone-900">
            <RealtimeSubscriptionSync userId={user?.id} />
            <GlobalCard className="w-full max-w-6xl" contentClassName="overflow-hidden">
                <header className="border-b border-stone-100 px-6 py-10 text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-600">
                        <Sparkles className="h-3.5 w-3.5" />
                        Finite six-cluster program
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        One verified scope. Three delivery speeds.
                    </h1>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-stone-500 sm:text-base">
                        Each program delivers the same six priority clusters. The tier
                        changes cadence, not scope. Billing is scheduled to end after all
                        six clusters are delivered.
                    </p>
                </header>

                {!scope ? (
                    <EmptyState
                        title="Complete an evidence-backed audit first"
                        body="Checkout is only available after a current immutable audit measures a qualified six-cluster scope."
                    />
                ) : !scope.checkoutEligible ? (
                    <EmptyState
                        title="This audit is not subscription-eligible"
                        body={
                            scope.eligibilityReason ||
                            "The measured scope does not currently contain six qualified clusters and at least 25 articles."
                        }
                    >
                        <div className="mt-4 flex justify-center gap-6 text-sm text-stone-600">
                            <span>{scope.recommendedClusterIds.length} qualified priority clusters</span>
                            <span>{scope.recommendedArticleCount} articles in measured scope</span>
                        </div>
                        <p className="mx-auto mt-4 max-w-xl text-xs text-stone-500">
                            You can share this audit or refresh it after adding products,
                            services, or markets. No subscription or one-off checkout is
                            offered for an undersized scope.
                        </p>
                    </EmptyState>
                ) : recognizedPlans.length !== 3 ? (
                    <EmptyState
                        title="Checkout plans are not fully configured"
                        body="Close, Accelerate, and Dominate must all be active before checkout can open."
                    />
                ) : (
                    <ProgramCheckout
                        auditId={scope.auditId}
                        subjectUrl={brand?.website_url || ""}
                        plans={recognizedPlans}
                        checkoutEnabled={
                            process.env.CLOSED_POOL_CHECKOUT_ENABLED === "true"
                        }
                    />
                )}
            </GlobalCard>
        </main>
    )
}

function EmptyState({
    title,
    body,
    children,
}: {
    title: string
    body: string
    children?: React.ReactNode
}) {
    return (
        <section className="px-6 py-16 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <AlertCircle className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-serif text-2xl">{title}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-stone-600">{body}</p>
            {children}
            <Link
                href="/onboarding"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
                <Layers3 className="h-4 w-4" />
                View audit
            </Link>
        </section>
    )
}
