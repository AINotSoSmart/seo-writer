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
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Check,
    Info,
    Link2,
    MessageSquareQuote,
    Sparkles,
} from "lucide-react"

import { InfoHint } from "./info-hint"
import { MethodPanel } from "./method-panel"
import { StatCard } from "./marks"
import { VizTokens } from "./viz-tokens"
import { VisibilityOverview } from "./visibility-overview"
import { VisibilityQuestions } from "./visibility-questions"
import { VisibilitySources } from "./visibility-sources"
import { VisibilitySurfaces } from "./visibility-surfaces"
import type {
    DashboardActionSummary,
    DashboardQuestionAction,
} from "./dashboard-model"
import type { VisibilitySummaryV2 } from "@/lib/visibility/visibility-summary"
import {
    type CitationBreakdown,
    type PageShape,
    type SourceType,
} from "@/lib/visibility/citation-classifier"
import type { FanOutSummary } from "@/lib/visibility/fan-out"
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
    /** Confirmed product area that owns this measured question. */
    scopeFamilyName: string
    /** Citation occurrences across this question's stored answers. */
    citationCount: number
    /** Hosts this question's answers cited — powers the source cross-link. */
    citedHosts?: string[]
    /** Tracked rivals named or cited in this question's answers. */
    rivalIds?: string[]
    /** Site-aware proposal linked to this durable question, when one exists. */
    action?: DashboardQuestionAction
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
    marketName: string
    summary: DashboardSummary
    prompts: DashboardPrompt[]
    engines: DashboardEngine[]
    clusters: DashboardCluster[]
    /** Per-engine presence, computed server-side from the stored answers. */
    perEngine: Array<{ engine: string; label: string; surface: string; total: number; present: number }>
    auditId?: string | null
    actionSummary: DashboardActionSummary
    /**
     * Retained so the CTA can still be read as a decision rather than a
     * constant, but there is only one caller now and it is behind login: the
     * report has no anonymous rendering path since `/visibility/[runId]` stopped
     * being public. There is deliberately no `publicToken` prop — an
     * unauthenticated share token for a customer run no longer exists.
     */
    isAuthenticated?: boolean
}

/**
 * One tab, styled as an underline rather than a pill.
 *
 * Hoisted to a constant because four triggers sharing an eleven-class string
 * inline is four places for it to drift apart.
 */
const TAB_CLASS =
    "flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[13px] text-[var(--viz-ink-secondary)] shadow-none data-[state=active]:border-[var(--viz-ink)] data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-[var(--viz-ink)] data-[state=active]:shadow-none"

function rate(part: number, whole: number): string {
    if (whole === 0) return "0%"
    return `${Math.round((part / whole) * 1000) / 10}%`
}

function rateNumber(part: number, whole: number): string {
    if (whole === 0) return "0.0"
    return ((part / whole) * 100).toFixed(1)
}

/**
 * "st", "nd", "rd", "th" — including the teens, which every naive version of
 * this gets wrong (11th, not 11st).
 */
function ordinalSuffix(n: number): string {
    const tens = n % 100
    if (tens >= 11 && tens <= 13) return "th"
    return ["th", "st", "nd", "rd"][n % 10] ?? "th"
}

export function VisibilityDashboard(props: DashboardProps) {
    const {
        runId,
        subjectName,
        subjectDomains,
        startedAt,
        creditsUsed,
        marketName,
        summary,
        prompts,
        engines,
        perEngine,
        isAuthenticated,
        actionSummary,
        embedded = false,
    } = props
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

    const questionPrompts = useMemo(() => {
        if (!focus) return prompts
        return prompts.filter((prompt) =>
            focus.kind === "host"
                ? (prompt.citedHosts ?? []).includes(focus.value)
                : (prompt.rivalIds ?? []).includes(focus.value),
        )
    }, [prompts, focus])

    const brandV = summary.brandVisibility
    /**
     * The brands this run can rank: the subject plus every confirmed rival.
     *
     * Rank is only meaningful against a stated field, so the field is stated —
     * "2nd of 5" is checkable against the rival table, where a bare "2nd" would
     * be a number only this card could produce.
     */
    const rankField = [
        { name: subjectName, namedAnswers: brandV.namedAnswers, own: true },
        ...summary.competitorVisibility.namedRows.map((row) => ({
            name: row.name,
            namedAnswers: row.namedAnswers,
            own: false,
        })),
    ].sort((a, b) => b.namedAnswers - a.namedAnswers || a.name.localeCompare(b.name))
    const brandRank = rankField.findIndex((row) => row.own) + 1
    const rankLeader = rankField[0]

    const breakdown = summary.citationBreakdown
    const citationReviewQueue = summary.citationReviewQueue ?? []
    const keyPages = summary.keyPages ?? []
    const fanOut = summary.fanOut

    const rivalNames = Object.fromEntries(
        summary.competitorVisibility.namedRows.map((row) => [row.id, row.name]),
    )

    return (
        <div className="viz-root text-[var(--viz-ink)]">
            <VizTokens />

            <div
                className={
                    embedded
                        ? "mx-auto w-full max-w-[1376px]"
                        : "mx-auto w-full max-w-[1376px] px-6 py-12"
                }
            >
                <header className="flex flex-col gap-5 border-b border-[var(--viz-hairline)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-violet-600">
                            <Sparkles className="size-3.5" aria-hidden />
                            AI visibility
                        </div>
                        <h1 className="mt-2 truncate font-serif text-[30px] font-medium leading-[1.15] text-[var(--viz-ink)]">
                            {subjectName}
                        </h1>
                        <p className="mt-2 text-[13px] text-[var(--viz-ink-secondary)]">
                            {summary.promptCount} buyer questions ·{" "}
                            {consumerEngines.map((engine) => engine.label).join(" and ") ||
                                "No completed consumer surface"}{" "}
                            · {formatRunDate(startedAt)}
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {creditsUsed > 0 && (
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--viz-hairline)] bg-white px-3 text-xs text-[var(--viz-ink-secondary)]">
                                <span className="size-1.5 rounded-full bg-[var(--viz-good)]" aria-hidden />
                                <span className="tabular-nums">{creditsUsed} credits used</span>
                            </span>
                        )}
                        {isAuthenticated && (
                            <Link
                                href="/content-plan"
                                className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[var(--viz-ink)] px-3.5 text-[13px] font-medium text-white transition hover:opacity-90"
                            >
                                {actionSummary.phase === "review" ? "Review" : "View"}{" "}
                                {actionSummary.phase === "review"
                                    ? actionSummary.eligibleCount
                                    : actionSummary.selectedCount}{" "}
                                actions
                                <ArrowRight className="size-3.5" aria-hidden />
                            </Link>
                        )}
                    </div>
                </header>

                <div className="flex flex-wrap items-center gap-2 py-4">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--viz-hairline)] bg-[var(--viz-surface)] px-3 py-1.5 text-xs">
                        <span className="flex gap-[3px]" aria-hidden>
                            <span className="size-1.5 rounded-full bg-[var(--viz-series-1)]" />
                            <span className="size-1.5 rounded-full bg-[var(--viz-series-2)]" />
                        </span>
                        <span className="text-[var(--viz-ink-muted)]">Engines</span>
                        {consumerEngines.map((engine) => engine.label).join(", ") || "none"}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--viz-hairline)] bg-[var(--viz-surface)] px-3 py-1.5 text-xs">
                        <span className="text-[var(--viz-ink-muted)]">Market</span>
                        <span>{marketName}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--viz-hairline)] bg-[var(--viz-surface)] px-3 py-1.5 text-xs">
                        <span className="text-[var(--viz-ink-muted)]">Questions</span>
                        <span className="tabular-nums">All {summary.promptCount}</span>
                    </span>

                    <span className="ml-auto flex items-center text-xs text-[var(--viz-ink-muted)]">
                        <MethodPanel
                            subjectName={subjectName}
                            unclassifiedShare={breakdown?.unclassifiedShare ?? 0}
                            promptCount={summary.promptCount}
                        />
                    </span>
                </div>

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
                {/*
                  * FOUR FIGURES, ABOVE THE TABS ON PURPOSE.
                  *
                  * They sat inside the Overview panel, which meant a reader on
                  * Sources or Questions lost every headline number and had to
                  * navigate back to recover their bearings. These four are the
                  * report's constants — they describe the run, not one view of
                  * it — so they stay on screen whichever panel is open.
                  *
                  * Every one of them names its own denominator. The first pair
                  * counts ANSWERS and the third counts QUESTIONS; when all four
                  * printed bare numbers, 40 appeared in each and read as one
                  * total.
                  */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        icon={
                            <MessageSquareQuote
                                className="size-4 text-[var(--viz-series-1)]"
                                aria-hidden
                            />
                        }
                        iconTint="color-mix(in srgb, var(--viz-series-1) 10%, transparent)"
                        label="Mention rate"
                        hint={
                            <InfoHint label="What being named counts">
                                <p>
                                    Answers whose text says {subjectName}, out of the{" "}
                                    {summary.answerCount} answers we read. An answer, not a
                                    question — one question asked on two engines produces two
                                    answers and either can name you.
                                </p>
                            </InfoHint>
                        }
                        value={rateNumber(brandV.namedAnswers, brandV.answersTotal)}
                        unit="%"
                        footnote={`${brandV.namedAnswers} of ${brandV.answersTotal} answers named you`}
                        proportion={[
                            { value: brandV.namedAnswers, color: "var(--viz-series-1)" },
                            {
                                value: Math.max(brandV.answersTotal - brandV.namedAnswers, 0),
                                color: "var(--viz-track)",
                            },
                        ]}
                    />
                    <StatCard
                        icon={<Check className="size-4 text-[var(--viz-good-ink)]" aria-hidden />}
                        iconTint="color-mix(in srgb, var(--viz-good) 12%, transparent)"
                        label="Questions led"
                        hint={
                            <InfoHint label="Why first place is counted separately">
                                <p>
                                    Questions where you were the first product an answer named.
                                    Position is the whole game in a recommendation: a buyer
                                    reads the first name and stops.
                                </p>
                            </InfoHint>
                        }
                        value={String(brandV.ledQuestions)}
                        unit={` / ${brandV.questionsTotal}`}
                        footnote="named first in an answer"
                        proportion={[
                            { value: brandV.ledQuestions, color: "var(--viz-good)" },
                            {
                                value: Math.max(
                                    brandV.questionsTotal - brandV.ledQuestions,
                                    0,
                                ),
                                color: "var(--viz-track)",
                            },
                        ]}
                    />
                    <StatCard
                        icon={<Link2 className="size-4 text-[var(--viz-seq-550)]" aria-hidden />}
                        iconTint="color-mix(in srgb, var(--viz-seq-350) 12%, transparent)"
                        label="Citation rate"
                        hint={
                            <InfoHint label="What being cited counts">
                                <p>
                                    Answers that linked to a page on your site as a source.
                                    Independent of naming — an answer can link to you without
                                    saying your name, and say your name without linking, so
                                    these two figures are not slices of one total.
                                </p>
                            </InfoHint>
                        }
                        value={rateNumber(brandV.citedAnswers, brandV.answersTotal)}
                        unit="%"
                        footnote={`${brandV.citedAnswers} answers linked to your site`}
                        proportion={[
                            { value: brandV.citedAnswers, color: "var(--viz-seq-350)" },
                            {
                                value: Math.max(brandV.answersTotal - brandV.citedAnswers, 0),
                                color: "var(--viz-track)",
                            },
                        ]}
                    />
                    {/*
                      * RANK, NOT A SCORE. Position among the brands this run
                      * actually tracked — the brand plus its confirmed rivals —
                      * so "2nd of 5" is checkable against the table below it
                      * rather than being a number only this page can produce.
                      */}
                    <StatCard
                        icon={
                            <BarChart3
                                className="size-4 text-[var(--viz-warning-ink)]"
                                aria-hidden
                            />
                        }
                        iconTint="color-mix(in srgb, var(--viz-warning) 16%, transparent)"
                        label="Brand rank"
                        hint={
                            <InfoHint label="How rank is decided">
                                <p>
                                    Your place among the {rankField.length} brands this run
                                    tracked, by how many answers recommended each by name. Ties
                                    break alphabetically, and mentions our own question caused
                                    are excluded before ranking.
                                </p>
                            </InfoHint>
                        }
                        value={String(brandRank)}
                        unit={`${ordinalSuffix(brandRank)} of ${rankField.length}`}
                        footnote={
                            rankLeader && rankLeader.namedAnswers > brandV.namedAnswers
                                ? `${rankLeader.name} leads at ${rate(
                                      rankLeader.namedAnswers,
                                      brandV.answersTotal,
                                  )}`
                                : "no tracked rival was named more often"
                        }
                        proportion={[
                            {
                                value: rankLeader?.namedAnswers ?? 0,
                                color: "var(--viz-warning)",
                            },
                            { value: brandV.namedAnswers, color: "var(--viz-series-1)" },
                            {
                                value: Math.max(
                                    brandV.answersTotal -
                                        (rankLeader?.namedAnswers ?? 0) -
                                        brandV.namedAnswers,
                                    0,
                                ),
                                color: "var(--viz-track)",
                            },
                        ]}
                    />
                </div>

                <Tabs value={tab} onValueChange={setTab} className="mt-8">
                    {/*
                      * Underlines, not a pill group.
                      *
                      * The shared pill `TabsList` is the app's control for
                      * switching a small widget between modes. Here it labels
                      * four full views of a report, and at that scale a filled
                      * capsule floating above the content reads as a toolbar
                      * rather than as navigation. An underlined row sitting on
                      * a hairline is the same affordance at document scale, and
                      * it lets the panel below start at the rule instead of
                      * below a floating chip.
                      */}
                    <TabsList className="h-auto w-full justify-start gap-0.5 overflow-x-auto rounded-none border-b border-[var(--viz-hairline)] bg-transparent p-0">
                        <TabsTrigger value="overview" className={TAB_CLASS}>
                            Overview
                        </TabsTrigger>
                        {perEngine.length > 1 && (
                            <TabsTrigger value="surfaces" className={TAB_CLASS}>
                                Surfaces
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="sources" className={TAB_CLASS}>
                            Sources
                        </TabsTrigger>
                        <TabsTrigger value="questions" className={TAB_CLASS}>
                            Questions
                            <span className="rounded-full bg-[var(--viz-track)] px-1.5 py-px text-[11px] tabular-nums text-[var(--viz-ink-muted)]">
                                {prompts.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <VisibilityOverview
                            subjectName={subjectName}
                            summary={summary}
                            actionSummary={actionSummary}
                            citationBreakdown={breakdown}
                            onFocusRival={(competitorId, label) =>
                                focusOn("rival", competitorId, label)
                            }
                        />
                    </TabsContent>

                <TabsContent value="surfaces">
                    <VisibilitySurfaces rows={perEngine} />
                </TabsContent>

                <TabsContent value="sources">
                    <VisibilitySources
                        promptCount={summary.promptCount}
                        citedHosts={summary.citedHosts}
                        breakdown={breakdown}
                        citationReviewQueue={citationReviewQueue}
                        keyPages={keyPages}
                        fanOut={fanOut}
                        engineLabels={engineLabels}
                        onFocusHost={(host) =>
                            focusOn("host", host, `answers citing ${host}`)
                        }
                    />
                </TabsContent>

                <TabsContent value="questions">
                    <VisibilityQuestions
                        runId={runId}
                        subjectName={subjectName}
                        subjectDomains={subjectDomains}
                        prompts={questionPrompts}
                        engineLabels={engineLabels}
                        rivalNames={rivalNames}
                        focus={focus ? { label: focus.label } : null}
                        onClearFocus={() => setFocus(null)}
                    />
                </TabsContent>
                </Tabs>

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
