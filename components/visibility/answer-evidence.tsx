"use client"

/**
 * The stored answer, shown in full, with its provenance beside it.
 *
 * The expanded row is evidence, not another dashboard summary. The captured
 * answer stays verbatim, while the surrounding chrome separates four facts:
 * where it came from, what it said about the subject, what it searched for,
 * and which pages it cited.
 */

import {
    cloneElement,
    isValidElement,
    useEffect,
    useState,
    type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
    AlertCircle,
    CheckCircle2,
    ExternalLink,
    Link2,
    Loader2,
    Search,
} from "lucide-react"

import { formatRunDateTime } from "@/lib/visibility/format-date"
import { Badge } from "./marks"

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

/** Marks tracked names inside text nodes without injecting captured HTML. */
function markEntities(
    text: string,
    subject: string[],
    rivals: string[],
    keyPrefix: string,
): ReactNode[] {
    const subjectSet = new Set(subject.map((name) => name.toLowerCase()))
    const terms = [...subject, ...rivals].filter((term) => term && term.length >= 3)
    if (terms.length === 0) return [text]

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
                key={`${keyPrefix}-${index}`}
                className={
                    isSubject
                        ? "rounded bg-[var(--viz-series-1)]/15 px-1 font-medium text-[var(--viz-ink)] ring-1 ring-[var(--viz-series-1)]/30"
                        : "rounded bg-[var(--viz-series-2)]/15 px-1 font-medium text-[var(--viz-ink)] ring-1 ring-[var(--viz-series-2)]/30"
                }
            >
                {part}
            </mark>
        )
    })
}

function markTree(
    node: ReactNode,
    subject: string[],
    rivals: string[],
    path = "answer",
): ReactNode {
    if (typeof node === "string") return markEntities(node, subject, rivals, path)
    if (Array.isArray(node)) {
        return node.map((child, index) =>
            markTree(child, subject, rivals, `${path}-${index}`),
        )
    }
    if (isValidElement<{ children?: ReactNode }>(node) && node.props.children !== undefined) {
        return cloneElement(
            node,
            undefined,
            markTree(node.props.children, subject, rivals, `${path}-child`),
        )
    }
    return node
}

function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "")
    } catch {
        return url
    }
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
            <p className="flex items-center gap-2 py-6 text-sm text-[var(--viz-critical)]">
                <AlertCircle className="size-4" aria-hidden />
                Could not load the stored answers: {error}
            </p>
        )
    }

    if (!answers) {
        return (
            <p className="flex items-center gap-2 py-6 text-sm text-[var(--viz-ink-muted)]">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading the captured answers…
            </p>
        )
    }

    if (answers.length === 0) {
        return (
            <p className="py-6 text-sm text-[var(--viz-ink-muted)]">
                No answers were stored for this question.
            </p>
        )
    }

    const subjectTerms = [subjectName, ...subjectDomains].filter(Boolean)

    return (
        <div className="min-w-0 max-w-full space-y-4 overflow-hidden py-5">
            {answers.map((answer) => {
                const named = answer.competitor_mentions
                    .filter((competitor) => competitor.mentionCount > 0)
                    .sort(
                        (a, b) => (a.mentionPosition ?? 99) - (b.mentionPosition ?? 99),
                    )
                const rivalTerms = answer.competitor_mentions.map((competitor) => competitor.name)
                const engineLabel = engineLabels[answer.engine] ?? answer.engine
                const initial = engineLabel.charAt(0).toUpperCase()

                return (
                    <article
                        key={`${answer.engine}-${answer.observed_at}`}
                        className="min-w-0 max-w-full overflow-hidden rounded-[14px] border border-[var(--viz-hairline)] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
                    >
                        <header className="flex flex-col gap-3 border-b border-[var(--viz-hairline)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="min-w-0 flex items-center gap-3">
                                <span className="inline-flex size-8 items-center justify-center rounded-[9px] bg-blue-50 text-xs font-bold text-[var(--viz-series-1)]">
                                    {initial}
                                </span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="truncate text-sm font-semibold text-[var(--viz-ink)]">
                                            {engineLabel}
                                        </h3>
                                        <span
                                            className={
                                                answer.surface === "consumer_app"
                                                    ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-[var(--viz-good-ink)]"
                                                    : "rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-[var(--viz-warning-ink)]"
                                            }
                                            title={SURFACE_NOTE[answer.surface]}
                                        >
                                            {answer.surface === "consumer_app"
                                                ? "consumer app"
                                                : "API surface"}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-[var(--viz-ink-muted)]">
                                        {answer.model || "Captured answer"}
                                    </p>
                                </div>
                            </div>
                            <time className="shrink-0 text-[11px] tabular-nums text-[var(--viz-ink-muted)]">
                                {formatRunDateTime(answer.observed_at)}
                            </time>
                        </header>

                        <div
                            className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
                                answer.mention_count === 0
                                    ? "border-red-100 bg-red-50/65"
                                    : "border-emerald-100 bg-emerald-50/65"
                            }`}
                        >
                            <div
                                className={`min-w-0 flex items-center gap-2 break-words text-xs font-medium ${
                                    answer.mention_count === 0
                                        ? "text-[var(--viz-critical)]"
                                        : "text-[var(--viz-good-ink)]"
                                }`}
                            >
                                {answer.mention_count === 0 ? (
                                    <AlertCircle className="size-4 shrink-0" aria-hidden />
                                ) : (
                                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                                )}
                                {answer.mention_count === 0
                                    ? `${subjectName} was not named in this answer`
                                    : `${subjectName} was named ${answer.mention_count}×`}
                            </div>
                            <div className="flex flex-wrap gap-4 text-[11px] tabular-nums text-[var(--viz-ink-secondary)]">
                                <span>
                                    Position {answer.mention_position ?? "—"}
                                    {answer.mentioned_entity_count > 0
                                        ? ` of ${answer.mentioned_entity_count}`
                                        : ""}
                                </span>
                                <span>{answer.citations.length} citations</span>
                                <span>{answer.search_queries.length} searches exposed</span>
                            </div>
                        </div>

                        <div className="grid min-w-0 max-w-full overflow-hidden lg:grid-cols-[minmax(0,1fr)_19rem]">
                            <section className="min-w-0 max-w-full overflow-hidden px-4 py-5 sm:px-5">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-xs font-semibold text-[var(--viz-ink)]">
                                            Captured answer
                                        </h4>
                                        <p className="mt-0.5 text-[10px] text-[var(--viz-ink-muted)]">
                                            Stored unedited; formatting rendered for readability.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-[var(--viz-track)] px-2 py-1 text-[10px] text-[var(--viz-ink-muted)]">
                                        verbatim
                                    </span>
                                </div>
                                <div className="max-h-[34rem] min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain pr-3 text-[13px] leading-6 text-[var(--viz-ink-secondary)] [overflow-wrap:anywhere] [scrollbar-color:var(--viz-baseline)_transparent] [scrollbar-width:thin]">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h1: ({ children }) => (
                                                <h5 className="mb-3 mt-5 text-base font-semibold first:mt-0">
                                                    {markTree(children, subjectTerms, rivalTerms, "h1")}
                                                </h5>
                                            ),
                                            h2: ({ children }) => (
                                                <h5 className="mb-2 mt-5 text-sm font-semibold first:mt-0">
                                                    {markTree(children, subjectTerms, rivalTerms, "h2")}
                                                </h5>
                                            ),
                                            h3: ({ children }) => (
                                                <h5 className="mb-2 mt-4 text-sm font-semibold first:mt-0">
                                                    {markTree(children, subjectTerms, rivalTerms, "h3")}
                                                </h5>
                                            ),
                                            p: ({ children }) => (
                                                <p className="mb-4 last:mb-0">
                                                    {markTree(children, subjectTerms, rivalTerms, "p")}
                                                </p>
                                            ),
                                            ul: ({ children }) => (
                                                <ul className="mb-4 list-disc space-y-1.5 pl-5 last:mb-0">
                                                    {children}
                                                </ul>
                                            ),
                                            ol: ({ children }) => (
                                                <ol className="mb-4 list-decimal space-y-1.5 pl-5 last:mb-0">
                                                    {children}
                                                </ol>
                                            ),
                                            li: ({ children }) => (
                                                <li>
                                                    {markTree(children, subjectTerms, rivalTerms, "li")}
                                                </li>
                                            ),
                                            strong: ({ children }) => (
                                                <strong className="font-semibold text-[var(--viz-ink)]">
                                                    {markTree(children, subjectTerms, rivalTerms, "strong")}
                                                </strong>
                                            ),
                                            blockquote: ({ children }) => (
                                                <blockquote className="my-4 border-l-2 border-[var(--viz-baseline)] pl-4 italic text-[var(--viz-ink-muted)]">
                                                    {children}
                                                </blockquote>
                                            ),
                                            a: ({ href, children }) => (
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer nofollow"
                                                    className="break-words font-medium text-[var(--viz-series-1)] underline decoration-blue-200 underline-offset-2 [overflow-wrap:anywhere] hover:decoration-current"
                                                >
                                                    {markTree(children, subjectTerms, rivalTerms, "link")}
                                                </a>
                                            ),
                                            code: ({ children }) => (
                                                <code className="break-words rounded bg-[var(--viz-track)] px-1 py-0.5 text-[12px] text-[var(--viz-ink)] [overflow-wrap:anywhere]">
                                                    {children}
                                                </code>
                                            ),
                                        }}
                                    >
                                        {answer.answer_text}
                                    </ReactMarkdown>
                                </div>
                            </section>

                            <aside className="min-w-0 overflow-hidden border-t border-[var(--viz-hairline)] bg-[var(--viz-plane)]/70 lg:border-l lg:border-t-0">
                                {named.length > 0 && (
                                    <EvidenceBlock title="Named instead">
                                        <div className="space-y-2">
                                            {named.map((competitor) => (
                                                <div
                                                    key={competitor.name}
                                                    className="flex items-center gap-2 text-xs"
                                                >
                                                    <Badge label={competitor.name} />
                                                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">
                                                        {competitor.name}
                                                    </span>
                                                    <span className="shrink-0 tabular-nums text-[var(--viz-ink-muted)]">
                                                        {competitor.mentionPosition
                                                            ? `#${competitor.mentionPosition}`
                                                            : `${competitor.mentionCount}×`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </EvidenceBlock>
                                )}

                                {answer.search_queries.length > 0 && (
                                    <EvidenceBlock
                                        title="Search paths"
                                        icon={<Search className="size-3.5" aria-hidden />}
                                    >
                                        <div className="min-w-0 max-w-full flex flex-wrap gap-1.5">
                                            {answer.search_queries.map((query, index) => (
                                                <span
                                                    key={`${query}-${index}`}
                                                    className="max-w-full break-words rounded-md border border-[var(--viz-hairline)] bg-white px-2 py-1 text-[10px] leading-4 text-[var(--viz-ink-secondary)] [overflow-wrap:anywhere]"
                                                >
                                                    {query}
                                                </span>
                                            ))}
                                        </div>
                                    </EvidenceBlock>
                                )}

                                <EvidenceBlock
                                    title={`Sources cited (${answer.citations.length})`}
                                    icon={<Link2 className="size-3.5" aria-hidden />}
                                >
                                    {answer.citations.length > 0 ? (
                                        <div className="max-h-[22rem] space-y-2.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:var(--viz-baseline)_transparent] [scrollbar-width:thin]">
                                            {answer.citations.map((citation, index) => (
                                                <a
                                                    key={`${citation.url}-${index}`}
                                                    href={citation.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer nofollow"
                                                    className="group block min-w-0 max-w-full overflow-hidden"
                                                >
                                                    <span className="flex items-start gap-1 text-[11px] font-medium leading-4 text-[var(--viz-series-1)] group-hover:underline">
                                                        <span className="min-w-0 line-clamp-2 [overflow-wrap:anywhere]">
                                                            {citation.title || citation.url}
                                                        </span>
                                                        <ExternalLink
                                                            className="mt-0.5 size-2.5 shrink-0"
                                                            aria-hidden
                                                        />
                                                    </span>
                                                    <span className="mt-0.5 block truncate text-[9px] text-[var(--viz-ink-muted)]">
                                                        {hostOf(citation.url)}
                                                    </span>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-[var(--viz-ink-muted)]">
                                            No sources were returned with this answer.
                                        </p>
                                    )}
                                </EvidenceBlock>
                            </aside>
                        </div>
                    </article>
                )
            })}
        </div>
    )
}

function EvidenceBlock({
    title,
    icon,
    children,
}: {
    title: string
    icon?: ReactNode
    children: ReactNode
}) {
    return (
        <section className="min-w-0 max-w-full overflow-hidden border-b border-[var(--viz-hairline)] p-4 last:border-b-0">
            <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--viz-ink-muted)]">
                {icon}
                {title}
            </h4>
            {children}
        </section>
    )
}
