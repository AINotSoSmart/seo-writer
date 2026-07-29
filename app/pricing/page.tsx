import type { Metadata } from "next"
import Link from "next/link"
import { Check, LockKeyhole } from "lucide-react"

import { Footer } from "@/components/landing/Footer"
import { Navbar } from "@/components/landing/Navbar"
import { PRODUCT_TRUTH, type ProductTier } from "@/config/product-truth"
import { generateMetadata as generateSeoMetadata } from "@/lib/seo"
import { createAdminClient } from "@/utils/supabase/admin"

export const metadata: Metadata = generateSeoMetadata({
    title: "Six-cluster program delivery speeds",
    description:
        "Choose how quickly FlipAEO delivers the same evidence-backed six-cluster scope: one, two, or four complete clusters per month.",
    keywords: ["FlipAEO pricing", "topic cluster program", "content delivery"],
    canonical: "/pricing",
})

async function activePlans() {
    try {
        const supabase = createAdminClient() as any
        const { data } = await supabase
            .from("dodo_pricing_plans")
            .select("id, name, price, currency")
            .eq("is_active", true)
            .order("price")
        return (data || [])
            .map((row: any) => {
                const tier = String(row.name).toLowerCase() as ProductTier
                const truth = PRODUCT_TRUTH.tiers[tier]
                return truth &&
                    Number(row.price) === truth.price &&
                    String(row.currency || "USD").toUpperCase() === truth.currency
                    ? { ...row, tier, truth }
                    : null
            })
            .filter(Boolean)
    } catch {
        return []
    }
}

export default async function PricingPage() {
    const plans = await activePlans()
    const checkoutEnabled = process.env.CLOSED_POOL_CHECKOUT_ENABLED === "true"

    return (
        <div className="min-h-screen bg-stone-50 text-stone-900">
            <Navbar />
            <main className="mx-auto max-w-6xl px-6 pb-24 pt-36">
                <header className="mx-auto max-w-3xl text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        One fixed scope
                    </p>
                    <h1 className="mt-4 font-serif text-5xl md:text-7xl">
                        Pay for delivery speed, not filler.
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-stone-600">
                        Every eligible program contains the same six qualified clusters.
                        Faster tiers change the schedule only. Checkout requires a fresh
                        eligible audit and a confirmed permanent URL pattern.
                    </p>
                </header>

                {!checkoutEnabled && (
                    <div className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <LockKeyhole className="h-4 w-4" />
                        Public checkout remains disabled until the staging delivery test passes.
                    </div>
                )}

                <section className="mt-12 grid gap-4 md:grid-cols-3">
                    {plans.map((plan: any) => (
                        <article key={plan.id} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-7">
                            <h2 className="font-serif text-3xl">{plan.truth.label}</h2>
                            <div className="mt-5 text-4xl font-bold">
                                {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: plan.truth.currency,
                                }).format(plan.truth.price)}
                                <span className="text-sm font-normal text-stone-400"> / month</span>
                            </div>
                            <p className="mt-3 min-h-12 text-sm font-medium text-stone-700">
                                {plan.truth.cadence}
                            </p>
                            <ul className="my-7 flex-1 space-y-3">
                                {[
                                    "The same six-cluster scope",
                                    "Frozen URLs and link graph",
                                    "Whole-cluster delivery",
                                    "End-of-scope cancellation request",
                                ].map((item) => (
                                    <li key={item} className="flex gap-2 text-sm text-stone-600">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0" /> {item}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href="/login?next=/onboarding"
                                className="rounded-lg bg-stone-950 px-4 py-3 text-center text-sm font-semibold text-white"
                            >
                                Run the eligibility audit
                            </Link>
                        </article>
                    ))}
                </section>

                {plans.length === 0 && (
                    <p className="mt-12 text-center text-sm text-stone-500">
                        Delivery plans are not currently configured for sale.
                    </p>
                )}

                <section className="mx-auto mt-16 max-w-3xl rounded-2xl border border-stone-200 bg-white p-7">
                    <h2 className="font-serif text-2xl">What happens when the scope is too small?</h2>
                    <p className="mt-3 text-sm leading-6 text-stone-600">
                        FlipAEO shows the measured evidence but hides all subscription
                        prices and checkout controls for that audit. It does not invent
                        filler or advertise a one-off product that does not exist.
                    </p>
                </section>
            </main>
            <Footer />
        </div>
    )
}
