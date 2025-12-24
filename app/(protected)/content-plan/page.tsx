"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import {
    Calendar,
    Sparkles,
    TrendingUp,
    Zap,
    Target,
    PenTool,
    Edit2,
    CheckCircle2,
    Clock,
    Loader2,
    X,
    Save,
    FileText,
    BookOpen,
    Code,
    Layout,
    MoreHorizontal,
    ArrowRight,
    BarChart3,
    MousePointerClick,
    Search,
    Info,
    Lightbulb,
    Gauge,
    Tag,
    Play,
    Pause
} from "lucide-react"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { Button } from "@/components/ui/button"
import { GlobalCard } from "@/components/ui/global-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AutomationModal } from "@/components/automation-modal"
import { cn } from "@/lib/utils"

// --- Minimal Design System Configuration ---

// Clean, monochrome-focused badge styles with minimal color usage
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

const STATUS_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
    pending: { label: "Planned", icon: Calendar, className: "text-stone-500" },
    writing: { label: "Writing", icon: PenTool, className: "text-stone-900" },
    published: { label: "Published", icon: CheckCircle2, className: "text-stone-900" },
}

// Intent Role Configuration for Strategic Content Categories
const INTENT_ROLE_CONFIG: Record<string, {
    label: string;
    icon: any;
    tagline: string;
    color: string;
    bgColor: string;
}> = {
    "Core Answer": {
        label: "Core Answer",
        icon: BookOpen,
        tagline: "Foundation of topical authority",
        color: "text-blue-600",
        bgColor: "bg-blue-50 border-blue-200"
    },
    "Problem-Specific": {
        label: "Problem-Specific",
        icon: Target,
        tagline: "Long-tail coverage without overlap",
        color: "text-amber-600",
        bgColor: "bg-amber-50 border-amber-200"
    },
    "Comparison": {
        label: "Comparison",
        icon: BarChart3,
        tagline: "Commercial intent winners",
        color: "text-emerald-600",
        bgColor: "bg-emerald-50 border-emerald-200"
    },
    "Decision": {
        label: "Decision",
        icon: Lightbulb,
        tagline: "Trust-building content",
        color: "text-purple-600",
        bgColor: "bg-purple-50 border-purple-200"
    },
    "Emotional/Story": {
        label: "Emotional/Story",
        icon: Sparkles,
        tagline: "Backlink magnets & AEO pickup",
        color: "text-rose-600",
        bgColor: "bg-rose-50 border-rose-200"
    },
    "Authority/Edge": {
        label: "Authority/Edge",
        icon: TrendingUp,
        tagline: "Expert positioning",
        color: "text-stone-700",
        bgColor: "bg-stone-100 border-stone-300"
    }
}

export default function ContentPlanPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [plan, setPlan] = useState<{ id: string; plan_data: ContentPlanItem[]; gsc_enhanced: boolean; automation_status?: string } | null>(null)
    const [filter, setFilter] = useState<"all" | "pending" | "writing" | "published">("all")
    const [error, setError] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<ContentPlanItem>>({})
    const [automationLoading, setAutomationLoading] = useState(false)
    const [showAutomationModal, setShowAutomationModal] = useState(false)
    const [missedCount, setMissedCount] = useState(0)

    useEffect(() => {
        fetchPlan()
    }, [])

    const fetchPlan = async () => {
        try {
            const res = await fetch("/api/content-plan")
            const data = await res.json()
            if (res.ok && data) {
                setPlan(data)
            }
        } catch (e: any) {
            setError(e.message || "Failed to load content plan")
        } finally {
            setLoading(false)
        }
    }

    const handleWriteArticle = async (item: ContentPlanItem) => {
        setLoading(true)
        setError("")

        try {
            const settingsRes = await fetch("/api/settings")
            if (!settingsRes.ok) throw new Error("Failed to fetch settings.")
            const settings = await settingsRes.json()

            if (!settings.brandId) {
                router.push("/onboarding")
                return
            }

            const generateRes = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyword: item.main_keyword,
                    brandId: settings.brandId,
                    title: item.title,
                    articleType: item.article_type || "informational",
                    supportingKeywords: item.supporting_keywords || [],
                    cluster: item.cluster || "",
                    planId: plan?.id,
                    itemId: item.id,
                }),
            })

            if (!generateRes.ok) {
                const data = await generateRes.json()
                throw new Error(data.error || "Failed to start article generation")
            }

            // const { articleId } = await generateRes.json() // Not needed for redirect

            if (plan) {
                await handleUpdateStatus(item.id, "writing")
            }

            // Redirect to articles list instead of the specific article
            router.push(`/articles`)
        } catch (e: any) {
            setError(e.message || "Failed to generate article")
        } finally {
            setLoading(false)
        }
    }

    const handleStartEdit = (item: ContentPlanItem) => {
        setEditingId(item.id)
        setEditForm({
            title: item.title,
            main_keyword: item.main_keyword,
            supporting_keywords: item.supporting_keywords,
            article_type: item.article_type || "informational",
        })
    }

    const handleSaveEdit = async () => {
        if (!plan || !editingId) return

        try {
            await fetch("/api/content-plan", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: plan.id,
                    itemId: editingId,
                    updates: editForm,
                }),
            })

            setPlan(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    plan_data: prev.plan_data.map(item =>
                        item.id === editingId ? { ...item, ...editForm } : item
                    ),
                }
            })
            setEditingId(null)
            setEditForm({})
        } catch (e) {
            console.error("Failed to save edit:", e)
        }
    }

    const handleUpdateStatus = async (itemId: string, status: "pending" | "writing" | "published") => {
        if (!plan) return

        try {
            await fetch("/api/content-plan", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: plan.id,
                    itemId,
                    updates: { status },
                }),
            })

            setPlan(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    plan_data: prev.plan_data.map(item =>
                        item.id === itemId ? { ...item, status } : item
                    ),
                }
            })
        } catch (e) {
            console.error("Failed to update status:", e)
        }
    }

    // Automation toggle handler
    const handleToggleAutomation = async () => {
        if (!plan) return

        const isActive = plan.automation_status === "active"

        if (isActive) {
            // Pausing automation - no modal needed
            setAutomationLoading(true)
            try {
                const res = await fetch("/api/content-plan/automation", { method: "DELETE" })
                const data = await res.json()
                if (res.ok) {
                    setPlan(prev => prev ? { ...prev, automation_status: data.automation_status } : prev)
                } else {
                    setError(data.error || "Failed to pause automation")
                }
            } catch (e: any) {
                setError(e.message || "Failed to pause automation")
            } finally {
                setAutomationLoading(false)
            }
        } else {
            // Starting automation - check for missed articles first
            setAutomationLoading(true)
            try {
                const res = await fetch("/api/content-plan/automation")
                const data = await res.json()

                if (data.missedCount > 0) {
                    // Show modal for user to choose how to handle missed articles
                    setMissedCount(data.missedCount)
                    setShowAutomationModal(true)
                } else {
                    // No missed articles - activate directly
                    await handleActivateAutomation("gradual")
                }
            } catch (e: any) {
                setError(e.message || "Failed to check automation status")
            } finally {
                setAutomationLoading(false)
            }
        }
    }

    // Handle activation with user's chosen action
    const handleActivateAutomation = async (action: "gradual" | "skip" | "reschedule") => {
        try {
            const res = await fetch("/api/content-plan/automation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            })
            const data = await res.json()

            if (res.ok) {
                setPlan(prev => prev ? { ...prev, automation_status: data.automation_status } : prev)
                // Refetch plan to get updated dates if rescheduled
                if (action === "reschedule" || action === "skip") {
                    fetchPlan()
                }
            } else {
                setError(data.error || "Failed to activate automation")
            }
        } catch (e: any) {
            setError(e.message || "Failed to activate automation")
            throw e
        }
    }

    const filteredPlan = plan?.plan_data.filter(item => {
        if (filter === "all") return true
        return item.status === filter
    }) || []

    const urgentItems = filteredPlan.filter(item => item.badge && ["high_impact", "quick_win"].includes(item.badge)).slice(0, 5)
    const regularItems = filteredPlan.filter(item => !urgentItems.includes(item))

    const planStats = plan?.plan_data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
    }, {} as Record<string, number>) || {}

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            </div>
        )
    }

    if (!plan) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
                <Calendar className="w-12 h-12 text-stone-300" />
                <h1 className="text-xl font-bold text-stone-900">
                    No content plan yet
                </h1>
                <p className="text-sm text-stone-500">
                    Complete the onboarding to generate your 30-day content plan
                </p>
                <Button onClick={() => router.push("/onboarding")}>
                    Start Onboarding
                </Button>
            </div>
        )
    }

    const PlanCard = ({ item, isUrgent = false }: { item: ContentPlanItem, isUrgent?: boolean }) => {
        const isEditing = editingId === item.id
        const typeConfig = ARTICLE_TYPE_CONFIG[item.article_type || "informational"]
        const BadgeIcon = item.badge ? BADGE_CONFIG[item.badge]?.icon : null

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "group relative p-5 rounded-xl border transition-all duration-200 flex flex-col h-full bg-white",
                    isUrgent
                        ? "border-stone-300 shadow-sm"
                        : "border-stone-200 hover:border-stone-300 hover:shadow-sm"
                )}
            >
                {/* --- Edit Mode --- */}
                {isEditing ? (
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] text-stone-400 font-medium uppercase mb-1 block">Title</label>
                            <input
                                type="text"
                                value={editForm.title || ""}
                                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
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
                                    value={editForm.main_keyword || ""}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, main_keyword: e.target.value }))}
                                    className="w-full px-3 py-2 text-xs bg-transparent border rounded-md"
                                    placeholder="Target Keyword"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-stone-400 font-medium uppercase mb-1 block">Article Type</label>
                                <select
                                    value={editForm.article_type || "informational"}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, article_type: e.target.value as any }))}
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
                                value={(editForm.supporting_keywords || []).join(", ")}
                                onChange={(e) => setEditForm(prev => ({
                                    ...prev,
                                    supporting_keywords: e.target.value.split(",").map(k => k.trim()).filter(k => k.length > 0)
                                }))}
                                className="w-full px-3 py-2 text-xs bg-transparent border rounded-md resize-none"
                                placeholder="keyword 1, keyword 2, keyword 3"
                                rows={2}
                            />
                            <p className="text-[10px] text-stone-400 mt-1">Separate keywords with commas</p>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 text-xs">
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveEdit} className="h-8 text-xs bg-stone-900 text-white hover:bg-stone-800">
                                Save Changes
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* --- View Mode --- */
                    <div className="flex flex-col h-full gap-3">
                        {/* Header: Badges, Score & Edit */}
                        <div className="flex items-start justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                {item.badge && BADGE_CONFIG[item.badge] && (
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                                        BADGE_CONFIG[item.badge].className
                                    )}>
                                        <BadgeIcon className="w-3 h-3" />
                                        {BADGE_CONFIG[item.badge].label}
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium text-stone-500 border border-stone-100 bg-stone-50">
                                    <typeConfig.icon className="w-3 h-3" />
                                    {typeConfig.label}
                                </span>
                                {/* Opportunity Score with Tooltip */}
                                {item.opportunity_score !== undefined && item.opportunity_score > 0 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-stone-700 bg-stone-100 border border-stone-200 cursor-help">
                                                <Gauge className="w-3 h-3" />
                                                {item.opportunity_score}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[220px]">
                                            <p className="font-semibold">Opportunity Score</p>
                                            <p className="text-[11px] opacity-90">Calculated from impressions, position, CTR gap, and keyword specificity. Higher = more valuable topic.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                {/* Impact Badge with Tooltip */}
                                {item.impact && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium cursor-help border",
                                                item.impact === "High" && "text-emerald-700 bg-emerald-50 border-emerald-200",
                                                item.impact === "Medium" && "text-amber-700 bg-amber-50 border-amber-200",
                                                item.impact === "Low" && "text-stone-500 bg-stone-50 border-stone-200"
                                            )}>
                                                <TrendingUp className="w-3 h-3" />
                                                {item.impact}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px]">
                                            <p className="font-semibold">Expected Traffic Impact</p>
                                            <p className="text-[11px] opacity-90">
                                                {item.impact === "High" && "This topic can drive significant organic traffic."}
                                                {item.impact === "Medium" && "This topic has moderate traffic potential."}
                                                {item.impact === "Low" && "Smaller traffic potential, but good for authority."}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>

                            <button
                                onClick={() => handleStartEdit(item)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-stone-100 rounded-md text-stone-400 hover:text-stone-600"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-stone-900 text-[15px] leading-snug group-hover:text-stone-700 transition-colors line-clamp-2">
                            {item.title}
                        </h3>

                        {/* AI Strategic Reason */}
                        {item.reason && (
                            <p className="text-[11px] text-stone-500 leading-relaxed italic">
                                <Lightbulb className="w-3 h-3 inline mr-1 opacity-70" />
                                {item.reason}
                            </p>
                        )}

                        {/* GSC Metrics Grid */}
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
                            {/* Main Keyword with Tooltip */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 text-stone-500 truncate cursor-help col-span-2">
                                        <Search className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate font-medium">{item.main_keyword}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[250px]">
                                    <p className="font-semibold">Target Keyword</p>
                                    <p className="text-[11px] opacity-90">The primary keyword this article will target for SEO rankings.</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* GSC Impressions */}
                            {item.gsc_impressions && item.gsc_impressions > 0 ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2 text-stone-500 cursor-help">
                                            <TrendingUp className="w-3 h-3 flex-shrink-0" />
                                            <span>{item.gsc_impressions.toLocaleString()} <span className="text-[10px] opacity-70">imps</span></span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px] text-center">
                                        <p className="font-semibold">Monthly Impressions</p>
                                        <p className="text-[11px] opacity-90">How many times your site appeared in search results for this keyword.</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : null}

                            {/* CTR */}
                            {item.gsc_ctr !== undefined && item.gsc_ctr > 0 ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex gap-2 text-stone-500 cursor-help">
                                            <MousePointerClick className="w-3 h-3 flex-shrink-0" />
                                            <span>{item.gsc_ctr.toFixed(1)}% <span className="text-[10px] opacity-70">CTR</span></span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px]">
                                        <p className="font-semibold">Click-Through Rate</p>
                                        <p className="text-[11px] opacity-90">Percentage of impressions that resulted in clicks. Low CTR = opportunity to target the keyword.</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : null}

                            {/* Position */}
                            {item.gsc_position && item.gsc_position > 0 ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex gap-2 text-stone-500 cursor-help">
                                            <Target className="w-3 h-3 flex-shrink-0" />
                                            <span>Pos {item.gsc_position.toFixed(1)}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[220px] ">
                                        <p className="font-semibold">Average Position</p>
                                        <p className="text-[11px] opacity-90">Your current ranking in Google. Position 1-10 = Page 1, 11-20 = Page 2, etc.</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : null}
                        </div>

                        {/* Supporting Keywords */}
                        {item.supporting_keywords && item.supporting_keywords.length > 0 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-[10px] text-stone-400 cursor-help">
                                        <Tag className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">
                                            +{item.supporting_keywords.length} related keywords
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[280px]">
                                    <p className="font-semibold mb-1">Supporting Keywords</p>
                                    <p className="text-[11px] opacity-90 leading-relaxed">
                                        {item.supporting_keywords.slice(0, 5).join(", ")}
                                        {item.supporting_keywords.length > 5 && ` +${item.supporting_keywords.length - 5} more`}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        )}

                        {/* Footer: Date & Action */}
                        <div className="mt-auto pt-3 flex items-end justify-between border-t border-stone-100">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-stone-400 font-medium">SCHEDULED</span>
                                <span className="text-xs font-medium text-stone-700">
                                    {new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            </div>

                            {item.status === 'writing' ? (
                                <Link
                                    href="/articles"
                                    className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-lg hover:bg-stone-200 transition-colors"
                                >
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Writing...
                                </Link>
                            ) : item.status === 'published' ? (
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Published
                                </span>
                            ) : (
                                <Button
                                    onClick={() => handleWriteArticle(item)}
                                    size="sm"
                                    className="h-8 text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 shadow-sm rounded-lg"
                                >
                                    Write Article
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>
        )
    }

    return (
        <div className="w-full min-h-screen font-sans">
            <GlobalCard className="w-full shadow-sm rounded-xl border border-stone-200 bg-white">
                {/* --- Integrated Header --- */}
                {/* --- Integrated Header --- */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 py-4 border-b border-stone-200/50 bg-stone-50/40 backdrop-blur-sm rounded-t-xl sticky top-0 z-10 backdrop-filter min-h-[72px]">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2 flex-wrap">
                                {plan?.gsc_enhanced ? (
                                    <>
                                        <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500/10 flex-shrink-0" />
                                        <span>Data-Driven Strategy</span>
                                    </>
                                ) : (
                                    "Content Plan"
                                )}
                            </h1>
                            {plan?.plan_data && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-200/50 text-[10px] font-medium text-stone-600 px-1.5 translate-y-[1px]">
                                    {plan.plan_data.length}
                                </span>
                            )}
                        </div>
                        {plan && (
                            <p className="text-[10px] font-medium text-stone-400 pl-0.5">
                                Generated {new Date().toLocaleDateString()} • 30 Day Roadmap
                            </p>
                        )}
                    </div>

                    {/* Automation Button + Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Automation Toggle Button */}
                        {plan && (
                            <Button
                                onClick={handleToggleAutomation}
                                disabled={automationLoading}
                                size="sm"
                                className={cn(
                                    "h-9 px-4 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 shadow-sm",
                                    plan.automation_status === "active"
                                        ? "bg-stone-900 text-white hover:bg-stone-800"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                                )}
                            >
                                {automationLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : plan.automation_status === "active" ? (
                                    <>
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <Pause className="w-3.5 h-3.5" />
                                        <span className="sm:block hidden">Pause Automation</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-3.5 h-3.5" />
                                        <span>Start Automation</span>
                                    </>
                                )}
                            </Button>
                        )}

                        {plan && (
                            <div className="flex bg-stone-100/50 border border-stone-200 rounded-lg p-1 shadow-sm self-start md:self-center overflow-x-auto max-w-full">
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilter(key as any)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                                            filter === key
                                                ? "bg-white text-stone-900 shadow-sm border border-stone-200/50"
                                                : "text-stone-500 hover:text-stone-700 hover:bg-stone-200/50"
                                        )}
                                    >
                                        <span className={filter === key ? "inline" : "hidden sm:inline"}>
                                            {config.label}
                                        </span>
                                        <ConfigIcon config={config} isSelected={filter === key} />
                                        <span className={cn(
                                            "ml-1 text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem]",
                                            filter === key ? "bg-stone-100 " : "bg-stone-200/50"
                                        )}>
                                            {planStats[key] || 0}
                                        </span>
                                    </button>
                                ))}
                                {/* 'All' Filter */}
                                <button
                                    onClick={() => setFilter("all")}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ml-1",
                                        filter === "all"
                                            ? "bg-white text-stone-900 shadow-sm border border-stone-200/50"
                                            : "text-stone-500 hover:text-stone-700 hover:bg-stone-200/50"
                                    )}
                                >
                                    <span>All</span>
                                    <span className={cn(
                                        "ml-1 text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem]",
                                        filter === "all" ? "bg-stone-100" : "bg-stone-200/50"
                                    )}>
                                        {plan.plan_data.length}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Body Content --- */}
                <div className="p-4 space-y-8">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-stone-300" />
                            <p className="text-sm text-stone-500 font-medium animate-pulse">Loading content plan...</p>
                        </div>
                    ) : error ? (
                        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-center">
                            <p className="text-sm text-red-600 font-medium mb-3">{error}</p>
                            <Button variant="outline" size="sm" onClick={fetchPlan} className="h-8 text-xs bg-white hover:bg-red-50 border-red-200 text-red-700">
                                Retry
                            </Button>
                        </div>
                    ) : !plan ? (
                        <div className="text-center py-20 px-4">
                            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FileText className="w-8 h-8 text-stone-400" />
                            </div>
                            <h2 className="text-xl font-bold text-stone-900 mb-2">No Content Plan Yet</h2>
                            <p className="text-stone-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
                                Generate a data-driven 30-day content plan based on your competitors and search trends.
                            </p>
                            <Button onClick={() => router.push("/blog-writer")} className="h-10 px-6 font-semibold shadow-md active:scale-95 transition-transform">
                                <Sparkles className="w-4 h-4 mr-2" />
                                Create First Plan
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* --- Strategic Content Grid by Intent Role --- */}
                            <div className="space-y-8">
                                {Object.entries(INTENT_ROLE_CONFIG).map(([roleKey, roleConfig]) => {
                                    // Get items for this role
                                    const roleItems = filteredPlan.filter(
                                        item => item.intent_role === roleKey
                                    )

                                    // Skip empty sections when filtering by status
                                    if (roleItems.length === 0 && filter !== 'all') return null

                                    const RoleIcon = roleConfig.icon
                                    const completedCount = roleItems.filter(i => i.status === 'published').length

                                    return (
                                        <section key={roleKey}>
                                            {/* Section Header */}
                                            <div className={cn(
                                                "flex items-center justify-between gap-3 mb-4 p-3 rounded-lg border",
                                                roleConfig.bgColor
                                            )}>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center bg-white/80 shadow-sm",
                                                        roleConfig.color
                                                    )}>
                                                        <RoleIcon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-sm font-bold text-stone-900 tracking-tight">
                                                            {roleConfig.label}
                                                        </h2>
                                                        <p className="text-[11px] text-stone-500">
                                                            {roleConfig.tagline}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                                                        roleConfig.color,
                                                        "bg-white/80"
                                                    )}>
                                                        {completedCount}/{roleItems.length}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Articles Grid */}
                                            {roleItems.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                    {roleItems.map((item) => (
                                                        <PlanCard key={item.id} item={item} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 text-stone-400 text-sm border border-dashed border-stone-200 rounded-lg">
                                                    No {roleConfig.label} articles yet
                                                </div>
                                            )}
                                        </section>
                                    )
                                })}

                                {/* Uncategorized Section (for legacy plans) */}
                                {filteredPlan.filter(item => !item.intent_role).length > 0 && (
                                    <section>
                                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-stone-100">
                                            <Layout className="w-4 h-4 text-stone-400" />
                                            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                                                Uncategorized
                                            </h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {filteredPlan
                                                .filter(item => !item.intent_role)
                                                .map((item) => (
                                                    <PlanCard key={item.id} item={item} />
                                                ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </GlobalCard>

            {/* Automation Modal for handling missed articles */}
            <AutomationModal
                isOpen={showAutomationModal}
                onClose={() => setShowAutomationModal(false)}
                missedCount={missedCount}
                onConfirm={handleActivateAutomation}
            />
        </div>
    )
}

// Helper to avoid TS errors in map
function ConfigIcon({ config, isSelected }: { config: any, isSelected: boolean }) {
    const Icon = config.icon
    return <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-stone-900" : "text-stone-400")} />
}
