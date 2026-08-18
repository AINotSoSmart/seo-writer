"use client"

/**
 * The AI-visibility dashboard.
 *
 * Built around one question: **why should the reader believe any of this?**
 *
 * The answer is that every number is a count of answers we stored, and every
 * answer is one click away in full. So the layout goes claim -> evidence, not
 * claim -> more claims:
 *
 *   1. HEADLINE   one hero figure and four counts, in plain words
 *   2. RIVALS     who the engines named instead (emphasis chart — you vs context)
 *   3. SURFACES   the per-engine split, never averaged across surface kinds
 *   4. SOURCES    the pages the answers were built from
 *   5. GAPS       every losing question, expandable to the verbatim answer
 *   6. BOUNDARY   why measured gaps are not automatically articles
 *
 * Chart choices follow the data's job rather than variety: the rival chart is
 * an *emphasis* form (one series is the point, the rest are context), the
 * source chart is *sequential* (magnitude, one hue), and the gap list is a
 * table because seven-plus classes that all carry meaning belong in a table.
 * There is no trend line, because a probe samples a non-deterministic system
 * and the variance has not been measured yet.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Handshake,
    Info,
    PenLine,
    Radar,
    ShieldCheck,
} from "lucide-react"

import { AnswerEvidence } from "./answer-evidence"
import { InfoHint, SectionHeading } from "./info-hint"
import { MethodPanel } from "./method-panel"
import { VizTokens } from "./viz-tokens"
import { VisibilityOverview } from "./visibility-overview"
import type { VisibilitySummaryV2 } from "@/lib/visibility/visibility-summary"
import {
    PAGE_SHAPE_LABELS,
    type CitationBreakdown,
    type PageShape,
    type SourceType,
} from "@/lib/visibility/citation-classifier"
import { blindSpots, type FanOutSummary } from "@/lib/visibility/fan-out"
import { formatRunDate } from "@/lib/visibility/format-date"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface DashboardPrompt {
    id: string
    prompt: string
    intent: string
    verdict: "absent" | "outranked" | "present"
    answers_total: number
    answers_present: number
    mean_mention_position: number | null
    /** Hosts this question's answers cited — powers the source cross-link. */
    citedHosts?: string[]
    /** Tracked rivals named or cited in this question's answers. */
    rivalIds?: string[]
}

export interface DashboardEngine {
    engine: string
    label: string
    surface: string
    attempted: number
    succeeded: number
    failed: number
    creditsUsed: number
    errors: string[]
}

export interface DashboardCluster {
    name: string
    articles: Array<{ title: string; mainKeyword: string; articleType: string }>
}

export interface DashboardSummary extends VisibilitySummaryV2 {
    promptCount: number
    answerCount: number
    presentAnswerCount: number
    absentPromptCount: number
    outrankedPromptCount: number
    presentPromptCount: number
    leadRate: number
    presenceRate: number
    rivalLeaderboard: Array<{ name: string; url: string; promptsNaming: number }>
    /** How the tracked list was built — see RunSummary in gap-mapper.ts. */
    competitorTracking?: {
        tracked: number
        supplied: number
        discovered: number
        discoveryAttempted: boolean
        discoveryFailed: boolean
    }
    citedHosts: Array<{
        host: string
        count: number
        answersNaming: number
        sourceType: SourceType
    }>
    citationBreakdown?: CitationBreakdown
    citationReviewQueue?: Array<{
        url: string
        title: string
        host: string
        count: number
    }>
    fanOut?: FanOutSummary
    keyPages?: Array<{
        url: string
        title: string
        host: string
        pageShape: PageShape
        sourceType: SourceType
        count: number
        answersNaming: number
    }>
}

export interface DashboardProps {
    /**
     * Rendered inside the dashboard shell, which already carries the page
     * header, the width and the padding. The shareable link route renders
     * standalone and leaves this false.
     */
    embedded?: boolean
    runId: string
    subjectName: string
    subjectDomains: string[]
    startedAt: string
    creditsUsed: number
    summary: DashboardSummary
    prompts: DashboardPrompt[]
    engines: DashboardEngine[]
    clusters: DashboardCluster[]
    /** Per-engine presence, computed server-side from the stored answers. */
    perEngine: Array<{ engine: string; label: string; surface: string; total: number; present: number }>
    auditId?: string | null
    /**
     * Retained so the CTA can still be read as a decision rather than a
     * constant, but there is only one caller now and it is behind login: the
     * report has no anonymous rendering path since `/visibility/[runId]` stopped
     * being public. There is deliberately no `publicToken` prop — an
     * unauthenticated share token for a customer run no longer exists.
     */
    isAuthenticated?: boolean
}

const VERDICT_META = {
    absent: {
        label: "Not named",
        Icon: AlertCircle,
        className: "text-[var(--viz-critical)]",
        chip: "bg-[var(--viz-critical)]/12 text-[var(--viz-critical)]",
    },
    outranked: {
        label: "Named, never first",
        Icon: AlertTriangle,
        className: "text-[var(--viz-warning-ink)]",
        chip: "bg-[var(--viz-warning)]/18 text-[var(--viz-warning-ink)]",
    },
    present: {
        label: "Named first",
        Icon: CheckCircle2,
        className: "text-[var(--viz-good-ink)]",
        chip: "bg-[var(--viz-good)]/12 text-[var(--viz-good-ink)]",
    },
} as const

const VERDICT_ORDER = { absent: 0, outranked: 1, present: 2 } as const

/**
 * Horizontal bar row. The value is always direct-labelled, so identity and
 * magnitude never depend on colour alone.
 */
function BarRow({
    name,
    value,
    max,
    total,
    color,
    emphasis = false,
    suffix,
    onSelect,
}: {
    name: string
    value: number
    max: number
    total: number
    color: string
    emphasis?: boolean
    suffix?: string
    /** When given, the label becomes a control that filters the question list. */
    onSelect?: () => void
}) {
    const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1.5 : 0) : 0
    const share = total > 0 ? Math.round((value / total) * 100) : 0
    return (
        <li
            className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3"
            title={`${name}: named in ${value} of ${total} questions (${share}%)`}
        >
            {onSelect ? (
                <button
                    type="button"
                    onClick={onSelect}
                    className={`truncate text-left text-sm underline decoration-dotted underline-offset-4 transition hover:text-[var(--viz-series-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-series-1)] ${
                        emphasis
                            ? "font-semibold text-[var(--viz-ink)]"
                            : "text-[var(--viz-ink-secondary)]"
                    }`}
                >
                    {name}
                </button>
            ) : (
            <span
                className={`truncate text-sm ${
                    emphasis
                        ? "font-semibold text-[var(--viz-ink)]"
                        : "text-[var(--viz-ink-secondary)]"
                }`}
            >
                {name}
            </span>
            )}
            <span className="viz-track block w-full">
                <span
                    className="viz-bar block"
                    style={{ width: `${width}%`, background: color }}
                />
            </span>
            {/*
             * Direct-labelled, so magnitude never rests on bar length alone.
             * The unit lives in the section heading rather than on every row —
             * repeated at 10 rows it wrapped the column onto two lines and read
             * as noise.
             */}
            <span className="w-16 whitespace-nowrap text-right text-sm tabular-nums text-[var(--viz-ink-secondary)]">
                {value}
                {suffix ?? ` / ${total}`}
            </span>
        </li>
    )
}

export function VisibilityDashboard(props: DashboardProps) {
    const {
        runId,
        subjectName,
        subjectDomains,
        startedAt,
        creditsUsed,
        summary,
        prompts,
        engines,
        perEngine,
        isAuthenticated,
        embedded = false,
    } = props

    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [filter, setFilter] = useState<"losing" | "all">("losing")
    const engineLabels = useMemo(
        () => Object.fromEntries(engines.map((engine) => [engine.engine, engine.label])),
        [engines],
    )

    const consumerEngines = engines.filter((engine) => engine.surface === "consumer_app")
    const apiEngines = engines.filter((engine) => engine.surface === "api")
    const degraded = engines.filter((engine) => engine.failed > 0)

    /**
     * A cross-link from a number to the questions behind it.
     *
     * The report had four panels a reader had to hold in their head at once:
     * "pixreunion.com was cited 6 times" and, somewhere in a forty-row list,
     * the six questions that produced those citations. `focus` is what joins
     * them — click the site or the rival, land on the questions.
     *
     * It deliberately does NOT replace the losing/all filter; it narrows on a
     * second axis, so "losing questions where pixreunion was cited" is
     * reachable and is usually the interesting set.
     */
    const [focus, setFocus] = useState<
        { kind: "host" | "rival"; value: string; label: string } | null
    >(null)
    const [tab, setTab] = useState("overview")

    const focusOn = (kind: "host" | "rival", value: string, label: string) => {
        setFocus({ kind, value, label })
        setTab("questions")
    }

    const visible = useMemo(() => {
        let rows =
            filter === "losing"
                ? prompts.filter((prompt) => prompt.verdict !== "present")
                : prompts
        if (focus) {
            rows = rows.filter((prompt) =>
                focus.kind === "host"
                    ? (prompt.citedHosts ?? []).includes(focus.value)
                    : (prompt.rivalIds ?? []).includes(focus.value),
            )
        }
        return [...rows].sort(
            (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict],
        )
    }, [prompts, filter, focus])

    const losingCount = prompts.filter((prompt) => prompt.verdict !== "present").length

    const hostMax = Math.max(...summary.citedHosts.map((host) => host.count), 1)
    const breakdown = summary.citationBreakdown
    const citationReviewQueue = summary.citationReviewQueue ?? []
    // Completed runs predate Phase 0b's explicit split. Preserve their frozen
    // counts while mapping the old unclassified bucket to founder review.
    const reviewShare = breakdown?.reviewShare ?? breakdown?.unclassifiedShare ?? 0
    const reportOnlyShare =
        breakdown?.reportOnlyShare ??
        Math.max(
            0,
            100 -
                (breakdown?.publishShare ?? 0) -
                (breakdown?.earnShare ?? 0) -
                reviewShare,
        )
    const keyPages = summary.keyPages ?? []
    const fanOut = summary.fanOut
    // Sub-queries the engines kept running and never found the brand in — a
    // retrieval-level absence, upstream of anything the answer text shows.
    const fanOutBlindSpots = useMemo(
        () => (fanOut ? blindSpots(fanOut) : []),
        [fanOut],
    )

    const toggle = (id: string) => {
        setExpanded((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    return (
        <div className="viz-root text-[var(--viz-ink)]">
            <VizTokens />

            {/* Padding and width belong to the host when there is one. The
                dashboard page supplies the app shell, its own sidebar gutter and
                the page header; repeating them here produced a second title and
                a card floating inside a card. The shareable link route has no
                shell, so it still gets both. */}
            <div className={embedded ? "" : "mx-auto max-w-5xl px-6 py-12"}>
                {/* ── Header ───────────────────────────────────────────── */}
                <header className={embedded ? "sr-only" : undefined}>
                    <p className="text-xs uppercase tracking-wide text-[var(--viz-ink-muted)]">
                        AI visibility · {formatRunDate(startedAt)}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">{subjectName}</h1>
                    <p className="mt-2 text-[var(--viz-ink-secondary)]">
                        We asked{" "}
                        <strong className="font-semibold text-[var(--viz-ink)]">
                            {summary.promptCount} buyer questions
                        </strong>{" "}
                        on{" "}
                        {consumerEngines.map((engine, index) => (
                            <span key={engine.engine}>
                                {index > 0 && index === consumerEngines.length - 1
                                    ? " and "
                                    : index > 0
                                      ? ", "
                                      : ""}
                                <strong className="font-semibold text-[var(--viz-ink)]">
                                    {engine.label}
                                </strong>
                            </span>
                        ))}{" "}
                        and read all {summary.answerCount} answers.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--viz-good)]/12 px-2.5 py-1 font-medium text-[var(--viz-good-ink)]">
                            <CheckCircle2 className="size-3.5" aria-hidden />
                            Real consumer answers, not the developer API
                        </span>
                        {creditsUsed > 0 && (
                            <span className="rounded-full border border-[var(--viz-hairline)] px-2.5 py-1 tabular-nums text-[var(--viz-ink-muted)]">
                                {creditsUsed} credits
                            </span>
                        )}
                    </div>

                    <div className="mt-4">
                        <MethodPanel
                            subjectName={subjectName}
                            unclassifiedShare={breakdown?.unclassifiedShare ?? 0}
                            promptCount={summary.promptCount}
                        />
                    </div>
                </header>

                {degraded.length > 0 && (
                    <p className="mt-6 flex items-start gap-2 rounded-lg border border-[var(--viz-warning)]/40 bg-[var(--viz-warning)]/10 p-4 text-sm">
                        <AlertTriangle
                            className="mt-0.5 size-4 shrink-0 text-[var(--viz-warning-ink)]"
                            aria-hidden
                        />
                        <span className="text-[var(--viz-ink-secondary)]">
                            <strong className="font-semibold text-[var(--viz-ink)]">
                                Some requests failed
                            </strong>{" "}
                            and are excluded from every number below —{" "}
                            {degraded
                                .map((engine) => `${engine.label} ${engine.failed}/${engine.attempted}`)
                                .join(", ")}
                            . A failed request is never counted as you being absent.
                        </span>
                    </p>
                )}

                {apiEngines.length > 0 && (
                    <p className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--viz-hairline)] p-4 text-sm">
                        <Info className="mt-0.5 size-4 shrink-0 text-[var(--viz-ink-muted)]" aria-hidden />
                        <span className="text-[var(--viz-ink-secondary)]">
                            {apiEngines.map((engine) => engine.label).join(", ")} came from the
                            developer API, which can differ substantially from what a person sees
                            in the app. Those answers are labelled individually and are reported
                            separately below.
                        </span>
                    </p>
                )}

                {/*
                  * Four views, not one scroll.
                  *
                  * The report is five dense sections — overview, surfaces,
                  * sources, every question, next step — and a reader arriving
                  * for one of them had to scroll past the other four. Worse, the
                  * question list alone is forty expandable rows, so the sections
                  * below it were effectively unreachable.
                  *
                  * Radix unmounts inactive panels, so the forty-row list and the
                  * source tables are not in the DOM until asked for.
                  *
                  * Order is document order: each panel wraps the section that
                  * already sat here, byte for byte. Nothing moved, so nothing
                  * inside a panel changed behaviour.
                  */}
                <Tabs value={tab} onValueChange={setTab} className="mt-8">
                    <TabsList className="w-full justify-start overflow-x-auto">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        {perEngine.length > 1 && (
                            <TabsTrigger value="surfaces">Surfaces</TabsTrigger>
                        )}
                        <TabsTrigger value="sources">Sources</TabsTrigger>
                        <TabsTrigger value="questions">
                            Questions ({prompts.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <VisibilityOverview
                            subjectName={subjectName}
                            summary={summary}
                            onFocusRival={(competitorId, label) =>
                                focusOn("rival", competitorId, label)
                            }
                        />
                    </TabsContent>

                <TabsContent value="surfaces">
                {/* ── 3. Surfaces ──────────────────────────────────────── */}
                {perEngine.length > 1 && (
                    <section className="mt-12">
                        <SectionHeading
                            title="How each surface differs"
                            hintLabel="Why surfaces are never averaged"
                            hint={
                                <p>
                                    Reported per surface and never averaged together — the same
                                    brand can look very different on two engines, and an average
                                    hides exactly the gap worth acting on.
                                </p>
                            }
                        />

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            {perEngine.map((engine, index) => {
                                const rate =
                                    engine.total > 0
                                        ? Math.round((engine.present / engine.total) * 1000) / 10
                                        : 0
                                const color =
                                    index === 0 ? "var(--viz-series-1)" : "var(--viz-series-2)"
                                return (
                                    <div
                                        key={engine.engine}
                                        className="rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center gap-2 text-sm font-medium">
                                                <span
                                                    className="inline-block size-2.5 rounded-sm"
                                                    style={{ background: color }}
                                                />
                                                {engine.label}
                                            </span>
                                            {engine.surface === "api" && (
                                                <span className="rounded-full bg-[var(--viz-warning)]/18 px-2 py-0.5 text-[11px] font-medium text-[var(--viz-warning-ink)]">
                                                    API surface
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 text-3xl font-semibold tabular-nums">
                                            {rate}%
                                        </div>
                                        <span className="viz-track mt-3 block w-full">
                                            <span
                                                className="viz-bar block"
                                                style={{
                                                    width: `${Math.max(rate, rate > 0 ? 1.5 : 0)}%`,
                                                    background: color,
                                                }}
                                            />
                                        </span>
                                        <p className="mt-2 text-sm tabular-nums text-[var(--viz-ink-secondary)]">
                                            named in {engine.present} of {engine.total} answers
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}

                </TabsContent>

                <TabsContent value="sources">
                {/* ── 4. Sources — what the answers were built from ────── */}
                {summary.citedHosts.length > 0 && (
                    <section className="mt-12">
                        <SectionHeading
                            title="What the answers were built from"
                            hintLabel="What citations mean here"
                            hint={
                                <p>
                                    The pages these engines cited, by number of citations.
                                    Getting cited here is what being recommended looks like
                                    underneath.
                                </p>
                            }
                        />

                        {breakdown && breakdown.totalCitations > 0 && (
                            <>
                                {/*
                                 * The actionable split, and the reason this section exists:
                                 * a source you can publish to yourself is a different kind
                                 * of work from one someone else has to publish about you.
                                 */}
                                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-5">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <PenLine
                                                className="size-4 text-[var(--viz-series-1)]"
                                                aria-hidden
                                            />
                                            You can publish this
                                        </div>
                                        <div className="mt-2 text-3xl font-semibold tabular-nums">
                                            {breakdown.publishShare}%
                                        </div>
                                        <p className="mt-1 text-sm text-[var(--viz-ink-secondary)]">
                                            of citations are your pages or a competitor&apos;s —
                                            answerable by writing better pages yourself.
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-5">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <Handshake
                                                className="size-4 text-[var(--viz-series-2)]"
                                                aria-hidden
                                            />
                                            You have to earn this
                                        </div>
                                        <div className="mt-2 text-3xl font-semibold tabular-nums">
                                            {breakdown.earnShare}%
                                        </div>
                                        <p className="mt-1 text-sm text-[var(--viz-ink-secondary)]">
                                            review sites, communities and press — a placement, not
                                            a publishing job.
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-5">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <ShieldCheck
                                                className="size-4 text-[var(--viz-ink-muted)]"
                                                aria-hidden
                                            />
                                            Report only
                                        </div>
                                        <div className="mt-2 text-3xl font-semibold tabular-nums">
                                            {reportOnlyShare}%
                                        </div>
                                        <p className="mt-1 text-sm text-[var(--viz-ink-secondary)]">
                                            institutional and third-party reference material — not
                                            an owned-page production job.
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-[var(--viz-warning)]/40 bg-[var(--viz-warning)]/5 p-5">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <AlertTriangle
                                                className="size-4 text-[var(--viz-warning-ink)]"
                                                aria-hidden
                                            />
                                            Founder review
                                        </div>
                                        <div className="mt-2 text-3xl font-semibold tabular-nums">
                                            {reviewShare}%
                                        </div>
                                        <p className="mt-1 text-sm text-[var(--viz-ink-secondary)]">
                                            unresolved sources — excluded from production until a
                                            person reviews them.
                                        </p>
                                    </div>
                                </div>

                                {/*
                                 * Stated at the top of the breakdown, not buried. Above a
                                 * third, the categories describe the limits of our lists
                                 * more than they describe the market, and the reader has to
                                 * know that before reading the chart.
                                 */}
                                {breakdown.unclassifiedShare >= 33 && (
                                    <p className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--viz-warning)]/40 bg-[var(--viz-warning)]/10 p-4 text-sm text-[var(--viz-ink-secondary)]">
                                        <Info
                                            className="mt-0.5 size-4 shrink-0 text-[var(--viz-warning-ink)]"
                                            aria-hidden
                                        />
                                        <span>
                                            <strong className="font-semibold text-[var(--viz-ink)]">
                                                {breakdown.unclassifiedShare}% of citations
                                                couldn&apos;t be categorised.
                                            </strong>{" "}
                                            These sources are placed in founder review and cannot
                                            enter article production automatically.
                                        </span>
                                    </p>
                                )}

                                <div className="mt-5 rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-5">
                                    <ul className="space-y-3">
                                        {breakdown.byType.map((tally) => (
                                            <li key={tally.sourceType}>
                                                <div className="flex items-baseline justify-between gap-3">
                                                    <span className="text-sm font-medium text-[var(--viz-ink)]">
                                                        {tally.label}
                                                    </span>
                                                    <span className="shrink-0 text-sm tabular-nums text-[var(--viz-ink-secondary)]">
                                                        {tally.citations} from {tally.hosts}{" "}
                                                        {tally.hosts === 1 ? "site" : "sites"}
                                                    </span>
                                                </div>
                                                <span className="viz-track mt-1.5 block w-full">
                                                    <span
                                                        className="viz-bar block"
                                                        style={{
                                                            width: `${Math.max(
                                                                (tally.citations /
                                                                    breakdown.totalCitations) *
                                                                    100,
                                                                1.5,
                                                            )}%`,
                                                            background:
                                                                tally.actionability === "publish"
                                                                    ? "var(--viz-series-1)"
                                                                    : tally.actionability === "earn"
                                                                      ? "var(--viz-series-2)"
                                                                      : tally.actionability === "review"
                                                                        ? "var(--viz-warning)"
                                                                        : "var(--viz-muted-mark)",
                                                        }}
                                                    />
                                                </span>
                                                <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">
                                                    {tally.action}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[var(--viz-hairline)] pt-3 text-xs text-[var(--viz-ink-muted)]">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span
                                                className="inline-block size-2.5 rounded-sm"
                                                style={{ background: "var(--viz-series-1)" }}
                                            />
                                            Publish
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span
                                                className="inline-block size-2.5 rounded-sm"
                                                style={{ background: "var(--viz-series-2)" }}
                                            />
                                            Earn
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span
                                                className="inline-block size-2.5 rounded-sm"
                                                style={{ background: "var(--viz-muted-mark)" }}
                                            />
                                            Neither
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span
                                                className="inline-block size-2.5 rounded-sm"
                                                style={{ background: "var(--viz-warning)" }}
                                            />
                                            Founder review
                                        </span>
                                    </div>
                                </div>

                                {citationReviewQueue.length > 0 && (
                                    <div className="mt-5 rounded-lg border border-[var(--viz-warning)]/40 bg-[var(--viz-warning)]/5 p-5">
                                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                                            <AlertTriangle
                                                className="size-4 text-[var(--viz-warning-ink)]"
                                                aria-hidden
                                            />
                                            Sources awaiting founder review
                                        </h3>
                                        <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">
                                            These exact pages could not be classified from stored
                                            evidence. They remain report-only until reviewed.
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
                            </>
                        )}

                        <h3 className="mt-8 text-sm font-medium">Most-cited sites</h3>
                        <div className="mt-3 rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-5">
                            <ul className="space-y-2.5">
                                {summary.citedHosts.slice(0, 10).map((host) => {
                                    const owned = host.sourceType === "owned"
                                    // Host only. Appending the category truncated
                                    // the hostname at 11rem — and the grouped
                                    // breakdown directly above already carries
                                    // category, so the suffix cost information in
                                    // order to repeat information.
                                    return (
                                        <BarRow
                                            key={host.host}
                                            name={owned ? `${host.host} (yours)` : host.host}
                                            value={host.count}
                                            max={hostMax}
                                            total={host.count}
                                            color={
                                                owned
                                                    ? "var(--viz-series-1)"
                                                    : "var(--viz-seq-350)"
                                            }
                                            emphasis={owned}
                                            suffix=""
                                            onSelect={() =>
                                                focusOn(
                                                    "host",
                                                    host.host,
                                                    `answers citing ${host.host}`,
                                                )
                                            }
                                        />
                                    )
                                })}
                            </ul>
                        </div>
                    </section>
                )}

                {/* ── 4b. The pages that assemble recommendations ───────── */}
                {keyPages.length > 0 && (
                    <section className="mt-12">
                        <SectionHeading
                            title="The lists the engines read"
                            hintLabel="Why these rows are the most actionable"
                            hint={
                                <p>
                                    Best-of lists, comparisons and reviews the answers were built
                                    from. This is how an engine assembles a recommendation —
                                    which makes these the most directly actionable rows in the
                                    report.
                                </p>
                            }
                        />

                        <ul className="mt-5 divide-y divide-[var(--viz-hairline)] overflow-hidden rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)]">
                            {keyPages.map((page) => (
                                <li key={page.url} className="p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <a
                                            href={page.url}
                                            target="_blank"
                                            rel="noopener noreferrer nofollow"
                                            className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-[var(--viz-series-1)] hover:underline"
                                        >
                                            <span className="truncate">
                                                {page.title || page.url}
                                            </span>
                                            <ExternalLink className="size-3 shrink-0" aria-hidden />
                                        </a>
                                        <span className="shrink-0 rounded-full border border-[var(--viz-hairline)] px-2 py-0.5 text-xs text-[var(--viz-ink-muted)]">
                                            {PAGE_SHAPE_LABELS[page.pageShape]}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">
                                        {page.host} · cited in {page.count}{" "}
                                        {page.count === 1 ? "answer" : "answers"}
                                        {page.answersNaming === 0 ? (
                                            <span className="text-[var(--viz-critical)]">
                                                {" "}
                                                · none of them named you
                                            </span>
                                        ) : (
                                            <span>
                                                {" "}
                                                · {page.answersNaming} named you
                                            </span>
                                        )}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 text-xs text-[var(--viz-ink-muted)]">
                            &ldquo;None of them named you&rdquo; describes the answers, not the
                            page — we haven&apos;t fetched these pages, so we can&apos;t say
                            whether a given one mentions you. Open a few and check.
                        </p>
                    </section>
                )}

                {/* ── 4c. Query fan-out — what the engines searched ────── */}
                {fanOut && fanOut.queries.length > 0 && (
                    <section className="mt-12">
                        <SectionHeading
                            title="What the engines searched for on your behalf"
                            hintLabel="What fan-out searches are"
                            hint={
                                <p>
                                    The engines don&apos;t search your question verbatim — they
                                    break it into their own searches. These are the ones they
                                    actually ran, and how many of your {summary.promptCount}{" "}
                                    questions triggered each.
                                </p>
                            }
                        />

                        {/*
                         * Coverage is stated before the data, because the fan-out
                         * is unevenly exposed: Cloro's own note is that Perplexity
                         * and Copilot populate it while ChatGPT returns the key
                         * empty. An unexplained short list would read as "the
                         * engines barely searched", which is false.
                         */}
                        {fanOut.hasSilentEngine && (
                            <p className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--viz-hairline)] p-4 text-sm text-[var(--viz-ink-secondary)]">
                                <Info
                                    className="mt-0.5 size-4 shrink-0 text-[var(--viz-ink-muted)]"
                                    aria-hidden
                                />
                                <span>
                                    {fanOut.coverage
                                        .filter(
                                            (row) => row.answers > 0 && row.answersWithFanOut === 0,
                                        )
                                        .map((row) => engineLabels[row.engine] ?? row.engine)
                                        .join(" and ")}{" "}
                                    didn&apos;t expose its searches, so nothing below comes from
                                    it. That&apos;s a limit of what the engine reports — not
                                    evidence that it searched less.
                                </span>
                            </p>
                        )}

                        {fanOutBlindSpots.length > 0 && (
                            <div className="mt-5 rounded-lg border border-[var(--viz-critical)]/30 bg-[var(--viz-critical)]/5 p-5">
                                <h3 className="flex items-center gap-2 text-sm font-semibold">
                                    <Radar
                                        className="size-4 text-[var(--viz-critical)]"
                                        aria-hidden
                                    />
                                    Searches you never turned up in
                                    <InfoHint label="What a retrieval-step absence means">
                                        <p>
                                            The engines ran these repeatedly and no answer that
                                            used them named you. That&apos;s an absence at the
                                            retrieval step — before the answer was even written.
                                        </p>
                                    </InfoHint>
                                </h3>
                                <ul className="mt-3 space-y-2">
                                    {fanOutBlindSpots.slice(0, 8).map((query) => (
                                        <li
                                            key={query.queryNorm}
                                            className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                                        >
                                            <span className="font-medium text-[var(--viz-ink)]">
                                                &ldquo;{query.query}&rdquo;
                                            </span>
                                            <span className="tabular-nums text-[var(--viz-ink-secondary)]">
                                                triggered by {query.prompts} of{" "}
                                                {summary.promptCount} questions
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-5 overflow-hidden rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--viz-hairline)] text-left text-xs text-[var(--viz-ink-muted)]">
                                        <th className="px-4 py-2.5 font-medium">
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
                                            <td className="px-4 py-2.5 text-[var(--viz-ink)]">
                                                {query.query}
                                            </td>
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

                        {/*
                         * The line that keeps this honest. It is the difference
                         * between this feature and the search-volume estimate we
                         * deliberately did not buy.
                         */}
                        <p className="mt-3 text-xs text-[var(--viz-ink-muted)]">
                            This is what the engines did, not how many people searched. A search
                            appearing often means the engines kept converging on that framing
                            across the questions we asked — it is not a search-volume figure and
                            cannot be read as one.
                        </p>
                    </section>
                )}

                </TabsContent>

                <TabsContent value="questions">
                {/* ── 5. Gaps, with evidence ───────────────────────────── */}
                <section className="mt-12">
                    <SectionHeading
                        title="Every question we asked"
                        hintLabel="How to check any claim on this page"
                        hint={
                            <>
                                <p>
                                    Open any row to read the answers exactly as they came back.
                                    If a claim here isn&apos;t supported by the answer underneath
                                    it, the claim is wrong — check a few.
                                </p>
                                <p className="mt-2">
                                    <strong className="text-[var(--viz-ink)]">Not named</strong>{" "}
                                    means the brand appears nowhere in the answer text.{" "}
                                    <strong className="text-[var(--viz-ink)]">
                                        Named, never first
                                    </strong>{" "}
                                    means it appears but never as the first product or provider
                                    named.
                                </p>
                            </>
                        }
                    >
                        <div className="flex items-center gap-1 rounded-lg border border-[var(--viz-hairline)] p-0.5 text-sm">
                            <button
                                type="button"
                                onClick={() => setFilter("losing")}
                                className={`rounded-md px-3 py-1 transition ${
                                    filter === "losing"
                                        ? "bg-[var(--viz-ink)] text-[var(--viz-surface)]"
                                        : "text-[var(--viz-ink-secondary)]"
                                }`}
                            >
                                Losing ({losingCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilter("all")}
                                className={`rounded-md px-3 py-1 transition ${
                                    filter === "all"
                                        ? "bg-[var(--viz-ink)] text-[var(--viz-surface)]"
                                        : "text-[var(--viz-ink-secondary)]"
                                }`}
                            >
                                All ({prompts.length})
                            </button>
                        </div>
                    </SectionHeading>

                    {/* The cross-link has to be visible and undoable. An
                        invisible filter is how a reader concludes questions are
                        missing. */}
                    {focus && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--viz-series-1)]/30 bg-[var(--viz-series-1)]/5 px-3 py-2 text-sm">
                            <span className="text-[var(--viz-ink-secondary)]">
                                Showing {visible.length}{" "}
                                {visible.length === 1 ? "question" : "questions"} —{" "}
                                <strong className="font-semibold text-[var(--viz-ink)]">
                                    {focus.label}
                                </strong>
                            </span>
                            <button
                                type="button"
                                onClick={() => setFocus(null)}
                                className="ml-auto rounded-md border border-[var(--viz-hairline)] px-2.5 py-1 text-xs font-medium text-[var(--viz-ink-secondary)] transition hover:text-[var(--viz-ink)]"
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    <ul className="mt-5 divide-y divide-[var(--viz-hairline)] overflow-hidden rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)]">
                        {visible.map((prompt) => {
                            const meta = VERDICT_META[prompt.verdict]
                            const isOpen = expanded.has(prompt.id)
                            return (
                                <li key={prompt.id}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(prompt.id)}
                                        aria-expanded={isOpen}
                                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--viz-plane)]"
                                    >
                                        {isOpen ? (
                                            <ChevronDown
                                                className="mt-0.5 size-4 shrink-0 text-[var(--viz-ink-muted)]"
                                                aria-hidden
                                            />
                                        ) : (
                                            <ChevronRight
                                                className="mt-0.5 size-4 shrink-0 text-[var(--viz-ink-muted)]"
                                                aria-hidden
                                            />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium text-[var(--viz-ink)]">
                                                {prompt.prompt}
                                            </span>
                                            <span className="mt-1 block text-xs text-[var(--viz-ink-muted)]">
                                                {prompt.intent} · {prompt.answers_present} of{" "}
                                                {prompt.answers_total} answers named you
                                            </span>
                                        </span>
                                        <span
                                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.chip}`}
                                        >
                                            <meta.Icon className="size-3.5" aria-hidden />
                                            {meta.label}
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="border-t border-[var(--viz-hairline)] bg-[var(--viz-plane)] px-4">
                                            <AnswerEvidence
                                                promptId={prompt.id}
                                                engineLabels={engineLabels}
                                                subjectName={subjectName}
                                                subjectDomains={subjectDomains}
                                            />
                                            <div className="pb-4">
                                                <Link
                                                    href={`/evidence/ai-answer/${runId}/${prompt.id}`}
                                                    className="inline-flex items-center gap-1 text-xs text-[var(--viz-series-1)] hover:underline"
                                                >
                                                    Open this evidence on its own page
                                                    <ExternalLink className="size-3" aria-hidden />
                                                </Link>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </section>

                </TabsContent>
                </Tabs>

                {/* Outside the tabs on purpose: the next action must be reachable
                    from every view, not hidden behind one of them. */}
                {/* ── 6. Production boundary ─────────────────────────── */}
                <section className="mt-12">
                    <SectionHeading
                        title="From findings to content work"
                        hintLabel="Why a losing question is not automatically an article"
                        hint={
                            <>
                                <p>
                                    A losing question is evidence about an AI answer, not proof
                                    that your site needs another article. Existing-page coverage
                                    and grouped target review decide whether the remedy is a
                                    refresh, a new page, or report-only.
                                </p>
                                <p className="mt-2">
                                    Legacy cluster suggestions are intentionally not shown or
                                    selected. Only confirmed grouped create/refresh actions can
                                    use production capacity.
                                </p>
                            </>
                        }
                    />
                    <div className="mt-5 flex flex-col gap-4 rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="font-semibold text-[var(--viz-ink)]">
                                {losingCount} losing questions await page-aware planning
                            </div>
                        </div>
                        {isAuthenticated && (
                            <Link
                                href="/content-plan"
                                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--viz-hairline)] px-4 py-2.5 text-sm font-semibold text-[var(--viz-ink)]"
                            >
                                Review delivery state
                            </Link>
                        )}
                    </div>
                </section>

                {/* ── Method note ──────────────────────────────────────── */}
                {/*
                  * The method note is one line plus a hint, not two paragraphs.
                  *
                  * Both paragraphs were standing information — true of every run
                  * and unchanged between them — sitting at the bottom of a long
                  * scroll where they were read once and never again. The only
                  * part that varies per run is the date and the answer count, so
                  * that is what stays visible.
                  */}
                <footer className="mt-14 flex flex-wrap items-center gap-1.5 border-t border-[var(--viz-hairline)] pt-6 text-xs leading-relaxed text-[var(--viz-ink-muted)]">
                    <span>
                        {summary.answerCount} answers captured on{" "}
                        {formatRunDate(startedAt)} — a measurement, not a ranking.
                    </span>
                    <InfoHint label="How to check this report, and what its limits are">
                        <p>
                            <strong className="text-[var(--viz-ink)]">How to check this.</strong>{" "}
                            Every number here counts answers we stored. Open any question and read
                            the answer that produced its verdict.
                        </p>
                        <p className="mt-2">
                            &ldquo;Not named&rdquo; means the brand appears nowhere in the text;
                            &ldquo;named, never first&rdquo; means it appears but is never the
                            first detected product or provider named.
                        </p>
                        <p className="mt-2">
                            AI answers are non-deterministic and vary by person, place and time.
                            A later run may differ, and that is a property of what is being
                            measured rather than a fault in the measurement.
                        </p>
                    </InfoHint>
                </footer>
            </div>
        </div>
    )
}
