import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"

import {
    getAuditScope,
    getGapEvidence,
    getPlannedArticles,
    getProgramProgress,
} from "@/actions/harvest"
import { ScopeResults } from "@/components/audit/scope-results"
import { createClient } from "@/utils/supabase/server"

export default async function EvidenceAuditPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: brand } = await supabase
        .from("brand_details")
        .select("id, brand_data")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle()

    if (!brand) return <NoAudit />

    const [scope, gaps, articles, progress] = await Promise.all([
        getAuditScope(brand.id),
        getGapEvidence(brand.id),
        getPlannedArticles(brand.id),
        getProgramProgress(brand.id),
    ])

    if (!scope) return <NoAudit />

    return (
        <main className="mx-auto w-full max-w-6xl py-6">
            <header className="mb-8 flex flex-col gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
                        <ShieldCheck className="h-4 w-4" />
                        Persistent evidence audit
                    </div>
                    <h1 className="mt-2 font-serif text-3xl text-stone-900">
                        Inspect the scope before you pay
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
                        This is the complete saved result—not a temporary onboarding screen.
                        Expand every cluster to review its article titles, supporting searches,
                        and observed sources.
                    </p>
                </div>
                {scope.checkoutEligible && !progress && (
                    <Link
                        href="/subscribe"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        Confirm URLs and pricing
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                )}
            </header>

            <ScopeResults
                scope={scope}
                gaps={gaps}
                articles={articles}
                brandName={(brand.brand_data as any)?.product_name || "Your Site"}
                progress={progress}
            />
        </main>
    )
}

function NoAudit() {
    return (
        <main className="mx-auto max-w-3xl py-16 text-center">
            <h1 className="font-serif text-3xl text-stone-900">
                No completed evidence audit yet
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-stone-600">
                Complete the initial website analysis to create a source-linked cluster plan.
            </p>
            <Link
                href="/onboarding"
                className="mt-5 inline-flex rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
                Start evidence audit
            </Link>
        </main>
    )
}
