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
                "group relative p-4 rounded-xl border transition-all flex flex-col h-full bg-white hover:border-stone-300",
                isUrgent
                    ? "ring-2 ring-stone-900 border-transparent"
                    : "border-stone-200",
                item.status === 'published' ? "bg-emerald-50/30 border-emerald-100" :
                    item.status === 'writing' ? "bg-blue-50/30 border-blue-100" :
                        "bg-white"
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
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Status Indicator */}
                            {item.status === 'published' ? (
                                <>
                                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Published</span>
                                </>
                            ) : item.status === 'writing' ? (
                                <>
                                    <div className="relative flex h-2.5 w-2.5 mr-1">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 "></span>
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700">Writing</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-stone-300 bg-white" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Planned</span>
                                </>
                            )}

                            {/* Type & Badge */}
                            <div className="flex items-center gap-1.5 ml-1 border-l border-stone-200 pl-3">
                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-stone-400 uppercase tracking-tight">
                                    <typeConfig.icon className="w-3 h-3" />
                                    {typeConfig.label}
                                </span>
                                {item.badge && item.badge !== 'new_opportunity' && BADGE_CONFIG[item.badge] && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600">
                                        <BadgeIcon className="w-2.5 h-2.5" />
                                        {BADGE_CONFIG[item.badge].label}
                                    </span>
                                )}
                            </div>

                            {/* Opportunity Score */}
                            {(item.gsc_impressions ?? 0) > 0 && (item.opportunity_score ?? 0) > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-100 cursor-help ml-1">
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
                                className="cursor-pointer transition-all p-1.5 hover:bg-stone-100 rounded-md text-stone-400 hover:text-stone-900 border border-transparent hover:border-stone-200"
                            >
                                <SquarePen className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Title & Reason */}
                    <div className="space-y-2 mt-1">
                        <h3 className="font-bold text-stone-900 text-[15px] leading-snug tracking-tight pr-4">
                            {item.title}
                        </h3>
                        {(item.reason || item.user_instructions) && (
                            <div className="space-y-1.5">
                                {item.reason && (
                                    <div className="text-[11px] text-stone-500 leading-relaxed border-l-2 border-stone-200 pl-2.5 bg-stone-50/50 py-1 rounded-r-md">
                                        <span className="font-bold text-stone-700 mr-1.5">Why:</span>
                                        {item.reason}
                                    </div>
                                )}
                                {item.user_instructions && (
                                    <div className="text-[11px] text-emerald-700/90 leading-relaxed bg-emerald-50/50 rounded-md p-2 border border-emerald-100/50">
                                        <p className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-wider">
                                            <PenTool className="w-3 h-3" />
                                            Editorial Brief
                                        </p>
                                        <p className="whitespace-pre-wrap">{item.user_instructions}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Metrics row */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200/60">
                            <span className="text-[9px] font-bold uppercase text-stone-400">Target</span>
                            <span className="font-bold text-stone-800 tracking-tight break-words">{item.main_keyword}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            {(item.gsc_impressions ?? 0) > 0 && (
                                <div className="flex items-center gap-1 text-stone-500 font-medium">
                                    <TrendingUp className="w-3.5 h-3.5 text-stone-400" />
                                    <span>{(item.gsc_impressions || 0) > 1000 ? `${((item.gsc_impressions || 0) / 1000).toFixed(1)}k` : item.gsc_impressions} vol</span>
                                </div>
                            )}

                            {(item.gsc_position ?? 0) > 0 && (
                                <div className="flex items-center gap-1 text-stone-500 font-medium">
                                    <Target className="w-3.5 h-3.5 text-stone-400" />
                                    <span>Pos #{item.gsc_position?.toFixed(1)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Simple Keywords array */}
                    {item.supporting_keywords && item.supporting_keywords.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="text-[10px] font-medium text-stone-400 mr-0.5">Related:</span>
                            {item.supporting_keywords.slice(0, 3).map(kw => (
                                <span key={kw} className="px-1.5 py-0.5 rounded outline outline-1 outline-stone-100 bg-stone-50 text-[10px] font-medium text-stone-500 hover:text-stone-700 transition-colors cursor-default">
                                    {kw}
                                </span>
                            ))}
                            {item.supporting_keywords.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-stone-400 cursor-default">
                                    +{item.supporting_keywords.length - 3}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Footer: Date & Action */}
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-black/[0.04]">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>

                        {item.status === 'writing' ? (
                            <Link
                                href="/articles"
                                className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all"
                            >
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Generating
                            </Link>
                        ) : item.status === 'published' ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg">
                                <CheckCircle2 className="w-3 h-3" />
                                Live
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
                                                "h-7 px-3 text-[11px] font-bold rounded-lg transition-all active:scale-95",
                                                !hasCredits
                                                    ? "bg-stone-100 text-stone-400 cursor-not-allowed hover:bg-stone-100 border border-stone-200"
                                                    : "bg-stone-900 text-white hover:bg-stone-800"
                                            )}
                                        >
                                            <Feather className="w-3 h-3 mr-1.5 opacity-80" />
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
