"use client"

import React, { useState } from "react"
import {
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Gauge,
    Layers,
    CalendarClock,
    CheckCircle2,
    AlertCircle,
    Link2,
    Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AuditScope, GapEvidence, ProgramProgress } from "@/actions/harvest"

/**
 * Scope view — replaces the blueprint-shaped AuditResults.
 *
 * The old screen led with an Authority Score computed against an LLM-invented
 * topic list, and a "projected score after plan" that was a simulation
 * guaranteed to look good. Both are gone.
 *
 * This shows three things instead, all of them countable:
 *   1. The finite scope of the niche — N articles across M clusters.
 *   2. How fast each tier closes it. Velocity is what's sold; scope is disclosed.
 *   3. The evidence, with the URL each gap was observed on. Every claim here is
 *      clickable, which is the whole point of the rewrite.
 */

interface ScopeResultsProps {
    scope: AuditScope
    gaps: GapEvidence[]
    brandName: string
    progress?: ProgramProgress | null
    onStartProgram?: (tier: "close" | "accelerate" | "dominate") => void
    isStarting?: boolean
    showShareLink?: boolean
}

const TIER_LABELS: Record<string, { name: string; price: string }> = {
    close: { name: "Close", price: "$249" },
    accelerate: { name: "Accelerate", price: "$449" },
    dominate: { name: "Dominate", price: "$799" },
}

function StatTile({
    icon: Icon,
    label,
    value,
    sub,
}: {
    icon: React.ElementType
    label: string
    value: string | number
    sub?: string
}) {
    return (
        <div className="flex-1 min-w-[150px] rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-2 text-stone-500 mb-2">
                <Icon size={15} strokeWidth={1.75} />
                <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
            </div>
            <div className="font-serif text-3xl text-stone-900 leading-none">{value}</div>
            {sub && <div className="text-xs text-stone-500 mt-1.5">{sub}</div>}
        </div>
    )
}

export function ScopeResults({
    scope,
    gaps,
    brandName,
    progress,
    onStartProgram,
    isStarting,
    showShareLink = true,
}: ScopeResultsProps) {
    const [showAllClusters, setShowAllClusters] = useState(false)
    const [showEvidence, setShowEvidence] = useState(true)
    const [copied, setCopied] = useState(false)

    const recommended = scope.clusters.filter((c) => scope.recommendedClusterIds.includes(c.id))
    const remainder = scope.clusters.filter((c) => !scope.recommendedClusterIds.includes(c.id))
    const visibleClusters = showAllClusters ? scope.clusters : recommended

    return (
        <div className="w-full space-y-8">
            {/* --- Scope headline --- */}
            <div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <h2 className="font-serif text-3xl md:text-4xl text-stone-900 tracking-tight">
                        {brandName}&rsquo;s niche:{" "}
                        <span className="text-brand-600">{scope.articleCount} articles</span> across{" "}
                        {scope.clusterCount} clusters
                    </h2>
                    {showShareLink && scope.publicToken && (
                        <Button
                            variant="outline"
                            className="shrink-0"
                            onClick={async () => {
                                const url = `${window.location.origin}/audit/${scope.publicToken}`
                                await navigator.clipboard.writeText(url)
                                setCopied(true)
                                window.setTimeout(() => setCopied(false), 1800)
                            }}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            {copied ? "Copied" : "Copy public audit"}
                        </Button>
                    )}
                </div>
                <p className="text-sm text-stone-500 mt-2">
                    Harvested from {scope.poolSize} real search queries. Every one carries the URL it
                    was observed on — open any of them below.
                </p>
            </div>

            {/* --- Small-niche guard: turning people away is deliberate --- */}
            {scope.belowViableThreshold && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex gap-3">
                    <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900">
                        <strong className="font-medium">This niche is small.</strong> {scope.articleCount}{" "}
                        articles closes it entirely — that&rsquo;s a one-off project, not a subscription.
                        A recurring plan would run out before it earned its keep.
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <StatTile
                    icon={Gauge}
                    label="You currently cover"
                    value={`${scope.authorityScore}%`}
                    sub="verified against your live pages"
                />
                <StatTile icon={Layers} label="Clusters" value={scope.clusterCount} sub="thematic groups" />
                <StatTile
                    icon={CalendarClock}
                    label="Recommended program"
                    value={scope.recommendedArticleCount}
                    sub={`${recommended.length} highest-value clusters`}
                />
            </div>

            {/* --- Burn-down, once a program is running --- */}
            {progress && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-5">
                    <div className="flex items-baseline justify-between mb-3">
                        <span className="text-sm font-medium text-stone-900">
                            {progress.status === "completed"
                                ? "Niche complete"
                                : `${progress.completedCount} of ${progress.totalArticles} closed`}
                        </span>
                        <span className="text-xs text-stone-500">
                            {progress.status === "completed"
                                ? "No gaps left to fill"
                                : `~${progress.monthsRemaining} month${progress.monthsRemaining === 1 ? "" : "s"} remaining`}
                        </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                        <div
                            className="h-full bg-brand-500 transition-all"
                            style={{ width: `${progress.percentComplete}%` }}
                        />
                    </div>
                    {progress.status === "completed" && (
                        <p className="text-xs text-stone-600 mt-3">
                            You&rsquo;ve closed every real gap in this niche. Add a product line or a new
                            market and we&rsquo;ll harvest a fresh pool — we won&rsquo;t pad the plan.
                        </p>
                    )}
                </div>
            )}

            {/* --- Velocity: the thing actually being sold --- */}
            {!progress && (
                <div>
                    <h3 className="font-serif text-xl text-stone-900 mb-1">Choose your pace</h3>
                    <p className="text-sm text-stone-500 mb-4">
                        Same scope, different completion dates. Each cluster ships complete, fully
                        interlinked, in one batch.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {scope.velocity.map((v) => {
                            const meta = TIER_LABELS[v.tier]
                            const isRecommended = v.tier === "accelerate"
                            return (
                                <div
                                    key={v.tier}
                                    className={cn(
                                        "rounded-lg border p-4 flex flex-col",
                                        isRecommended
                                            ? "border-brand-400 bg-brand-50/40"
                                            : "border-stone-200 bg-white"
                                    )}
                                >
                                    <div className="flex items-baseline justify-between">
                                        <span className="font-medium text-stone-900">{meta?.name || v.tier}</span>
                                        <span className="font-serif text-xl text-stone-900">{meta?.price}</span>
                                    </div>
                                    <div className="text-xs text-stone-500 mt-1">
                                        {v.clustersPerMonth} cluster{v.clustersPerMonth === 1 ? "" : "s"} / month
                                    </div>
                                    <div className="text-sm text-stone-700 mt-3">
                                        Done in <strong className="font-medium">{v.months} months</strong>
                                    </div>
                                    {onStartProgram && (
                                        <Button
                                            className="mt-4 w-full"
                                            variant={isRecommended ? "default" : "outline"}
                                            disabled={isStarting}
                                            onClick={() => onStartProgram(v.tier as "close" | "accelerate" | "dominate")}
                                        >
                                            {isStarting ? "Starting…" : "Start"}
                                        </Button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* --- Clusters --- */}
            <div>
                <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-serif text-xl text-stone-900">
                        {showAllClusters ? "All clusters" : "Your program"}
                    </h3>
                    {remainder.length > 0 && (
                        <button
                            onClick={() => setShowAllClusters(!showAllClusters)}
                            className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1"
                        >
                            {showAllClusters
                                ? "Show program only"
                                : `Show ${remainder.length} lower-priority clusters`}
                            {showAllClusters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                    {visibleClusters.map((cluster, i) => {
                        const isRecommended = scope.recommendedClusterIds.includes(cluster.id)
                        return (
                            <div
                                key={cluster.id}
                                className={cn(
                                    "rounded-lg border p-4 flex items-start gap-4",
                                    isRecommended ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-50 opacity-60"
                                )}
                            >
                                <div className="font-serif text-lg text-stone-400 w-6 shrink-0">{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-stone-900 text-sm">{cluster.name}</div>
                                    <div className="text-xs text-stone-500 mt-1">
                                        {cluster.articleCount} articles
                                        {cluster.competitorUrls.length > 0 && (
                                            <> · {cluster.competitorUrls.length} competitor pages own these</>
                                        )}
                                    </div>
                                </div>
                                {!isRecommended && (
                                    <span className="text-[10px] uppercase tracking-wide text-stone-400 shrink-0">
                                        Later
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* --- Evidence: the falsifiable part --- */}
            <div>
                <button
                    onClick={() => setShowEvidence(!showEvidence)}
                    className="flex items-center gap-2 mb-3 group"
                >
                    <h3 className="font-serif text-xl text-stone-900">The evidence</h3>
                    {showEvidence ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <p className="text-sm text-stone-500 mb-4">
                    Each row links to the page the query was observed on, and the competitor pages
                    currently answering it. If a link doesn&rsquo;t back the claim, tell us — that&rsquo;s a bug.
                </p>

                {showEvidence && (
                    <div className="overflow-x-auto rounded-lg border border-stone-200">
                        <table className="w-full text-sm min-w-[640px]">
                            <thead className="bg-stone-50 text-stone-500">
                                <tr>
                                    <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Query</th>
                                    <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Seen on</th>
                                    <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Competitors</th>
                                    <th className="text-left font-medium px-4 py-2.5 text-xs uppercase tracking-wide">You</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gaps.slice(0, 40).map((gap, i) => (
                                    <tr key={i} className="border-t border-stone-100 align-top">
                                        <td className="px-4 py-3 text-stone-900">{gap.query}</td>
                                        <td className="px-4 py-3">
                                            {gap.sourceUrl ? (
                                                <a
                                                    href={gap.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-brand-600 hover:underline inline-flex items-center gap-1 text-xs break-all"
                                                >
                                                    {new URL(gap.sourceUrl).hostname.replace("www.", "")}
                                                    <ExternalLink size={11} className="shrink-0" />
                                                </a>
                                            ) : (
                                                <span className="text-xs text-red-600">missing — bug</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {gap.competitors.length === 0 ? (
                                                <span className="text-xs text-stone-400">none</span>
                                            ) : (
                                                <div className="space-y-1">
                                                    {gap.competitors.slice(0, 2).map((c, j) => (
                                                        <a
                                                            key={j}
                                                            href={c.matchedUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-brand-600 hover:underline flex items-center gap-1 text-xs"
                                                        >
                                                            <Link2 size={11} className="shrink-0" />
                                                            {c.name}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {gap.status === "partial" ? (
                                                <span className="text-xs text-amber-600 inline-flex items-center gap-1">
                                                    <CheckCircle2 size={11} /> partial
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-400">not covered</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {gaps.length > 40 && (
                            <div className="px-4 py-2.5 text-xs text-stone-500 bg-stone-50 border-t border-stone-100">
                                Showing 40 of {gaps.length} gaps.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
