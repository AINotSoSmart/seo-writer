"use client"

import { ArrowRight } from "lucide-react"

import { AnalyzePhaseList } from "@/components/onboarding/analyze-phase-list"
import {
    ScopeFamilyReview,
    ScopeFamilySkeleton,
    focusScopeField,
    type ScopeBlocker,
} from "@/components/onboarding/scope-family-review"
import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import {
    SCOPE_ANALYZE_PHASES,
    type AnalyzeBrandPhase,
} from "@/lib/analyze-brand/stream"
import type { BrandDetails, ScopeFamily } from "@/lib/schemas/brand"

/**
 * Step 3 of onboarding. What we think you sell.
 *
 * Waits on its own call and nothing else. This screen used to share a step value
 * with the URL form and render whatever had arrived so far — persona and scope
 * were produced concurrently by two models of different speeds, so it routinely
 * appeared with an empty category list under a status line describing work that
 * had already finished.
 */
export function ScopeStep({
    brand,
    targetSeeds,
    seedsWithoutDemand,
    scopeLoading,
    scopeReady,
    phasesSeen,
    scopeAnalysisIssues,
    scopeBlockers,
    onFamiliesChange,
    onTargetSeedsChange,
    onLookAgain,
    onRestart,
    onContinue,
}: {
    brand: BrandDetails
    targetSeeds: string[]
    seedsWithoutDemand: string[]
    scopeLoading: boolean
    scopeReady: boolean
    phasesSeen: Set<AnalyzeBrandPhase>
    scopeAnalysisIssues: Array<{ family?: string; message: string }>
    scopeBlockers: ScopeBlocker[]
    onFamiliesChange: (families: ScopeFamily[]) => void
    onTargetSeedsChange: (seeds: string[]) => void
    onLookAgain: (seeds: string[]) => void
    onRestart: () => void
    onContinue: () => void
}) {
    const waiting = scopeLoading && !scopeReady

    return (
        <div className="space-y-4 pb-1">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl tracking-tight text-stone-900">
                    Confirm what you sell
                </h2>
            </div>

            {waiting && (
                <p className="text-xs text-stone-500">Working out everything you sell.</p>
            )}

            {waiting ? (
                <div className="space-y-2 rounded-lg bg-stone-50 px-3 py-2.5">
                    {/* Same component, same visual language as step 1. One
                        waiting treatment in this flow, and never a spinner. */}
                    <AnalyzePhaseList phases={SCOPE_ANALYZE_PHASES} seen={phasesSeen} />
                </div>
            ) : null}

            {waiting ? (
                <ScopeFamilySkeleton />
            ) : (
                <ScopeFamilyReview
                    families={brand.scope_families || []}
                    targetSeeds={brand.target_seed_keywords || targetSeeds}
                    seedsWithoutDemand={seedsWithoutDemand}
                    onChange={onFamiliesChange}
                    onChangeTargetSeeds={onTargetSeedsChange}
                    onRestart={onRestart}
                />
            )}

            {scopeAnalysisIssues.length > 0 && (
                <details className="text-xs text-stone-500">
                    <summary className="cursor-pointer hover:text-stone-700">
                        Extraction notes ({scopeAnalysisIssues.length})
                    </summary>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4">
                        {scopeAnalysisIssues.map((issue, index) => (
                            <li key={`${issue.family || "scope"}-${index}`}>
                                {issue.family ? `${issue.family}: ` : ""}
                                {issue.message}
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {/* Asked HERE, not on the first screen. Naming the searches you care
                about is far easier once you can see what we already found — and
                the extractor works without them, so it was never a prerequisite. */}
            {scopeReady && (
                <details className="rounded-lg border border-stone-200 px-3 py-2.5">
                    <summary className="cursor-pointer text-xs text-stone-600 hover:text-stone-900">
                        Anything we missed?
                        <span className="ml-1.5 text-stone-400">optional</span>
                    </summary>
                    <div className="mt-2.5 space-y-2">
                        <label className="text-xs font-medium text-stone-600">
                            What do people type into Google to find a tool like yours?
                        </label>
                        <PillInput
                            value={targetSeeds}
                            onChange={onTargetSeedsChange}
                            placeholder="e.g. ai photo restoration (press Enter to add)"
                            disabled={scopeLoading}
                        />
                        <p className="text-[10px] leading-relaxed text-stone-400">
                            Not your brand name — the words a stranger would search.
                            Two to five words each. Every one becomes a product area
                            you confirm before research starts.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={scopeLoading || targetSeeds.length === 0}
                            onClick={() => onLookAgain(targetSeeds)}
                            className="h-8 text-xs"
                        >
                            Add these and look again
                        </Button>
                    </div>
                </details>
            )}

            <div className="sticky bottom-0 space-y-3 border-t border-stone-100 bg-white/95 py-3 backdrop-blur-sm">
                {!scopeLoading && scopeBlockers.length > 0 && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                        <p className="text-[11px] font-medium text-amber-900">
                            {scopeBlockers.length === 1
                                ? "One thing left before we can start"
                                : `${scopeBlockers.length} things left before we can start`}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                            {scopeBlockers.map((blocker, index) => (
                                <li key={`${blocker.familyId}-${blocker.field}-${index}`}>
                                    <button
                                        type="button"
                                        onClick={() => focusScopeField(blocker)}
                                        className="text-left text-[11px] leading-snug text-amber-800 underline-offset-2 hover:underline"
                                    >
                                        {blocker.familyName ? `${blocker.familyName}: ` : ""}
                                        {blocker.message}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <Button
                    onClick={onContinue}
                    disabled={scopeLoading || !scopeReady || scopeBlockers.length > 0}
                    className="w-full h-10 font-semibold bg-gradient-to-b from-stone-800 to-stone-950 hover:from-stone-700 hover:to-stone-900 disabled:opacity-50"
                >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    )
}
