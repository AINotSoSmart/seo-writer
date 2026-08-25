"use client"

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { SectionHeading } from "./info-hint"

export interface VisibilitySurfaceRow {
    engine: string
    label: string
    surface: string
    total: number
    present: number
}

export function VisibilitySurfaces({ rows }: { rows: VisibilitySurfaceRow[] }) {
    return (
        <section className="mt-5">
            <SectionHeading
                title="How each surface differs"
                hintLabel="Why surfaces are never averaged"
                hint={
                    <p>
                        Reported per surface and never averaged together — the same brand can
                        look very different on two engines, and an average hides exactly the gap
                        worth acting on.
                    </p>
                }
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {rows.map((engine, index) => {
                    const rate =
                        engine.total > 0
                            ? Math.round((engine.present / engine.total) * 1000) / 10
                            : 0
                    const color =
                        index === 0 ? "var(--viz-series-1)" : "var(--viz-series-2)"
                    return (
                        <div key={engine.engine} className="viz-card p-5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-2 text-sm font-medium">
                                    <span
                                        className="inline-block size-2.5 rounded-sm"
                                        style={{ background: color }}
                                        aria-hidden
                                    />
                                    {engine.label}
                                </span>
                                {engine.surface === "api" && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-[var(--viz-warning-ink)]">
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
    )
}

export function VisibilitySurfacesSheet({
    rows,
    open,
    onOpenChange,
}: {
    rows: VisibilitySurfaceRow[]
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
                <SheetHeader className="border-b border-[var(--viz-hairline)] px-6 py-5">
                    <SheetTitle>Compare measured surfaces</SheetTitle>
                    <SheetDescription>
                        A contextual comparison kept separate from the four report workflows.
                    </SheetDescription>
                </SheetHeader>
                <div className="p-6">
                    <VisibilitySurfaces rows={rows} />
                </div>
            </SheetContent>
        </Sheet>
    )
}
