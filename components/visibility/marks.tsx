/**
 * The chart marks this dashboard is allowed to draw.
 *
 * A parts-of-a-whole split, a ranked comparison, a filled-vs-remaining
 * capacity, a countable tick row, a position in a field, and a headline figure.
 * Anything that cannot be said with one of these is a table, and the ranked
 * comparison is built to sit inside one.
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
 * Above this many items a tick is thinner than the gap beside it and the row
 * turns into grey mush. The card's strip is roughly 200px wide, so sixty ticks
 * is already about 1.3px each — past that the mark stops being countable, which
 * is the only reason to draw it instead of a bar.
 */
const MAX_COUNTABLE_TICKS = 60

/**
 * One tick per item, lit for the ones that count.
 *
 * The KPI row's denominators are small and countable — forty answers, forty
 * questions — so this mark IS the measurement: four lit ticks out of forty,
 * which a reader can verify by eye. A solid bar is an abstraction of the same
 * fact, and it is the same abstraction whether the total is forty or forty
 * thousand. `CapacityStrip` already reaches for this idea for the backlog; this
 * is the same instinct at KPI scale, with a thinner tick.
 *
 * Above `MAX_COUNTABLE_TICKS` it degrades to a proportional bar on purpose. A
 * tick row nobody can count is worse than the bar it replaced, because it
 * implies a precision the reader cannot check.
 */
export function TickTrack({
    filled,
    total,
    color,
    restColor = "var(--viz-baseline)",
    height = 22,
}: {
    filled: number
    total: number
    color: string
    restColor?: string
    height?: number
}) {
    if (total <= 0) return null

    if (total > MAX_COUNTABLE_TICKS) {
        const share = Math.min(Math.max(filled / total, 0), 1)
        return (
            <div
                className="viz-track-pill"
                style={{ height: Math.min(height, 8) }}
                aria-hidden
            >
                <span
                    className="block h-full rounded-full"
                    // Floored so a real but tiny value still leaves a mark; a
                    // measured 1-in-400 must not render as an empty track.
                    style={{ width: `${Math.max(share * 100, 1.5)}%`, background: color }}
                />
            </div>
        )
    }

    const lit = Math.min(Math.max(filled, 0), total)
    return (
        <div className="flex gap-[2px]" style={{ height }} aria-hidden>
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    className="flex-1 rounded-[1px]"
                    style={{ background: index < lit ? color : restColor }}
                />
            ))}
        </div>
    )
}

/**
 * The ranked field as one cell per brand, with the subject's place lit.
 *
 * Rank is not a rate, so it gets no tick row: "2nd of 5" has no numerator to
 * fill. What it has is a field of known size and a position inside it, and that
 * is exactly what these cells say — five boxes, the second one yours. The
 * ordinals are drawn inside while they fit, so the card states its own claim
 * without the reader consulting the label above it.
 */
export function RankTicks({
    position,
    total,
    color,
    height = 22,
}: {
    /** 1-based place in the field. */
    position: number
    total: number
    color: string
    height?: number
}) {
    if (total <= 0 || position <= 0) return null
    // Past eight cells an ordinal no longer fits without clipping, so the cells
    // keep their width and lose their numbers rather than the reverse.
    const showOrdinals = total <= 8
    return (
        <div className="flex gap-[3px]" style={{ height }} aria-hidden>
            {Array.from({ length: total }, (_, index) => {
                const own = index + 1 === position
                return (
                    <span
                        key={index}
                        className="flex flex-1 items-center justify-center rounded-[3px] text-[10px] font-bold tabular-nums"
                        style={{
                            background: own ? color : "var(--viz-track)",
                            color: own ? "#ffffff" : "var(--viz-ink-muted)",
                        }}
                    >
                        {showOrdinals ? index + 1 : null}
                    </span>
                )
            })}
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
    mark,
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
    /**
     * The shape beneath the number — a `TickTrack` for a rate, `RankTicks` for a
     * position. Passed in rather than described by props, because the two are
     * different marks with different arguments and a single `proportion` array
     * could only express one of them; the rank card was forcing the leader's
     * count and the brand's count into a stacked bar that summed to nothing
     * meaningful.
     */
    mark?: ReactNode
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
            {mark ? <div className="mt-3.5">{mark}</div> : null}
            {/* Separated by a rule: the number above is this run's measurement,
                the line below says what it was counted out of. Running them
                together read as one caption for both. */}
            <div className="mt-3.5 border-t border-[var(--viz-hairline)] pt-2.5 text-[11px] text-[var(--viz-ink-muted)]">
                {footnote}
            </div>
        </div>
    )
}
