"use client"

import { useEffect, useMemo, useState } from "react"
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Info,
    Radar,
    Search,
} from "lucide-react"

import { blindSpots, type FanOutSummary } from "@/lib/visibility/fan-out"
import type { SourceRelationship, SourceReport } from "@/lib/visibility/source-report"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "./marks"
import { SectionHeading } from "./info-hint"

const PAGE_SIZE = 10

const RELATIONSHIP_META: Record<
    SourceRelationship,
    { label: string; description: string; color: string; tint: string }
> = {
    owned: {
        label: "Your domain",
        description: "Citations that point to the confirmed customer domain.",
        color: "var(--viz-series-1)",
        tint: "#eff6ff",
    },
    competitor: {
        label: "Tracked competitors",
        description: "Citations that point to a domain already in the rival set.",
        color: "var(--viz-warning)",
        tint: "#fff8e8",
    },
    external: {
        label: "External sources",
        description: "Every other cited domain, without guessing what kind of site it is.",
        color: "var(--viz-muted-mark)",
        tint: "var(--viz-plane)",
    },
}

function percentage(part: number, whole: number): string {
    if (whole <= 0) return "0%"
    return `${Math.round((part / whole) * 100)}%`
}

export function VisibilitySources({
    report,
    fanOut,
    promptCount,
    engineLabels,
    focusHost,
    onFocusHost,
    onOpenLists,
}: {
    report: SourceReport
    fanOut?: FanOutSummary
    promptCount: number
    engineLabels: Record<string, string>
    focusHost?: string | null
    onFocusHost: (host: string) => void
    onOpenLists: () => void
}) {
    const [relationshipFilter, setRelationshipFilter] = useState<SourceRelationship | "all">("all")
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [showSearchPaths, setShowSearchPaths] = useState(false)

    useEffect(() => {
        if (focusHost) {
            setSearch(focusHost)
            setRelationshipFilter("all")
            setPage(1)
        }
    }, [focusHost])

    const filteredHosts = useMemo(() => {
        const query = search.trim().toLowerCase()
        return report.hosts.filter(
            (host) =>
                (relationshipFilter === "all" || host.relationship === relationshipFilter) &&
                (!query || host.host.toLowerCase().includes(query)),
        )
    }, [relationshipFilter, report.hosts, search])

    const pageCount = Math.max(1, Math.ceil(filteredHosts.length / PAGE_SIZE))
    const visibleHosts = filteredHosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const searchBlindSpots = fanOut ? blindSpots(fanOut) : []

    if (report.totalCitations === 0) {
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
        <div className="mt-5 space-y-5">
            <section>
                <SectionHeading
                    title="Sources behind the measured answers"
                    sub="Every cited domain, connected to the questions and engines where it appeared."
                    hintLabel="What this evidence can and cannot prove"
                    hint={
                        <p>
                            A citation proves that an answer used a page as a source. It does not
                            prove what the page says about your brand unless that page is fetched
                            and checked separately.
                        </p>
                    }
                >
                    {report.explicitlyShapedPages.length > 0 && (
                        <button
                            type="button"
                            onClick={onOpenLists}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--viz-series-1)] hover:underline"
                        >
                            {report.explicitlyShapedPages.length} named lists or reviews
                            <ArrowRight className="size-3" aria-hidden />
                        </button>
                    )}
                </SectionHeading>

                <div className="viz-card mt-5 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryFact
                        value={report.totalCitations}
                        label="citation instances"
                        detail="Every stored source occurrence"
                    />
                    <SummaryFact
                        value={report.distinctSites}
                        label="distinct sites"
                        detail="Domains used across the run"
                    />
                    <SummaryFact
                        value={report.relationshipCounts.owned}
                        label="citations to your domain"
                        detail="A factual ownership match"
                    />
                    <SummaryFact
                        value={report.relationshipCounts.external}
                        label="external citations"
                        detail="Shown without guessing the site type"
                    />
                </div>
            </section>

            <section className="viz-card p-5 sm:p-[22px]">
                <SectionHeading
                    size="card"
                    title="Where the citations point"
                    sub="Three relationships we can state from confirmed domains—no action or quality assumptions."
                />
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {(["owned", "competitor", "external"] as const).map((relationship) => {
                        const meta = RELATIONSHIP_META[relationship]
                        const count = report.relationshipCounts[relationship]
                        return (
                            <button
                                key={relationship}
                                type="button"
                                onClick={() => {
                                    setRelationshipFilter(relationship)
                                    setSearch("")
                                    setPage(1)
                                }}
                                className={`min-w-0 rounded-xl border p-4 text-left transition-colors hover:border-[var(--viz-baseline)] ${
                                    relationshipFilter === relationship
                                        ? "border-[var(--viz-ink)]"
                                        : "border-[var(--viz-hairline)]"
                                }`}
                                style={{ background: meta.tint }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                                        <span
                                            className="size-2 rounded-full"
                                            style={{ background: meta.color }}
                                            aria-hidden
                                        />
                                        {meta.label}
                                    </span>
                                    <span className="text-sm font-semibold tabular-nums">
                                        {count}
                                        <span className="ml-1 text-[11px] font-normal text-[var(--viz-ink-muted)]">
                                            {percentage(count, report.totalCitations)}
                                        </span>
                                    </span>
                                </div>
                                <p className="mt-3 min-h-10 text-xs leading-5 text-[var(--viz-ink-secondary)]">
                                    {meta.description}
                                </p>
                            </button>
                        )
                    })}
                </div>
            </section>

            <section className="viz-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-[var(--viz-hairline)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div>
                        <h2 className="text-sm font-semibold">Cited-site directory</h2>
                        <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">
                            {filteredHosts.length} {filteredHosts.length === 1 ? "site" : "sites"}
                            {relationshipFilter !== "all" ? ` in ${RELATIONSHIP_META[relationshipFilter].label}` : ""}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--viz-ink-muted)]"
                                aria-hidden
                            />
                            <input
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value)
                                    setPage(1)
                                }}
                                placeholder="Find a domain"
                                aria-label="Find a cited domain"
                                className="h-9 w-full rounded-lg border border-[var(--viz-hairline)] bg-white pl-9 pr-3 text-xs outline-none placeholder:text-[var(--viz-ink-muted)] focus:border-[var(--viz-baseline)] sm:w-48"
                            />
                        </div>
                        <div className="flex gap-1 overflow-x-auto" aria-label="Filter source relationship">
                            {(["all", "owned", "competitor", "external"] as const).map(
                                (relationship) => (
                                    <button
                                        key={relationship}
                                        type="button"
                                        onClick={() => {
                                            setRelationshipFilter(relationship)
                                            setPage(1)
                                        }}
                                        className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-medium ${
                                            relationshipFilter === relationship
                                                ? "bg-[var(--viz-ink)] text-white"
                                                : "bg-[var(--viz-track)] text-[var(--viz-ink-secondary)] hover:text-[var(--viz-ink)]"
                                        }`}
                                    >
                                        {relationship === "all" ? "All" : RELATIONSHIP_META[relationship].label}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-[13px]">
                        <thead className="bg-[var(--viz-plane)] text-[11px] text-[var(--viz-ink-muted)]">
                            <tr>
                                <th className="px-5 py-2.5 text-left font-medium">Site</th>
                                <th className="px-4 py-2.5 text-left font-medium">Relationship</th>
                                <th className="px-4 py-2.5 text-right font-medium">Citations</th>
                                <th className="px-4 py-2.5 text-right font-medium">Losing questions</th>
                                <th className="px-4 py-2.5 text-right font-medium">Questions</th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                    Brand named
                                </th>
                                <th className="px-5 py-2.5 text-right font-medium">Evidence</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleHosts.map((host) => (
                                <tr
                                    key={host.host}
                                    className="border-t border-[var(--viz-hairline)] hover:bg-[var(--viz-plane)]"
                                >
                                    <td className="px-5 py-3">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <Badge
                                                 label={host.host}
                                                 own={host.relationship === "owned"}
                                            />
                                            <div className="min-w-0">
                                                <div className="truncate font-medium">
                                                    {host.host}
                                                    {host.relationship === "owned" ? " (yours)" : ""}
                                                </div>
                                                <div className="mt-0.5 truncate text-[10px] text-[var(--viz-ink-muted)]">
                                                    {host.engines.map((engine) => engineLabels[engine] ?? engine).join(" · ")}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full border border-[var(--viz-hairline)] px-2 py-1 text-[10px] font-medium">
                                            {RELATIONSHIP_META[host.relationship].label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                        {host.citationCount}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--viz-critical)]">
                                        {host.losingQuestionIds.length}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-[var(--viz-ink-secondary)]">
                                        {host.questionIds.length}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-[var(--viz-ink-secondary)]">
                                        {host.namingAnswerCount} / {host.answerCount}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => onFocusHost(host.host)}
                                            className="text-xs font-medium text-[var(--viz-series-1)] hover:underline"
                                        >
                                            View questions
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {visibleHosts.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-10 text-center text-sm text-[var(--viz-ink-muted)]"
                                    >
                                        No cited sites match this view.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {pageCount > 1 && (
                    <div className="flex items-center justify-between border-t border-[var(--viz-hairline)] px-5 py-3">
                        <span className="text-[11px] tabular-nums text-[var(--viz-ink-muted)]">
                            Page {page} of {pageCount}
                        </span>
                        <div className="flex gap-1">
                            <PageButton
                                label="Previous source page"
                                disabled={page === 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                <ChevronLeft className="size-3.5" />
                            </PageButton>
                            <PageButton
                                label="Next source page"
                                disabled={page === pageCount}
                                onClick={() =>
                                    setPage((current) => Math.min(pageCount, current + 1))
                                }
                            >
                                <ChevronRight className="size-3.5" />
                            </PageButton>
                        </div>
                    </div>
                )}
            </section>

            {fanOut && fanOut.queries.length > 0 && (
                <section className="viz-card grid gap-5 p-5 sm:p-[22px] lg:grid-cols-[minmax(0,1fr)_minmax(260px,.55fr)] lg:items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[var(--viz-series-1)]">
                                <Radar className="size-4" aria-hidden />
                            </span>
                            <div>
                                <h2 className="text-sm font-semibold">Engine search paths</h2>
                                <p className="mt-0.5 text-xs text-[var(--viz-ink-muted)]">
                                    Retrieval behaviour, kept out of the cited-site directory.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 grid grid-cols-3 gap-3">
                            <MiniFact value={fanOut.queries.length} label="searches" />
                            <MiniFact value={fanOut.totalObservations} label="observations" />
                            <MiniFact value={searchBlindSpots.length} label="blind spots" />
                        </div>
                    </div>
                    <div className="rounded-xl bg-[var(--viz-plane)] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--viz-ink-muted)]">
                            Repeated searches you never surfaced in
                        </p>
                        <div className="mt-3 space-y-2">
                            {searchBlindSpots.slice(0, 3).map((query) => (
                                <div
                                    key={query.queryNorm}
                                    className="flex items-start justify-between gap-3 text-xs"
                                >
                                    <span className="min-w-0 truncate">{query.query}</span>
                                    <span className="shrink-0 tabular-nums text-[var(--viz-ink-muted)]">
                                        {query.prompts}/{promptCount}
                                    </span>
                                </div>
                            ))}
                            {searchBlindSpots.length === 0 && (
                                <p className="text-xs text-[var(--viz-ink-muted)]">
                                    No repeated retrieval-step absence was observed.
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSearchPaths(true)}
                            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--viz-series-1)] hover:underline"
                        >
                            Inspect all search paths
                            <ArrowRight className="size-3" aria-hidden />
                        </button>
                    </div>
                </section>
            )}

            <SearchPathsSheet
                open={showSearchPaths}
                onOpenChange={setShowSearchPaths}
                fanOut={fanOut}
                engineLabels={engineLabels}
            />
        </div>
    )
}

function SummaryFact({ value, label, detail }: { value: number | string; label: string; detail: string }) {
    return (
        <div className="border-t border-[var(--viz-hairline)] p-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <div className="text-[24px] font-semibold leading-none tabular-nums">{value}</div>
            <div className="mt-2 text-xs font-medium">{label}</div>
            <div className="mt-1 text-[11px] text-[var(--viz-ink-muted)]">{detail}</div>
        </div>
    )
}

function MiniFact({ value, label }: { value: number; label: string }) {
    return (
        <div>
            <div className="text-xl font-semibold leading-none tabular-nums">{value}</div>
            <div className="mt-1.5 text-[11px] text-[var(--viz-ink-muted)]">{label}</div>
        </div>
    )
}

function PageButton({
    children,
    label,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
    return (
        <button
            type="button"
            aria-label={label}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--viz-hairline)] disabled:opacity-35"
            {...props}
        >
            {children}
        </button>
    )
}

function SearchPathsSheet({
    open,
    onOpenChange,
    fanOut,
    engineLabels,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    fanOut?: FanOutSummary
    engineLabels: Record<string, string>
}) {
    if (!fanOut) return null
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
                <SheetHeader className="border-b border-[var(--viz-hairline)] px-6 py-5">
                    <SheetTitle>Engine search paths</SheetTitle>
                    <SheetDescription>
                        Literal sub-queries exposed while the engines assembled these answers.
                    </SheetDescription>
                </SheetHeader>
                <div className="space-y-5 p-6">
                    {fanOut.hasSilentEngine && (
                        <div className="flex gap-2 rounded-xl border border-[var(--viz-hairline)] bg-[var(--viz-plane)] p-4 text-xs leading-5 text-[var(--viz-ink-secondary)]">
                            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>
                                {fanOut.coverage
                                    .filter((row) => row.answers > 0 && row.answersWithFanOut === 0)
                                    .map((row) => engineLabels[row.engine] ?? row.engine)
                                    .join(" and ")} did not expose searches. That is not evidence
                                that the surface searched less.
                            </span>
                        </div>
                    )}
                    <div className="overflow-hidden rounded-xl border border-[var(--viz-hairline)]">
                        <table className="w-full text-xs">
                            <thead className="bg-[var(--viz-plane)] text-[10px] text-[var(--viz-ink-muted)]">
                                <tr>
                                    <th className="px-4 py-2.5 text-left font-medium">Search</th>
                                    <th className="px-4 py-2.5 text-right font-medium">Questions</th>
                                    <th className="px-4 py-2.5 text-right font-medium">Brand named</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fanOut.queries.map((query) => (
                                    <tr key={query.queryNorm} className="border-t border-[var(--viz-hairline)]">
                                        <td className="px-4 py-3">{query.query}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-[var(--viz-ink-secondary)]">
                                            {query.prompts}
                                        </td>
                                        <td className={`px-4 py-3 text-right tabular-nums ${query.answersNaming === 0 ? "text-[var(--viz-critical)]" : "text-[var(--viz-ink-secondary)]"}`}>
                                            {query.answersNaming} / {query.occurrences}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs leading-5 text-[var(--viz-ink-muted)]">
                        This is what the engines did, not how many people searched. It is not a
                        search-volume figure and cannot be read as one.
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    )
}
