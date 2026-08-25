import { AlertTriangle, ExternalLink, Info, Radar } from "lucide-react"

import {
    PAGE_SHAPE_LABELS,
    type CitationBreakdown,
    type PageShape,
    type SourceType,
} from "@/lib/visibility/citation-classifier"
import { blindSpots, type FanOutSummary } from "@/lib/visibility/fan-out"
import { Badge } from "./marks"
import { InfoHint, SectionHeading } from "./info-hint"

interface CitedHost {
    host: string
    count: number
    answersNaming: number
    sourceType: SourceType
}

interface ReviewSource {
    url: string
    title: string
    host: string
    count: number
}

interface KeyPage {
    url: string
    title: string
    host: string
    pageShape: PageShape
    sourceType: SourceType
    count: number
    answersNaming: number
}

function actionColor(actionability: CitationBreakdown["byType"][number]["actionability"]): string {
    if (actionability === "publish") return "var(--viz-series-1)"
    if (actionability === "earn") return "var(--viz-seq-200)"
    if (actionability === "review") return "var(--viz-warning)"
    return "var(--viz-muted-mark)"
}

export function VisibilitySources({
    promptCount,
    citedHosts,
    breakdown,
    citationReviewQueue,
    keyPages,
    fanOut,
    engineLabels,
    onFocusHost,
}: {
    promptCount: number
    citedHosts: CitedHost[]
    breakdown?: CitationBreakdown
    citationReviewQueue: ReviewSource[]
    keyPages: KeyPage[]
    fanOut?: FanOutSummary
    engineLabels: Record<string, string>
    onFocusHost: (host: string) => void
}) {
    const hostMax = Math.max(1, ...citedHosts.map((host) => host.count))
    const fanOutBlindSpots = fanOut ? blindSpots(fanOut) : []

    if (!breakdown || breakdown.totalCitations === 0) {
        return (
            <section className="viz-card mt-5 p-6">
                <SectionHeading title="Sources" />
                <p className="mt-3 text-sm text-[var(--viz-ink-muted)]">
                    No cited sources were returned in this run.
                </p>
            </section>
        )
    }

    return (
        <div className="mt-5 space-y-10">
            <section>
                <SectionHeading
                    title="Source detail"
                    hintLabel="What citations mean here"
                    hint={
                        <p>
                            These are the pages the engines cited to build their answers. The
                            action label comes from page ownership and source structure, not from
                            a generic domain score.
                        </p>
                    }
                >
                    <span className="text-xs tabular-nums text-[var(--viz-ink-muted)]">
                        {breakdown.totalCitations} citations
                    </span>
                </SectionHeading>

                {breakdown.unclassifiedShare >= 33 && (
                    <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-[var(--viz-ink-secondary)]">
                        <Info
                            className="mt-0.5 size-4 shrink-0 text-[var(--viz-warning-ink)]"
                            aria-hidden
                        />
                        <span>
                            <strong className="font-semibold text-[var(--viz-ink)]">
                                {breakdown.unclassifiedShare}% of citations couldn&apos;t be
                                categorised.
                            </strong>{" "}
                            They stay excluded from production until a person reviews them.
                        </span>
                    </p>
                )}

                <div className="viz-card mt-5 p-5">
                    <ul className="space-y-4">
                        {breakdown.byType.map((tally) => (
                            <li key={tally.sourceType}>
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="text-sm font-medium">{tally.label}</span>
                                    <span className="shrink-0 text-sm tabular-nums text-[var(--viz-ink-secondary)]">
                                        {tally.citations} from {tally.hosts}{" "}
                                        {tally.hosts === 1 ? "site" : "sites"}
                                    </span>
                                </div>
                                <span className="viz-track mt-1.5 block w-full overflow-hidden">
                                    <span
                                        className={`viz-bar block ${
                                            tally.actionability === "review" ? "viz-hatch" : ""
                                        }`}
                                        style={{
                                            width: `${Math.max(
                                                (tally.citations / breakdown.totalCitations) * 100,
                                                1.5,
                                            )}%`,
                                            background:
                                                tally.actionability === "review"
                                                    ? undefined
                                                    : actionColor(tally.actionability),
                                        }}
                                    />
                                </span>
                                <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">
                                    {tally.action}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>

                {citationReviewQueue.length > 0 && (
                    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/60 p-5">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <AlertTriangle
                                className="size-4 text-[var(--viz-warning-ink)]"
                                aria-hidden
                            />
                            Sources awaiting founder review
                        </h3>
                        <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">
                            These exact pages remain report-only until reviewed.
                        </p>
                        <ul className="mt-3 space-y-2">
                            {citationReviewQueue.slice(0, 10).map((item) => (
                                <li
                                    key={item.url}
                                    className="flex items-start justify-between gap-3 text-sm"
                                >
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer nofollow"
                                        className="min-w-0 truncate text-[var(--viz-series-1)] hover:underline"
                                    >
                                        {item.title || item.url}
                                    </a>
                                    <span className="shrink-0 text-xs tabular-nums text-[var(--viz-ink-muted)]">
                                        {item.host} · {item.count}×
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <section>
                <SectionHeading title="Most-cited sites" />
                <div className="viz-card mt-5 p-5">
                    <ul className="space-y-3">
                        {citedHosts.slice(0, 10).map((host) => {
                            const owned = host.sourceType === "owned"
                            return (
                                <li
                                    key={host.host}
                                    className="grid grid-cols-[auto_minmax(8rem,12rem)_1fr_auto] items-center gap-3"
                                >
                                    <Badge label={host.host} own={owned} />
                                    <button
                                        type="button"
                                        onClick={() => onFocusHost(host.host)}
                                        className={`truncate text-left text-sm underline decoration-dotted underline-offset-4 ${
                                            owned
                                                ? "font-semibold text-[var(--viz-ink)]"
                                                : "text-[var(--viz-ink-secondary)]"
                                        }`}
                                    >
                                        {owned ? `${host.host} (yours)` : host.host}
                                    </button>
                                    <span className="viz-track block w-full">
                                        <span
                                            className="viz-bar block"
                                            style={{
                                                width: `${Math.max(
                                                    (host.count / hostMax) * 100,
                                                    1.5,
                                                )}%`,
                                                background: owned
                                                    ? "var(--viz-series-1)"
                                                    : "var(--viz-seq-350)",
                                            }}
                                        />
                                    </span>
                                    <span className="w-8 text-right text-sm tabular-nums text-[var(--viz-ink-secondary)]">
                                        {host.count}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </section>

            {keyPages.length > 0 && (
                <section>
                    <SectionHeading
                        title="The lists the engines read"
                        hintLabel="Why these rows are actionable"
                        hint={
                            <p>
                                Best-of lists, comparisons and reviews used to assemble the
                                answers. Open them to check whether an earned placement is possible.
                            </p>
                        }
                    />
                    <ul className="viz-card mt-5 divide-y divide-[var(--viz-hairline)] overflow-hidden">
                        {keyPages.map((page) => (
                            <li key={page.url} className="p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <a
                                        href={page.url}
                                        target="_blank"
                                        rel="noopener noreferrer nofollow"
                                        className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-[var(--viz-series-1)] hover:underline"
                                    >
                                        <span className="truncate">{page.title || page.url}</span>
                                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                                    </a>
                                    <span className="rounded-full border border-[var(--viz-hairline)] px-2 py-0.5 text-xs text-[var(--viz-ink-muted)]">
                                        {PAGE_SHAPE_LABELS[page.pageShape]}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">
                                    {page.host} · cited in {page.count}{" "}
                                    {page.count === 1 ? "answer" : "answers"} ·{" "}
                                    {page.answersNaming > 0
                                        ? `${page.answersNaming} named you`
                                        : "none of them named you"}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-xs text-[var(--viz-ink-muted)]">
                        &ldquo;None named you&rdquo; describes the answers, not the page — we
                        haven&apos;t fetched these pages, so open a few and check.
                    </p>
                </section>
            )}

            {fanOut && fanOut.queries.length > 0 && (
                <section>
                    <SectionHeading
                        title="What the engines searched for on your behalf"
                        hintLabel="What fan-out searches are"
                        hint={
                            <p>
                                Literal sub-queries exposed by the engines, counted across the
                                questions in this run. They are not estimates of human demand.
                            </p>
                        }
                    />
                    {fanOut.hasSilentEngine && (
                        <p className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--viz-hairline)] p-4 text-sm text-[var(--viz-ink-secondary)]">
                            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>
                                {fanOut.coverage
                                    .filter(
                                        (row) => row.answers > 0 && row.answersWithFanOut === 0,
                                    )
                                    .map((row) => engineLabels[row.engine] ?? row.engine)
                                    .join(" and ")}{" "}
                                did not expose its searches; that is not evidence that it searched
                                less.
                            </span>
                        </p>
                    )}
                    {fanOutBlindSpots.length > 0 && (
                        <div className="mt-5 rounded-lg border border-red-200 bg-red-50/60 p-5">
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                                <Radar className="size-4 text-[var(--viz-critical)]" aria-hidden />
                                Searches you never turned up in
                                <InfoHint label="What a retrieval-step absence means">
                                    The engine ran these searches and the resulting answers did not
                                    name you. The absence happened before the answer was written.
                                </InfoHint>
                            </h3>
                            <ul className="mt-3 space-y-2">
                                {fanOutBlindSpots.slice(0, 8).map((query) => (
                                    <li
                                        key={query.queryNorm}
                                        className="flex flex-wrap justify-between gap-2 text-sm"
                                    >
                                        <span>&ldquo;{query.query}&rdquo;</span>
                                        <span className="tabular-nums text-[var(--viz-ink-secondary)]">
                                            {query.prompts} of {promptCount} questions
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="viz-card mt-5 overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm">
                            <thead className="border-b border-[var(--viz-hairline)] text-xs text-[var(--viz-ink-muted)]">
                                <tr>
                                    <th className="px-4 py-2.5 text-left font-medium">
                                        Search the engine ran
                                    </th>
                                    <th className="px-4 py-2.5 text-right font-medium">
                                        Your questions
                                    </th>
                                    <th className="px-4 py-2.5 text-right font-medium">
                                        Named you
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {fanOut.queries.slice(0, 20).map((query) => (
                                    <tr
                                        key={query.queryNorm}
                                        className="border-b border-[var(--viz-hairline)] last:border-0"
                                    >
                                        <td className="px-4 py-2.5">{query.query}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-[var(--viz-ink-secondary)]">
                                            {query.prompts}
                                        </td>
                                        <td
                                            className={`px-4 py-2.5 text-right tabular-nums ${
                                                query.answersNaming === 0
                                                    ? "text-[var(--viz-critical)]"
                                                    : "text-[var(--viz-ink-secondary)]"
                                            }`}
                                        >
                                            {query.answersNaming} / {query.occurrences}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-[var(--viz-ink-muted)]">
                        This is what the engines did, not how many people searched. It is not a
                        search-volume figure and cannot be read as one.
                    </p>
                </section>
            )}
        </div>
    )
}
