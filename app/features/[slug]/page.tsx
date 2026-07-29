import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react"

import { Footer } from "@/components/landing/Footer"
import { Navbar } from "@/components/landing/Navbar"
import { StructuredData } from "@/components/seo/StructuredData"
import { defaultSEO } from "@/config/seo"
import { features } from "../data"

export function generateStaticParams() {
    return Object.keys(features).map((slug) => ({ slug }))
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const feature = features[slug]
    if (!feature) return { title: "Feature not found" }
    return {
        title: `${feature.name} | FlipAEO`,
        description: feature.summary,
        alternates: { canonical: `${defaultSEO.siteUrl}/features/${slug}` },
    }
}

export default async function FeaturePage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const feature = features[slug]
    if (!feature) notFound()

    return (
        <div className="min-h-screen bg-stone-50">
            <StructuredData
                data={{
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    name: `FlipAEO ${feature.name}`,
                    description: feature.summary,
                    url: `${defaultSEO.siteUrl}/features/${feature.slug}`,
                    applicationCategory: "BusinessApplication",
                    operatingSystem: "Web Browser",
                    featureList: [...feature.outputs, ...feature.safeguards],
                }}
            />
            <Navbar />
            <main className="mx-auto max-w-4xl px-6 pb-24 pt-32">
                <Link href="/features" className="inline-flex items-center gap-2 text-sm text-stone-500">
                    <ArrowLeft className="h-4 w-4" /> All features
                </Link>
                <header className="mt-8">
                    <h1 className="font-serif text-4xl text-stone-900 md:text-6xl">{feature.name}</h1>
                    <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-600">{feature.summary}</p>
                    <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm leading-6 text-stone-700">
                        <strong>Product promise:</strong> {feature.promise}
                    </div>
                </header>
                <div className="mt-12 grid gap-5 md:grid-cols-2">
                    <ListCard title="Inputs" items={feature.inputs} />
                    <ListCard title="What you receive" items={feature.outputs} />
                </div>
                <section className="mt-5 rounded-2xl bg-stone-950 p-7 text-white">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="h-5 w-5" /> Contract safeguards
                    </div>
                    <ul className="mt-5 grid gap-3 md:grid-cols-2">
                        {feature.safeguards.map((item) => (
                            <li key={item} className="flex gap-2 text-sm text-stone-300">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </section>
                <div className="mt-10 text-center">
                    <Link href="/login?next=/onboarding" className="inline-flex rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white">
                        Run an evidence-backed audit
                    </Link>
                </div>
            </main>
            <Footer />
        </div>
    )
}

function ListCard({ title, items }: { title: string; items: string[] }) {
    return (
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="font-serif text-2xl">{title}</h2>
            <ul className="mt-5 space-y-3">
                {items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-stone-600">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-stone-900" />
                        {item}
                    </li>
                ))}
            </ul>
        </section>
    )
}
