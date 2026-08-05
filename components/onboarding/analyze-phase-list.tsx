"use client"

import { motion } from "motion/react"

import type { AnalyzeBrandPhase } from "@/lib/analyze-brand/stream"
import { cn } from "@/lib/utils"

/**
 * What the analyze run is doing, phase by phase.
 *
 * Replaces a single frozen line of 11px grey text. Two things made that line
 * actively misleading rather than merely thin:
 *
 * 1. `ANALYZE_PHASE_COPY.crawl_started` and `.crawl_done` are the same string,
 *    so the label did not move at all through the longest segment of the run.
 * 2. The label was whatever event arrived LAST, and `brand_ready` reliably beats
 *    `scope_ready` — so it read "Building brand profile…" while the category
 *    list, the thing the founder was staring at, was still being computed.
 *
 * Phases are therefore marked complete INDEPENDENTLY rather than by position:
 * "Building brand profile ✓" ticked while "Finding product areas" is still
 * breathing is the truth, and it is precisely the information that was missing.
 *
 * Visual language is lifted from components/audit/audit-console.tsx so the two
 * waiting screens in this product behave the same way.
 */

const PHASE_ORDER = [
    "crawl_started",
    "crawl_done",
    "scope_ready",
    "brand_ready",
] as const satisfies readonly AnalyzeBrandPhase[]

type ListedPhase = (typeof PHASE_ORDER)[number]

const PHASE_LABEL: Record<ListedPhase, string> = {
    crawl_started: "Reading your site",
    crawl_done: "Understanding your pages",
    scope_ready: "Finding product areas",
    brand_ready: "Building brand profile",
}

const PHASE_DETAIL: Record<ListedPhase, string> = {
    crawl_started: "Fetching your sitemap and the pages that describe what you sell.",
    crawl_done: "Picking the pages that actually explain the product.",
    scope_ready: "Grouping what you sell into areas we can research. This is the slow part.",
    brand_ready: "Reading your tone of voice so the articles sound like you.",
}

export function AnalyzePhaseList({
    seen,
    pageCount,
}: {
    /** Every phase whose event has arrived. Order-independent by design. */
    seen: Set<AnalyzeBrandPhase>
    /** Pages read, from the `crawl_done` payload the client used to discard. */
    pageCount?: number
}) {
    const activeIndex = PHASE_ORDER.findIndex((phase) => !seen.has(phase))

    return (
        <ol className="space-y-1.5" aria-live="polite">
            {PHASE_ORDER.map((phase, index) => {
                const complete = seen.has(phase)
                const active = index === activeIndex
                const label =
                    phase === "crawl_done" && complete && pageCount
                        ? `${PHASE_LABEL[phase]} · read ${pageCount} page${pageCount === 1 ? "" : "s"}`
                        : PHASE_LABEL[phase]
                return (
                    <motion.li
                        key={phase}
                        className="flex items-start gap-2"
                        animate={{ opacity: complete ? 0.38 : active ? 1 : 0.22 }}
                        transition={{ duration: 0.3 }}
                    >
                        <span className="mt-[1px] w-4 shrink-0 text-center font-mono text-[10px] tabular-nums text-stone-400">
                            {complete ? "✓" : String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                            <motion.span
                                className={cn(
                                    "block text-xs",
                                    active ? "text-stone-900" : "text-stone-500",
                                )}
                                animate={active ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
                                transition={
                                    active
                                        ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                                        : { duration: 0.2 }
                                }
                            >
                                {label}
                            </motion.span>
                            {active ? (
                                <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">
                                    {PHASE_DETAIL[phase]}
                                </span>
                            ) : null}
                        </span>
                    </motion.li>
                )
            })}
        </ol>
    )
}
