import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Layers3,
  Link2,
  PackageCheck,
  ShieldCheck,
  TimerReset,
} from "lucide-react"

import { Footer } from "@/components/landing/Footer"
import { GridBackground } from "@/components/landing/GridBackground"
import { Navbar } from "@/components/landing/Navbar"
import { StructuredData } from "@/components/seo/StructuredData"
import { commonPageMetadata, generateWebApplicationJsonLd } from "@/lib/seo"

export const metadata: Metadata = commonPageMetadata.home()

const contract = [
  {
    icon: FileSearch,
    title: "Immutable evidence audit",
    text: "Observed queries retain their source URLs. A later audit creates a new run instead of rewriting history.",
  },
  {
    icon: Layers3,
    title: "Six qualified clusters",
    text: "One program selects six unsold priority clusters with 3–15 articles each and at least 25 articles in total.",
  },
  {
    icon: Link2,
    title: "Frozen URLs and links",
    text: "You confirm the permanent URL pattern before purchase. Every pillar, leaf, sibling, and existing-page edge is frozen.",
  },
  {
    icon: PackageCheck,
    title: "Complete batch delivery",
    text: "Successful siblings stay withheld if one member fails. The cluster is released only when every article and link passes validation.",
  },
]

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-50 text-stone-900">
      <div className="pointer-events-none absolute inset-0">
        <GridBackground />
      </div>
      <StructuredData data={JSON.parse(generateWebApplicationJsonLd())} />
      <Navbar />
      <main className="relative">
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-36 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-stone-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            Finite topic-cluster delivery
          </div>
          <h1 className="mx-auto mt-6 max-w-5xl font-serif text-5xl leading-[1.04] tracking-tight md:text-7xl">
            Don&apos;t buy endless articles.
            <span className="block text-stone-500">Buy a measured scope that finishes.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-stone-600">
            FlipAEO finds source-linked search gaps, selects six qualified topic
            clusters, freezes their URLs and internal links, and delivers each
            cluster as one complete batch.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login?next=/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Run the evidence audit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features"
              className="rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-semibold"
            >
              Read the product contract
            </Link>
          </div>
          <p className="mt-4 text-xs text-stone-500">
            No GSC connection. No ranking, traffic, or AI-citation guarantee.
          </p>
        </section>

        <section className="border-y border-stone-200 bg-white/80 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-5 md:grid-cols-2">
              {contract.map(({ icon: Icon, title, text }, index) => (
                <article key={title} className="rounded-2xl border border-stone-200 bg-white p-7">
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-semibold text-stone-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="mt-6 font-serif text-2xl">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Same scope, different pace
            </p>
            <h2 className="mt-3 font-serif text-4xl">Delivery velocity, not article quotas</h2>
            <p className="mt-4 leading-7 text-stone-600">
              Close delivers one cluster every 30 days. Accelerate delivers two,
              15 days apart. Dominate delivers four, spaced 7–8 days apart. All
              three end after the same six clusters are delivered.
            </p>
            <Link href="/pricing" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline">
              See delivery speeds <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl bg-stone-950 p-8 text-white">
            <TimerReset className="h-7 w-7" />
            <h3 className="mt-5 font-serif text-3xl">The subscription has an end.</h3>
            <ul className="mt-6 space-y-4">
              {[
                "Generated, delivered, and published are separate states",
                "Pause deliveries without changing the frozen spacing",
                "All six delivered means program scope delivered",
                "Cancellation is requested for the end of the paid period",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm text-stone-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
