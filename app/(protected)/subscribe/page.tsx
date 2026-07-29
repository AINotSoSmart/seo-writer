import { cookies } from "next/headers"
import Image from "next/image"
import { Check, Sparkles, Zap } from "lucide-react"
import { createClient } from "@/utils/supabase/server"
import SubscribeButton from "@/components/subscribe/SubscribeButton"
import ManageSubscription from "@/components/subscribe/ManageSubscription"
import RealtimeSubscriptionSync from "@/components/subscribe/RealtimeSubscriptionSync"
import { GlobalCard } from "@/components/ui/global-card"
import { CustomSpinner } from "@/components/CustomSpinner"

function formatPrice(value: number | string, currency: string) {
    const amount = typeof value === "number" ? value : Number(value || 0)
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
    } catch {
        return `$${amount.toFixed(2)}`
    }
}

type PlanRow = {
    id: string
    name: string
    description: string | null
    price: number
    credits: number | null
    currency: string | null
    dodo_product_id: string
}

async function getPlans(): Promise<PlanRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("dodo_pricing_plans")
        .select("id, name, description, price, credits, currency, dodo_product_id")
        .eq("is_active", true)
        .order("price", { ascending: true })

    return error ? [] : (data || []) as PlanRow[]
}

async function getUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

async function getLatestSubscription(userId: string) {
    const supabase = await createClient()
    const fields = "dodo_subscription_id, status, pricing_plan_id, next_billing_date, cancel_at_period_end, current_period_end, canceled_at, price_snapshot, currency_snapshot"

    for (const status of ["active", "pending"] as const) {
        const { data, error } = await supabase
            .from("dodo_subscriptions")
            .select(fields)
            .eq("user_id", userId)
            .eq("status", status)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) return null
        if (data) return data
    }

    const { data, error } = await supabase
        .from("dodo_subscriptions")
        .select(fields)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    return error ? null : data
}

const tierCopy: Record<string, { velocity: string; description: string }> = {
    close: {
        velocity: "1 complete cluster / month",
        description: "Close the highest-priority part of your map at a steady pace.",
    },
    accelerate: {
        velocity: "2 complete clusters / month",
        description: "Move through the same verified scope twice as fast.",
    },
    dominate: {
        velocity: "4 complete clusters / month",
        description: "Ship four complete, interlinked clusters every month.",
    },
}

export default async function SubscribePage() {
    await cookies()
    const [plans, user] = await Promise.all([getPlans(), getUser()])

    let subscriptionSummary: {
        subscription_id: string
        status: "pending" | "active" | "cancelled" | "expired"
        plan_name?: string
        next_billing_date?: string
        cancel_at_period_end?: boolean
        current_period_end?: string
        canceled_at?: string
        price_snapshot?: number | null
        currency_snapshot?: string | null
    } | null = null

    if (user) {
        const row = await getLatestSubscription(user.id)
        if (row?.dodo_subscription_id) {
            const rawStatus = String(row.status || "").toLowerCase()
            const status = rawStatus === "active"
                ? "active"
                : rawStatus === "pending"
                    ? "pending"
                    : rawStatus === "cancelled" || rawStatus === "canceled"
                        ? "cancelled"
                        : "expired"

            subscriptionSummary = {
                subscription_id: row.dodo_subscription_id,
                status,
                plan_name: plans.find((plan) => plan.id === row.pricing_plan_id)?.name,
                next_billing_date: row.next_billing_date || undefined,
                cancel_at_period_end: Boolean(row.cancel_at_period_end),
                current_period_end: row.current_period_end || undefined,
                canceled_at: row.canceled_at || undefined,
                price_snapshot: row.price_snapshot ?? null,
                currency_snapshot: row.currency_snapshot ?? null,
            }
        }
    }

    if (subscriptionSummary?.status === "active") {
        return (
            <main className="flex min-h-screen flex-col items-center font-sans text-stone-900">
                <RealtimeSubscriptionSync userId={user?.id} />
                <div className="w-full">
                    <ManageSubscription
                        subscription={subscriptionSummary}
                        plans={plans}
                        userEmail={user?.email || null}
                    />
                </div>
            </main>
        )
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center py-8 font-sans text-stone-900">
            <RealtimeSubscriptionSync userId={user?.id} />
            <GlobalCard className="w-full max-w-6xl" contentClassName="overflow-hidden">
                <div className="border-b border-stone-100 px-6 pb-7 pt-10 text-center">
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-3 py-1">
                        <Sparkles className="h-3.5 w-3.5 fill-stone-600/20 text-stone-600" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">
                            Choose delivery velocity
                        </span>
                    </div>
                    <h1 className="mb-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
                        Your scope is fixed. Choose the speed.
                    </h1>
                    <p className="mx-auto max-w-2xl text-sm leading-relaxed text-stone-500 sm:text-base">
                        Every tier closes the same evidence-backed map. Faster tiers ship more
                        complete, interlinked clusters each month.
                    </p>
                </div>

                {plans.length > 0 ? (
                    <div className="grid gap-px bg-stone-200 sm:grid-cols-3">
                        {plans.map((plan) => {
                            const key = plan.name.toLowerCase()
                            const copy = tierCopy[key] || {
                                velocity: `${plan.credits ?? 0} generation credits / month`,
                                description: plan.description || "Evidence-backed content delivery.",
                            }
                            const featured = key === "accelerate"

                            return (
                                <section
                                    key={plan.id}
                                    className={`flex flex-col bg-white p-6 ${featured ? "ring-2 ring-inset ring-brand-300" : ""}`}
                                >
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between gap-3">
                                            <h2 className="font-serif text-3xl text-stone-900">{plan.name}</h2>
                                            {featured && (
                                                <span className="rounded-full bg-stone-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
                                                    Recommended
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-2 min-h-10 text-sm leading-relaxed text-stone-500">
                                            {copy.description}
                                        </p>
                                    </div>
                                    <div className="mb-1 flex items-baseline gap-1">
                                        <span className="text-4xl font-bold tracking-tighter text-stone-900">
                                            {formatPrice(plan.price, plan.currency ?? "USD")}
                                        </span>
                                        <span className="text-sm font-medium text-stone-400">/mo</span>
                                    </div>
                                    <p className="mb-6 text-sm font-semibold text-stone-700">{copy.velocity}</p>

                                    <div className="mb-7 flex-1 space-y-3">
                                        <FeatureItem text="Finite scope disclosed before purchase" />
                                        <FeatureItem text="Source URL for every claimed gap" />
                                        <FeatureItem text="Whole clusters shipped together" />
                                        <FeatureItem text="Research, citations, links, and images" />
                                        <FeatureItem text="WordPress-ready drafts and manual export" />
                                    </div>

                                    <SubscribeButton
                                        productId={plan.dodo_product_id}
                                        isAuthenticated={Boolean(user)}
                                        className="w-full cursor-pointer rounded-lg bg-gradient-to-b from-stone-800 to-stone-950 text-sm font-semibold text-white transition-all hover:from-stone-700 hover:to-stone-900 active:scale-[0.98]"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Zap className="h-4 w-4 fill-white/20" />
                                            Choose {plan.name}
                                        </span>
                                    </SubscribeButton>
                                </section>
                            )
                        })}
                    </div>
                ) : (
                    <div className="p-12 text-center text-stone-500">
                        <CustomSpinner className="mx-auto mb-2 h-10 w-10" />
                        <p>No purchasable plans are active yet.</p>
                    </div>
                )}

                <div className="flex items-center justify-center border-t border-stone-100 bg-stone-50/50 p-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                        Secure payments by{" "}
                        <Image
                            src="/dodo-logo.png"
                            alt="Dodo Payments"
                            width={70}
                            height={14}
                            className="ml-1 inline-block align-middle"
                        />
                    </span>
                </div>
            </GlobalCard>
        </main>
    )
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-stone-900" strokeWidth={3} />
            <span className="text-sm font-medium leading-relaxed text-stone-700">{text}</span>
        </div>
    )
}
