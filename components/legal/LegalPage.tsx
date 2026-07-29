import type { ReactNode } from "react"

import { Footer } from "@/components/landing/Footer"
import { Navbar } from "@/components/landing/Navbar"

export function LegalPage({
    title,
    summary,
    children,
}: {
    title: string
    summary: string
    children: ReactNode
}) {
    return (
        <div className="min-h-screen bg-stone-50 text-stone-900">
            <Navbar />
            <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Updated July 29, 2026
                </p>
                <h1 className="mt-3 font-serif text-5xl">{title}</h1>
                <p className="mt-5 text-lg leading-8 text-stone-600">{summary}</p>
                <div className="legal-copy mt-12 space-y-8 text-sm leading-7 text-stone-700">
                    {children}
                </div>
            </main>
            <Footer />
        </div>
    )
}

export function LegalSection({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) {
    return (
        <section>
            <h2 className="font-serif text-2xl text-stone-900">{title}</h2>
            <div className="mt-3 space-y-3">{children}</div>
        </section>
    )
}
