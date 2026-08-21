import type { Metadata } from "next"
import Link from "next/link"

import { PRODUCT_TRUTH } from "@/config/product-truth"

export const metadata: Metadata = {
    title: "Pricing — FlipAEO",
    description: "Founding beta pricing for recurring AI visibility measurement and content delivery.",
}

export default function PricingPage() {
    return (
        <main className="mx-auto max-w-5xl px-6 py-20 text-stone-900">
            <header className="mx-auto max-w-3xl text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">One launch plan</p>
                <h1 className="mt-3 font-serif text-5xl tracking-tight">Measure the questions. Close the gaps.</h1>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-stone-600">
                    One site and 40 buyer questions measured in ChatGPT and Google AI Mode.
                    Each billing cycle delivers the report plus up to eight prioritised create
                    or refresh actions in one complete draft batch.
                </p>
            </header>

            <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-stone-300 bg-white p-8 shadow-sm">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="font-serif text-3xl">{PRODUCT_TRUTH.label}</h2>
                        <p className="mt-2 text-sm text-stone-600">
                            Founders receive the same measurement and production contract—there
                            are no velocity tiers or article-credit bundles.
                        </p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                        <div className="text-4xl font-semibold">${PRODUCT_TRUTH.introductoryPrice}</div>
                        <div className="text-xs text-stone-500">per month for the first three billing periods</div>
                    </div>
                </div>

                <ul className="mt-8 grid gap-3 text-sm text-stone-700 sm:grid-cols-2">
                    <li>One website</li>
                    <li>Up to {PRODUCT_TRUTH.trackedPromptAllowance} tracked buyer questions</li>
                    <li>ChatGPT + Google AI Mode</li>
                    <li>Up to {PRODUCT_TRUTH.actionAllowance} create/refresh actions per cycle</li>
                    <li>Visible findings and backlog</li>
                    <li>One complete, exportable draft batch</li>
                </ul>

                <div className="mt-8 rounded-xl bg-stone-50 p-4 text-sm leading-relaxed text-stone-600">
                    The planned continuing price is ${PRODUCT_TRUTH.continuingPrice}/month from
                    billing period four, disclosed before checkout. Checkout remains disabled
                    until that price phase and the full payment-to-batch path pass sandbox tests.
                </div>

                <Link href="/onboarding" className="mt-7 inline-flex rounded-lg bg-stone-900 px-5 py-3 text-sm font-semibold text-white">
                    Confirm your buyer questions
                </Link>
            </section>
        </main>
    )
}
