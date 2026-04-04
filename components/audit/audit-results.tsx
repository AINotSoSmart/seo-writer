"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    TrendingUp,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Zap,
    Target,
    ArrowRight,
    CheckCircle2,
    XCircle,
    Users,
    Eye,
    Link2,
    Download,
    Share2,
    BarChart3,
    LayoutDashboard
} from "lucide-react"
import { TopicalAuditResult, GapItem, CompetitorMatch, PillarScore } from "@/lib/audit/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AuditResultsProps {
    auditResult: TopicalAuditResult
    brandName: string
    onGeneratePlan: () => void
    isGeneratingPlan?: boolean
}

// --- Utility Functions ---

function getScoreColor(score: number): string {
    if (score < 25) return "text-rose-600"
    if (score < 50) return "text-amber-600"
    if (score < 70) return "text-yellow-600"
    return "text-emerald-600"
}

function getScoreBgColor(score: number): string {
    if (score < 25) return "bg-rose-50 text-rose-700 border-rose-200"
    if (score < 50) return "bg-amber-50 text-amber-700 border-amber-200"
    if (score < 70) return "bg-yellow-50 text-yellow-700 border-yellow-200"
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
}

function getScoreBarColor(score: number): string {
    if (score < 25) return "bg-rose-500"
    if (score < 50) return "bg-amber-500"
    if (score < 70) return "bg-yellow-500"
    return "bg-emerald-500"
}

function getScoreLabel(score: number): string {
    if (score < 15) return "Critical"
    if (score < 30) return "Weak"
    if (score < 50) return "Below Average"
    if (score < 70) return "Moderate"
    if (score < 85) return "Good"
    return "Excellent"
}

// --- Sub-components ---

function KPICard({ title, value, subtext, icon: Icon, trend, className }: { title: string, value: string | number, subtext?: string | React.ReactNode, icon?: any, trend?: { val: string, up: boolean }, className?: string }) {
    return (
        <div className={cn("bg-white rounded-xl border border-stone-200 p-5 shadow-xs", className)}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-stone-500">{title}</span>
                {Icon && <Icon className="w-5 h-5 text-stone-400" />}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-stone-900 tracking-tight">{value}</span>
                {trend && (
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5", trend.up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                        {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                        {trend.val}
                    </span>
                )}
            </div>
            {subtext && <div className="mt-2 text-xs text-stone-500">{subtext}</div>}
        </div>
    )
}

function CompetitorBar({ name, score, max, colorClass, label }: { name: string, score: number, max: number, colorClass?: string, label?: string }) {
    const width = Math.max((score / max) * 100, 2)
    return (
        <div className="flex items-center gap-3 text-sm">
            <div className="w-32 truncate font-medium text-stone-700 shrink-0" title={name}>{name}</div>
            <div className="flex-1 h-2.5 bg-stone-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full", colorClass || "bg-stone-400")}
                />
            </div>
            <div className="w-12 text-right text-xs font-mono text-stone-500">{label || score}</div>
        </div>
    )
}

// --- Main Component ---

export function AuditResults({
    auditResult,
    brandName,
    onGeneratePlan,
    isGeneratingPlan = false
}: AuditResultsProps) {
    const [expandedPillar, setExpandedPillar] = useState<string | null>(null)
    const [showAllCriticalGaps, setShowAllCriticalGaps] = useState(false)

    const {
        authority_score,
        pillar_scores,
        gap_matrix,
        competitor_coverages,
        user_coverage,
        niche_blueprint,
        projected_score_after_plan,
        audit_meta
    } = auditResult

    const totalTopics = gap_matrix.length
    const userCoveredTopics = gap_matrix.filter(g => g.user_covered).length
    const uncoveredGaps = gap_matrix.filter(g => !g.user_covered)
    const criticalGaps = uncoveredGaps.filter(g => g.importance === "critical")
    const competitorAvgCoverage = competitor_coverages.length > 0
        ? Math.round(competitor_coverages.reduce((acc, c) => acc + (gap_matrix.filter(g => g.competitors_covering.includes(c.site_name)).length), 0) / competitor_coverages.length)
        : 0
    const competitorMaxCoverage = competitor_coverages.length > 0
        ? Math.max(...competitor_coverages.map(c => gap_matrix.filter(g => g.competitors_covering.includes(c.site_name)).length))
        : 0

    // Sort pillars by opportunity (lowest score first)
    const sortedPillars = [...pillar_scores].sort((a, b) => a.user_score - b.user_score)

    return (
        <div className="space-y-8 font-sans text-stone-900 pb-12">
            {/* --- Header --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
                        <LayoutDashboard className="w-6 h-6 text-stone-400" />
                        Topical Authority Audit
                    </h1>
                    <p className="text-stone-500 text-sm mt-1">
                        Analysis for <span className="font-semibold text-stone-700">{brandName}</span> • {new Date().toLocaleDateString()}
                    </p>
                </div>
                <div className="flex items-center gap-3">

                    <Button
                        onClick={onGeneratePlan}
                        disabled={isGeneratingPlan}
                        className="bg-stone-900 hover:bg-stone-800 text-white gap-2 shadow-xs"
                    >
                        {isGeneratingPlan ? (
                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating Plan...</>
                        ) : (
                            <>Generate Content Plan <ArrowRight className="w-4 h-4" /></>
                        )}
                    </Button>
                </div>
            </div>

            {/* --- KPI Grid --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard
                    title="Authority Score"
                    value={authority_score}
                    icon={Shield}
                    trend={{ val: "Beta", up: true }}
                    subtext={
                        <span className="flex items-center gap-1.5">
                            Rank: <span className={cn("font-medium", getScoreColor(authority_score))}>{getScoreLabel(authority_score)}</span>
                        </span>
                    }
                    className="md:col-span-1"
                />
                <KPICard
                    title="Topic Coverage"
                    value={`${Math.round((userCoveredTopics / totalTopics) * 100)}%`}
                    icon={Target}
                    subtext={
                        <span className="text-stone-500">
                            You cover <strong>{userCoveredTopics}</strong> of <strong>{totalTopics}</strong> required topics
                        </span>
                    }
                />
                <KPICard
                    title="Market Opportunity"
                    value={uncoveredGaps.length}
                    icon={Zap}
                    subtext={
                        <span className="text-rose-600 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {criticalGaps.length} Critical Gaps
                        </span>
                    }
                />
            </div>

            {/* --- Main Intelligence Layout --- */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Left Col: Competitive Landscape (8 cols) */}
                <div className="xl:col-span-8 bg-white border border-stone-200 rounded-xl p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-stone-400" />
                            Competitive Landscape
                        </h3>
                        <span className="text-xs text-stone-400 bg-stone-50 px-2 py-1 rounded-full border border-stone-100">
                            Based on {audit_meta.competitors_scanned} competitors
                        </span>
                    </div>

                    <div className="space-y-5">
                        <CompetitorBar
                            name="Your Brand"
                            score={userCoveredTopics}
                            max={totalTopics}
                            colorClass={getScoreBarColor(authority_score)}
                            label={`${Math.round((userCoveredTopics / totalTopics) * 100)}%`}
                        />
                        {/* Divider */}
                        <div className="h-px bg-stone-100 my-2" />

                        {competitor_coverages.slice(0, 5).map((comp, i) => {
                            const count = gap_matrix.filter(g => g.competitors_covering.includes(comp.site_name)).length
                            return (
                                <CompetitorBar
                                    key={i}
                                    name={comp.site_name}
                                    score={count}
                                    max={totalTopics}
                                    colorClass="bg-stone-300"
                                    label={`${Math.round((count / totalTopics) * 100)}%`}
                                />
                            )
                        })}
                    </div>

                    <div className="mt-8 p-4 bg-stone-50 rounded-lg border border-stone-100 flex items-start gap-3">
                        <div className="bg-white p-1.5 rounded-md shadow-xs border border-stone-100 shrink-0">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-stone-900">Projected Growth</p>
                            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                Filling your {uncoveredGaps.length} gaps is projected to increase your Authority Score from{" "}
                                <span className="font-bold text-stone-900">{authority_score}</span> to{" "}
                                <span className="font-bold text-emerald-600">{projected_score_after_plan}</span>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Col: Critical Gaps (4 cols) */}
                <div className="xl:col-span-4 bg-white border border-stone-200 rounded-xl p-6 shadow-xs flex flex-col h-full">
                    <h3 className="text-lg font-semibold mb-1 text-rose-700 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Critical Gaps
                    </h3>
                    <p className="text-xs text-stone-500 mb-4">High-impact topics you're missing.</p>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[340px]">
                        {(showAllCriticalGaps ? criticalGaps : criticalGaps.slice(0, 8)).map((gap, i) => (
                            <div key={i} className="group p-3 rounded-lg border border-transparent hover:border-rose-100 hover:bg-rose-50/50 transition-all">
                                <div className="flex justify-between items-start gap-2">
                                    <span className="text-sm font-medium text-stone-800 group-hover:text-rose-900 leading-snug">
                                        {gap.topic}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-100">
                                        {gap.pillar}
                                    </span>
                                    {gap.competitor_matches && gap.competitor_matches.length > 0 && (
                                        <a
                                            href={gap.competitor_matches[0].matched_page_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] text-stone-400 flex items-center gap-1 hover:text-rose-600 transition-colors"
                                        >
                                            Covered by {gap.competitor_matches[0].competitor_name}
                                            <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {criticalGaps.length > 8 && (
                        <div className="pt-4 mt-auto border-t border-stone-100 text-center">
                            <button 
                                onClick={() => setShowAllCriticalGaps(!showAllCriticalGaps)}
                                className="text-xs font-medium text-stone-500 hover:text-stone-900"
                            >
                                {showAllCriticalGaps ? "View fewer critical gaps" : `View all ${criticalGaps.length} critical gaps`}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Pillar Breakdown Table --- */}
            <div className="bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden">
                <div className="p-6 border-b border-stone-100 bg-stone-50/30">
                    <h3 className="text-lg font-semibold text-stone-900">Content Strategy Breakdown</h3>
                    <p className="text-sm text-stone-500 mt-1">Detailed analysis of your topical authority.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-stone-50 text-stone-500 border-b border-stone-200">
                            <tr>
                                <th className="px-6 py-3 font-medium w-1/3">Content Category</th>
                                <th className="px-6 py-3 font-medium w-32 text-center">Your Score</th>
                                <th className="px-6 py-3 font-medium w-32 text-center">Gap Count</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {sortedPillars.map((pillar) => {
                                const pillarGaps = gap_matrix.filter(g => g.pillar === pillar.pillar && !g.user_covered)
                                const isExpanded = expandedPillar === pillar.pillar

                                return (
                                    <React.Fragment key={pillar.pillar}>
                                        <tr
                                            className={cn("hover:bg-stone-50 transition-colors cursor-pointer", isExpanded ? "bg-stone-50/80" : "")}
                                            onClick={() => setExpandedPillar(isExpanded ? null : pillar.pillar)}
                                        >
                                            <td className="px-6 py-4 font-medium text-stone-900">
                                                {pillar.pillar}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={cn("font-bold", getScoreColor(pillar.user_score))}>
                                                    {pillar.user_score}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-stone-500">
                                                {pillarGaps.length}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn("text-xs font-medium px-2 py-1 rounded-full border", getScoreBgColor(pillar.user_score))}>
                                                    {getScoreLabel(pillar.user_score)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isExpanded ? <ChevronUp className="w-4 h-4 ml-auto text-stone-400" /> : <ChevronDown className="w-4 h-4 ml-auto text-stone-400" />}
                                            </td>
                                        </tr>
                                        {/* Expanded Details Row */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <tr className="bg-stone-50/30 shadow-inner">
                                                    <td colSpan={5} className="px-6 py-4">
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                        >
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="space-y-3">
                                                                    <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Top Missing Topics</h4>
                                                                    <ul className="space-y-2">
                                                                        {pillarGaps.slice(0, 5).map((gap, i) => (
                                                                            <li key={i} className="flex items-start gap-2 text-xs">
                                                                                <XCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                                                                                <span className="text-stone-700">{gap.topic}</span>
                                                                            </li>
                                                                        ))}
                                                                        {pillarGaps.length === 0 && (
                                                                            <li className="text-xs text-emerald-600 flex items-center gap-2">
                                                                                <CheckCircle2 className="w-3.5 h-3.5" /> All topics covered!
                                                                            </li>
                                                                        )}
                                                                    </ul>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Strategy</h4>
                                                                    <div className="text-xs text-stone-600 bg-white p-3 rounded border border-stone-200">
                                                                        To improve your {pillar.user_score}/100 score in <strong>{pillar.pillar}</strong>, you need to publish content addressing the missing topics.
                                                                        {pillar.best_competitor_score > pillar.user_score && (
                                                                            <span className="block mt-1 text-stone-400">
                                                                                Competitors average {pillar.best_competitor_score} in this pillar.
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </td>
                                                </tr>
                                            )}
                                        </AnimatePresence>
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- Sticky CTA Mobile / Bottom Access --- */}
            <div className="flex justify-center pt-8">
                <Button
                    onClick={onGeneratePlan}
                    disabled={isGeneratingPlan}
                    size="lg"
                    className="bg-stone-900 hover:bg-stone-800 text-white gap-2 shadow-lg hover:shadow-xl transition-all w-full md:w-auto md:px-12 h-14 text-lg"
                >
                    {isGeneratingPlan ? (
                        <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Working...</>
                    ) : (
                        <>Start My First Recovery Plan <ArrowRight className="w-5 h-5" /></>
                    )}
                </Button>
            </div>
        </div>
    )
}
