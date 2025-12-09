"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
    Calendar,
    Sparkles,
    TrendingUp,
    Zap,
    Target,
    PenTool,
    ExternalLink,
    ChevronRight,
    Filter,
    CheckCircle2,
    Clock,
    Loader2
} from "lucide-react"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { Button } from "@/components/ui/button"

// Badge colors and icons
const BADGE_CONFIG = {
    high_impact: { label: "High Impact", icon: Sparkles, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    quick_win: { label: "Quick Win", icon: Zap, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    low_ctr: { label: "Low CTR", icon: TrendingUp, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    new_opportunity: { label: "New", icon: Target, className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
}

const INTENT_COLORS = {
    informational: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
    comparison: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
    tutorial: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
    commercial: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
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

    const handleWriteArticle = (item: ContentPlanItem) => {
        // Navigate to blog writer with topic pre-filled
        const params = new URLSearchParams({
            topic: item.title,
            keyword: item.main_keyword,
        })
        router.push(`/blog-writer?${params.toString()}`)
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

            // Update local state
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

    return (
        <div className={`min-h-screen ${isDark ? 'bg-stone-950' : 'bg-stone-50'}`}>
            {/* Header */}
            <div className={`sticky top-0 z-10 border-b ${isDark ? 'bg-stone-950/95 border-stone-800' : 'bg-stone-50/95 border-stone-200'} backdrop-blur-sm`}>
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-stone-800' : 'bg-stone-200'}`}>
                                <Calendar className={`w-5 h-5 ${isDark ? 'text-stone-300' : 'text-stone-600'}`} />
                            </div>
                            <div>
                                <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                    30-Day Content Plan
                                </h1>
                                <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                    {plan.plan_data.length} posts • {plan.gsc_enhanced && "GSC Enhanced"}
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
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
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 mt-4">
                        {(["all", "pending", "writing", "published"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f
                                        ? (isDark ? 'bg-stone-800 text-white' : 'bg-stone-900 text-white')
                                        : (isDark ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-500 hover:bg-stone-200')
                                    }`}
                            >
                                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                <div className="space-y-3">
                    {filteredPlan.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={`rounded-xl border p-4 transition-all ${isDark
                                    ? 'bg-stone-900 border-stone-800 hover:border-stone-700'
                                    : 'bg-white border-stone-200 hover:border-stone-300'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Date Badge */}
                                <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center ${isDark ? 'bg-stone-800' : 'bg-stone-100'}`}>
                                    <span className={`text-xs font-medium ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                        {new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short' })}
                                    </span>
                                    <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                        {new Date(item.scheduled_date).getDate()}
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                {item.title}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                {/* Badge */}
                                                {item.badge && BADGE_CONFIG[item.badge] && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${BADGE_CONFIG[item.badge].className}`}>
                                                        {(() => {
                                                            const BadgeIcon = BADGE_CONFIG[item.badge!].icon
                                                            return <BadgeIcon className="w-3 h-3" />
                                                        })()}
                                                        {BADGE_CONFIG[item.badge].label}
                                                    </span>
                                                )}
                                                {/* Keyword */}
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-stone-800 text-stone-400' : 'bg-stone-100 text-stone-600'}`}>
                                                    {item.main_keyword}
                                                </span>
                                                {/* Intent */}
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${INTENT_COLORS[item.intent]}`}>
                                                    {item.intent}
                                                </span>
                                                {/* Cluster */}
                                                {item.cluster && (
                                                    <span className={`text-[10px] ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                                                        {item.cluster}
                                                    </span>
                                                )}
                                            </div>
                                            {/* GSC Data */}
                                            {item.gsc_impressions && (
                                                <div className={`flex items-center gap-3 mt-2 text-[10px] ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                                                    <span>{item.gsc_impressions.toLocaleString()} impressions</span>
                                                    {item.gsc_position && <span>Position {item.gsc_position}</span>}
                                                    {item.gsc_ctr && <span>{item.gsc_ctr}% CTR</span>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {/* Status Dropdown */}
                                            <select
                                                value={item.status}
                                                onChange={(e) => handleUpdateStatus(item.id, e.target.value as any)}
                                                className={`text-xs px-2 py-1 rounded-lg border appearance-none ${isDark
                                                        ? 'bg-stone-800 border-stone-700 text-stone-300'
                                                        : 'bg-stone-50 border-stone-200 text-stone-600'
                                                    }`}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="writing">Writing</option>
                                                <option value="published">Published</option>
                                            </select>

                                            {/* Write Button */}
                                            <Button
                                                onClick={() => handleWriteArticle(item)}
                                                size="sm"
                                                className={`h-8 px-3 text-xs font-medium ${isDark
                                                        ? 'bg-stone-800 hover:bg-stone-700 text-white'
                                                        : 'bg-stone-900 hover:bg-stone-800 text-white'
                                                    }`}
                                            >
                                                <PenTool className="w-3 h-3 mr-1.5" />
                                                Write
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {filteredPlan.length === 0 && (
                    <div className="text-center py-12">
                        <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                            No posts match the current filter
                        </p>
                    </div>
                )}
            </div>

            {/* Error Display */}
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
