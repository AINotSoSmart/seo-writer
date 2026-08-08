"use client"

import { motion } from "motion/react"

import type { AnalyzeBrandPhase } from "@/lib/analyze-brand/stream"
import { cn } from "@/lib/utils"

/**
 * What is happening, line by line. The only waiting treatment in onboarding.
 *
 * Replaces a single frozen line of 11px grey text and the spinners around it.
 * Two things made that line actively misleading rather than merely thin:
 *
 * 1. `ANALYZE_PHASE_COPY.crawl_started` and `.crawl_done` are the same string,
 *    so the label did not move at all through the longest segment of the run.
 * 2. The label was whatever event arrived LAST, so it could read "Building brand
 *    profile…" — already finished — while the thing the founder was staring at
 *    was still being computed.
 *
 * Phases are therefore marked complete INDEPENDENTLY rather than by position.
 * That still matters with a sequential flow, because a run resumed from cache
 * can land several phases at once.
 *
 * Every line must correspond to a real NDJSON event. If a stretch of work is
 * silent, emit a phase for it — never pad the list with a timed fake. A loader
 * that lies is worse than a spinner.
 *
 * Visual language is lifted from components/audit/audit-console.tsx:448-502 so
 * all three waiting screens in this product speak the same way.
 */

type ListedPhase = Exclude<AnalyzeBrandPhase, "complete" | "error">

const PHASE_LABEL: Record<ListedPhase, string> = {
    crawl_started: "Reading your site",
    crawl_done: "Understanding your pages",
    brand_ready: "Building your brand profile",
    scope_started: "Grouping what you sell",
    scope_grounding: "Checking each area against your site",
    scope_ready: "Product areas ready",
}

const PHASE_DETAIL: Record<ListedPhase, string> = {
    crawl_started: "Fetching your sitemap and the pages that describe what you sell.",
    crawl_done: "Picking the pages that actually explain the product.",
    brand_ready: "Reading your tone of voice so the articles sound like you.",
    scope_started: "Working out every distinct thing your business sells.",
    scope_grounding: "Making sure each one is backed by something real on your site.",
    scope_ready: "Almost there.",
}

/**
 * The one waiting treatment in onboarding.
 *
 * Both waits use this component — only `phases` differs. Deliberately not two
 * variants and never a spinner: a spinner says "something is happening", this
 * says WHAT is happening, which is the difference between a 60-second wait that
 * feels considered and one that feels broken.
 */
export function AnalyzePhaseList({
    phases,
    seen,
    pageCount,
}: {
    /** Ordered phases for this wait — BRAND_ANALYZE_PHASES or SCOPE_ANALYZE_PHASES. */
    phases: readonly ListedPhase[]
    /** Every phase whose event has arrived. Order-independent by design. */
    seen: Set<AnalyzeBrandPhase>
    /** Pages read, from the `crawl_done` payload the client used to discard. */
    pageCount?: number
}) {
    const activeIndex = phases.findIndex((phase) => !seen.has(phase))

    return (
        <ol className="space-y-1.5" aria-live="polite">
            {phases.map((phase, index) => {
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
