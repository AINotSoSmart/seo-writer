import type { Metadata } from "next"
import Link from "next/link"
import { Check, LockKeyhole } from "lucide-react"

import { Footer } from "@/components/landing/Footer"
import { Navbar } from "@/components/landing/Navbar"
import { PRODUCT_TRUTH, type ProductTier } from "@/config/product-truth"
import { generateMetadata as generateSeoMetadata } from "@/lib/seo"
import { createAdminClient } from "@/utils/supabase/admin"

export const metadata: Metadata = generateSeoMetadata({
    title: "Pricing — One Agency Month, Your Whole Programme",
    description:
        "From $249 a month, against the $3,000-$15,000 a B2B SaaS content agency charges. Your audit sets the size, the tier sets the speed, and billing ends when the work does.",
    keywords: [
        "saas seo agency pricing",
        "b2b saas content marketing cost",
        "seo agency alternative pricing",
        "content program pricing",
    ],
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
                        The agency alternative
                    </p>
                    <h1 className="mt-4 font-serif text-5xl md:text-7xl">
                        One agency month. Your whole programme.
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-stone-600">
                        A B2B SaaS content agency runs $3,000 to $15,000 a month, indefinitely.
                        This is the same work — research, planning, writing, internal linking,
                        delivery — priced as software and scoped to end. Your free audit decides
                        how big the job is. The plan below only decides how fast it arrives.
                    </p>
                    <p className="mt-4 text-sm leading-6 text-stone-500">
                        A <strong className="font-medium text-stone-700">cluster</strong> is one
                        pillar article plus the 8 to 15 supporting pieces around it, all linked
                        to each other. Your audit decides how many you get.
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
                                    "The same scope, whichever plan",
                                    "Internal links that work on arrival",
                                    "Clusters arrive whole, never half-built",
                                    "Cancels itself when the work is done",
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
                                Show me what I&rsquo;m missing
                            </Link>
                        </article>
                    ))}
                </section>

                {plans.length === 0 && (
                    <p className="mt-12 text-center text-sm text-stone-500">
                        Delivery plans are not currently configured for sale.
                    </p>
                )}

                <section className="mx-auto mt-16 grid max-w-4xl gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-stone-200 bg-white p-7">
                        <h2 className="font-serif text-2xl">How your total is worked out</h2>
                        <p className="mt-3 text-sm leading-6 text-stone-600">
                            Count the clusters your audit found, divide by how many arrive each
                            month, round up. That is how many monthly payments you make, and then
                            it stops. Nine clusters on Accelerate is five months. Four clusters on
                            Close is four months. You see the exact figure before you pay anything.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-7">
                        <h2 className="font-serif text-2xl">If nothing qualifies, we say so</h2>
                        <p className="mt-3 text-sm leading-6 text-stone-600">
                            A smaller site is simply a smaller programme — there is no minimum you
                            have to clear. But if your audit turns up nothing worth building, you
                            get the evidence and no checkout. We would rather lose the sale than
                            invent filler to reach a price.
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    )
}
