"use client"

import { useMemo, useState } from "react"
import { Check, LockKeyhole, Zap } from "lucide-react"

import { checkout } from "@/lib/dodopayments"
import { programPricing, type ProductTier } from "@/config/product-truth"

type Plan = {
    id: string
    name: string
    price: number
    currency: string
    tier: ProductTier
    cadence: string
}

function formatPrice(value: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(value)
}

export function ProgramCheckout({
    auditId,
    subjectUrl,
    plans,
    clusterCount,
    checkoutEnabled,
}: {
    auditId: string
    subjectUrl: string
    plans: Plan[]
    /** Qualified clusters this audit measured. Drives the quote. */
    clusterCount: number
    checkoutEnabled: boolean
}) {
    const site = new URL(subjectUrl)
    const [pattern, setPattern] = useState(
        `${site.protocol}//${site.host}/blog/{slug}/`,
    )
    const [confirmed, setConfirmed] = useState(false)
    const [loadingTier, setLoadingTier] = useState<ProductTier | null>(null)
    const [error, setError] = useState<string | null>(null)

    const validation = useMemo(() => {
        try {
            if (pattern.split("{slug}").length !== 2) {
                return "Use {slug} exactly once."
            }
            const preview = new URL(pattern.replace("{slug}", "example-article"))
            if (preview.protocol !== "https:") return "The pattern must use HTTPS."
            if (preview.hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, "")) {
                return "The pattern must use your audited website host."
            }
            return null
        } catch {
            return "Enter a complete URL pattern."
        }
    }, [pattern, site.hostname])

    const previews = ["first-topic", "second-topic", "pillar-guide"].map((slug) =>
        pattern.includes("{slug}") ? pattern.replace("{slug}", slug) : pattern,
    )

    async function begin(tier: ProductTier) {
        setError(null)
        if (validation || !confirmed || !checkoutEnabled) return
        setLoadingTier(tier)
        try {
            const result = await checkout({
                auditId,
                tier,
                publicationUrlPattern: pattern,
                returnUrl: `${window.location.origin}/subscribe?subscribed=1`,
            })
            window.location.assign(result.checkout_url)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to open checkout.")
            setLoadingTier(null)
        }
    }

    return (
        <div>
            <section className="border-b border-stone-200 bg-stone-50 p-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-serif text-xl text-stone-900">
                        Confirm where these articles will live
                    </h2>
                    <p className="mt-1 text-sm text-stone-600">
                        FlipAEO freezes every article URL and internal link before purchase.
                    </p>
                    <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-stone-600">
                        Publishing URL pattern
                    </label>
                    <input
                        value={pattern}
                        onChange={(event) => {
                            setPattern(event.target.value)
                            setConfirmed(false)
                        }}
                        className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-700"
                    />
                    {validation ? (
                        <p className="mt-2 text-xs text-red-600">{validation}</p>
                    ) : (
                        <div className="mt-3 space-y-1">
                            {previews.map((preview) => (
                                <div key={preview} className="truncate font-mono text-xs text-stone-500">
                                    {preview}
                                </div>
                            ))}
                        </div>
                    )}
                    <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-stone-700">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            disabled={Boolean(validation)}
                            onChange={(event) => setConfirmed(event.target.checked)}
                            className="mt-0.5"
                        />
                        I confirm this permanent URL pattern for this six-cluster program.
                    </label>
                </div>
            </section>

            {!checkoutEnabled && (
                <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                    <LockKeyhole className="h-4 w-4" />
                    Checkout is disabled until the delivery contract passes staging verification.
                </div>
            )}

            <div className="grid gap-px bg-stone-200 sm:grid-cols-3">
                {plans.map((plan) => {
                    const featured = plan.tier === "accelerate"
                    return (
                        <section
                            key={plan.id}
                            className={`flex flex-col bg-white p-6 ${featured ? "ring-2 ring-inset ring-stone-900" : ""}`}
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="font-serif text-3xl">{plan.name}</h3>
                                {featured && (
                                    <span className="rounded-full bg-stone-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
                                        Recommended
                                    </span>
                                )}
                            </div>
                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-bold tracking-tight">
                                    {formatPrice(plan.price, plan.currency)}
                                </span>
                                <span className="text-sm text-stone-400">/mo</span>
                            </div>
                            <p className="mt-2 min-h-10 text-sm font-medium text-stone-700">
                                {plan.cadence}
                            </p>
                            {/*
                              * The quote is derived, never fixed. A tier sets the price
                              * per period and clusters per period; the audit sets how
                              * many clusters there are. Periods follow, so any count is
                              * priced coherently without a new Dodo product.
                              */}
                            <p className="mt-2 text-sm text-stone-700">
                                {(() => {
                                    const quote = programPricing(clusterCount, plan.tier)
                                    return (
                                        <>
                                            <span className="font-semibold">
                                                {formatPrice(quote.total, plan.currency)}
                                            </span>{" "}
                                            total — {quote.billingPeriods} payment
                                            {quote.billingPeriods === 1 ? "" : "s"} of{" "}
                                            {formatPrice(quote.pricePerPeriod, plan.currency)}
                                            <span className="block text-xs text-stone-500">
                                                {formatPrice(quote.perCluster, plan.currency)} per
                                                cluster · {clusterCount} cluster
                                                {clusterCount === 1 ? "" : "s"} total
                                            </span>
                                        </>
                                    )
                                })()}
                            </p>
                            <div className="my-6 flex-1 space-y-3">
                                {[
                                    "The same finite six-cluster scope",
                                    "Source-linked gap evidence",
                                    "Frozen URLs and internal-link graph",
                                    "Complete cluster batches",
                                    "Automatic cancellation after scope delivery",
                                ].map((feature) => (
                                    <div key={feature} className="flex gap-2 text-sm text-stone-700">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0" />
                                        {feature}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => void begin(plan.tier)}
                                disabled={
                                    !checkoutEnabled ||
                                    !confirmed ||
                                    Boolean(validation) ||
                                    loadingTier !== null
                                }
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Zap className="h-4 w-4" />
                                {loadingTier === plan.tier ? "Opening checkout…" : `Choose ${plan.name}`}
                            </button>
                        </section>
                    )
                })}
            </div>
            {error && <p className="border-t border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        </div>
    )
}
