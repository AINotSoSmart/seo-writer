/* eslint-disable @typescript-eslint/no-explicit-any -- forward Phase 3 relations are absent from generated database types until migration. */
import Link from "next/link"
import { CheckCircle2, CircleDashed, Download, FileText } from "lucide-react"

import { getAuditScope, getGapEvidence, getPlannedArticles } from "@/actions/harvest"
import { ScopeResults } from "@/components/audit/scope-results"
import { ProgramDeliveryControls } from "@/components/program/ProgramDeliveryControls"
import {
    ActionProposalRetry,
    ActionProposalReview,
    type ReviewProposal,
} from "@/components/program/ActionProposalReview"
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
            <main className="mx-auto w-full py-6">
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
                "id, measurement_run_id, period_start, period_end, state, action_allowance, delivered_at, failure_code, eligible_action_groups, backlog_action_groups, " +
                "cycle_actions(id, rank, resolution_type, state, target_url, selection_reason, " +
                "planned_articles(id, article_id, title, target_url, generation_status, delivery_status, publication_status, publication_url))",
        )
        .eq("program_id", program.id)
        .order("period_start", { ascending: false })

    const cycleIds = (cycles || []).map((cycle: any) => cycle.id)
    const { data: proposalSets } = cycleIds.length
        ? await (supabase as any)
              .from("action_proposal_sets")
              .select("id, cycle_id, state")
              .in("cycle_id", cycleIds)
              .eq("state", "review")
        : { data: [] }
    const proposalSetIds = (proposalSets || []).map((set: any) => set.id)
    const { data: proposals } = proposalSetIds.length
        ? await (supabase as any)
              .from("action_proposals")
              .select(
                  "id, proposal_set_id, resolution_type, deliverable_type, title, target_url, priority, reason",
              )
              .in("proposal_set_id", proposalSetIds)
              .order("priority", { ascending: false })
        : { data: [] }
    const proposalIds = (proposals || []).map((proposal: any) => proposal.id)
    const { data: proposalPromptLinks } = proposalIds.length
        ? await (supabase as any)
              .from("action_proposal_prompts")
              .select("proposal_id, tracked_prompt_id")
              .in("proposal_id", proposalIds)
        : { data: [] }
    const trackedIds = [
        ...new Set((proposalPromptLinks || []).map((link: any) => link.tracked_prompt_id)),
    ]
    const { data: trackedQuestions } = trackedIds.length
        ? await (supabase as any)
              .from("tracked_prompts")
              .select("id, prompt")
              .in("id", trackedIds)
        : { data: [] }
    const questionById = new Map(
        (trackedQuestions || []).map((question: any) => [question.id, question.prompt]),
    )
    const setByCycle = new Map<string, any>(
        (proposalSets || []).map((set: any) => [set.cycle_id, set]),
    )
    const proposalsBySet = new Map<string, ReviewProposal[]>()
    for (const proposal of proposals || []) {
        const questions = (proposalPromptLinks || [])
            .filter((link: any) => link.proposal_id === proposal.id)
            .map((link: any) => questionById.get(link.tracked_prompt_id))
            .filter((question: unknown): question is string => typeof question === "string")
        const rows = proposalsBySet.get(proposal.proposal_set_id) ?? []
        rows.push({
            id: proposal.id,
            resolutionType: proposal.resolution_type,
            deliverableType: proposal.deliverable_type,
            title: proposal.title,
            targetUrl: proposal.target_url,
            priority: proposal.priority,
            reason: proposal.reason,
            questions,
        })
        proposalsBySet.set(proposal.proposal_set_id, rows)
    }

    const allActions = (cycles || []).flatMap((cycle: any) => cycle.cycle_actions || [])
    const ready = allActions.filter((action: any) =>
        ["ready", "delivered"].includes(action.state),
    ).length
    const delivered = allActions.filter((action: any) => action.state === "delivered").length

    return (
        <main className="mx-auto w-full py-6">
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
                    <div key={cycle.id} className="space-y-4">
                    {setByCycle.has(cycle.id) && (
                        <ActionProposalReview
                            proposalSetId={setByCycle.get(cycle.id).id}
                            allowance={cycle.action_allowance}
                            proposals={proposalsBySet.get(setByCycle.get(cycle.id).id) ?? []}
                        />
                    )}
                    {!setByCycle.has(cycle.id) &&
                        cycle.state === "awaiting_input" &&
                        cycle.failure_code === "action_planning_failed" &&
                        cycle.measurement_run_id && (
                            <ActionProposalRetry runId={cycle.measurement_run_id} />
                        )}
                    <article className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                        <header className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
                            <div>
                                <h2 className="font-medium text-stone-900">
                                    {formatPeriod(cycle.period_start, cycle.period_end)}
                                </h2>
                                <p className="mt-1 text-xs text-stone-500">
                                    {(cycle.cycle_actions || []).length}/{cycle.action_allowance} selected actions
                                    {cycle.backlog_action_groups > 0
                                        ? ` · ${cycle.backlog_action_groups} eligible ${cycle.backlog_action_groups === 1 ? "action" : "actions"} retained in backlog`
                                        : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {cycle.state === "delivered" &&
                                    (cycle.cycle_actions || []).length > 0 && (
                                    <a
                                        href={`/api/subscription-cycles/${cycle.id}/export`}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
                                    >
                                        <Download className="h-3.5 w-3.5" /> Download batch
                                    </a>
                                )}
                                <StatePill state={cycle.state} />
                            </div>
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
                                                    {action.state === "delivered" && output?.article_id && (
                                                        <Link
                                                            href={`/articles/${output.article_id}`}
                                                            className="mt-2 inline-flex text-xs font-semibold text-stone-700 underline underline-offset-2"
                                                        >
                                                            Review and export draft
                                                        </Link>
                                                    )}
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
                    </div>
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
