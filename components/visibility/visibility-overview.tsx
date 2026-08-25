import type { SourceReport } from "@/lib/visibility/source-report"
import type { VisibilitySummaryV2 } from "@/lib/visibility/visibility-summary"
import { ArrowRight } from "lucide-react"
import type { DashboardActionKind, DashboardActionSummary } from "./dashboard-model"
import { SectionHeading } from "./info-hint"
import { Badge, Bar, CapacityStrip, LegendRow, StackedPill } from "./marks"

interface VisibilityOverviewProps {
    subjectName: string
    summary: VisibilitySummaryV2
    actionSummary: DashboardActionSummary
    onFocusRival?: (competitorId: string, label: string) => void
    onOpenSource?: (host?: string) => void
    sourceReport: SourceReport
}

function percent(part: number, whole: number): string {
    if (whole === 0) return "0.0%"
    return `${((part / whole) * 100).toFixed(1)}%`
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <section className={`viz-card min-w-0 p-5 sm:p-[22px] ${className}`}>
            {children}
        </section>
    )
}

function Meta({ children }: { children: React.ReactNode }) {
    return (
        <span className="shrink-0 text-xs tabular-nums text-[var(--viz-ink-muted)]">
            {children}
        </span>
    )
}

function actionLabel(kind: DashboardActionKind): string {
    if (kind === "report_only") return "Report"
    return kind === "refresh" ? "Refresh" : "Create"
}

function actionChip(kind: DashboardActionKind): string {
    if (kind === "create") return "bg-emerald-50 text-emerald-800"
    if (kind === "refresh") return "bg-blue-50 text-blue-800"
    return "bg-stone-100 text-stone-600"
}

function actionPhase(summary: DashboardActionSummary): {
    value: number
    label: string
    backlogLabel: string | null
} {
    if (summary.phase === "review") {
        return { value: summary.eligibleCount, label: "ready to review", backlogLabel: null }
    }
    if (summary.phase === "ready") {
        return {
            value: summary.selectedCount,
            label: "ready for release",
            backlogLabel: `${summary.backlogCount} in backlog`,
        }
    }
    if (summary.phase === "delivered") {
        return {
            value: summary.selectedCount,
            label: "delivered",
            backlogLabel: `${summary.backlogCount} in backlog`,
        }
    }
    if (summary.phase === "producing") {
        return {
            value: summary.selectedCount,
            label: "producing now",
            backlogLabel: `${summary.backlogCount} in backlog`,
        }
    }
    return {
        value: 0,
        label: summary.phase === "failed" ? "planning needs attention" : "not planned yet",
        backlogLabel: null,
    }
}

export function VisibilityOverview({
    subjectName,
    summary,
    actionSummary,
    onFocusRival,
    onOpenSource,
    sourceReport,
}: VisibilityOverviewProps) {
    const brand = summary.brandVisibility
    const competitors = summary.competitorVisibility
    const citedById = new Map(competitors.citedRows.map((row) => [row.id, row]))

    const rivalRows = competitors.namedRows
        .map((row) => ({
            ...row,
            citationOccurrences: citedById.get(row.id)?.citationOccurrences ?? 0,
        }))
        .sort(
            (a, b) =>
                b.namedAnswers - a.namedAnswers ||
                b.citationOccurrences - a.citationOccurrences ||
                a.name.localeCompare(b.name),
        )

    const leaderboard = [
        {
            id: "__brand__",
            name: subjectName,
            namedAnswers: brand.namedAnswers,
            own: true,
        },
        ...rivalRows.map((row) => ({
            id: row.id,
            name: row.name,
            namedAnswers: row.namedAnswers,
            own: false,
        })),
    ].sort((a, b) => b.namedAnswers - a.namedAnswers || a.name.localeCompare(b.name))

    const leaderMax = Math.max(1, ...leaderboard.map((row) => row.namedAnswers))
    // One shared, content-aware identity column keeps every track on the same
    // baseline without clipping ordinary domains. The bar remains the flexible
    // column, so its fill math stays `value / leaderMax` regardless of how much
    // room the longest label needs.
    const rivalLabelWidth = `${Math.min(
        28,
        Math.max(12, ...leaderboard.map((row) => [...row.name].length + 2)),
    )}ch`
    const excludedMentions =
        competitors.promptInducedNamedAnswersExcluded +
        competitors.promptInducedCitedAnswersExcluded

    const cycle = actionPhase(actionSummary)
    const capacityTotal = Math.max(
        actionSummary.eligibleCount,
        actionSummary.selectedCount + actionSummary.backlogCount,
    )
    const losingHosts = sourceReport.hosts.filter((host) => host.losingQuestionIds.length > 0)
    const losingHostMax = Math.max(
        1,
        ...losingHosts.slice(0, 6).map((host) => host.losingQuestionIds.length),
    )

    return (
        <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
            <Panel>
                <SectionHeading
                    size="card"
                    title="Where you stand"
                    sub={`All ${brand.questionsTotal} questions, by how the answers treated you.`}
                    hintLabel="How the question verdicts are counted"
                    hint={
                        <p>
                            Each question gets one verdict after every stored answer is checked.
                            Named first, named but never first, and not named are mutually exclusive,
                            so the bar is a complete partition of the measured set.
                        </p>
                    }
                >
                    <Meta>{brand.questionsTotal} questions</Meta>
                </SectionHeading>

                {brand.questionsTotal > 0 ? (
                    <>
                        <div className="mt-[22px]">
                            <StackedPill
                                segments={[
                                    {
                                        value: brand.ledQuestions,
                                        color: "var(--viz-good)",
                                        labelInk: "#ffffff",
                                        label: `${brand.ledQuestions} named first`,
                                    },
                                    {
                                        value: brand.namedNeverFirstQuestions,
                                        color: "var(--viz-warning)",
                                        labelInk: "#3d2900",
                                        label: `${brand.namedNeverFirstQuestions} not first`,
                                    },
                                    {
                                        value: brand.notNamedQuestions,
                                        color: "var(--viz-critical)",
                                        labelInk: "#ffffff",
                                        label: `${brand.notNamedQuestions} not named`,
                                    },
                                ]}
                            />
                        </div>
                        <div className="mt-5 flex flex-col gap-[11px]">
                            <LegendRow
                                color="var(--viz-good)"
                                label="Named first"
                                value={String(brand.ledQuestions)}
                                share={percent(brand.ledQuestions, brand.questionsTotal)}
                            />
                            <LegendRow
                                color="var(--viz-warning)"
                                label="Named, never first"
                                value={String(brand.namedNeverFirstQuestions)}
                                share={percent(
                                    brand.namedNeverFirstQuestions,
                                    brand.questionsTotal,
                                )}
                            />
                            <LegendRow
                                color="var(--viz-critical)"
                                label="Not named in any answer"
                                value={String(brand.notNamedQuestions)}
                                share={percent(brand.notNamedQuestions, brand.questionsTotal)}
                                emphasis
                            />
                        </div>
                    </>
                ) : (
                    <p className="mt-8 text-sm text-[var(--viz-ink-muted)]">
                        No questions were measured in this run.
                    </p>
                )}
            </Panel>

            <Panel>
                <SectionHeading
                    size="card"
                    title="Who was named instead"
                    sub="Tracked rivals. Mentions our own question caused are excluded."
                    hintLabel="How rival recommendations are counted"
                    hint={
                        <p>
                            Bars share one fixed scale: the most-named brand fills the track and
                            every other bar is sized against it. An empty track means the brand was
                            never named, not that a measured rate rounded down to zero.
                        </p>
                    }
                >
                    <Meta>{competitors.trackedCount} tracked</Meta>
                </SectionHeading>

                <div className="mt-5 flex flex-col gap-2.5">
                    {leaderboard.map((row) => (
                        <div key={row.id} className="flex min-w-0 items-center gap-2.5">
                            <Badge label={row.name} own={row.own} />
                            {onFocusRival && !row.own ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onFocusRival(row.id, `answers involving ${row.name}`)
                                    }
                                    className="shrink-0 whitespace-nowrap text-left text-[13px] text-[var(--viz-ink-secondary)] underline decoration-dotted underline-offset-4 transition hover:text-[var(--viz-series-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-series-1)]"
                                    style={{ width: rivalLabelWidth }}
                                >
                                    {row.name}
                                </button>
                            ) : (
                                <span
                                    className={`shrink-0 whitespace-nowrap text-[13px] ${
                                        row.own
                                            ? "font-semibold text-[var(--viz-ink)]"
                                            : "text-[var(--viz-ink-secondary)]"
                                    }`}
                                    style={{ width: rivalLabelWidth }}
                                >
                                    {row.name}
                                </span>
                            )}
                            <span className="min-w-0 flex-1">
                                <Bar
                                    value={row.namedAnswers}
                                    max={leaderMax}
                                    label={percent(row.namedAnswers, brand.answersTotal)}
                                    color={
                                        row.own ? "var(--viz-series-1)" : "var(--viz-warning)"
                                    }
                                    labelInk={row.own ? "#ffffff" : "#3d2900"}
                                    emptyReason="never named"
                                />
                            </span>
                        </div>
                    ))}
                </div>

                {excludedMentions > 0 && (
                    <p className="mt-4 border-t border-[var(--viz-hairline)] pt-3 text-[11px] text-[var(--viz-ink-muted)]">
                        {excludedMentions} prompt-induced {excludedMentions === 1 ? "mention" : "mentions"} excluded from this table.
                    </p>
                )}
            </Panel>

            <Panel className="lg:col-span-2">
                <SectionHeading
                    size="card"
                    title="This cycle's actions"
                    sub={`Site-aware create and refresh groups. Up to ${actionSummary.allowance} selected.`}
                    hintLabel="Why a losing question is not automatically an article"
                    hint={
                        <>
                            <p>
                                A losing question is evidence about an AI answer, not proof that
                                your site needs another article. Existing-page coverage and grouped
                                target review decide whether the remedy is a refresh, a new page, or
                                a confirmed publishing action.
                            </p>
                            <p className="mt-2">
                                Only confirmed grouped create/refresh actions consume production
                                capacity. Suggestions waiting for review are not described as
                                producing.
                            </p>
                        </>
                    }
                >
                    <Meta>{actionSummary.eligibleCount} found</Meta>
                </SectionHeading>

                <div className="mt-[18px] flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-[32px] font-semibold leading-none tabular-nums tracking-[-0.02em]">
                        {cycle.value}
                    </span>
                    <span className="text-[13px] text-[var(--viz-ink-secondary)]">
                        {cycle.label}
                    </span>
                    {cycle.backlogLabel && (
                        <span className="ml-auto text-[13px] tabular-nums text-[var(--viz-ink-muted)]">
                            {cycle.backlogLabel}
                        </span>
                    )}
                </div>

                {capacityTotal > 0 && capacityTotal <= 60 && (
                    <div className="mt-4">
                        <CapacityStrip
                            filled={actionSummary.selectedCount}
                            total={capacityTotal}
                            filledColor="#7c3aed"
                            restColor="#ede9fe"
                        />
                    </div>
                )}

                <div className="mt-[18px] flex flex-col gap-2 border-t border-[var(--viz-hairline)] pt-[15px]">
                    {actionSummary.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex min-w-0 items-center gap-2 text-[13px]">
                            <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${actionChip(item.kind)}`}
                            >
                                {actionLabel(item.kind)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[var(--viz-ink-secondary)]">
                                {item.targetUrl || item.title}
                            </span>
                            <span className="shrink-0 tabular-nums text-[var(--viz-ink-muted)]">
                                {item.questionCount} {item.questionCount === 1 ? "question" : "questions"}
                            </span>
                        </div>
                    ))}
                    {actionSummary.items.length === 0 && (
                        <p className="text-xs text-[var(--viz-ink-muted)]">
                            No grouped action record exists for this measurement yet.
                        </p>
                    )}
                </div>
            </Panel>

            <Panel className="lg:col-span-2">
                <SectionHeading
                    size="card"
                    title="Sources recurring in lost answers"
                    sub="Domains cited across questions where you were absent or another brand ranked ahead."
                    hintLabel="What this ranking means"
                    hint={
                        <p>
                            Sites are ranked by the number of losing questions they appeared in,
                            not by raw citation volume. This keeps the view tied to a customer
                            problem: which sources repeatedly appear when your visibility is weak.
                        </p>
                    }
                >
                    <button
                        type="button"
                        onClick={() => onOpenSource?.()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--viz-series-1)] hover:underline"
                    >
                        Explore all sources
                        <ArrowRight className="size-3" aria-hidden />
                    </button>
                </SectionHeading>

                {losingHosts.length > 0 ? (
                    <div className="mt-5 grid gap-y-3">
                        {losingHosts.slice(0, 6).map((host) => (
                            <button
                                key={host.host}
                                type="button"
                                onClick={() => onOpenSource?.(host.host)}
                                className="grid min-w-0 w-full grid-cols-[22px_minmax(0,1fr)_minmax(7rem,11rem)_auto] items-center gap-3 text-left"
                            >
                                <Badge label={host.host} own={host.relationship === "owned"} />
                                <span className="min-w-0 truncate text-[13px] font-medium text-[var(--viz-ink-secondary)] hover:text-[var(--viz-ink)]">
                                    {host.relationship === "owned"
                                        ? `${host.host} (yours)`
                                        : host.host}
                                </span>
                                <Bar
                                    value={host.losingQuestionIds.length}
                                    max={losingHostMax}
                                    color={
                                        host.relationship === "owned"
                                            ? "var(--viz-series-1)"
                                            : "var(--viz-seq-350)"
                                    }
                                    label={`${host.losingQuestionIds.length}`}
                                    emptyReason="no losing questions"
                                />
                                <span className="shrink-0 whitespace-nowrap text-right text-xs font-semibold tabular-nums">
                                    {host.citationCount} cites
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="mt-8 text-sm text-[var(--viz-ink-muted)]">
                        No cited domains were connected to a losing question in this run.
                    </p>
                )}
            </Panel>
        </div>
    )
}
