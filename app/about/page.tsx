import type { Metadata } from "next"
import Link from "next/link"

import { Footer } from "@/components/landing/Footer"
import { Navbar } from "@/components/landing/Navbar"

export const metadata: Metadata = {
    title: "About FlipAEO",
    description:
        "Why FlipAEO measures public evidence before delivering a finite, frozen content program.",
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
                    A finite content program built from observable evidence.
                </h1>
                <div className="mt-10 space-y-6 text-base leading-8 text-stone-700 sm:text-lg">
                    <p>
                        FlipAEO was created by an independent blogger and software founder
                        after years of planning, writing, publishing, and learning where
                        automated content systems fail.
                    </p>
                    <p>
                        The product audits a website and selected competitors, preserves the
                        source behind every observed query, and identifies qualified gaps.
                        Eligible customers receive six frozen topic clusters with deterministic
                        URLs and internal links.
                    </p>
                    <p>
                        Delivery is finite. The customer chooses the speed, the measured scope
                        remains fixed, and billing is scheduled to end once every cluster
                        are delivered. FlipAEO does not guarantee rankings, traffic, or AI
                        citations.
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
                        View delivery speeds
                    </Link>
                </div>
            </main>
            <Footer />
        </div>
    )
}
