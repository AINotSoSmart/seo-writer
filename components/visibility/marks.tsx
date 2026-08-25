/**
 * The chart marks this dashboard is allowed to draw.
 *
 * Four shapes, chosen because four is what the data needs — a parts-of-a-whole
 * split, a ranked comparison, a filled-vs-remaining capacity, and a headline
 * figure. Anything that cannot be said with one of these is a table, and the
 * ranked comparison is built to sit inside one.
 *
 * ## Two rules the marks enforce, so callers cannot forget them
 *
 * 1. **Magnitude is never carried by colour alone.** Every segment and bar is
 *    direct-labelled, or its value sits beside it. The palette already clears
 *    the contrast gates (see `viz-tokens.tsx`), but a reader who cannot
 *    distinguish two hues still reads every number.
 * 2. **Absence is not zero.** `Bar` states a reason where a zero-length bar
 *    would go. A rival that was never named and a rival measured at 0% look
 *    identical as bars and mean different things; only one of them is a
 *    measurement.
 *
 * Deliberately absent: any delta, sparkline or trend. A probe samples a
 * non-deterministic system and this product refuses trend claims until the
 * variance is measured — so there is no mark here capable of expressing one,
 * which is the cheapest way to keep that promise.
 */

import type { ReactNode } from "react"

export interface PillSegment {
    value: number
    /** CSS colour for the fill. */
    color: string
    /** Ink for a label drawn inside the fill — required when `label` is set. */
    labelInk?: string
    /** Direct label, drawn inside the segment when it is wide enough to hold it. */
    label?: string
    /** Diagonal hatch instead of a solid fill: "counted differently, or not at all". */
    hatched?: boolean
}

/**
 * One rounded bar split into parts of a whole.
 *
 * Used where the segments sum to something real — 40 questions, 47 citations.
 * The dominant segment carries its own label so the shape is readable before
 * the legend is.
 */
export function StackedPill({
    segments,
    height = 34,
    minLabelShare = 0.18,
}: {
    segments: PillSegment[]
    height?: number
    /** Below this share a label would not fit, so it is dropped to the legend. */
    minLabelShare?: number
}) {
    const total = segments.reduce((sum, segment) => sum + segment.value, 0)
    if (total <= 0) return null

    return (
        <div className="flex gap-[3px]" style={{ height }}>
            {segments
                .filter((segment) => segment.value > 0)
                .map((segment, index) => {
                    const share = segment.value / total
                    const showLabel = Boolean(segment.label) && share >= minLabelShare
                    return (
                        <div
                            key={index}
                            className={`flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full text-xs font-semibold tabular-nums ${
                                segment.hatched ? "viz-hatch" : ""
                            }`}
                            style={{
                                // `flex-grow` alone distributes only the FREE
                                // space, so a segment starts at its content
                                // width and grows from there — which made the
                                // segment labelled "5 after a rival" render
                                // wider than the segment labelled "5 first".
                                // A zero basis is what makes the shape a
                                // proportion rather than a suggestion.
                                flex: `${segment.value} 1 0%`,
                                background: segment.hatched ? undefined : segment.color,
                                color: segment.labelInk,
                            }}
                        >
                            {showLabel ? segment.label : null}
                        </div>
                    )
                })}
        </div>
    )
}

/** One row of a `StackedPill`'s legend: swatch, name, count, share. */
export function LegendRow({
    color,
    hatched = false,
    label,
    value,
    share,
    emphasis = false,
}: {
    color?: string
    hatched?: boolean
    label: string
    value: string
    share?: string
    emphasis?: boolean
}) {
    return (
        <div className="flex items-center gap-2.5 text-[13px]">
            <span
                className={`size-2 shrink-0 ${hatched ? "viz-hatch rounded-[2px]" : "rounded-full"}`}
                style={hatched ? undefined : { background: color }}
                aria-hidden
            />
            <span
                className={
                    emphasis
                        ? "flex-1 font-medium text-[var(--viz-ink)]"
                        : "flex-1 text-[var(--viz-ink-secondary)]"
                }
            >
                {label}
            </span>
            <span className="font-semibold tabular-nums">{value}</span>
            {share ? (
                <span className="w-12 text-right tabular-nums text-[var(--viz-ink-muted)]">
                    {share}
                </span>
            ) : null}
        </div>
    )
}

/**
 * A ranked bar inside a fixed track — the comparison form.
 *
 * Sized to fill a table cell, because that is where ranked comparisons live on
 * this page: the row already carries the name and the other measures, and a bar
 * that brought its own label column would fight the table for alignment.
 *
 * `emptyReason` is the parameter that matters. A rival the engines never named
 * gets the reason, not a zero-width bar, because those are different findings
 * and only one of them is a measurement.
 */
export function Bar({
    value,
    max,
    color,
    label,
    labelInk = "#ffffff",
    emptyReason,
}: {
    value: number
    max: number
    color: string
    /** Formatted value rendered at the value end, normally a percentage. */
    label: string
    labelInk?: string
    /** Shown in place of the bar when the value is zero. */
    emptyReason: string
}) {
    if (value <= 0) {
        return (
            <span className="viz-track-pill flex h-[22px] items-center px-2.5 text-[11px] text-[var(--viz-ink-muted)]">
                {emptyReason}
            </span>
        )
    }

    const share = max > 0 ? Math.min(value / max, 1) : 0
    // Under a quarter of the track the number cannot sit inside the fill
    // without clipping, so the bar keeps its true width and the value moves out
    // beside it. The bar is never widened to fit its own label.
    const labelFits = share >= 0.26

    return (
        <span className="flex items-center gap-2">
            <span className="viz-track-pill h-[22px] flex-1">
                <span
                    className="flex h-[22px] items-center justify-end rounded-full pr-2"
                    style={{ width: `${Math.max(share * 100, 2)}%`, background: color }}
                >
                    {labelFits && (
                        <span
                            className="text-[11px] font-semibold tabular-nums"
                            style={{ color: labelInk }}
                        >
                            {label}
                        </span>
                    )}
                </span>
            </span>
            {!labelFits && (
                <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums">
                    {label}
                </span>
            )}
        </span>
    )
}

/**
 * The square that stands in for a brand's mark.
 *
 * Not a favicon: fetching one would send every reader's browser to a
 * competitor's domain on page load, which leaks who is being tracked to the
 * company being tracked. An initial on a tinted square costs nothing and gives
 * the eye the same anchor down a column of names.
 */
export function Badge({ label, own = false }: { label: string; own?: boolean }) {
    const initial = label.trim().charAt(0).toUpperCase() || "?"
    const palette = [
        { background: "#fde68a", color: "#78350f" },
        { background: "#e0f2fe", color: "#075985" },
        { background: "#dcfce7", color: "#166534" },
        { background: "#fce7f3", color: "#9d174d" },
        { background: "#f5f5f4", color: "#57534e" },
    ]
    const paletteIndex = [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const tint = palette[paletteIndex % palette.length]
    return (
        <span
            className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
            style={
                own
                    ? { background: "#ede9fe", color: "#5b21b6" }
                    : tint
            }
            aria-label={label}
            title={label}
        >
            {initial}
        </span>
    )
}

/**
 * Filled cells against remaining cells — "8 of these 17, this cycle".
 *
 * A bar would say the same thing less well: the point is that the backlog is a
 * countable set of real items, not a percentage.
 */
export function CapacityStrip({
    filled,
    total,
    filledColor,
    restColor,
    height = 26,
}: {
    filled: number
    total: number
    filledColor: string
    restColor: string
    height?: number
}) {
    if (total <= 0) return null
    return (
        <div className="flex gap-1" style={{ height }} aria-hidden>
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    className="flex-1 rounded-[3px]"
                    style={{ background: index < filled ? filledColor : restColor }}
                />
            ))}
        </div>
    )
}

/**
 * The headline figure form: tinted icon, label with its own hint, one number,
 * and a proportion bar underneath so the ratio is visible without reading.
 */
export function StatCard({
    icon,
    iconTint,
    label,
    hint,
    value,
    unit,
    footnote,
    proportion,
}: {
    icon: ReactNode
    iconTint: string
    label: string
    /** Rendered beside the label — the explanation lives here, not in a paragraph. */
    hint?: ReactNode
    value: string
    /** Trailing detail shown smaller and muted: "%", "/ 40", "nd of 5". */
    unit?: string
    footnote: string
    /** Segments for the strip beneath the number. Omit for no strip. */
    proportion?: PillSegment[]
}) {
    return (
        <div className="viz-card p-5">
            <span
                className="inline-flex size-[30px] items-center justify-center rounded-[9px]"
                style={{ background: iconTint }}
                aria-hidden
            >
                {icon}
            </span>
            <div className="mt-3.5 flex items-center gap-1.5 text-xs text-[var(--viz-ink-secondary)]">
                {label}
                {hint}
            </div>
            <div className="mt-1.5 text-[32px] font-semibold leading-none tabular-nums tracking-[-0.02em]">
                {value}
                {unit ? (
                    <span className="text-[19px] text-[var(--viz-ink-muted)]">{unit}</span>
                ) : null}
            </div>
            {proportion ? (
                <div className="mt-3.5">
                    <StackedPill segments={proportion} height={6} minLabelShare={2} />
                </div>
            ) : null}
            <div className="mt-2 text-[11px] text-[var(--viz-ink-muted)]">{footnote}</div>
        </div>
    )
}
