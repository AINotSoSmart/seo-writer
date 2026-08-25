import type { ComponentType, ReactNode } from "react"

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

export function ProductMetric({
    icon: Icon,
    iconTint,
    iconColor,
    label,
    value,
    note,
    progress,
}: {
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
    iconTint: string
    iconColor: string
    label: string
    value: string
    note: string
    progress?: number
}) {
    const boundedProgress = Math.max(0, Math.min(progress ?? 0, 1))
    return (
        <article className="viz-card min-w-0 p-5">
            <span
                className="inline-flex size-[30px] items-center justify-center rounded-[9px]"
                style={{ background: iconTint, color: iconColor }}
                aria-hidden
            >
                <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-3.5 text-xs text-[var(--viz-ink-secondary)]">{label}</p>
            <p className="mt-1.5 text-[30px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--viz-ink)]">
                {value}
            </p>
            {progress !== undefined ? (
                <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-[var(--viz-track)]" aria-hidden>
                    <div
                        className="h-full rounded-full bg-[var(--viz-series-1)]"
                        style={{ width: `${boundedProgress * 100}%` }}
                    />
                </div>
            ) : null}
            <p className="mt-2 text-[11px] text-[var(--viz-ink-muted)]">{note}</p>
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
