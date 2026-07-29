import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { Footer } from "@/components/landing/Footer"
import { Navbar } from "@/components/landing/Navbar"
import { defaultSEO } from "@/config/seo"
import { features } from "./data"

export const metadata: Metadata = {
    title: "How FlipAEO's finite content program works",
    description:
        "Source-linked audit evidence, six qualified topic clusters, frozen internal links, complete batch delivery, and a finite program burn-down.",
    alternates: { canonical: `${defaultSEO.siteUrl}/features` },
}

export default function FeaturesPage() {
    return (
        <div className="min-h-screen bg-stone-50">
            <Navbar />
            <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
                <header className="mx-auto mb-14 max-w-3xl text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-stone-600">
                        <Sparkles className="h-3.5 w-3.5" /> Product contract
                    </div>
                    <h1 className="mt-5 font-serif text-4xl text-stone-900 md:text-6xl">
                        Evidence first. Complete clusters second.
                    </h1>
                    <p className="mt-5 text-lg leading-7 text-stone-600">
                        FlipAEO sells one finite six-cluster scope at three delivery speeds.
                        It makes no ranking, traffic, or citation promise, and the program
                        does not run indefinitely.
                    </p>
                </header>
                <section className="grid gap-4 md:grid-cols-2">
                    {Object.values(features).map((feature, index) => (
                        <Link
                            key={feature.slug}
                            href={`/features/${feature.slug}`}
                            className="rounded-2xl border border-stone-200 bg-white p-6 hover:border-stone-400"
                        >
                            <div className="text-xs font-semibold text-stone-400">
                                {String(index + 1).padStart(2, "0")}
                            </div>
                            <h2 className="mt-3 font-serif text-2xl text-stone-900">{feature.name}</h2>
                            <p className="mt-2 text-sm leading-6 text-stone-600">{feature.summary}</p>
                            <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
                                Read the contract <ArrowRight className="h-4 w-4" />
                            </div>
                        </Link>
                    ))}
                </section>
            </main>
            <Footer />
        </div>
    )
}
