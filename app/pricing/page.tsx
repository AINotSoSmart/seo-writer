import type { Metadata } from "next"
import { Navbar } from "@/components/landing/Navbar"
import PricingSection from "@/components/landing/PricingSection"
import { FAQSection } from "@/components/landing/FAQSection"
import { Footer } from "@/components/landing/Footer"
import { GridBackground } from "@/components/landing/GridBackground"
import { generateMetadata as generateSeoMetadata } from "@/lib/seo"

export const metadata: Metadata = generateSeoMetadata({
    title: "Pricing",
    description: "Choose how quickly FlipAEO closes your evidence-backed content scope: one, two, or four complete clusters per month.",
    keywords: [
        "FlipAEO pricing",
        "content gap audit",
        "content cluster service",
        "SEO content program",
    ],
    canonical: "/pricing",
})

export default function PricingPage() {
    return (
        <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
            <div className="pointer-events-none absolute inset-0 z-0 h-full w-full">
                <GridBackground />
            </div>
            <Navbar />
            <main className="relative z-10">
                <div className="mx-auto max-w-4xl px-6 pb-2 pt-20 text-center md:pt-28">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
                        Scope first. Checkout second.
                    </p>
                    <h1 className="mt-5 font-serif text-5xl tracking-tight text-stone-900 md:text-7xl">
                        Know the finish line before you buy.
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-500">
                        The free audit shows the articles, clusters, and source evidence.
                        Your subscription determines delivery speed—not how much filler we create.
                    </p>
                </div>
                <PricingSection />
                <FAQSection />
            </main>
            <Footer />
        </div>
    )
}
