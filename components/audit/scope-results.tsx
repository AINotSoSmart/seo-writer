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
    FileText,
    Gauge,
    Layers,
    Link2,
} from "lucide-react"

import type {
    AuditScope,
    GapEvidence,
    PlannedArticleRow,
    ProgramProgress,
} from "@/actions/harvest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ScopeResults({
    scope,
    gaps,
    brandName,
    progress,
    articles = [],
    showShareLink = true,
}: {
    scope: AuditScope
    gaps: GapEvidence[]
    brandName: string
    progress?: ProgramProgress | null
    articles?: PlannedArticleRow[]
    showShareLink?: boolean
}) {
    const [showAllClusters, setShowAllClusters] = useState(false)
    const [showEvidence, setShowEvidence] = useState(true)
    const [copied, setCopied] = useState(false)
    const [expandedClusterIds, setExpandedClusterIds] = useState<Set<string>>(
        () => new Set(scope.recommendedClusterIds),
    )
    const recommended = scope.clusters.filter((cluster) =>
        scope.recommendedClusterIds.includes(cluster.id),
    )
    const recommendedFamilyCount = new Set(
        recommended.map((cluster) => cluster.scopeFamilyId),
    ).size
    const remainder = scope.clusters.filter(
        (cluster) => !scope.recommendedClusterIds.includes(cluster.id),
    )
    const visibleClusters = showAllClusters ? scope.clusters : recommended
    const gapById = new Map(gaps.map((gap) => [gap.id, gap]))

    const toggleCluster = (clusterId: string) => {
        setExpandedClusterIds((current) => {
            const next = new Set(current)
            if (next.has(clusterId)) next.delete(clusterId)
            else next.add(clusterId)
            return next
        })
    }

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

            {/*
              * Never shown to someone who has already bought. After purchase every
              * cluster is "sold", so the eligibility check returns zero remaining —
              * which is about buying ANOTHER program, not about this audit being
              * deficient. Rendering it unguarded told a paying customer their scope
              * was ineligible directly above the articles they had just paid for.
              */}
            {!scope.checkoutEligible && !scope.hasActiveProgram && !progress && (
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
                    label={scope.hasActiveProgram ? "Your program" : "Program scope"}
                    value={scope.recommendedArticleCount}
                    detail={`${recommended.length} clusters across confirmed business areas`}
                />
            </div>

            {progress && <ProgramBurnDown progress={progress} />}

            <section>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h3 className="font-serif text-xl text-stone-900">
                            {showAllClusters ? "All measured clusters" : "Your six-cluster program"}
                        </h3>
                        <p className="mt-1 text-sm text-stone-500">
                            {scope.hasActiveProgram ? (
                                <>
                                    Your program covers {scope.recommendedArticleCount} articles
                                    across {recommendedFamilyCount} confirmed business{" "}
                                    {recommendedFamilyCount === 1 ? "area" : "areas"}. Clusters are
                                    delivered complete, in priority order.
                                </>
                            ) : (
                                <>
                                    The selected six contain {scope.recommendedArticleCount}{" "}
                                    articles. They cover {recommendedFamilyCount} confirmed business{" "}
                                    {recommendedFamilyCount === 1 ? "area" : "areas"}. Review every
                                    title and its supporting searches before choosing a delivery
                                    speed.
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() =>
                                setExpandedClusterIds(
                                    new Set(visibleClusters.map((cluster) => cluster.id)),
                                )
                            }
                            className="text-xs font-medium text-stone-600 hover:text-stone-950"
                        >
                            Expand all articles
                        </button>
                        <button
                            type="button"
                            onClick={() => setExpandedClusterIds(new Set())}
                            className="text-xs font-medium text-stone-600 hover:text-stone-950"
                        >
                            Collapse all
                        </button>
                        {remainder.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowAllClusters((value) => !value)}
                                className="flex items-center gap-1 text-xs font-medium text-brand-600"
                            >
                                {showAllClusters
                                    ? "Show six-cluster program"
                                    : `Show ${remainder.length} additional clusters`}
                                {showAllClusters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    {visibleClusters.map((cluster, index) => {
                        const selected = scope.recommendedClusterIds.includes(cluster.id)
                        const expanded = expandedClusterIds.has(cluster.id)
                        const clusterArticles = articles.filter(
                            (article) => article.clusterId === cluster.id,
                        )
                        return (
                            <article
                                key={cluster.id}
                                className={cn(
                                    "overflow-hidden rounded-lg border",
                                    selected
                                        ? "border-stone-200 bg-white"
                                        : "border-stone-200 bg-stone-50 opacity-65",
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleCluster(cluster.id)}
                                    className="flex w-full items-start gap-4 p-4 text-left"
                                    aria-expanded={expanded}
                                >
                                <div className="w-6 font-serif text-lg text-stone-400">
                                    {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                                            {cluster.scopeFamilyName}
                                        </span>
                                        <span className="text-sm font-medium text-stone-900">
                                            {cluster.name}
                                        </span>
                                        {selected && (
                                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                                                Program cluster
                                            </span>
                                        )}
                                    </div>
                                    {cluster.description && (
                                        <p className="mt-1 text-xs leading-relaxed text-stone-500">
                                            {cluster.description}
                                        </p>
                                    )}
                                    <div className="mt-1 text-xs text-stone-500">
                                        {cluster.articleCount} articles ·{" "}
                                        {cluster.qualified ? "qualified" : "outside program limits"}
                                    </div>
                                </div>
                                {expanded ? (
                                    <ChevronUp className="mt-1 h-4 w-4 text-stone-400" />
                                ) : (
                                    <ChevronDown className="mt-1 h-4 w-4 text-stone-400" />
                                )}
                                </button>
                                {expanded && (
                                    <div className="border-t border-stone-100 bg-stone-50/40 px-4 py-3 sm:px-6">
                                        {clusterArticles.length === 0 ? (
                                            <p className="py-3 text-sm text-amber-700">
                                                The cluster says it contains {cluster.articleCount} articles,
                                                but no article rows were returned. Treat this as an audit data bug.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {clusterArticles.map((article, articleIndex) => {
                                                    const scopeMismatch =
                                                        article.scopeFamilyId !==
                                                        cluster.scopeFamilyId
                                                    const articleEvidence = article.sourceQueryIds
                                                        .map((id) => gapById.get(id))
                                                        .filter(
                                                            (gap): gap is GapEvidence =>
                                                                Boolean(gap),
                                                        )
                                                    return (
                                                        <div
                                                            key={article.id}
                                                            className="rounded-md border border-stone-200 bg-white p-3"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="text-xs text-stone-400">
                                                                            {String(articleIndex + 1).padStart(2, "0")}
                                                                        </span>
                                                                        {article.isPillar && (
                                                                            <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                                                                Pillar
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <h4 className="mt-1 text-sm font-medium text-stone-900">
                                                                        {article.title}
                                                                    </h4>
                                                                    {scopeMismatch && (
                                                                        <p className="mt-1 text-xs font-medium text-red-600">
                                                                            This article crossed confirmed business
                                                                            areas. Treat this as an audit data bug.
                                                                        </p>
                                                                    )}
                                                                    <p className="mt-1 text-xs text-stone-500">
                                                                        Primary search: {article.mainKeyword}
                                                                    </p>
                                                                    {article.supportingKeywords.length > 0 && (
                                                                        <p className="mt-1 text-xs text-stone-500">
                                                                            Supports:{" "}
                                                                            {article.supportingKeywords.join(", ")}
                                                                        </p>
                                                                    )}
                                                                    <details className="mt-2">
                                                                        <summary className="cursor-pointer text-xs font-medium text-brand-600">
                                                                            Inspect {articleEvidence.length} source-linked
                                                                            search{articleEvidence.length === 1 ? "" : "es"}
                                                                        </summary>
                                                                        <div className="mt-2 grid gap-1.5">
                                                                            {articleEvidence.length > 0 ? (
                                                                                articleEvidence.map((gap) => (
                                                                                    <EvidenceLink
                                                                                        key={gap.id}
                                                                                        gap={gap}
                                                                                    />
                                                                                ))
                                                                            ) : (
                                                                                <span className="text-xs text-red-600">
                                                                                    No supporting evidence rows were returned.
                                                                                    Treat this as an audit data bug.
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </details>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
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

            {!progress && scope.checkoutEligible && (
                <section className="rounded-xl border border-stone-200 bg-stone-50 p-5">
                    <h3 className="font-serif text-xl text-stone-900">
                        Finished inspecting the scope?
                    </h3>
                    <p className="mb-4 mt-1 text-sm text-stone-500">
                        Every tier freezes and delivers these same six clusters. Only the
                        delivery cadence changes.
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
                            </div>
                        ))}
                    </div>
                    <Button
                        className="mt-4"
                        onClick={() => {
                            window.location.href = "/subscribe"
                        }}
                    >
                        Confirm URLs and view pricing
                    </Button>
                </section>
            )}
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

function EvidenceLink({ gap }: { gap: GapEvidence }) {
    return (
        <div className="flex flex-col gap-1 rounded border border-stone-100 bg-stone-50 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-stone-700">{gap.observedValue}</span>
            {gap.sourceUrl ? (
                <a
                    href={gap.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"
                >
                    Open observed source
                    <ExternalLink size={10} />
                </a>
            ) : (
                <span className="text-[11px] text-red-600">Missing source</span>
            )}
        </div>
    )
}

function EvidenceTable({ gaps }: { gaps: GapEvidence[] }) {
    const [showAll, setShowAll] = useState(false)
    const visibleGaps = showAll ? gaps : gaps.slice(0, 40)

    return (
        <div>
            <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-medium">Observed search</th>
                            <th className="px-4 py-2.5 text-left font-medium">Observed source</th>
                            <th className="px-4 py-2.5 text-left font-medium">Competitors</th>
                            <th className="px-4 py-2.5 text-left font-medium">Current coverage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleGaps.map((gap) => (
                            <tr key={gap.id} className="border-t align-top">
                                <td className="px-4 py-3 text-stone-900">
                                    {gap.observedValue}
                                </td>
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
            {gaps.length > 40 && (
                <button
                    type="button"
                    onClick={() => setShowAll((value) => !value)}
                    className="mt-3 text-xs font-medium text-brand-600"
                >
                    {showAll
                        ? "Show first 40 evidence rows"
                        : `Show all ${gaps.length} evidence rows`}
                </button>
            )}
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
