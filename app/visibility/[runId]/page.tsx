/**
 * The AI-visibility report.
 *
 * Three sections, deliberately. The whole argument for this pivot is that the
 * evidence becomes legible enough to act on in one sitting; a wall of widgets
 * would put back exactly the "why should I care" problem it exists to remove.
 *
 *   1. WHERE YOU STAND    — how often engines named you, and who they named.
 *   2. WHERE YOU'RE LOSING — the actual prompts, each linking to the verbatim
 *                            answer that proves it.
 *   3. WHAT TO DO         — the clusters those losing prompts group into.
 *
 * Every number on this page is a count of stored answers. Nothing here is a
 * weighted composite, because a customer cannot check one.
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { createAdminClient } from "@/utils/supabase/admin"
import { ENGINE_LABELS, type AiEngine } from "@/lib/visibility/engines"
import type { RunSummary } from "@/lib/visibility/gap-mapper"

export const metadata: Metadata = {
    robots: { index: false, follow: false },
}

interface PageProps {
    params: Promise<{ runId: string }>
}

interface PromptRow {
    id: string
    prompt: string
    intent: string
    verdict: "absent" | "outranked" | "present"
    answers_total: number
    answers_present: number
    mean_mention_position: number | null
}

interface ClusterRow {
    name: string
    articles: Array<{ title: string; mainKeyword: string; articleType: string }>
}

interface EngineLedgerRow {
    engine: AiEngine
    attempted: number
    succeeded: number
    failed: number
    errors: string[]
}

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <div className="rounded-lg border p-4">
            <div className="text-3xl font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </div>
    )
}

export default async function VisibilityReportPage({ params }: PageProps) {
    const { runId } = await params
    const supabase = createAdminClient() as any

    const { data: run } = await supabase
        .from("ai_probe_runs")
        .select(
            "id, subject_name, status, failure_reason, engines, prompt_count, answer_count, present_answer_count, gap_prompt_count, engine_ledger, summary, clusters, started_at",
        )
        .eq("id", runId)
        .single()
    if (!run) notFound()

    if (run.status !== "completed") {
        return (
            <main className="mx-auto max-w-2xl px-6 py-16">
                <h1 className="text-2xl font-semibold">
                    {run.status === "running" ? "Probe in progress" : "Probe failed"}
                </h1>
                <p className="mt-3 text-muted-foreground">
                    {run.status === "running"
                        ? "The answer engines are still being asked. This page will show results once every prompt has an answer."
                        : run.failure_reason ||
                          "The run did not complete, so there is nothing to report."}
                </p>
            </main>
        )
    }

    const summary: RunSummary = run.summary || {}
    const ledger: EngineLedgerRow[] = run.engine_ledger || []
    const clusters: ClusterRow[] = run.clusters || []

    const { data: promptRows } = await supabase
        .from("ai_probe_prompts")
        .select("id, prompt, intent, verdict, answers_total, answers_present, mean_mention_position")
        .eq("run_id", runId)

    const prompts: PromptRow[] = promptRows || []
    const order = { absent: 0, outranked: 1, present: 2 }
    const losing = prompts
        .filter((prompt) => prompt.verdict !== "present")
        .sort((a, b) => order[a.verdict] - order[b.verdict])
    const winning = prompts.filter((prompt) => prompt.verdict === "present")

    // A partially broken run is still reportable, but the reader has to be told
    // which engines are missing — otherwise a failed engine reads as an absence.
    const degraded = ledger.filter((entry) => entry.failed > 0)

    return (
        <main className="mx-auto max-w-4xl px-6 py-12">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                AI visibility · {new Date(run.started_at).toLocaleDateString()}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{run.subject_name}</h1>
            <p className="mt-2 text-muted-foreground">
                {run.prompt_count} buyer questions asked across{" "}
                {(run.engines || []).map((e: AiEngine) => ENGINE_LABELS[e] ?? e).join(", ")} —{" "}
                {run.answer_count} answers read.
            </p>

            {degraded.length > 0 && (
                <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                    Some requests failed and are excluded from every number below:{" "}
                    {degraded
                        .map(
                            (entry) =>
                                `${ENGINE_LABELS[entry.engine] ?? entry.engine} ${entry.failed}/${entry.attempted}`,
                        )
                        .join(", ")}
                    . A failed request is not counted as an absence.
                </p>
            )}

            {/* ── 1. Where you stand ─────────────────────────────────────── */}
            <section className="mt-10">
                <h2 className="text-xl font-semibold">Where you stand</h2>

                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat
                        value={`${summary.presenceRate ?? 0}%`}
                        label={`of ${run.answer_count} answers named you`}
                    />
                    <Stat
                        value={`${summary.leadRate ?? 0}%`}
                        label="of questions where you were named first"
                    />
                    <Stat
                        value={String(summary.absentPromptCount ?? 0)}
                        label="questions you're absent from entirely"
                    />
                    <Stat
                        value={String(summary.outrankedPromptCount ?? 0)}
                        label="questions where you're named but behind a rival"
                    />
                </div>

                {(summary.rivalLeaderboard?.length ?? 0) > 0 && (
                    <div className="mt-8">
                        <h3 className="text-sm font-medium">Who gets named instead</h3>
                        <ul className="mt-3 space-y-2">
                            {summary.rivalLeaderboard.slice(0, 8).map((rival) => {
                                const share = run.prompt_count
                                    ? Math.round((rival.promptsNaming / run.prompt_count) * 100)
                                    : 0
                                return (
                                    <li key={rival.name} className="flex items-center gap-3 text-sm">
                                        <span className="w-40 shrink-0 truncate">{rival.name}</span>
                                        <span
                                            className="h-2 rounded-full bg-primary/70"
                                            style={{ width: `${Math.max(share, 2)}%` }}
                                        />
                                        <span className="text-muted-foreground tabular-nums">
                                            {rival.promptsNaming} of {run.prompt_count}
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )}

                {(summary.citedHosts?.length ?? 0) > 0 && (
                    <div className="mt-8">
                        <h3 className="text-sm font-medium">
                            Sources the engines cited most
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            These are the pages AI answers are built from. Being cited here is
                            what being recommended actually looks like underneath.
                        </p>
                        <ul className="mt-3 flex flex-wrap gap-2">
                            {summary.citedHosts.slice(0, 15).map((host) => (
                                <li
                                    key={host.host}
                                    className="rounded-full border px-3 py-1 text-sm"
                                >
                                    {host.host}{" "}
                                    <span className="text-muted-foreground tabular-nums">
                                        ×{host.count}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            {/* ── 2. Where you're losing ─────────────────────────────────── */}
            <section className="mt-14">
                <h2 className="text-xl font-semibold">
                    Where you&apos;re losing ({losing.length})
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Every row links to the exact answers that were returned. Open one and
                    read it — this report is only worth what those answers prove.
                </p>

                <ul className="mt-5 divide-y rounded-lg border">
                    {losing.map((prompt) => (
                        <li key={prompt.id} className="p-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium">{prompt.prompt}</span>
                                <span
                                    className={
                                        prompt.verdict === "absent"
                                            ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                                            : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400"
                                    }
                                >
                                    {prompt.verdict === "absent"
                                        ? "not named"
                                        : `named ${prompt.answers_present}/${prompt.answers_total}, never first`}
                                </span>
                            </div>
                            <Link
                                href={`/evidence/ai-answer/${runId}/${prompt.id}`}
                                className="mt-1 inline-block text-sm text-primary underline underline-offset-2"
                            >
                                Read the {prompt.answers_total} answers
                            </Link>
                        </li>
                    ))}
                </ul>

                {winning.length > 0 && (
                    <p className="mt-4 text-sm text-muted-foreground">
                        You already lead {winning.length}{" "}
                        {winning.length === 1 ? "question" : "questions"}. Those are not in the
                        plan below — there is nothing to fix.
                    </p>
                )}
            </section>

            {/* ── 3. What to do ─────────────────────────────────────────── */}
            <section className="mt-14">
                <h2 className="text-xl font-semibold">What closes the gap</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    The {losing.length} losing questions group into {clusters.length}{" "}
                    {clusters.length === 1 ? "cluster" : "clusters"}. Each article below
                    targets questions measured above — nothing here was invented to pad a
                    plan.
                </p>

                <div className="mt-5 space-y-6">
                    {clusters.map((cluster) => (
                        <div key={cluster.name} className="rounded-lg border p-5">
                            <div className="flex items-baseline justify-between gap-3">
                                <h3 className="font-semibold">{cluster.name}</h3>
                                <span className="text-sm text-muted-foreground">
                                    {cluster.articles.length} articles
                                </span>
                            </div>
                            <ol className="mt-3 space-y-1.5 text-sm">
                                {cluster.articles.map((article, index) => (
                                    <li key={`${article.mainKeyword}-${index}`} className="flex gap-3">
                                        <span className="text-muted-foreground tabular-nums">
                                            {index + 1}.
                                        </span>
                                        <span>
                                            {article.title}
                                            {index === 0 && (
                                                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                                    pillar
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    ))}
                </div>

                {clusters.length === 0 && (
                    <p className="mt-4 rounded-lg border p-4 text-sm text-muted-foreground">
                        The losing questions did not group into any cluster that clears the
                        minimum depth. That is a real result, not an error — this scope may be
                        too narrow to justify a content program.
                    </p>
                )}
            </section>

            <p className="mt-14 border-t pt-6 text-xs text-muted-foreground">
                AI answers are non-deterministic and vary by user, region and time. These
                numbers describe {run.answer_count} answers captured on{" "}
                {new Date(run.started_at).toLocaleDateString()}, all of which are stored and
                readable above. They are not a ranking, and a later run may differ.
            </p>
        </main>
    )
}
