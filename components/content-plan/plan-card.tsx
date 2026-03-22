"use client"

import { useState, memo } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
    Calendar,
    Sparkles,
    TrendingUp,
    Zap,
    Target,
    PenTool,
    SquarePen,
    CheckCircle2,
    Loader2,
    FileText,
    BookOpen,
    BarChart3,
    MousePointerClick,
    Search,
    Feather,
    Lightbulb,
    Gauge,
    Tag,
} from "lucide-react"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// Badge and type configs
const BADGE_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
    high_impact: {
        label: "High Impact",
        icon: Sparkles,
        className: "text-stone-900 border-stone-200 bg-stone-50"
    },
    quick_win: {
        label: "Quick Win",
        icon: Zap,
        className: "text-stone-900 border-stone-200 bg-stone-50"
    },
    low_ctr: {
        label: "Low CTR",
        icon: MousePointerClick,
        className: "text-stone-900 border-stone-200 bg-stone-50"
    },
    new_opportunity: {
        label: "New Opportunity",
        icon: Target,
        className: "text-stone-900 border-stone-200 bg-stone-50"
    },
}

const ARTICLE_TYPE_CONFIG: Record<string, { label: string; icon: any }> = {
    informational: { label: "Informational", icon: FileText },
    commercial: { label: "Commercial", icon: BarChart3 },
    howto: { label: "How-To", icon: BookOpen },
}

interface PlanCardProps {
    item: ContentPlanItem
    isUrgent?: boolean
    isEditing: boolean
    hasCredits: boolean
    onStartEdit: () => void
    onCancelEdit: () => void
    onSaveEdit: (updates: Partial<ContentPlanItem>) => void
    onWriteArticle: () => void
}

// Separate EditForm component with its own local state
const EditForm = memo(function EditForm({
    item,
    onCancel,
    onSave
}: {
    item: ContentPlanItem
    onCancel: () => void
    onSave: (updates: Partial<ContentPlanItem>) => void
}) {
    // Local state for the edit form - this prevents parent re-renders
    const [localForm, setLocalForm] = useState({
        title: item.title || "",
        main_keyword: item.main_keyword || "",
        article_type: item.article_type || "informational",
        // Store as raw string for better typing experience
        supporting_keywords_raw: (item.supporting_keywords || []).join(", "),
        user_instructions: item.user_instructions || "",
    })

    const handleSave = () => {
        // Split keywords only on save
        const keywords = localForm.supporting_keywords_raw
            .split(",")
            .map(k => k.trim())
            .filter(k => k.length > 0)

        onSave({
            title: localForm.title,
            main_keyword: localForm.main_keyword,
            article_type: localForm.article_type,
            supporting_keywords: keywords,
            user_instructions: localForm.user_instructions,
        })
    }

    return (
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
                <label className="text-[10px] text-stone-400 font-medium uppercase mb-1 block">Title</label>
                <input
                    type="text"
                    value={localForm.title}
                    onChange={(e) => setLocalForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 text-sm font-medium bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    placeholder="Article Title"
                    autoFocus
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] text-stone-400 font-medium uppercase mb-1 block">Target Keyword</label>
                    <input
                        type="text"
                        value={localForm.main_keyword}
                        onChange={(e) => setLocalForm(prev => ({ ...prev, main_keyword: e.target.value }))}
                        className="w-full px-3 py-2 text-xs bg-transparent border rounded-md"
                        placeholder="Target Keyword"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-stone-400 font-medium uppercase mb-1 block">Article Type</label>
                    <select
                        value={localForm.article_type}
                        onChange={(e) => setLocalForm(prev => ({ ...prev, article_type: e.target.value as any }))}
                        className="w-full px-3 py-2 text-xs bg-transparent border rounded-md"
                    >
                        <option value="informational">Informational</option>
                        <option value="commercial">Commercial</option>
                        <option value="howto">How-To</option>
                    </select>
                </div>
            </div>
            <div>
                <label className="text-[10px] text-stone-400 font-medium uppercase mb-1 block">Supporting Keywords</label>
                <textarea
                    value={localForm.supporting_keywords_raw}
                    onChange={(e) => setLocalForm(prev => ({
                        ...prev,
                        supporting_keywords_raw: e.target.value
                    }))}
                    className="w-full px-3 py-2 text-xs bg-transparent border rounded-md resize-none"
                    placeholder="keyword 1, keyword 2, keyword 3"
                    rows={2}
                />
                <p className="text-[10px] text-stone-400 mt-1">Separate keywords with commas</p>
            </div>
            <div>
                <label className="text-[10px] text-stone-400 font-medium uppercase flex items-center gap-1 mb-1">
                    Editorial Instructions
                    <span className="text-stone-300 font-normal lowercase tracking-normal">(optional)</span>
                </label>
                <textarea
                    value={localForm.user_instructions}
                    onChange={(e) => setLocalForm(prev => ({ ...prev, user_instructions: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-stone-400"
                    placeholder="E.g. Focus on pricing comparison, use a casual tone, avoid mentioning Competitor X..."
                    rows={3}
                />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 text-xs">
                    Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="h-8 text-xs bg-stone-900 text-white hover:bg-stone-800">
                    Save Changes
                </Button>
            </div>
        </div>
    )
})

// Memoized PlanCard component - only re-renders when its props change
export const PlanCard = memo(function PlanCard({
    item,
    isUrgent = false,
    isEditing,
    hasCredits,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onWriteArticle
}: PlanCardProps) {
    const typeConfig = ARTICLE_TYPE_CONFIG[item.article_type || "informational"]
    const BadgeIcon = item.badge ? BADGE_CONFIG[item.badge]?.icon : null

    return (
        <div
            className={cn(
                "relative p-4 rounded-lg border border-l-4 transition-colors flex flex-col h-full bg-white",
                isUrgent
                    ? "border-stone-400 shadow-sm ring-1 ring-stone-900/5"
                    : "border-stone-200 hover:border-stone-300",
                item.status === 'published' ? "border-l-emerald-500 bg-emerald-50/5" :
                    item.status === 'writing' ? "border-l-blue-500 bg-blue-50/5" :
                        "border-l-stone-200"
            )}
        >
            {isEditing ? (
                <EditForm
                    item={item}
                    onCancel={onCancelEdit}
                    onSave={onSaveEdit}
                />
            ) : (
                /* --- View Mode --- */
                <div className="flex flex-col h-full gap-3">
                    {/* Header: Badges, Score & Edit */}
                    <div className="flex items-start justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {/* Status Indicator */}
                            <span className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border",
                                item.status === 'published' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                    item.status === 'writing' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                        "bg-stone-50 text-stone-500 border-stone-200"
                            )}>
                                <span className={cn(
                                    "w-1 h-1 rounded-full",
                                    item.status === 'published' ? "bg-emerald-500" :
                                        item.status === 'writing' ? "bg-blue-500" :
                                            "bg-stone-400"
                                )} />
                                {item.status === 'writing' ? 'Drafting' : item.status === 'published' ? 'Live' : 'Planned'}
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-bold text-stone-400 border border-stone-100 bg-stone-50/50 uppercase tracking-tight">
                                {typeConfig.label}
                            </span>

                            {item.badge && item.badge !== 'new_opportunity' && BADGE_CONFIG[item.badge] && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider border border-stone-200 bg-white text-stone-500">
                                    <BadgeIcon className="w-2.5 h-2.5" />
                                    {BADGE_CONFIG[item.badge].label}
                                </span>
                            )}

                            {/* Opportunity Score - Only show if we have real GSC data */}
                            {(item.gsc_impressions ?? 0) > 0 && (item.opportunity_score ?? 0) > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-100 cursor-help">
                                            <Sparkles className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                            {item.opportunity_score}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px] text-[10px]">
                                        <p className="font-bold">Score: {item.opportunity_score}</p>
                                        <p className="opacity-90">Calculated from market demand and search position.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>

                        {item.status !== 'published' && item.status !== 'writing' && (
                            <button
                                onClick={onStartEdit}
                                className="cursor-pointer opacity-100 group-hover:opacity-100 transition-all p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 border border-transparent hover:border-stone-100"
                            >
                                <SquarePen className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Title & Reason */}
                    <div className="space-y-1">
                        <h3 className="font-bold text-stone-900 text-[15px] leading-tight line-clamp-2 tracking-tight">
                            {item.title}
                        </h3>
                        {item.reason && (
                            <p className="text-[11px] text-stone-500 leading-normal p-2 rounded-lg border border-stone-100">
                                <span className="font-bold text-stone-900 mr-1.5 underline decoration-amber-500/30">Why:</span>
                                {item.reason}
                            </p>
                        )}
                        {item.user_instructions && (
                            <div className="mt-2 text-[11px] text-stone-600 leading-normal p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/50">
                                <p className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                                    <PenTool className="w-3 h-3" />
                                    Editorial Instructions:
                                </p>
                                <p className="text-emerald-900/80 whitespace-pre-wrap">{item.user_instructions}</p>
                            </div>
                        )}
                    </div>

                    {/* SEO Metrics Bar */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-600 px-2 py-0.5 rounded border border-stone-100">
                            <span className="font-bold uppercase text-[9px] text-stone-400">Main Keyword:</span>
                            <span className="font-bold tracking-tight text-stone-900">{item.main_keyword}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            {(item.gsc_impressions ?? 0) > 0 && (
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-stone-400 uppercase">Demand</span>
                                    <span className="text-[11px] font-bold text-stone-900">{item.gsc_impressions?.toLocaleString()}</span>
                                </div>
                            )}

                            {(item.gsc_position ?? 0) > 0 && (
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-stone-400 uppercase">Current</span>
                                    <span className="text-[11px] font-bold text-stone-900">#{item.gsc_position?.toFixed(1)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Simple Keywords */}
                    {item.supporting_keywords && item.supporting_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {item.supporting_keywords.slice(0, 3).map(kw => (
                                <span key={kw} className="px-2 py-0.5 rounded bg-stone-100 text-[10px] font-medium text-stone-600">
                                    {kw}
                                </span>
                            ))}
                            {item.supporting_keywords.length > 3 && (
                                <span className="px-2 py-0.5 text-[10px] font-medium text-stone-400">
                                    +{item.supporting_keywords.length - 3}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Footer: Date & Action */}
                    <div className="mt-auto pt-3 flex items-center justify-between border-t border-stone-100/60">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500">
                                <Calendar className="w-3 h-3" />
                                {new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                        </div>

                        {item.status === 'writing' ? (
                            <Link
                                href="/articles"
                                className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-2 rounded-md hover:bg-blue-100 transition-all"
                            >
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Generating...
                            </Link>
                        ) : item.status === 'published' ? (
                            <span className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-2 rounded-md">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Published
                            </span>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-block">
                                        <Button
                                            onClick={onWriteArticle}
                                            size="sm"
                                            disabled={!hasCredits}
                                            className={cn(
                                                "text-xs font-semibold px-2 py-2 rounded-md transition-all active:scale-95",
                                                !hasCredits
                                                    ? "bg-stone-100 text-stone-400 cursor-not-allowed hover:bg-stone-100 border border-stone-200"
                                                    : "bg-stone-900 text-white hover:bg-stone-800"
                                            )}
                                        >
                                            <Feather className="w-3.5 h-3.5 mr-1" />
                                            Write Now
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {!hasCredits && (
                                    <TooltipContent>
                                        <p>Passes required. Please top up.</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
})
