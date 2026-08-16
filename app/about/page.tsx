import type { Metadata } from "next"
import Link from "next/link"

import { Footer } from "@/components/landing/Footer"
import { Navbar } from "@/components/landing/Navbar"

export const metadata: Metadata = {
    title: "About FlipAEO — why measurement comes before writing",
    description:
        "Built by a solo founder who published for years before automating it. Why FlipAEO tracks buyer questions, shows its evidence and refuses filler quotas.",
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
                    Measure first. Write only what the evidence supports.
                </h1>
                <div className="mt-10 space-y-6 text-base leading-8 text-stone-700 sm:text-lg">
                    <p>
                        I built FlipAEO after years of planning, writing and publishing my own
                        content — and watching where automated content tools quietly fall apart.
                        They almost always fail the same two ways: they cannot tell you where a
                        recommendation came from, and they turn every allowance into a quota.
                    </p>
                    <p>
                        So this works the other way round. You confirm 40 questions buyers ask.
                        We measure how ChatGPT and Google AI Mode answer them, preserve the
                        mentions and citations behind each verdict, and show the report before
                        selecting work. Then we turn at most eight high-priority gaps into
                        create or refresh actions and deliver the selected drafts together.
                    </p>
                    <p>
                        Eight is a cost ceiling, not a promise to manufacture eight articles.
                        Smaller batches and report-only cycles are honest outcomes; qualified
                        work that does not fit stays in the backlog. You can cancel future
                        cycles at any time and keep completed reports and delivered drafts. We
                        do not promise rankings, traffic or AI citations — nobody can honestly
                        guarantee those.
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
