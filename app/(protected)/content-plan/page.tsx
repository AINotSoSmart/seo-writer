/* eslint-disable @typescript-eslint/no-explicit-any -- forward Phase 3 relations are absent from generated database types until migration. */
import Link from "next/link"
import { CheckCircle2, CircleDashed, FileText } from "lucide-react"

import { getAuditScope, getGapEvidence, getPlannedArticles } from "@/actions/harvest"
import { ScopeResults } from "@/components/audit/scope-results"
import { ProgramDeliveryControls } from "@/components/program/ProgramDeliveryControls"
import { createClient } from "@/utils/supabase/server"

export default async function ContentPlanPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: brand } = await supabase
        .from("brand_details")
        .select("id, brand_data")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
    if (!brand) return <NoProgram />

    const { data: program } = await (supabase as any)
        .from("programs")
        .select("id, plan_id, status, action_allowance, started_at")
        .eq("user_id", user.id)
        .eq("brand_id", brand.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!program) {
        const [scope, gaps, articles] = await Promise.all([
            getAuditScope(brand.id),
            getGapEvidence(brand.id),
            getPlannedArticles(brand.id),
        ])
        if (!scope) return <NoProgram />

        return (
            <main className="mx-auto w-full max-w-6xl py-6">
                <header className="mb-7 flex items-start justify-between border-b border-stone-200 pb-6">
                    <div>
                        <h1 className="font-serif text-3xl text-stone-900">Proposed content work</h1>
                        <p className="mt-2 text-sm text-stone-600">
                            This is audit evidence, not a purchased or scheduled batch.
                        </p>
                    </div>
                    <Link href="/audit" className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800">
                        Open permanent audit
                    </Link>
                </header>
                <ScopeResults
                    scope={scope}
                    gaps={gaps}
                    articles={articles}
                    brandName={(brand.brand_data as any)?.product_name || "Your Site"}
                />
            </main>
        )
    }

    const { data: cycles } = await (supabase as any)
        .from("subscription_cycles")
        .select(
            "id, period_start, period_end, state, action_allowance, delivered_at, failure_code, " +
                "cycle_actions(id, rank, resolution_type, state, target_url, selection_reason, " +
                "planned_articles(id, title, target_url, generation_status, delivery_status, publication_status, publication_url))",
        )
        .eq("program_id", program.id)
        .order("period_start", { ascending: false })

    const allActions = (cycles || []).flatMap((cycle: any) => cycle.cycle_actions || [])
    const ready = allActions.filter((action: any) =>
        ["ready", "delivered"].includes(action.state),
    ).length
    const delivered = allActions.filter((action: any) => action.state === "delivered").length

    return (
        <main className="mx-auto w-full max-w-6xl py-6">
            <header className="flex items-start justify-between border-b border-stone-200 pb-6">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Founding beta · up to {program.action_allowance} actions per cycle
                    </p>
                    <h1 className="mt-1 font-serif text-3xl text-stone-900">Recurring delivery cycles</h1>
                    <p className="mt-2 text-sm text-stone-600">
                        Every cycle keeps its measurement, selected work and complete batch together.
                    </p>
                </div>
                <ProgramDeliveryControls programId={program.id} status={program.status} />
            </header>

            <section className="grid gap-3 py-6 sm:grid-cols-3">
                <ProgressCard label="Cycles" value={String((cycles || []).length)} />
                <ProgressCard label="Outputs ready" value={`${ready}/${allActions.length}`} />
                <ProgressCard label="Outputs delivered" value={`${delivered}/${allActions.length}`} />
            </section>

            <section className="space-y-4">
                {(cycles || []).map((cycle: any) => (
                    <article key={cycle.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                        <header className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
                            <div>
                                <h2 className="font-medium text-stone-900">
                                    {formatPeriod(cycle.period_start, cycle.period_end)}
                                </h2>
                                <p className="mt-1 text-xs text-stone-500">
                                    {(cycle.cycle_actions || []).length}/{cycle.action_allowance} selected actions
                                </p>
                            </div>
                            <StatePill state={cycle.state} />
                        </header>
                        {(cycle.cycle_actions || []).length ? (
                            <div className="divide-y divide-stone-100">
                                {(cycle.cycle_actions || [])
                                    .sort((a: any, b: any) => a.rank - b.rank)
                                    .map((action: any) => {
                                        const output = Array.isArray(action.planned_articles)
                                            ? action.planned_articles[0]
                                            : action.planned_articles
                                        return (
                                            <div key={action.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[2rem_1fr_auto]">
                                                <span className="font-mono text-xs text-stone-400">{String(action.rank).padStart(2, "0")}</span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="rounded border border-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-500">
                                                            {action.resolution_type}
                                                        </span>
                                                        <span className="text-sm font-medium text-stone-900">
                                                            {output?.title || action.target_url || "Selected content action"}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-xs text-stone-500">{action.selection_reason}</p>
                                                </div>
                                                <StatePill state={action.state} />
                                            </div>
                                        )
                                    })}
                            </div>
                        ) : (
                            <p className="px-5 py-6 text-sm text-stone-500">
                                Measurement may honestly produce a report-only cycle with no content actions.
                            </p>
                        )}
                    </article>
                ))}
            </section>
        </main>
    )
}

function ProgressCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
                <FileText className="h-4 w-4" /> {label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-stone-900">{value}</div>
        </div>
    )
}

function StatePill({ state }: { state: string }) {
    const done = state === "delivered"
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-600">
            {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <CircleDashed className="h-3.5 w-3.5" />}
            {state.replaceAll("_", " ")}
        </span>
    )
}

function formatPeriod(start: string, end: string) {
    const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" })
    return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`
}

function NoProgram() {
    return (
        <main className="mx-auto max-w-2xl py-20 text-center">
            <h1 className="font-serif text-3xl text-stone-900">No content plan yet</h1>
            <p className="mt-3 text-sm text-stone-600">Complete onboarding to confirm the buyer questions your subscription will track.</p>
            <Link href="/onboarding" className="mt-6 inline-flex rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white">Continue onboarding</Link>
        </main>
    )
}
