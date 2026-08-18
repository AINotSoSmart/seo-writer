/**
 * The provenance page for one AI-visibility gap.
 *
 * Every `ai_answer` query's `source_url` points here. A Google-harvested query
 * can be checked by opening the SERP; an AI answer cannot, because it was a
 * private generation that will not reproduce. So the check is against our
 * stored record: the verbatim answer, the engine and model that produced it,
 * when it was asked, and every URL it cited.
 *
 * This page must never summarise. A paraphrased answer is exactly the
 * unverifiable evidence the audit exists to avoid.
 *
 * It is **private**. It once rendered for anyone holding two UUIDs, because it
 * read through the admin client — which bypasses RLS — and never asked who was
 * calling. What that exposed was not a score but the raw material: verbatim
 * third-party answers, the customer's own buyer questions, their competitor
 * set, and when each was asked. `noindex` was the only thing standing in front
 * of it, and `noindex` is a request to crawlers, not an access control.
 *
 * The rule now: authenticate, then match `ai_probe_runs.user_id` against the
 * signed-in user exactly. The admin client stays — the visibility tables are
 * read through it everywhere — but it may only be used *after* ownership has
 * been established, never as a substitute for establishing it.
 */

import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { ENGINE_LABELS, type AiEngine } from "@/lib/visibility/engines"
import { formatRunDate, formatRunDateTime } from "@/lib/visibility/format-date"

export const metadata: Metadata = {
    // Owner-only and never indexed. The noindex is belt-and-braces now that
    // authentication is the actual boundary.
    robots: { index: false, follow: false },
}

interface PageProps {
    params: Promise<{ runId: string; promptId: string }>
}

interface ResultRow {
    engine: string
    model: string
    answer_text: string
    citations: Array<{ url: string; title: string }>
    mention_count: number
    citation_count: number
    total_citations: number
    mention_position: number | null
    mentioned_entity_count: number
    competitor_mentions: Array<{ name: string; mentionCount: number; mentionPosition: number | null }>
    observed_at: string
}

const VERDICT_COPY: Record<string, string> = {
    absent: "Not named in any answer",
    outranked: "Named, but never first",
    present: "Named first in at least one answer",
}

export default async function AiAnswerEvidencePage({ params }: PageProps) {
    const { runId, promptId } = await params

    // Authentication first. An anonymous reader is bounced to login carrying the
    // deep link, so following an evidence URL from a report survives signing in.
    const userClient = await createClient()
    const {
        data: { user },
    } = await userClient.auth.getUser()
    if (!user) {
        redirect(
            `/login?next=${encodeURIComponent(`/evidence/ai-answer/${runId}/${promptId}`)}`,
        )
    }

    const supabase = createAdminClient() as any

    // Ownership before content. `notFound()` rather than a 403: a stranger must
    // not be able to tell an existing run from an invented one, because "this
    // run id is real" is itself a fact about someone else's account.
    const { data: run } = await supabase
        .from("ai_probe_runs")
        .select("subject_name, started_at, country_code, user_id")
        .eq("id", runId)
        .single()
    if (!run || run.user_id !== user.id) notFound()

    const { data: prompt } = await supabase
        .from("ai_probe_prompts")
        .select("id, prompt, intent, verdict, answers_total, answers_present, run_id")
        .eq("id", promptId)
        .eq("run_id", runId)
        .single()
    if (!prompt) notFound()

    const { data: results } = await supabase
        .from("ai_probe_results")
        .select(
            "engine, model, answer_text, citations, mention_count, citation_count, total_citations, mention_position, mentioned_entity_count, competitor_mentions, observed_at",
        )
        .eq("prompt_id", promptId)
        // Redundant with the prompt's own run scoping, and kept anyway: this is
        // the query that returns the answer text, so it states its own boundary
        // rather than inheriting one from a check several lines above.
        .eq("run_id", runId)
        .order("engine", { ascending: true })

    const rows: ResultRow[] = results || []

    return (
        <main className="mx-auto max-w-3xl px-6 py-12">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Captured answer-engine evidence
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-snug">{prompt.prompt}</h1>

            <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-4">
                <div>
                    <dt className="text-muted-foreground">Brand</dt>
                    <dd className="font-medium">{run.subject_name}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Result</dt>
                    <dd className="font-medium">
                        {VERDICT_COPY[prompt.verdict] ?? prompt.verdict}
                    </dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Named in</dt>
                    <dd className="font-medium">
                        {prompt.answers_present} of {prompt.answers_total} answers
                    </dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Asked</dt>
                    <dd className="font-medium">
                        {formatRunDate(run.started_at)}
                    </dd>
                </div>
            </dl>

            {/*
              * Stated plainly rather than buried. An AI answer is a sample of a
              * non-deterministic system: asking again tomorrow can return a
              * different list. The honest claim is about what was observed, and
              * a customer who understands that trusts the rest of the report
              * more, not less.
              */}
            <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                These are the exact answers returned when this question was asked, stored
                unedited. AI answers vary between runs and between users — this is what was
                observed at the time above, not a permanent ranking.
            </p>

            <div className="mt-10 space-y-10">
                {rows.map((row) => (
                    <section key={row.engine}>
                        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                            <h2 className="text-lg font-semibold">
                                {ENGINE_LABELS[row.engine as AiEngine] ?? row.engine}
                            </h2>
                            <span className="text-xs text-muted-foreground">
                                {row.model} · {formatRunDateTime(row.observed_at)}
                            </span>
                        </header>

                        <p className="mt-3 text-sm text-muted-foreground">
                            {run.subject_name} mentioned {row.mention_count}×
                            {row.mention_position
                                ? ` · named #${row.mention_position} of ${row.mentioned_entity_count} tracked brands`
                                : " · not named"}
                            {row.total_citations > 0
                                ? ` · ${row.citation_count} of ${row.total_citations} citations point to your site`
                                : " · no citations"}
                        </p>

                        {row.competitor_mentions.filter((c) => c.mentionCount > 0).length > 0 && (
                            <p className="mt-2 text-sm">
                                <span className="text-muted-foreground">Named instead: </span>
                                {row.competitor_mentions
                                    .filter((competitor) => competitor.mentionCount > 0)
                                    .sort(
                                        (a, b) =>
                                            (a.mentionPosition ?? 99) - (b.mentionPosition ?? 99),
                                    )
                                    .map((competitor) => competitor.name)
                                    .join(", ")}
                            </p>
                        )}

                        <article className="mt-4 whitespace-pre-wrap rounded-lg border bg-card p-5 text-sm leading-relaxed">
                            {row.answer_text}
                        </article>

                        {row.citations.length > 0 && (
                            <div className="mt-4">
                                <h3 className="text-sm font-medium">
                                    Sources it cited ({row.citations.length})
                                </h3>
                                <ul className="mt-2 space-y-1 text-sm">
                                    {row.citations.map((citation, index) => (
                                        <li key={`${citation.url}-${index}`}>
                                            <a
                                                href={citation.url}
                                                target="_blank"
                                                rel="noopener noreferrer nofollow"
                                                className="text-primary underline underline-offset-2"
                                            >
                                                {citation.title || citation.url}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                ))}
            </div>
        </main>
    )
}
