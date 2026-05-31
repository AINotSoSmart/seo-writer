"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
    Calendar,
    Sparkles,
    Zap,
    Target,
    Lock,
    PenTool,
    CheckCircle2,
    Loader2,
    FileText,
    BookOpen,
    Layout,
    BarChart3,
    MousePointerClick,
    Play,
    Layers,
    Award,
    Waypoints,
    LayoutGrid,
    Network,
} from "lucide-react"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { Button } from "@/components/ui/button"
import { GlobalCard } from "@/components/ui/global-card"
import { AutomationModal } from "@/components/automation-modal"
import { cn } from "@/lib/utils"
import { useCreditManager } from "@/lib/credit-manager"
import { createClient } from "@/utils/supabase/client"
import { CustomSpinner } from "@/components/CustomSpinner"
import { PlanCard } from "@/components/content-plan/plan-card"
import { PaywallOverlay } from "@/components/content-plan/paywall-overlay"
import { PillarPagesSection, PillarRecommendation } from "@/components/content-plan/pillar-pages-section"
import { useSubscription } from "@/contexts/subscription-context"

// Dynamic import for canvas view (heavy dependency, only load when needed)
const ContentPlanCanvas = dynamic(
    () => import("@/components/content-plan/content-plan-canvas").then(mod => ({ default: mod.ContentPlanCanvas })),
    {
        ssr: false,
        loading: () => (
            <div className="h-[600px] flex items-center justify-center bg-stone-50 border border-stone-200 rounded-xl">
                <CustomSpinner className="w-8 h-8 text-stone-500" />
            </div>
        )
    }
)

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

// Article Category Configuration for Strategic 12-8-6-4 Distribution
const ARTICLE_CATEGORY_CONFIG: Record<string, {
    label: string;
    icon: any;
    tagline: string;
    color: string;
    bgColor: string;
    targetCount: number;
}> = {
    "Core Answers": {
        label: "Core Answers",
        icon: Layers,
        tagline: "Direct answers to your customers' most burning questions.",
        color: "text-stone-700",
        bgColor: "bg-stone-100 border-stone-200",
        targetCount: 12
    },
    "Supporting Articles": {
        label: "Supporting Articles",
        icon: Waypoints,
        tagline: "Comprehensive guides that build depth and trust.",
        color: "text-stone-700",
        bgColor: "bg-stone-100 border-stone-200",
        targetCount: 8
    },
    "Conversion Pages": {
        label: "Conversion Pages",
        icon: MousePointerClick,
        tagline: "High-intent content designed to drive signups.",
        color: "text-stone-700",
        bgColor: "bg-stone-100 border-stone-200",
        targetCount: 6
    },
    "Authority Plays": {
        label: "Authority Plays",
        icon: Award,
        tagline: "Thought leadership to establish industry expertise.",
        color: "text-stone-700",
        bgColor: "bg-stone-100 border-stone-200",
        targetCount: 4
    }
}

export default function ContentPlanPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [plan, setPlan] = useState<{
        id: string;
        brand_id: string;
        plan_data: ContentPlanItem[];
        gsc_enhanced: boolean;
        automation_status?: string;
        generation_status?: string;
        generation_phase?: string;
        generation_error?: string;
        pillar_recommendations?: PillarRecommendation[] | null;
        brand_website_url?: string | null;
        discovered_competitors?: any[] | null;
    } | null>(null)
    const [filter, setFilter] = useState<"all" | "pending" | "writing" | "published">("all")
    const [viewMode, setViewMode] = useState<"list" | "canvas">("list")
    const [error, setError] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<ContentPlanItem>>({})
    const [automationLoading, setAutomationLoading] = useState(false)
    const [showAutomationModal, setShowAutomationModal] = useState(false)
    const [missedCount, setMissedCount] = useState(0)


    const [userId, setUserId] = useState<string | null>(null)

    // Credit gating - use centralized credit manager
    const { balance: creditBalance } = useCreditManager(userId)
    const hasCredits = creditBalance > 0

    // Subscription-based gating - subscribers never see paywall
    const { isSubscribed } = useSubscription()
    const MAX_FREE_ENABLED_CARDS = 2  // Free users can only interact with first 2 cards in first category

    useEffect(() => {
        // Fetch current user for credit tracking
        const supabase = createClient()
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user) {
                setUserId(data.user.id)
            }
        })

        fetchPlan()
    }, [])

    // Handle redirect when no plan exists (must be in useEffect, not render)
    useEffect(() => {
        if (!loading && !plan) {
            router.replace("/onboarding")
        }
    }, [loading, plan, router])

    // Poll for updates when plan is still generating
    useEffect(() => {
        if (!plan || plan.generation_status === 'complete' || plan.generation_status === 'failed') {
            return
        }

        // Poll every 3 seconds while generating
        const interval = setInterval(async () => {
            try {
                const res = await fetch("/api/content-plan")
                const data = await res.json()
                if (res.ok && data) {
                    setPlan(data)
                    // Stop polling when complete
                    if (data.generation_status === 'complete' || data.generation_status === 'failed') {
                        clearInterval(interval)
                    }
                }
            } catch (e) {
                console.error("Poll error:", e)
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [plan?.id, plan?.generation_status])

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
                    instructions: item.user_instructions,
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

    // Used by the memoized PlanCard component
    const handleSaveEditForItem = useCallback(async (itemId: string, updates: Partial<ContentPlanItem>) => {
        if (!plan) return

        try {
            await fetch("/api/content-plan", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planId: plan.id,
                    itemId,
                    updates,
                }),
            })

            setPlan(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    plan_data: prev.plan_data.map(item =>
                        item.id === itemId ? { ...item, ...updates } : item
                    ),
                }
            })
            setEditingId(null)
        } catch (e) {
            console.error("Failed to save edit:", e)
        }
    }, [plan])

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

    // === EARLY RETURNS - Must come BEFORE computed values to prevent crashes ===

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <CustomSpinner className="w-10 h-10" />
            </div>
        )
    }

    if (!plan) {
        // Redirect is handled by useEffect above, show spinner while redirecting
        return (
            <div className="min-h-screen flex items-center justify-center">
                <CustomSpinner className="w-10 h-10" />
            </div>
        )
    }

    // Show generating state while background job runs
    // This MUST be checked before accessing plan_data since it's empty during generation
    if (plan.generation_status === 'pending' || plan.generation_status === 'generating') {
        const phaseLabels: Record<string, { title: string; description: string }> = {
            sitemap: { title: "Syncing Your Content", description: "Fetching existing pages from your sitemap..." },
            seeds: { title: "Setting Up Your Strategy", description: "Preparing your content strategy foundation..." },
            intelligence: { title: "Analyzing Market Landscape", description: "Discovering competitors and market trends..." },
            serp: { title: "Analyzing Market Landscape", description: "Scanning competitors and SERP patterns..." },
            gap: { title: "Finding Blue Ocean Opportunities", description: "Identifying content gaps your competitors missed..." },
            hierarchy: { title: "Building Topic Hierarchy", description: "Organizing topics by strategic importance..." },
            plan: { title: "Generating Your 30-Day Plan", description: "Creating your personalized content roadmap..." }
        }
        const phaseOrder = ['sitemap', 'intelligence', 'plan']
        const currentPhase = plan.generation_phase ? phaseLabels[plan.generation_phase] || phaseLabels.sitemap : phaseLabels.sitemap

        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-full max-w-lg">
                    <GlobalCard contentClassName="p-4 text-center space-y-4">
                        <div className="flex justify-center">
                            <CustomSpinner className="w-12 h-12" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold text-stone-900">
                                {currentPhase.title}
                            </h2>
                            <p className="text-sm text-stone-500">
                                {currentPhase.description}
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            {phaseOrder.map((phase, i) => (
                                <div
                                    key={phase}
                                    className={cn(
                                        "w-2 h-2 rounded-full transition-all",
                                        plan.generation_phase === phase
                                            ? "bg-stone-900 w-6"
                                            : i < phaseOrder.indexOf(plan.generation_phase || 'sitemap')
                                                ? "bg-stone-400"
                                                : "bg-stone-200"
                                    )}
                                />
                            ))}
                        </div>
                        <p className="text-xs text-stone-400">
                            This usually takes 3-5 minutes. You can leave this page if you want.
                        </p>
                    </GlobalCard>
                </div>
            </div>
        )
    }

    // === COMPUTED VALUES - Safe to access plan_data after early returns ===

    const planData = plan.plan_data || []

    const filteredPlan = planData.filter(item => {
        if (filter === "all") return true
        return item.status === filter
    })

    const urgentItems = filteredPlan.filter(item => item.badge && ["high_impact", "quick_win"].includes(item.badge)).slice(0, 5)
    const regularItems = filteredPlan.filter(item => !urgentItems.includes(item))

    const planStats = planData.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    // Show error state if generation failed
    if (plan.generation_status === 'failed') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-full max-w-md">
                    <GlobalCard className="p-8 text-center space-y-6">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                            <Zap className="w-6 h-6 text-red-500" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold text-stone-900">
                                Generation Failed
                            </h2>
                            <p className="text-sm text-stone-500">
                                {"Something went wrong. Please try again."}
                            </p>
                        </div>
                        <Button onClick={() => router.push("/onboarding")} className="w-full">
                            Try Again
                        </Button>
                    </GlobalCard>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full min-h-screen font-sans">
            <GlobalCard className="relative flex w-full flex-col w-full rounded-xl border border-stone-100 bg-white">
                {/* --- Integrated Header --- */}
                {/* --- Integrated Header --- */}
                <div className="flex flex-col gap-6 px-5 py-5 border-b border-stone-200/50 bg-stone-50/40 backdrop-blur-md rounded-t-xl sticky top-0 z-10 min-h-[80px]">
                    <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between lg:justify-start gap-4">
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-black text-stone-900 tracking-tight flex items-center gap-2 flex-wrap">
                                    {plan?.gsc_enhanced ? (
                                        <>
                                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-sm transition-transform hover:rotate-3">
                                                <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
                                            </div>
                                            <span className="bg-gradient-to-r from-stone-900 to-stone-600 bg-clip-text text-transparent">Content Strategy</span>
                                        </>
                                    ) : (
                                        "Strategy Roadmap"
                                    )}
                                </h1>
                                {plan?.plan_data && (
                                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-stone-900 text-[11px] font-black text-white px-2 shadow-md">
                                        {plan.plan_data.length}
                                    </span>
                                )}
                            </div>
                        </div>
                        {plan && (
                            <p className="text-[11px] font-bold text-stone-400 pl-1 uppercase tracking-[0.15em] opacity-80 mt-1 whitespace-nowrap">
                                Data-Driven 30 Day Roadmap
                            </p>
                        )}
                    </div>

                    {/* Consolidated Toolbar */}
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
                        {/* Left: Filter Tabs */}
                        {plan && (
                            <div className="flex items-center p-1 bg-stone-100/50 border border-stone-200/50 rounded-xl overflow-x-auto w-full lg:w-auto no-scrollbar">
                                <button
                                    onClick={() => setFilter("all")}
                                    className={cn(
                                        "relative px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap z-10",
                                        filter === "all"
                                            ? "text-stone-900 bg-white shadow-sm ring-1 ring-stone-200"
                                            : "text-stone-500 hover:text-stone-700"
                                    )}
                                >
                                    All <span className="opacity-40 ml-1">{plan.plan_data.length}</span>
                                </button>
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilter(key as any)}
                                        className={cn(
                                            "cursor-pointer relative px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap z-10 flex items-center gap-2",
                                            filter === key
                                                ? "text-stone-900 bg-white shadow-sm ring-1 ring-stone-200"
                                                : "text-stone-500 hover:text-stone-700"
                                        )}
                                    >
                                        {config.label}
                                        <span className="opacity-40">{planStats[key] || 0}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Right: Actions & View */}
                        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                            {/* View Mode Toggle */}
                            {plan && (
                                <div className="flex items-center p-0.5 bg-stone-100/50 border border-stone-200/50 rounded-lg">
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className={cn(
                                            "cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all",
                                            viewMode === "list"
                                                ? "text-stone-900 bg-white shadow-sm ring-1 ring-stone-200"
                                                : "text-stone-400 hover:text-stone-600"
                                        )}
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5" />
                                        Cards
                                    </button>
                                    <button
                                        onClick={() => setViewMode("canvas")}
                                        className={cn(
                                            "cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all",
                                            viewMode === "canvas"
                                                ? "text-stone-900 bg-white shadow-sm ring-1 ring-stone-200"
                                                : "text-stone-400 hover:text-stone-600"
                                        )}
                                    >
                                        <Network className="w-3.5 h-3.5" />
                                        Canvas
                                    </button>
                                </div>
                            )}

                            {/* Credits Warning */}
                            {!hasCredits && (
                                <Link href="/subscribe" className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100 hover:bg-red-100/50 transition-colors">
                                    <Lock className="w-3 h-3" />
                                    <span>Top up</span>
                                </Link>
                            )}



                            {/* Auto-Refill Button (Clean) */}
                            {plan && (
                                <Button
                                    onClick={handleToggleAutomation}
                                    disabled={automationLoading || !isSubscribed || (!hasCredits && plan.automation_status !== "active")}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-9 px-4 text-[11px] font-bold border-stone-200 hover:bg-stone-50 hover:text-stone-900 transition-all rounded-lg",
                                        plan.automation_status === "active" && "bg-stone-50 border-stone-300"
                                    )}
                                >
                                    {automationLoading ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                                            {plan.automation_status === "active" ? "Disabling..." : "Enabling..."}
                                        </>
                                    ) : plan.automation_status === "active" ? (
                                        <>
                                            <span className="relative flex h-2 w-2 mr-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                            Automation On
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-3.5 h-3.5" />
                                            Enable Automation
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Body Content --- */}
                {viewMode === "canvas" && plan ? (
                    /* Canvas View */
                    <div className="p-2">
                        <ContentPlanCanvas
                            planData={plan.plan_data || []}
                            pillars={plan.pillar_recommendations || null}
                            brandWebsiteUrl={plan.brand_website_url || null}
                            discoveredCompetitors={plan.discovered_competitors || null}
                        />
                    </div>
                ) : (
                    /* List/Cards View */
                    <div className="p-4 space-y-8">



                    {/* Pillar Pages Section - Replaces Quick Analysis */}
                    {plan && (
                        <PillarPagesSection
                            pillars={plan.pillar_recommendations || null}
                            brandId={plan.brand_id}
                            onPillarUpdated={(updatedPillar) => {
                                // Update local state when a pillar is marked as created
                                setPlan(prev => {
                                    if (!prev || !prev.pillar_recommendations) return prev
                                    return {
                                        ...prev,
                                        pillar_recommendations: prev.pillar_recommendations.map(p =>
                                            p.id === updatedPillar.id ? updatedPillar : p
                                        )
                                    }
                                })
                            }}
                        />
                    )}

                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3">
                            <CustomSpinner className="w-10 h-10" />
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
                            <Button onClick={() => router.push("/onboarding")} className="h-10 px-6 font-semibold shadow-md active:scale-95 transition-transform">
                                <Sparkles className="w-4 h-4 mr-2" />
                                Create First Plan
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-8">
                                {(() => {
                                    // Get today's date in local timezone (YYYY-MM-DD format)
                                    const today = new Date()
                                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

                                    // Sort categories: the one containing today's article comes first
                                    const sortedCategories = Object.entries(ARTICLE_CATEGORY_CONFIG).sort(([keyA], [keyB]) => {
                                        const hasToday = (key: string) => filteredPlan.some(
                                            item => item.article_category === key &&
                                                item.scheduled_date.split('T')[0] === todayStr
                                        )
                                        const aHasToday = hasToday(keyA)
                                        const bHasToday = hasToday(keyB)
                                        if (aHasToday && !bHasToday) return -1
                                        if (!aHasToday && bHasToday) return 1
                                        return 0
                                    })

                                    return sortedCategories.map(([categoryKey, categoryConfig], categoryIndex) => {
                                        // Get items for this category and sort by date
                                        const rawCategoryItems = filteredPlan
                                            .filter(item => item.article_category === categoryKey)
                                            .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())

                                        // Circular rotation: find today's article index and rotate
                                        // So today's article is first, older ones wrap to end
                                        const todayIndex = rawCategoryItems.findIndex(
                                            item => item.scheduled_date.split('T')[0] === todayStr
                                        )

                                        const categoryItems = todayIndex > 0
                                            ? [...rawCategoryItems.slice(todayIndex), ...rawCategoryItems.slice(0, todayIndex)]
                                            : rawCategoryItems

                                        // Skip empty sections when filtering by status
                                        if (categoryItems.length === 0 && filter !== 'all') return null

                                        const CategoryIcon = categoryConfig.icon
                                        const completedCount = categoryItems.filter(i => i.status === 'published').length

                                        // FREE USER GATING LOGIC:
                                        // - First category (index 0): show first 2 cards enabled (can write), rest paywalled
                                        // - Other categories (1,2,3): show first 3 cards visible but DISABLED, rest paywalled
                                        // SUBSCRIBER LOGIC: Never paywalled, button state controlled by hasCredits
                                        const isFirstCategory = categoryIndex === 0

                                        // Cards per row (for showing one full row in other categories)
                                        const CARDS_PER_ROW = 3

                                        // Enabled cards: only first category gets writing ability
                                        const freeUserEnabledCount = isFirstCategory ? MAX_FREE_ENABLED_CARDS : 0

                                        // Visible cards: first category uses enabledCount, others show full first row
                                        const freeUserVisibleCount = isFirstCategory
                                            ? MAX_FREE_ENABLED_CARDS
                                            : CARDS_PER_ROW

                                        // Determine how many cards to show (not paywalled)
                                        const visibleCardsCount = isSubscribed
                                            ? categoryItems.length
                                            : freeUserVisibleCount

                                        // Determine how many cards have write enabled
                                        const enabledCardsCount = isSubscribed
                                            ? categoryItems.length
                                            : freeUserEnabledCount

                                        // Should we show paywall for this category?
                                        const showPaywall = !isSubscribed && categoryItems.length > visibleCardsCount

                                        return (
                                            <section key={categoryKey}>
                                                {/* Section Header */}
                                                {/* Section Header */}
                                                <div className="flex items-start justify-between gap-4 mb-6 mt-2 px-1">
                                                    <div className="flex gap-3">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 border",
                                                            categoryConfig.bgColor,
                                                            categoryConfig.color
                                                        )}>
                                                            <CategoryIcon className="w-4 h-4" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <h2 className="text-sm font-bold text-stone-900 tracking-tight flex items-center gap-2">
                                                                {categoryConfig.label}
                                                            </h2>
                                                            <p className="text-[11px] text-stone-500 max-w-md leading-relaxed">
                                                                <span className="font-semibold text-stone-400">Why: </span>
                                                                {categoryConfig.tagline}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            "text-[10px] font-bold px-2 py-1 rounded-md bg-stone-100/50 text-stone-400 border border-stone-100/50"
                                                        )}>
                                                            {completedCount} / {categoryConfig.targetCount} Published
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Articles Grid */}
                                                {categoryItems.length > 0 ? (
                                                    <>
                                                        {/* Visible Cards (may include enabled + disabled-but-visible) */}
                                                        {visibleCardsCount > 0 && (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                                {categoryItems.slice(0, visibleCardsCount).map((item, itemIndex) => {
                                                                    // Determine if this card's write button should be enabled
                                                                    // Subscribers: all cards follow hasCredits
                                                                    // Free users: only first N cards in FIRST category can write
                                                                    const canWrite = isSubscribed
                                                                        ? hasCredits
                                                                        : (itemIndex < enabledCardsCount && hasCredits)

                                                                    return (
                                                                        <PlanCard
                                                                            key={item.id}
                                                                            item={item}
                                                                            isEditing={editingId === item.id}
                                                                            hasCredits={canWrite}
                                                                            onStartEdit={() => handleStartEdit(item)}
                                                                            onCancelEdit={() => setEditingId(null)}
                                                                            onSaveEdit={(updates) => handleSaveEditForItem(item.id, updates)}
                                                                            onWriteArticle={() => handleWriteArticle(item)}
                                                                        />
                                                                    )
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Paywalled Cards (free users only, subscribers never see this) */}
                                                        {showPaywall && (
                                                            <PaywallOverlay
                                                                hiddenCount={categoryItems.length - visibleCardsCount}
                                                                categoryName={categoryConfig.label}
                                                            >
                                                                <div className={cn(
                                                                    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5",
                                                                    visibleCardsCount > 0 && "mt-5"
                                                                )}>
                                                                    {categoryItems.slice(visibleCardsCount).map((item) => (
                                                                        <PlanCard
                                                                            key={item.id}
                                                                            item={item}
                                                                            isEditing={false}
                                                                            hasCredits={false}
                                                                            onStartEdit={() => { }}
                                                                            onCancelEdit={() => { }}
                                                                            onSaveEdit={() => { }}
                                                                            onWriteArticle={() => { }}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </PaywallOverlay>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="text-center py-6 text-stone-400 text-sm border border-dashed border-stone-200 rounded-lg">
                                                        No {categoryConfig.label} yet
                                                    </div>
                                                )}
                                            </section>
                                        )
                                    })
                                })()}

                                {/* Uncategorized Section (for legacy plans without article_category) */}
                                {filteredPlan.filter(item => !item.article_category).length > 0 && (
                                    <section>
                                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-stone-100">
                                            <Layout className="w-4 h-4 text-stone-400" />
                                            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                                                Legacy / Uncategorized
                                            </h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {filteredPlan
                                                .filter(item => !item.article_category)
                                                .map((item) => (
                                                    <PlanCard
                                                        key={item.id}
                                                        item={item}
                                                        isEditing={editingId === item.id}
                                                        hasCredits={hasCredits}
                                                        onStartEdit={() => handleStartEdit(item)}
                                                        onCancelEdit={() => setEditingId(null)}
                                                        onSaveEdit={(updates) => handleSaveEditForItem(item.id, updates)}
                                                        onWriteArticle={() => handleWriteArticle(item)}
                                                    />
                                                ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </>
                    )}
                </div>
                )}
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

