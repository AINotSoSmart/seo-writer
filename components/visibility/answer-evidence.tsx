"use client"

/**
 * The stored answer, shown in full, with every tracked brand marked in place.
 *
 * This component is the product. Charts persuade a reader who already believes
 * the measurement; this is what convinces the one who doesn't. A founder told
 * "you're absent from 26 questions" reasonably suspects a made-up number — so
 * the answer that produced the claim is one click away, unedited, with the
 * competitors the engine actually named highlighted where they appear.
 *
 * Nothing here summarises, scores, or rewrites. It renders what was captured.
 */

import { useEffect, useState } from "react"
import { AlertCircle, ExternalLink, Loader2, Search } from "lucide-react"

import { formatRunDateTime } from "@/lib/visibility/format-date"

const SURFACE_NOTE: Record<string, string> = {
    consumer_app: "Real answer from the consumer app",
    api: "Developer API — a different surface from the consumer app",
}

interface StoredAnswer {
    engine: string
    surface: string
    model: string
    answer_text: string
    citations: Array<{ url: string; title: string }>
    mention_count: number
    mention_position: number | null
    mentioned_entity_count: number
    competitor_mentions: Array<{
        name: string
        mentionCount: number
        mentionPosition: number | null
    }>
    search_queries: string[]
    observed_at: string
}

interface Props {
    promptId: string
    engineLabels: Record<string, string>
    subjectName: string
    subjectDomains: string[]
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Marks brand and competitor names inside the answer text.
 *
 * Splits on a word-boundary alternation and returns React nodes — never
 * `dangerouslySetInnerHTML`. The answer is text captured from a third party;
 * injecting it as HTML would let any engine's output execute in the dashboard.
 */
function markEntities(
    text: string,
    subject: string[],
    rivals: string[],
): React.ReactNode[] {
    const subjectSet = new Set(subject.map((name) => name.toLowerCase()))
    const terms = [...subject, ...rivals].filter((term) => term && term.length >= 3)
    if (terms.length === 0) return [text]

    // Longest first so "Acme Studio" wins over "Acme".
    const pattern = terms
        .slice()
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join("|")

    const parts = text.split(new RegExp(`\\b(${pattern})\\b`, "gi"))
    return parts.map((part, index) => {
        if (index % 2 === 0) return part
        const isSubject = subjectSet.has(part.toLowerCase())
        return (
            <mark
                key={index}
                className={
                    isSubject
                        ? "rounded bg-[var(--viz-series-1)]/20 px-1 font-medium text-[var(--viz-ink)] ring-1 ring-[var(--viz-series-1)]/40"
                        : "rounded bg-[var(--viz-series-2)]/20 px-1 font-medium text-[var(--viz-ink)] ring-1 ring-[var(--viz-series-2)]/40"
                }
            >
                {part}
            </mark>
        )
    })
}

export function AnswerEvidence({
    promptId,
    engineLabels,
    subjectName,
    subjectDomains,
}: Props) {
    const [answers, setAnswers] = useState<StoredAnswer[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        fetch(`/api/visibility/answers?promptId=${promptId}`)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
            })
            .then((data) => {
                if (!cancelled) setAnswers(data.answers || [])
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : String(err))
            })
        return () => {
            cancelled = true
        }
    }, [promptId])

    if (error) {
        return (
            <p className="flex items-center gap-2 py-4 text-sm text-[var(--viz-critical)]">
                <AlertCircle className="size-4" aria-hidden />
                Could not load the stored answers: {error}
            </p>
        )
    }

    if (!answers) {
        return (
            <p className="flex items-center gap-2 py-4 text-sm text-[var(--viz-ink-muted)]">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading the captured answers…
            </p>
        )
    }

    if (answers.length === 0) {
        return (
            <p className="py-4 text-sm text-[var(--viz-ink-muted)]">
                No answers were stored for this question.
            </p>
        )
    }

    const subjectTerms = [subjectName, ...subjectDomains].filter(Boolean)

    return (
        <div className="space-y-6 py-4">
            {answers.map((answer) => {
                const named = answer.competitor_mentions
                    .filter((competitor) => competitor.mentionCount > 0)
                    .sort(
                        (a, b) => (a.mentionPosition ?? 99) - (b.mentionPosition ?? 99),
                    )

                return (
                    <article
                        key={`${answer.engine}-${answer.observed_at}`}
                        className="rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)]"
                    >
                        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--viz-hairline)] px-4 py-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--viz-ink)]">
                                    {engineLabels[answer.engine] ?? answer.engine}
                                </span>
                                <span
                                    className={
                                        answer.surface === "consumer_app"
                                            ? "rounded-full bg-[var(--viz-good)]/12 px-2 py-0.5 text-[11px] font-medium text-[var(--viz-good-ink)]"
                                            : "rounded-full bg-[var(--viz-warning)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--viz-ink-secondary)]"
                                    }
                                    title={SURFACE_NOTE[answer.surface]}
                                >
                                    {answer.surface === "consumer_app" ? "consumer app" : "API surface"}
                                </span>
                            </div>
                            <span className="text-xs tabular-nums text-[var(--viz-ink-muted)]">
                                {formatRunDateTime(answer.observed_at)}
                            </span>
                        </header>

                        <div className="border-b border-[var(--viz-hairline)] px-4 py-2.5 text-sm">
                            {answer.mention_count === 0 ? (
                                <span className="flex items-center gap-2 text-[var(--viz-critical)]">
                                    <AlertCircle className="size-4 shrink-0" aria-hidden />
                                    <span>
                                        <strong className="font-semibold">{subjectName}</strong> does
                                        not appear anywhere in this answer.
                                    </span>
                                </span>
                            ) : (
                                <span className="text-[var(--viz-ink-secondary)]">
                                    <strong className="font-semibold text-[var(--viz-ink)]">
                                        {subjectName}
                                    </strong>{" "}
                                    named {answer.mention_count}×
                                    {answer.mention_position
                                        ? ` · position ${answer.mention_position} of ${answer.mentioned_entity_count}`
                                        : ""}
                                </span>
                            )}
                            {named.length > 0 && (
                                <p className="mt-1.5 text-[var(--viz-ink-secondary)]">
                                    Named instead:{" "}
                                    {named.map((competitor, index) => (
                                        <span key={competitor.name}>
                                            {index > 0 && ", "}
                                            <span className="font-medium text-[var(--viz-ink)]">
                                                {competitor.name}
                                            </span>
                                            {competitor.mentionPosition === 1 && (
                                                <span className="text-[var(--viz-ink-muted)]"> (first)</span>
                                            )}
                                        </span>
                                    ))}
                                </p>
                            )}
                        </div>

                        <div className="max-h-[28rem] overflow-y-auto px-4 py-4">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--viz-ink-secondary)]">
                                {markEntities(
                                    answer.answer_text,
                                    subjectTerms,
                                    answer.competitor_mentions.map((c) => c.name),
                                )}
                            </p>
                        </div>

                        {answer.search_queries.length > 0 && (
                            <div className="border-t border-[var(--viz-hairline)] px-4 py-3">
                                <h4 className="flex items-center gap-1.5 text-xs font-medium text-[var(--viz-ink-secondary)]">
                                    <Search className="size-3.5" aria-hidden />
                                    What it searched for
                                </h4>
                                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                                    {answer.search_queries.map((query, index) => (
                                        <li
                                            key={`${query}-${index}`}
                                            className="rounded border border-[var(--viz-hairline)] px-2 py-0.5 text-xs text-[var(--viz-ink-muted)]"
                                        >
                                            {query}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {answer.citations.length > 0 && (
                            <div className="border-t border-[var(--viz-hairline)] px-4 py-3">
                                <h4 className="text-xs font-medium text-[var(--viz-ink-secondary)]">
                                    Sources it cited ({answer.citations.length})
                                </h4>
                                <ul className="mt-1.5 space-y-1">
                                    {answer.citations.slice(0, 12).map((citation, index) => (
                                        <li key={`${citation.url}-${index}`} className="text-xs">
                                            <a
                                                href={citation.url}
                                                target="_blank"
                                                rel="noopener noreferrer nofollow"
                                                className="inline-flex items-center gap-1 text-[var(--viz-series-1)] hover:underline"
                                            >
                                                {citation.title || citation.url}
                                                <ExternalLink className="size-3 shrink-0" aria-hidden />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </article>
                )
            })}
        </div>
    )
}
