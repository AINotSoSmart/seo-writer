"use client"

import { useState } from "react"
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Copy,
    ExternalLink,
    Gauge,
    Layers,
    Link2,
} from "lucide-react"

import type { AuditScope, GapEvidence, ProgramProgress } from "@/actions/harvest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ScopeResults({
    scope,
    gaps,
    brandName,
    progress,
    showShareLink = true,
}: {
    scope: AuditScope
    gaps: GapEvidence[]
    brandName: string
    progress?: ProgramProgress | null
    showShareLink?: boolean
}) {
    const [showAllClusters, setShowAllClusters] = useState(false)
    const [showEvidence, setShowEvidence] = useState(true)
    const [copied, setCopied] = useState(false)
    const recommended = scope.clusters.filter((cluster) =>
        scope.recommendedClusterIds.includes(cluster.id),
    )
    const remainder = scope.clusters.filter(
        (cluster) => !scope.recommendedClusterIds.includes(cluster.id),
    )
    const visibleClusters = showAllClusters ? scope.clusters : recommended

    return (
        <div className="w-full space-y-8">
            <header>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <h2 className="font-serif text-3xl tracking-tight text-stone-900 md:text-4xl">
                        {brandName}:{" "}
                        <span className="text-brand-600">{scope.articleCount} planned articles</span>{" "}
                        across {scope.clusterCount} measured clusters
                    </h2>
                    {showShareLink && scope.publicToken && (
                        <Button
                            variant="outline"
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
                <p className="mt-2 text-sm text-stone-500">
                    Measured from {scope.poolSize} observed search queries. Each evidence row
                    links to the source where it was found.
                </p>
            </header>

            {!scope.checkoutEligible && (
                <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div className="text-sm text-amber-950">
                        <strong className="font-medium">Not eligible for a program yet.</strong>{" "}
                        {scope.eligibilityReason} This evidence can still be shared or refreshed
                        after the business adds products, services, or markets. No checkout is
                        offered for this scope.
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <Stat
                    icon={Gauge}
                    label="Current coverage"
                    value={`${scope.authorityScore}%`}
                    detail="matched against live pages"
                />
                <Stat
                    icon={Layers}
                    label="Measured clusters"
                    value={scope.clusterCount}
                    detail="qualified clusters contain 3–15 articles"
                />
                <Stat
                    icon={CalendarClock}
                    label="Program scope"
                    value={scope.recommendedArticleCount}
                    detail={`${recommended.length} highest-priority qualified clusters`}
                />
            </div>

            {progress && <ProgramBurnDown progress={progress} />}

            {!progress && scope.checkoutEligible && (
                <section>
                    <h3 className="font-serif text-xl text-stone-900">Choose delivery speed</h3>
                    <p className="mb-4 mt-1 text-sm text-stone-500">
                        Every tier delivers the same six clusters. Only the cadence changes.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {scope.velocity.map((velocity) => (
                            <div
                                key={velocity.tier}
                                className={cn(
                                    "rounded-lg border bg-white p-4",
                                    velocity.tier === "accelerate"
                                        ? "border-brand-400 bg-brand-50/40"
                                        : "border-stone-200",
                                )}
                            >
                                <div className="font-medium capitalize text-stone-900">
                                    {velocity.tier}
                                </div>
                                <p className="mt-1 text-xs text-stone-500">
                                    {velocity.clustersPerMonth} complete cluster
                                    {velocity.clustersPerMonth === 1 ? "" : "s"} per month
                                </p>
                                <p className="mt-3 text-sm text-stone-700">
                                    Approximately {velocity.months} month
                                    {velocity.months === 1 ? "" : "s"} to deliver
                                </p>
                                <Button
                                    className="mt-4 w-full"
                                    variant={
                                        velocity.tier === "accelerate" ? "default" : "outline"
                                    }
                                    onClick={() => {
                                        window.location.href = "/subscribe"
                                    }}
                                >
                                    Confirm URLs and pricing
                                </Button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <div className="mb-3 flex items-baseline justify-between">
                    <h3 className="font-serif text-xl text-stone-900">
                        {showAllClusters ? "All measured clusters" : "Priority program scope"}
                    </h3>
                    {remainder.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowAllClusters((value) => !value)}
                            className="flex items-center gap-1 text-xs text-stone-500"
                        >
                            {showAllClusters
                                ? "Show program scope"
                                : `Show ${remainder.length} additional clusters`}
                            {showAllClusters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                    )}
                </div>
                <div className="space-y-2">
                    {visibleClusters.map((cluster, index) => {
                        const selected = scope.recommendedClusterIds.includes(cluster.id)
                        return (
                            <div
                                key={cluster.id}
                                className={cn(
                                    "flex items-start gap-4 rounded-lg border p-4",
                                    selected
                                        ? "border-stone-200 bg-white"
                                        : "border-stone-200 bg-stone-50 opacity-65",
                                )}
                            >
                                <div className="w-6 font-serif text-lg text-stone-400">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-stone-900">
                                        {cluster.name}
                                    </div>
                                    <div className="mt-1 text-xs text-stone-500">
                                        {cluster.articleCount} articles ·{" "}
                                        {cluster.qualified ? "qualified" : "outside program limits"}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            <section>
                <button
                    type="button"
                    onClick={() => setShowEvidence((value) => !value)}
                    className="mb-3 flex items-center gap-2"
                >
                    <h3 className="font-serif text-xl text-stone-900">Source-linked evidence</h3>
                    {showEvidence ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <p className="mb-4 text-sm text-stone-500">
                    If a source does not support its observed query, that is a data bug.
                </p>
                {showEvidence && <EvidenceTable gaps={gaps} />}
            </section>
        </div>
    )
}

function Stat({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: React.ElementType
    label: string
    value: string | number
    detail: string
}) {
    return (
        <div className="min-w-40 flex-1 rounded-lg border border-stone-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-stone-500">
                <Icon size={15} />
                <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
            </div>
            <div className="font-serif text-3xl leading-none text-stone-900">{value}</div>
            <div className="mt-1.5 text-xs text-stone-500">{detail}</div>
        </div>
    )
}

function ProgramBurnDown({ progress }: { progress: ProgramProgress }) {
    const delivered = progress.scopeStatus === "scope_delivered"
    return (
        <section className="rounded-lg border border-stone-200 bg-stone-50 p-5">
            <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm font-medium text-stone-900">
                    {delivered
                        ? "Program scope delivered"
                        : `${progress.deliveredCount} of ${progress.totalArticles} delivered`}
                </span>
                <span className="text-xs text-stone-500">
                    {delivered
                        ? "All six program clusters delivered"
                        : `About ${progress.monthsRemaining} month${progress.monthsRemaining === 1 ? "" : "s"} remaining`}
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div
                    className="h-full bg-brand-500"
                    style={{ width: `${progress.percentComplete}%` }}
                />
            </div>
            <p className="mt-3 text-xs text-stone-600">
                Generated {progress.generatedCount}/{progress.totalArticles} · Delivered{" "}
                {progress.deliveredCount}/{progress.totalArticles} · Published{" "}
                {progress.publishedCount}/{progress.totalArticles}
            </p>
            {delivered && (
                <p className="mt-2 text-xs text-stone-600">
                    All six clusters in this program have been delivered.
                    {progress.additionalQualifiedClustersAvailable
                        ? " Additional qualified clusters remain available for a future program."
                        : ""}
                </p>
            )}
        </section>
    )
}

function EvidenceTable({ gaps }: { gaps: GapEvidence[] }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                        <th className="px-4 py-2.5 text-left font-medium">Query</th>
                        <th className="px-4 py-2.5 text-left font-medium">Observed source</th>
                        <th className="px-4 py-2.5 text-left font-medium">Competitors</th>
                        <th className="px-4 py-2.5 text-left font-medium">Current coverage</th>
                    </tr>
                </thead>
                <tbody>
                    {gaps.slice(0, 40).map((gap) => (
                        <tr key={`${gap.query}:${gap.sourceUrl}`} className="border-t align-top">
                            <td className="px-4 py-3 text-stone-900">{gap.query}</td>
                            <td className="px-4 py-3">
                                {gap.sourceUrl ? (
                                    <a
                                        href={gap.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                                    >
                                        {safeHostname(gap.sourceUrl)}
                                        <ExternalLink size={11} />
                                    </a>
                                ) : (
                                    <span className="text-xs text-red-600">Missing source</span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                {gap.competitors.slice(0, 2).map((competitor) => (
                                    <a
                                        key={competitor.matchedUrl}
                                        href={competitor.matchedUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1 text-xs text-brand-600"
                                    >
                                        <Link2 size={11} />
                                        {competitor.name}
                                    </a>
                                ))}
                            </td>
                            <td className="px-4 py-3 text-xs text-stone-500">
                                {gap.status === "partial" ? (
                                    <span className="inline-flex items-center gap-1 text-amber-700">
                                        <CheckCircle2 size={11} /> Partial
                                    </span>
                                ) : (
                                    "Not covered"
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function safeHostname(value: string) {
    try {
        return new URL(value).hostname.replace(/^www\./, "")
    } catch {
        return "source"
    }
}
