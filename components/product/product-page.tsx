import type { ComponentType, ReactNode } from "react"

import { TickTrack } from "@/components/visibility/marks"
import { VizTokens } from "@/components/visibility/viz-tokens"

export function ProductPage({
    children,
    width = "wide",
    className = "",
}: {
    children: ReactNode
    width?: "wide" | "reading"
    className?: string
}) {
    return (
        <main
            className={`viz-root mx-auto w-full ${
                width === "reading" ? "max-w-5xl" : "max-w-[1376px]"
            } py-6 sm:py-8 ${className}`}
        >
            <VizTokens />
            {children}
        </main>
    )
}

export function ProductHeader({
    eyebrow,
    icon: Icon,
    title,
    description,
    actions,
}: {
    eyebrow: string
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
    title: string
    description: string
    actions?: ReactNode
}) {
    return (
        <header className="flex min-w-0 flex-col gap-5 border-b border-[var(--viz-hairline)] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-violet-600">
                    <Icon className="size-3.5" aria-hidden />
                    {eyebrow}
                </div>
                <h1 className="mt-2 font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.02em] text-[var(--viz-ink)]">
                    {title}
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[var(--viz-ink-secondary)]">
                    {description}
                </p>
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
    )
}

/**
 * A headline count for a product page, in the same language as the visibility
 * report's `StatCard`.
 *
 * The two differences from that card are deliberate. It takes an `icon`
 * component rather than a node, because these pages name their sections by
 * icon and repeating the JSX at every call site invited drift. And it takes
 * `filled`/`total` rather than a ready-made mark, because every ratio on these
 * pages is the same shape — some of a countable set of articles — so the card
 * can pick the mark itself.
 */
export function ProductMetric({
    icon: Icon,
    iconTint,
    iconColor,
    label,
    value,
    note,
    filled,
    total,
    emptyNote,
}: {
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
    iconTint: string
    iconColor: string
    label: string
    value: string
    note: string
    /**
     * The counts behind the ratio, not a 0-1 fraction.
     *
     * A fraction is enough to draw a bar and not enough to draw ticks, and
     * ticks are the point: these totals are single-digit or low-double-digit
     * sets of real articles, so "3 of 8 delivered" can be drawn as eight cells
     * with three lit and checked by eye. Passing `0.375` throws away the only
     * thing that made that possible. Omit both for a figure with no
     * denominator.
     */
    filled?: number
    total?: number
    /**
     * What the note says while `total` is 0.
     *
     * A separate string rather than a clever rewrite of `note`, because the two
     * are saying different things: `note` explains what the ratio counts, and
     * this explains why there is no ratio yet. Falls back to `note`.
     */
    emptyNote?: string
}) {
    /**
     * A RATIO OUT OF ZERO IS UNDEFINED, NOT ZERO.
     *
     * On a new account these cards printed "0/0", which invites the reader to
     * work out what fraction that is and then to wonder whether something
     * failed. Nothing failed — there is simply nothing to take a fraction of
     * yet. An em dash says that, and it is the same mark the visibility report
     * uses for a column that cannot be asked of a given row.
     */
    const undefinedRatio = total !== undefined && total <= 0
    return (
        // A column with the note pushed to the bottom, so that in a row where
        // one card has no mark — "Delivered drafts" has no denominator — every
        // footnote still sits on the same line instead of floating up.
        <article className="viz-card flex min-w-0 flex-col p-5">
            <span
                className="inline-flex size-[30px] items-center justify-center rounded-[9px]"
                style={{ background: iconTint, color: iconColor }}
                aria-hidden
            >
                <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-3.5 text-xs text-[var(--viz-ink-secondary)]">{label}</p>
            <p
                className={`mt-1.5 text-[30px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${
                    undefinedRatio ? "text-[var(--viz-ink-muted)]" : "text-[var(--viz-ink)]"
                }`}
            >
                {undefinedRatio ? "\u2014" : value}
            </p>
            {total !== undefined && !undefinedRatio ? (
                <div className="mt-3.5">
                    {/*
                      * Lit in the card's OWN colour, not a fixed blue. The
                      * published card carried a green icon above a blue bar,
                      * which read as two unrelated facts stacked in one card.
                      */}
                    <TickTrack
                        filled={filled ?? 0}
                        total={total}
                        color={iconColor}
                        height={18}
                    />
                </div>
            ) : null}
            <p className="mt-3.5 border-t border-[var(--viz-hairline)] pt-2.5 text-[11px] text-[var(--viz-ink-muted)]">
                {undefinedRatio ? (emptyNote ?? note) : note}
            </p>
        </article>
    )
}

export function ProductPanel({
    children,
    className = "",
}: {
    children: ReactNode
    className?: string
}) {
    return (
        <section className={`viz-card min-w-0 overflow-hidden ${className}`}>
            {children}
        </section>
    )
}

export const primaryActionClass =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-[var(--viz-ink)] px-3.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"

export const secondaryActionClass =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-[var(--viz-hairline)] bg-white px-3.5 text-xs font-semibold text-[var(--viz-ink-secondary)] transition hover:bg-[var(--viz-plane)] hover:text-[var(--viz-ink)] disabled:cursor-not-allowed disabled:opacity-50"
