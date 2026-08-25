"use client"

import { useMemo, useState } from "react"
import {
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ListFilter,
    Search,
} from "lucide-react"

import type {
    DeclaredPageKind,
    SourceReport,
    SourceReportPage,
} from "@/lib/visibility/source-report"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "./marks"
import { SectionHeading } from "./info-hint"

const PAGE_SIZE = 12

type OwnershipFilter = "all" | "owned" | "external" | "competitor"

const DECLARED_KIND_LABELS: Record<DeclaredPageKind, string> = {
    "best-of": "Best-of title",
    comparison: "Comparison title",
    review: "Review title",
}

function relationshipLabel(page: SourceReportPage): string {
    if (page.relationship === "owned") return "Your domain"
    if (page.relationship === "competitor") return "Tracked competitor"
    return "External"
}

function ownershipMatches(page: SourceReportPage, filter: OwnershipFilter): boolean {
    if (filter === "all") return true
    return page.relationship === filter
}

export function VisibilityLists({
    report,
    engineLabels,
    onFocusQuestions,
}: {
    report: SourceReport
    engineLabels: Record<string, string>
    onFocusQuestions: (questionIds: string[], label: string) => void
}) {
    const [shape, setShape] = useState<DeclaredPageKind | "all">("all")
    const [ownership, setOwnership] = useState<OwnershipFilter>("all")
    const [onlyNoCooccurrence, setOnlyNoCooccurrence] = useState(false)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [selected, setSelected] = useState<SourceReportPage | null>(null)

    const filteredPages = useMemo(() => {
        const query = search.trim().toLowerCase()
        return report.explicitlyShapedPages.filter(
            (item) =>
                (shape === "all" || item.declaredKind === shape) &&
                ownershipMatches(item, ownership) &&
                (!onlyNoCooccurrence || item.namingAnswerCount === 0) &&
                (!query ||
                    item.host.toLowerCase().includes(query) ||
                    item.title.toLowerCase().includes(query)),
        )
    }, [onlyNoCooccurrence, ownership, report.explicitlyShapedPages, search, shape])

    const pageCount = Math.max(1, Math.ceil(filteredPages.length / PAGE_SIZE))
    const visiblePages = filteredPages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const distinctSites = new Set(report.explicitlyShapedPages.map((item) => item.host)).size
    const citationInstances = report.explicitlyShapedPages.reduce(
        (sum, item) => sum + item.citationCount,
        0,
    )
    const losingQuestions = new Set(
        report.explicitlyShapedPages.flatMap((item) => item.losingQuestionIds),
    ).size
    const maxCitations = Math.max(
        1,
        ...report.explicitlyShapedPages.map((item) => item.citationCount),
    )

    return (
        <div className="mt-5 space-y-5">
            <section>
                <SectionHeading
                    title="The lists the engines read"
                    sub="Pages whose stored citation titles explicitly say best-of, comparison or review."
                    hintLabel="Why this list is deliberately narrow"
                    hint={
                        <p>
                            The system uses only words already present in the stored title. It does
                            not fetch the page or guess its type from the domain. Pages without
                            explicit title wording remain visible in Sources, not hidden or rejected.
                        </p>
                    }
                >
                    <span className="text-xs tabular-nums text-[var(--viz-ink-muted)]">
                        {report.explicitlyShapedPages.length} pages
                    </span>
                </SectionHeading>

                <div className="viz-card mt-5 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
                    <ListFact
                        value={report.explicitlyShapedPages.length}
                        label="explicit titles"
                        detail="Best-of, comparison or review"
                    />
                    <ListFact
                        value={distinctSites}
                        label="distinct sites"
                        detail="Domains carrying those pages"
                    />
                    <ListFact
                        value={citationInstances}
                        label="citations"
                        detail="Source occurrences across answers"
                    />
                    <ListFact
                        value={losingQuestions}
                        label="losing questions"
                        detail="Weak-visibility questions citing these pages"
                    />
                </div>
            </section>

            <section className="viz-card overflow-hidden">
                <div className="border-b border-[var(--viz-hairline)] p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[var(--viz-series-1)]">
                                <ListFilter className="size-4" aria-hidden />
                            </span>
                            <div>
                                <h2 className="text-sm font-semibold">Explicit-title page directory</h2>
                                <p className="mt-0.5 text-xs text-[var(--viz-ink-muted)]">
                                    {filteredPages.length} pages in this view
                                </p>
                            </div>
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
                                    placeholder="Find a page or site"
                                    aria-label="Find a titled page or site"
                                    className="h-9 w-full rounded-lg border border-[var(--viz-hairline)] bg-white pl-9 pr-3 text-xs outline-none placeholder:text-[var(--viz-ink-muted)] focus:border-[var(--viz-baseline)] sm:w-56"
                                />
                            </div>
                            <button
                                type="button"
                                aria-pressed={onlyNoCooccurrence}
                                onClick={() => {
                                    setOnlyNoCooccurrence((current) => !current)
                                    setPage(1)
                                }}
                                className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[11px] font-medium ${
                                    onlyNoCooccurrence
                                        ? "border-red-200 bg-red-50 text-red-800"
                                        : "border-[var(--viz-hairline)] text-[var(--viz-ink-secondary)]"
                                }`}
                            >
                                {onlyNoCooccurrence && <CheckCircle2 className="size-3.5" />}
                                No brand co-occurrence
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-[var(--viz-hairline)] pt-4 lg:flex-row lg:items-center lg:justify-between">
                        <FilterGroup
                            label="Page"
                            values={[
                                ["all", "All"],
                                ["best-of", "Best-of"],
                                ["comparison", "Comparisons"],
                                ["review", "Reviews"],
                            ]}
                            active={shape}
                            onChange={(value) => {
                                setShape(value as DeclaredPageKind | "all")
                                setPage(1)
                            }}
                        />
                        <FilterGroup
                            label="Owner"
                            values={[
                                ["all", "All"],
                                ["external", "External"],
                                ["competitor", "Competitor"],
                                ["owned", "Yours"],
                            ]}
                            active={ownership}
                            onChange={(value) => {
                                setOwnership(value as OwnershipFilter)
                                setPage(1)
                            }}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-[13px]">
                        <thead className="bg-[var(--viz-plane)] text-[11px] text-[var(--viz-ink-muted)]">
                            <tr>
                                <th className="w-10 px-4 py-2.5 text-right font-medium">#</th>
                                <th className="px-3 py-2.5 text-left font-medium">Page</th>
                                <th className="px-4 py-2.5 text-left font-medium">Kind</th>
                                <th className="w-44 px-4 py-2.5 text-left font-medium">Used by answers</th>
                                <th className="px-4 py-2.5 text-right font-medium">Brand named</th>
                                <th className="px-4 py-2.5 text-left font-medium">Relationship</th>
                                <th className="px-5 py-2.5 text-right font-medium">Next</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visiblePages.map((item, index) => (
                                <tr
                                    key={item.url}
                                    className="border-t border-[var(--viz-hairline)] hover:bg-[var(--viz-plane)]"
                                >
                                    <td className="px-4 py-3 text-right text-[11px] tabular-nums text-[var(--viz-ink-muted)]">
                                        {(page - 1) * PAGE_SIZE + index + 1}
                                    </td>
                                    <td className="max-w-[360px] px-3 py-3">
                                        <button
                                            type="button"
                                            onClick={() => setSelected(item)}
                                            className="flex w-full min-w-0 items-start gap-2.5 text-left"
                                        >
                                            <Badge
                                                 label={item.host}
                                                 own={item.relationship === "owned"}
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium hover:text-[var(--viz-series-1)]">
                                                    {item.title || item.url}
                                                </span>
                                                <span className="mt-0.5 block truncate text-[10px] text-[var(--viz-ink-muted)]">
                                                    {item.host}
                                                </span>
                                            </span>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full border border-[var(--viz-hairline)] px-2 py-1 text-[10px]">
                                            {item.declaredKind ? DECLARED_KIND_LABELS[item.declaredKind] : ""}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="viz-track-pill h-1.5 flex-1">
                                                <span
                                                    className="block h-1.5 rounded-full bg-[var(--viz-seq-350)]"
                                                    style={{
                                                        width: `${Math.max(
                                                            (item.citationCount / maxCitations) * 100,
                                                            3,
                                                        )}%`,
                                                    }}
                                                />
                                            </span>
                                            <span className="w-6 text-right font-semibold tabular-nums">
                                                {item.citationCount}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-[10px] text-[var(--viz-ink-muted)]">
                                            {item.questionIds.length} questions · {item.engines.length} engines
                                        </div>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${item.namingAnswerCount === 0 ? "text-[var(--viz-critical)]" : "text-[var(--viz-ink-secondary)]"}`}>
                                        {item.namingAnswerCount} / {item.answerCount}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-[var(--viz-ink-secondary)]">
                                        {relationshipLabel(item)}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => setSelected(item)}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--viz-series-1)] hover:underline"
                                        >
                                            Inspect
                                            <ArrowRight className="size-3" aria-hidden />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {visiblePages.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-12 text-center text-sm text-[var(--viz-ink-muted)]"
                                    >
                                        No list pages match this view.
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
                            <PagerButton
                                label="Previous list page"
                                disabled={page === 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                <ChevronLeft className="size-3.5" />
                            </PagerButton>
                            <PagerButton
                                label="Next list page"
                                disabled={page === pageCount}
                                onClick={() =>
                                    setPage((current) => Math.min(pageCount, current + 1))
                                }
                            >
                                <ChevronRight className="size-3.5" />
                            </PagerButton>
                        </div>
                    </div>
                )}
            </section>

            <PageSheet
                page={selected}
                engineLabels={engineLabels}
                onOpenChange={(open) => !open && setSelected(null)}
                onFocusQuestions={onFocusQuestions}
            />
        </div>
    )
}

function ListFact({ value, label, detail }: { value: number; label: string; detail: string }) {
    return (
        <div className="border-t border-[var(--viz-hairline)] p-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <div className="text-[24px] font-semibold leading-none tabular-nums">{value}</div>
            <div className="mt-2 text-xs font-medium">{label}</div>
            <div className="mt-1 text-[11px] text-[var(--viz-ink-muted)]">{detail}</div>
        </div>
    )
}

function FilterGroup({
    label,
    values,
    active,
    onChange,
}: {
    label: string
    values: Array<[string, string]>
    active: string
    onChange: (value: string) => void
}) {
    return (
        <div className="flex items-center gap-1 overflow-x-auto">
            <span className="mr-1 shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--viz-ink-muted)]">
                {label}
            </span>
            {values.map(([value, text]) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => onChange(value)}
                    className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-medium ${
                        active === value
                            ? "bg-[var(--viz-ink)] text-white"
                            : "bg-[var(--viz-track)] text-[var(--viz-ink-secondary)]"
                    }`}
                >
                    {text}
                </button>
            ))}
        </div>
    )
}

function PagerButton({
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

function PageSheet({
    page,
    engineLabels,
    onOpenChange,
    onFocusQuestions,
}: {
    page: SourceReportPage | null
    engineLabels: Record<string, string>
    onOpenChange: (open: boolean) => void
    onFocusQuestions: (questionIds: string[], label: string) => void
}) {
    return (
        <Sheet open={Boolean(page)} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
                {page && (
                    <>
                        <SheetHeader className="border-b border-[var(--viz-hairline)] px-6 py-5 pr-12">
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-[var(--viz-ink-muted)]">
                                <span>{page.declaredKind ? DECLARED_KIND_LABELS[page.declaredKind] : "Explicit title"}</span>
                                <span aria-hidden>·</span>
                                <span>{page.host}</span>
                            </div>
                            <SheetTitle className="mt-2 text-left text-lg leading-6">
                                {page.title || page.url}
                            </SheetTitle>
                            <SheetDescription className="text-left">
                                Included because its stored citation title explicitly identifies
                                the format—not because the system classified the site.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="space-y-6 p-6">
                            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--viz-hairline)]">
                                <SheetFact value={page.citationCount} label="citations" />
                                <SheetFact value={page.questionIds.length} label="questions" />
                                <SheetFact
                                    value={`${page.namingAnswerCount}/${page.answerCount}`}
                                    label="brand named"
                                />
                            </div>

                            <div>
                                <h3 className="text-xs font-semibold">Surfaces using this page</h3>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {page.engines.map((engine) => (
                                        <span
                                            key={engine}
                                            className="rounded-full bg-[var(--viz-track)] px-2.5 py-1 text-xs text-[var(--viz-ink-secondary)]"
                                        >
                                            {engineLabels[engine] ?? engine}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-[var(--viz-ink-secondary)]">
                                Brand co-occurrence describes the answers that cited this page, not
                                the page itself. Open the source if you want to inspect its current
                                contents.
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                                <a
                                    href={page.url}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--viz-ink)] px-4 text-xs font-semibold text-white"
                                >
                                    Open source
                                    <ArrowUpRight className="size-3.5" aria-hidden />
                                </a>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onFocusQuestions(
                                            page.questionIds,
                                            `questions citing ${page.host}`,
                                        )
                                    }
                                    className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--viz-hairline)] px-4 text-xs font-semibold"
                                >
                                    View related questions
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

function SheetFact({ value, label }: { value: number | string; label: string }) {
    return (
        <div className="border-l border-[var(--viz-hairline)] p-3 text-center first:border-l-0">
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-[10px] text-[var(--viz-ink-muted)]">{label}</div>
        </div>
    )
}
