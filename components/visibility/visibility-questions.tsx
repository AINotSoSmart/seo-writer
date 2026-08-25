"use client"

import { useMemo, useState, type MouseEvent } from "react"
import Link from "next/link"
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Download,
    ExternalLink,
    X,
} from "lucide-react"

import type { DashboardActionKind, DashboardPrompt } from "./dashboard-model"
import { AnswerEvidence } from "./answer-evidence"
import { Badge } from "./marks"

type QuestionFilter = "losing" | "all" | "absent" | "outranked" | "present"

const VERDICT = {
    absent: {
        label: "Not named",
        Icon: AlertCircle,
        chip: "bg-red-50 text-[var(--viz-critical)]",
    },
    outranked: {
        label: "Not first",
        Icon: AlertTriangle,
        chip: "bg-amber-50 text-[var(--viz-warning-ink)]",
    },
    present: {
        label: "Named first",
        Icon: CheckCircle2,
        chip: "bg-emerald-50 text-[var(--viz-good-ink)]",
    },
} as const

const GROUP_COLORS = [
    "var(--viz-good)",
    "var(--viz-series-1)",
    "var(--viz-warning)",
    "var(--viz-series-2)",
]

function actionMeta(kind: DashboardActionKind): { label: string; className: string } {
    if (kind === "refresh") {
        return { label: "Refresh", className: "bg-blue-50 text-blue-800" }
    }
    if (kind === "report_only") {
        return { label: "Report only", className: "bg-stone-100 text-stone-600" }
    }
    return { label: "Create", className: "bg-emerald-50 text-emerald-800" }
}

function csvCell(value: string | number): string {
    return `"${String(value).replaceAll('"', '""')}"`
}

export function VisibilityQuestions({
    runId,
    subjectName,
    subjectDomains,
    prompts,
    engineLabels,
    rivalNames,
    focus,
    onClearFocus,
}: {
    runId: string
    subjectName: string
    subjectDomains: string[]
    prompts: DashboardPrompt[]
    engineLabels: Record<string, string>
    rivalNames: Record<string, string>
    focus: { label: string } | null
    onClearFocus: () => void
}) {
    const [filter, setFilter] = useState<QuestionFilter>(focus ? "losing" : "all")
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const visible = useMemo(() => {
        if (filter === "all") return prompts
        if (filter === "losing") return prompts.filter((row) => row.verdict !== "present")
        return prompts.filter((row) => row.verdict === filter)
    }, [filter, prompts])

    const groups = useMemo(() => {
        const grouped = new Map<string, DashboardPrompt[]>()
        for (const prompt of visible) {
            const name = prompt.scopeFamilyName || "Other questions"
            const rows = grouped.get(name) ?? []
            rows.push(prompt)
            grouped.set(name, rows)
        }
        return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    }, [visible])

    const visibleIds = visible.map((row) => row.id)
    const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))

    const toggleExpanded = (id: string) => {
        setExpanded((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleExpandedFromRow = (
        event: MouseEvent<HTMLTableRowElement>,
        id: string,
    ) => {
        const target = event.target as HTMLElement
        if (target.closest("button, a, input, select, label")) return
        if (window.getSelection()?.toString()) return
        toggleExpanded(id)
    }

    const toggleSelected = (id: string) => {
        setSelected((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAllVisible = () => {
        setSelected((current) => {
            const next = new Set(current)
            if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
            else visibleIds.forEach((id) => next.add(id))
            return next
        })
    }

    const exportCsv = () => {
        const chosen = selected.size
            ? prompts.filter((row) => selected.has(row.id))
            : visible
        const header = [
            "Question",
            "Topic",
            "Verdict",
            "Named in answers",
            "Answers measured",
            "Citations",
            "Named instead",
            "Action",
        ]
        const rows = chosen.map((row) => [
            row.prompt,
            row.scopeFamilyName,
            VERDICT[row.verdict].label,
            row.answers_present,
            row.answers_total,
            row.citationCount,
            (row.rivalIds ?? []).map((id) => rivalNames[id] ?? id).join("; "),
            row.action ? actionMeta(row.action.kind).label : "",
        ])
        const csv = [header, ...rows]
            .map((row) => row.map((value) => csvCell(value)).join(","))
            .join("\r\n")
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `visibility-questions-${runId}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    return (
        <section className="mt-5 min-w-0 max-w-full overflow-hidden rounded-[14px] border border-[var(--viz-hairline)] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
            <div className="flex flex-col gap-4 border-b border-[var(--viz-hairline)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                    <h2 className="text-lg font-semibold tracking-[-0.01em]">Questions</h2>
                    <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">
                        Grouped by confirmed product area. Open a row for the stored answers.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-[var(--viz-track)] px-2.5 text-xs text-[var(--viz-ink-secondary)]">
                        <Activity className="size-3.5" aria-hidden />
                        {prompts.reduce((sum, row) => sum + row.answers_total, 0)} answers
                    </span>
                    <button
                        type="button"
                        onClick={exportCsv}
                        className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[var(--viz-hairline)] px-3 text-xs font-medium text-[var(--viz-ink)] transition hover:bg-[var(--viz-plane)]"
                    >
                        <Download className="size-3.5" aria-hidden />
                        Export {selected.size ? `${selected.size} selected` : "CSV"}
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--viz-hairline)] px-4 py-3 sm:px-5">
                <label className="inline-flex h-[30px] items-center overflow-hidden rounded-lg border border-[var(--viz-hairline)] text-xs">
                    <span className="px-2.5 text-[var(--viz-ink-muted)]">Verdict</span>
                    <select
                        value={filter}
                        onChange={(event) => setFilter(event.target.value as QuestionFilter)}
                        className="h-full border-l border-[var(--viz-hairline)] bg-[var(--viz-plane)] px-2.5 pr-7 text-[var(--viz-ink)] outline-none"
                    >
                        <option value="all">All questions</option>
                        <option value="losing">Not leading</option>
                        <option value="absent">Not named</option>
                        <option value="outranked">Not first</option>
                        <option value="present">Named first</option>
                    </select>
                </label>
                <span className="inline-flex h-[30px] items-center rounded-lg border border-[var(--viz-hairline)] px-2.5 text-xs text-[var(--viz-ink-secondary)]">
                    Engines&nbsp;
                    <strong className="font-medium text-[var(--viz-ink)]">
                        {Object.values(engineLabels).join(", ") || "No completed answers"}
                    </strong>
                </span>
                {focus && (
                    <span className="inline-flex h-[30px] min-w-0 items-center gap-2 rounded-lg bg-blue-50 px-2.5 text-xs text-blue-900">
                        <span className="truncate">Showing {focus.label}</span>
                        <button
                            type="button"
                            onClick={onClearFocus}
                            aria-label="Clear question focus"
                            className="rounded p-0.5 hover:bg-blue-100"
                        >
                            <X className="size-3" aria-hidden />
                        </button>
                    </span>
                )}
                <span className="ml-auto text-xs tabular-nums text-[var(--viz-ink-muted)]">
                    {visible.length} of {prompts.length}
                </span>
            </div>

            <div className="max-w-full overflow-x-hidden lg:overflow-x-auto">
                <table className="block w-full min-w-0 text-left lg:table lg:min-w-[1020px] lg:table-fixed">
                    <thead className="block border-b border-[var(--viz-hairline)] text-[11px] uppercase tracking-[0.04em] text-[var(--viz-ink-muted)] lg:table-header-group">
                        <tr className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] lg:table-row">
                            <th className="block w-10 px-3 py-2.5 font-medium lg:table-cell lg:w-12 lg:px-4 lg:pl-5">
                                <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={toggleAllVisible}
                                    aria-label="Select all visible questions"
                                    className="size-3.5 rounded border-stone-300 accent-stone-900"
                                />
                            </th>
                            <th className="block min-w-0 py-2.5 pr-2 font-medium lg:table-cell lg:pr-5">Question</th>
                            <th className="hidden w-[130px] py-2.5 font-medium lg:table-cell">Verdict</th>
                            <th className="hidden w-[116px] py-2.5 font-medium lg:table-cell">Named in</th>
                            <th className="hidden w-[90px] py-2.5 font-medium lg:table-cell">Cited</th>
                            <th className="hidden w-[128px] py-2.5 font-medium lg:table-cell">Named instead</th>
                            <th className="hidden w-[132px] py-2.5 font-medium lg:table-cell">Action</th>
                            <th className="block w-10 py-2.5 font-medium lg:table-cell lg:w-12" />
                        </tr>
                    </thead>
                    <tbody className="block lg:table-row-group">
                        {groups.map(([groupName, rows], groupIndex) => {
                            const namedCount = rows.filter(
                                (row) => row.verdict !== "absent",
                            ).length
                            return [
                                <tr key={`${groupName}-heading`} className="block lg:table-row">
                                    <th
                                        colSpan={8}
                                        className="block border-b border-[var(--viz-hairline)] bg-[var(--viz-plane)] px-4 py-2.5 text-xs font-semibold sm:px-5 lg:table-cell"
                                    >
                                        <span
                                            className="mr-2.5 inline-block size-2 rounded-[2px]"
                                            style={{
                                                background:
                                                    GROUP_COLORS[groupIndex % GROUP_COLORS.length],
                                            }}
                                            aria-hidden
                                        />
                                        {groupName}
                                        <span className="ml-2 font-normal tabular-nums text-[var(--viz-ink-muted)]">
                                            {rows.length} {rows.length === 1 ? "question" : "questions"} · named in {namedCount}
                                        </span>
                                    </th>
                                </tr>,
                                ...rows.map((prompt) => {
                                    const meta = VERDICT[prompt.verdict]
                                    const isOpen = expanded.has(prompt.id)
                                    const rivals = (prompt.rivalIds ?? []).map(
                                        (id) => rivalNames[id] ?? id,
                                    )
                                    const action = prompt.action
                                        ? actionMeta(prompt.action.kind)
                                        : null
                                    return (
                                        <tr
                                            key={prompt.id}
                                            onClick={(event) =>
                                                toggleExpandedFromRow(event, prompt.id)
                                            }
                                            className={`grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] cursor-pointer border-b border-[var(--viz-hairline)] align-middle transition lg:table-row ${
                                                isOpen
                                                    ? "bg-blue-50/40"
                                                    : "hover:bg-[var(--viz-plane)]"
                                            }`}
                                        >
                                            <td className="block px-3 py-3.5 lg:table-cell lg:px-4 lg:pl-5">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(prompt.id)}
                                                    onChange={() => toggleSelected(prompt.id)}
                                                    aria-label={`Select ${prompt.prompt}`}
                                                    className="size-3.5 rounded border-stone-300 accent-stone-900"
                                                />
                                            </td>
                                            <td className="block min-w-0 py-3.5 pr-2 text-[13px] leading-relaxed text-[var(--viz-ink)] lg:table-cell lg:pr-6">
                                                <div className="break-words [overflow-wrap:anywhere]">
                                                    {prompt.prompt}
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5 lg:hidden">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
                                                    >
                                                        <meta.Icon className="size-3" aria-hidden />
                                                        {meta.label}
                                                    </span>
                                                    <span className="rounded-full bg-[var(--viz-track)] px-2 py-0.5 text-[10px] tabular-nums text-[var(--viz-ink-secondary)]">
                                                        {prompt.answers_present}/{prompt.answers_total} answers
                                                    </span>
                                                    <span className="rounded-full bg-[var(--viz-track)] px-2 py-0.5 text-[10px] tabular-nums text-[var(--viz-ink-secondary)]">
                                                        {prompt.citationCount} {prompt.citationCount === 1 ? "citation" : "citations"}
                                                    </span>
                                                    {action && prompt.action && (
                                                        <span
                                                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${action.className}`}
                                                            title={
                                                                prompt.action.status === "suggested"
                                                                    ? "Suggested; awaiting confirmation"
                                                                    : prompt.action.title
                                                            }
                                                        >
                                                            {action.label}
                                                        </span>
                                                    )}
                                                </div>
                                                {rivals.length > 0 && (
                                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1 lg:hidden">
                                                        <span className="mr-0.5 text-[10px] text-[var(--viz-ink-muted)]">
                                                            Named instead
                                                        </span>
                                                        {rivals.slice(0, 3).map((name) => (
                                                            <Badge key={name} label={name} />
                                                        ))}
                                                        {rivals.length > 3 && (
                                                            <span className="text-[10px] tabular-nums text-[var(--viz-ink-muted)]">
                                                                +{rivals.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="hidden py-3.5 lg:table-cell">
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
                                                >
                                                    <meta.Icon className="size-3" aria-hidden />
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td className="hidden py-3.5 text-[13px] tabular-nums text-[var(--viz-ink-secondary)] lg:table-cell">
                                                {prompt.answers_present} / {prompt.answers_total}
                                            </td>
                                            <td className="hidden py-3.5 text-[13px] tabular-nums text-[var(--viz-ink-secondary)] lg:table-cell">
                                                {prompt.citationCount > 0
                                                    ? prompt.citationCount
                                                    : <span className="text-[var(--viz-ink-muted)]">&mdash;</span>}
                                            </td>
                                            <td className="hidden py-3.5 lg:table-cell">
                                                {rivals.length ? (
                                                    <span className="flex items-center gap-1">
                                                        {rivals.slice(0, 3).map((name) => (
                                                            <Badge key={name} label={name} />
                                                        ))}
                                                        {rivals.length > 3 && (
                                                            <span className="ml-0.5 text-xs tabular-nums text-[var(--viz-ink-muted)]">
                                                                +{rivals.length - 3}
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-[13px] text-[var(--viz-ink-muted)]">&mdash;</span>
                                                )}
                                            </td>
                                            <td className="hidden py-3.5 lg:table-cell">
                                                {action && prompt.action ? (
                                                    <span
                                                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${action.className}`}
                                                        title={
                                                            prompt.action.status === "suggested"
                                                                ? "Suggested; awaiting confirmation"
                                                                : prompt.action.title
                                                        }
                                                    >
                                                        {action.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-[13px] text-[var(--viz-ink-muted)]">&mdash;</span>
                                                )}
                                            </td>
                                            <td className="block py-3.5 pr-2 text-right lg:table-cell lg:pr-4">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpanded(prompt.id)}
                                                    aria-label={`${isOpen ? "Close" : "Open"} answers for ${prompt.prompt}`}
                                                    aria-expanded={isOpen}
                                                    aria-controls={`question-evidence-${prompt.id}`}
                                                    className={`rounded-md p-1.5 transition ${
                                                        isOpen
                                                            ? "bg-blue-100 text-[var(--viz-series-1)]"
                                                            : "text-[var(--viz-ink-muted)] hover:bg-stone-100 hover:text-[var(--viz-ink)]"
                                                    }`}
                                                >
                                                    {isOpen ? (
                                                        <ChevronDown className="size-4" aria-hidden />
                                                    ) : (
                                                        <ChevronRight className="size-4" aria-hidden />
                                                    )}
                                                </button>
                                                {isOpen && (
                                                    <div className="sr-only">Answers expanded below</div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                }).flatMap((row) => {
                                    const promptId = String(row.key)
                                    if (!expanded.has(promptId)) return [row]
                                    return [
                                        row,
                                        <tr key={`${promptId}-answers`} className="block lg:table-row">
                                            <td
                                                colSpan={8}
                                                id={`question-evidence-${promptId}`}
                                                className="block min-w-0 max-w-full overflow-hidden border-b border-[var(--viz-hairline)] bg-[#fbfbfa] px-3 sm:px-5 lg:table-cell lg:max-w-0"
                                            >
                                                <div className="min-w-0 max-w-full overflow-hidden">
                                                    <AnswerEvidence
                                                        promptId={promptId}
                                                        engineLabels={engineLabels}
                                                        subjectName={subjectName}
                                                        subjectDomains={subjectDomains}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-2 border-t border-[var(--viz-hairline)] py-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <span className="text-[10px] text-[var(--viz-ink-muted)]">
                                                        Exact captured evidence · stored unedited
                                                    </span>
                                                    <Link
                                                        href={`/evidence/ai-answer/${runId}/${promptId}`}
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--viz-series-1)] hover:underline"
                                                    >
                                                        Open this evidence on its own page
                                                        <ExternalLink className="size-3" aria-hidden />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>,
                                    ]
                                }),
                            ]
                        })}
                        {visible.length === 0 && (
                            <tr className="block lg:table-row">
                                <td
                                    colSpan={8}
                                    className="block px-5 py-12 text-center text-sm text-[var(--viz-ink-muted)] lg:table-cell"
                                >
                                    No questions match this verdict filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
