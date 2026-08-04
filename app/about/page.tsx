import type { Metadata } from "next"
import Link from "next/link"

import { Footer } from "@/components/landing/Footer"
import { Navbar } from "@/components/landing/Navbar"

export const metadata: Metadata = {
    title: "About FlipAEO — why we sell a programme that ends",
    description:
        "Built by a solo founder who published for years before automating it. Why FlipAEO shows its sources and cancels itself instead of running as an open-ended retainer.",
    alternates: { canonical: "/about" },
}

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-stone-50 text-stone-950">
            <Navbar />
            <main className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                    About FlipAEO
                </p>
                <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
                    A content programme designed to end.
                </h1>
                <div className="mt-10 space-y-6 text-base leading-8 text-stone-700 sm:text-lg">
                    <p>
                        I built FlipAEO after years of planning, writing and publishing my own
                        content — and watching where automated content tools quietly fall apart.
                        They almost always fail the same two ways: they cannot tell you where a
                        topic came from, and they can never admit the useful ones ran out.
                    </p>
                    <p>
                        So this works the other way round. We read your site and the competitors
                        you name, keep the source link behind every question we find, and show
                        you the list before you spend anything. You can open any row and check it.
                        Then we write the missing articles and deliver them in complete, linked
                        batches — as many as your site genuinely justifies, not a number chosen
                        to hit a price.
                    </p>
                    <p>
                        And when the last batch lands, the subscription cancels itself. A
                        retainer has no natural end, which is why month three so often turns into
                        rewrites of things you already own. We would rather lose the fee. What we
                        will not do is promise rankings, traffic or AI citations — nobody can
                        honestly guarantee those, and we would rather tell you that up front.
                    </p>
                </div>
                <div className="mt-10 flex flex-wrap gap-3">
                    <Link
                        href="/features/evidence-backed-topical-audit"
                        className="rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
                    >
                        See how the audit works
                    </Link>

                    <Link
                        href="/pricing"
                        className="rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-semibold"
                    >
                        See pricing
                    </Link>
                </div>
            </main>
            <Footer />
        </div>
    )
}
