"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
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
    Code
} from "lucide-react"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { Button } from "@/components/ui/button"
import { GlobalCard } from "@/components/ui/global-card"

// Badge colors and icons
const BADGE_CONFIG = {
    high_impact: { label: "🔥 High Impact", icon: Sparkles, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    quick_win: { label: "⚡ Quick Win", icon: Zap, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    low_ctr: { label: "📈 Low CTR", icon: TrendingUp, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    new_opportunity: { label: "🧭 New", icon: Target, className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
}

const ARTICLE_TYPE_CONFIG = {
    informational: { label: "Informational", icon: FileText, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    commercial: { label: "Commercial", icon: TrendingUp, className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    howto: { label: "How-To", icon: BookOpen, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
}

const STATUS_CONFIG = {
    pending: { label: "Pending", icon: Clock, className: "text-stone-400" },
    writing: { label: "Writing", icon: PenTool, className: "text-blue-500" },
    published: { label: "Published", icon: CheckCircle2, className: "text-green-500" },
}

export default function ContentPlanPage() {
    const router = useRouter()
    const [isDark, setIsDark] = useState(false)
    const [loading, setLoading] = useState(true)
    const [plan, setPlan] = useState<{ id: string; plan_data: ContentPlanItem[]; gsc_enhanced: boolean } | null>(null)
    const [filter, setFilter] = useState<"all" | "pending" | "writing" | "published">("all")
    const [error, setError] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<ContentPlanItem>>({})

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
        }
    }, [])

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
        // Show loading state on the button
        setLoading(true)
        setError("")

        try {
            // Get user's brand ID from settings
            const settingsRes = await fetch("/api/settings")
            if (!settingsRes.ok) {
                throw new Error("Failed to fetch settings. Please set up your brand first.")
            }
            const settings = await settingsRes.json()

            if (!settings.brandId) {
                router.push("/onboarding")
                return
            }

            // Trigger article generation with brandId only (style_dna comes from brand_details)
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
                }),
            })

            if (!generateRes.ok) {
                const data = await generateRes.json()
                throw new Error(data.error || "Failed to start article generation")
            }

            const { articleId } = await generateRes.json()

            // Update content plan item status to "writing"
            if (plan) {
                await handleUpdateStatus(item.id, "writing")
            }

            // Redirect to the article page
            router.push(`/articles/${articleId}`)
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

    const filteredPlan = plan?.plan_data.filter(item => {
        if (filter === "all") return true
        return item.status === filter
    }) || []

    // Separate high-priority items (with GSC badges)
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
                <Calendar className={`w-12 h-12 ${isDark ? 'text-stone-600' : 'text-stone-300'}`} />
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                    No content plan yet
                </h1>
                <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    Complete the onboarding to generate your 30-day content plan
                </p>
                <Button onClick={() => router.push("/onboarding")}>
                    Start Onboarding
                </Button>
            </div>
        )
    }

    const renderPlanItem = (item: ContentPlanItem, index: number, isUrgent: boolean = false) => {
        const isEditing = editingId === item.id
        const typeConfig = ARTICLE_TYPE_CONFIG[item.article_type || "informational"]

        return (
            <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`rounded-xl border p-3 md:p-4 transition-all ${isUrgent
                    ? (isDark ? 'bg-amber-950/20 border-amber-800' : 'bg-amber-50 border-amber-200')
                    : (isDark ? 'bg-stone-900 border-stone-800 hover:border-stone-700' : 'bg-white border-stone-200 hover:border-stone-300')
                    }`}
            >
                {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={editForm.title || ""}
                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold ${isDark ? 'bg-stone-800 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
                            placeholder="Title"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                                type="text"
                                value={editForm.main_keyword || ""}
                                onChange={(e) => setEditForm(prev => ({ ...prev, main_keyword: e.target.value }))}
                                className={`px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-stone-800 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
                                placeholder="Main keyword"
                            />
                            <select
                                value={editForm.article_type || "informational"}
                                onChange={(e) => setEditForm(prev => ({ ...prev, article_type: e.target.value as any }))}
                                className={`px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-stone-800 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
                            >
                                <option value="informational">Informational</option>
                                <option value="commercial">Commercial</option>
                                <option value="howto">How-To</option>
                            </select>
                        </div>
                        <input
                            type="text"
                            value={(editForm.supporting_keywords || []).join(", ")}
                            onChange={(e) => setEditForm(prev => ({ ...prev, supporting_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                            className={`w-full px-3 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-stone-800 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
                            placeholder="Supporting keywords (comma separated)"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit} className="h-7 px-3 text-xs">
                                <Save className="w-3 h-3 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 px-3 text-xs">
                                <X className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* View Mode - Mobile-first layout */
                    <div className="space-y-3">
                        {/* Top Row: Date + Title */}
                        <div className="flex items-start gap-3">
                            {/* Date Badge - smaller on mobile */}
                            <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
                                <span className={`text-[10px] md:text-xs font-medium ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                    {new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short' })}
                                </span>
                                <span className={`text-base md:text-lg font-bold leading-none ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                    {new Date(item.scheduled_date).getDate()}
                                </span>
                            </div>

                            {/* Title + Badges */}
                            <div className="flex-1 min-w-0">
                                <h3 className={`font-semibold text-sm md:text-base leading-snug line-clamp-2 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                    {item.title}
                                </h3>
                                {/* Tags Row */}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    {item.badge && BADGE_CONFIG[item.badge] && (
                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium ${BADGE_CONFIG[item.badge].className}`}>
                                            {BADGE_CONFIG[item.badge].label}
                                        </span>
                                    )}
                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-medium ${typeConfig.className}`}>
                                        <typeConfig.icon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        {typeConfig.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Keywords Row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isDark ? 'bg-stone-700 text-stone-200' : 'bg-stone-200 text-stone-700'}`}>
                                🎯 {item.main_keyword}
                            </span>
                            {/* Supporting keywords - hidden on mobile */}
                            {item.supporting_keywords?.slice(0, 2).map((kw, i) => (
                                <span key={i} className={`hidden md:inline-block px-2 py-0.5 rounded text-[10px] ${isDark ? 'bg-stone-800 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
                                    {kw}
                                </span>
                            ))}
                            {item.cluster && (
                                <span className={`hidden md:inline text-[10px] ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                                    📁 {item.cluster}
                                </span>
                            )}
                        </div>

                        {/* GSC Data - collapsible on mobile */}
                        {item.gsc_impressions && (
                            <div className={`flex flex-wrap items-center gap-2 md:gap-3 text-[9px] md:text-[10px] ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                                <span>📊 {item.gsc_impressions.toLocaleString()}</span>
                                {item.gsc_position && <span>📍 #{item.gsc_position.toFixed(0)}</span>}
                                {item.gsc_ctr !== undefined && <span className="hidden md:inline">👆 {item.gsc_ctr.toFixed(1)}%</span>}
                            </div>
                        )}

                        {/* Strategic Reason - hidden on mobile */}
                        {item.reason && (
                            <p className={`hidden md:block text-[11px] italic ${isDark ? 'text-stone-500' : 'text-stone-500'}`}>
                                💡 {item.reason}
                            </p>
                        )}

                        {/* Actions - stacked on mobile */}
                        <div className="flex flex-col md:flex-row gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                            <Button
                                onClick={() => handleWriteArticle(item)}
                                size="sm"
                                className={`w-full md:w-auto h-9 md:h-8 px-4 text-xs font-semibold ${isDark ? 'bg-stone-800 hover:bg-stone-700 text-white' : 'bg-stone-900 hover:bg-stone-800 text-white'}`}
                            >
                                <PenTool className="w-3.5 h-3.5 mr-1.5" />
                                Write Article
                            </Button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleStartEdit(item)}
                                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-100 text-stone-500'}`}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <select
                                    value={item.status}
                                    onChange={(e) => handleUpdateStatus(item.id, e.target.value as any)}
                                    className={`flex-1 md:flex-none text-xs px-3 py-2 rounded-lg border ${isDark ? 'bg-stone-800 border-stone-700 text-stone-300' : 'bg-stone-50 border-stone-200 text-stone-600'}`}
                                >
                                    <option value="pending">⏳ Pending</option>
                                    <option value="writing">✍️ Writing</option>
                                    <option value="published">✅ Published</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        )
    }

    return (
        <div className="w-full min-h-screen font-sans py-4 md:py-6">
            <div className="mx-auto">
                <GlobalCard className="w-full shadow-sm rounded-xl">
                    {/* Integrated Header */}
                    <div className={`flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-4 border-b ${isDark ? 'border-stone-800 bg-stone-900/40' : 'border-stone-200/50 bg-stone-50/40'} backdrop-blur-sm rounded-t-xl`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-stone-800' : 'bg-stone-200'}`}>
                                <Calendar className={`w-5 h-5 ${isDark ? 'text-stone-300' : 'text-stone-600'}`} />
                            </div>
                            <div>
                                <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                    Content Plan
                                </h1>
                                <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                    {plan.plan_data.length} posts {plan.gsc_enhanced && "• ✨ GSC Enhanced"}
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-3 mt-2 md:mt-0">
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                <div key={key} className="flex items-center gap-1">
                                    <config.icon className={`w-3.5 h-3.5 ${config.className}`} />
                                    <span className={`text-xs font-medium ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
                                        {planStats[key] || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className={`flex items-center gap-2 px-4 md:px-6 py-3 border-b overflow-x-auto ${isDark ? 'border-stone-800 bg-stone-900/20' : 'border-stone-100 bg-stone-50/20'}`}>
                        {(["all", "pending", "writing", "published"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f
                                    ? (isDark ? 'bg-stone-800 text-white' : 'bg-stone-900 text-white')
                                    : (isDark ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-500 hover:bg-stone-200')
                                    }`}
                            >
                                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-4 md:p-6">
                        {/* Urgent Items (Top 5 with badges) */}
                        {urgentItems.length > 0 && (
                            <div className="mb-6">
                                <h2 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                    🔥 Top Priority
                                    <span className={`text-xs font-normal ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Based on Google data</span>
                                </h2>
                                <div className="space-y-3">
                                    {urgentItems.map((item, index) => renderPlanItem(item, index, true))}
                                </div>
                            </div>
                        )}

                        {/* Regular Items */}
                        <div className="space-y-3">
                            {regularItems.map((item, index) => renderPlanItem(item, index))}
                        </div>

                        {filteredPlan.length === 0 && (
                            <div className="text-center py-12">
                                <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                    No posts match the current filter
                                </p>
                            </div>
                        )}
                    </div>
                </GlobalCard>
            </div>

            {error && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-md">
                    <div className={`p-4 rounded-xl text-sm border ${isDark ? 'bg-red-900/20 text-red-400 border-red-800' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {error}
                    </div>
                </div>
            )}
        </div>
    )
}
