"use client"

import Image from "next/image"
import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Loader2, ChevronUp, ArrowRight, Globe, BadgeCheck, Calendar, TrendingUp, ExternalLink, Shield, CheckCircle2, Users, Sparkles, Zap, Target, Lock, Ban, Trash2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { saveBrandAction } from "@/actions/brand"
import { BrandDetails } from "@/lib/schemas/brand"
import { ContentPlanItem, CompetitorData } from "@/lib/schemas/content-plan"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

// localStorage keys for persistence
const STORAGE_KEYS = {
    STEP: 'onboarding_step',
    BRAND_URL: 'onboarding_brand_url',
    BRAND_DATA: 'onboarding_brand_data',
    BRAND_ID: 'onboarding_brand_id',
    COMPETITORS: 'onboarding_competitors',
    COMPETITOR_SEEDS: 'onboarding_competitor_seeds',
    CONTENT_PLAN: 'onboarding_content_plan',
    PLAN_ID: 'onboarding_plan_id',
} as const

// Voice step removed - style_dna is now part of brand extraction
type Step = "brand" | "competitors" | "plan" | "gsc-prompt" | "gsc-reassurance" | "gsc-sites" | "gsc-enhancing" | "complete"

interface GSCSite {
    siteUrl: string
    permissionLevel: string
}

export default function OnboardingPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    const [isHydrated, setIsHydrated] = useState(false)
    const [step, setStep] = useState<Step>("brand")

    // Brand DNA State
    const [url, setUrl] = useState("")
    const [analyzing, setAnalyzing] = useState(false)
    const [brandData, setBrandData] = useState<BrandDetails | null>(null)
    const [savingBrand, setSavingBrand] = useState(false)
    const [brandId, setBrandId] = useState<string | null>(null)

    // Competitor Analysis State
    const [analyzingCompetitors, setAnalyzingCompetitors] = useState(false)
    const [competitors, setCompetitors] = useState<CompetitorData[]>([])
    const [competitorSeeds, setCompetitorSeeds] = useState<string[]>([])

    // Content Plan State
    const [generatingPlan, setGeneratingPlan] = useState(false)
    const [contentPlan, setContentPlan] = useState<ContentPlanItem[]>([])
    const [planId, setPlanId] = useState<string | null>(null)
    const [savingPlan, setSavingPlan] = useState(false)

    // GSC State
    const [hasGSC, setHasGSC] = useState(false)
    const [enhancingWithGSC, setEnhancingWithGSC] = useState(false)
    const [gscSites, setGscSites] = useState<GSCSite[]>([])
    const [selectedSite, setSelectedSite] = useState<string>("")
    const [loadingGscSites, setLoadingGscSites] = useState(false)

    const [error, setError] = useState("")

    // Clear all onboarding data from localStorage
    const clearOnboardingStorage = useCallback(() => {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key)
        })
    }, [])

    // Restore state from localStorage on mount
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Check URL params first for step and brandId
        const urlStep = searchParams.get('step') // Keep as string for gsc-success handling
        const urlBrandId = searchParams.get('brandId')

        // Handle GSC callback success - this is critical!
        if (urlStep === 'gsc-success') {
            // GSC connected successfully - now show site selection
            const savedPlanId = localStorage.getItem(STORAGE_KEYS.PLAN_ID)
            const savedContentPlan = localStorage.getItem(STORAGE_KEYS.CONTENT_PLAN)

            if (savedContentPlan) {
                try {
                    setContentPlan(JSON.parse(savedContentPlan))
                } catch { }
            }
            if (savedPlanId) setPlanId(savedPlanId)

            // Restore brand data for context
            const savedBrandData = localStorage.getItem(STORAGE_KEYS.BRAND_DATA)
            if (savedBrandData) {
                try {
                    setBrandData(JSON.parse(savedBrandData))
                } catch { }
            }

            // Set GSC connected flag and go to site selection
            setHasGSC(true)
            setStep("gsc-sites")

            // Fetch available GSC sites
            fetchGscSites()

            setIsHydrated(true)
            return
        }

        // Restore step (handle all valid steps - voice step removed)
        const savedStep = urlStep || localStorage.getItem(STORAGE_KEYS.STEP)
        const validSteps: Step[] = ["brand", "competitors", "plan", "gsc-prompt", "gsc-reassurance", "gsc-sites", "gsc-enhancing", "complete"]
        if (savedStep && validSteps.includes(savedStep as Step)) {
            setStep(savedStep as Step)
        }

        // Restore brand URL
        const savedUrl = localStorage.getItem(STORAGE_KEYS.BRAND_URL)
        if (savedUrl) setUrl(savedUrl)

        // Restore brand data
        const savedBrandData = localStorage.getItem(STORAGE_KEYS.BRAND_DATA)
        if (savedBrandData) {
            try {
                setBrandData(JSON.parse(savedBrandData))
            } catch { }
        }

        // Restore brand ID
        const savedBrandId = urlBrandId || localStorage.getItem(STORAGE_KEYS.BRAND_ID)
        if (savedBrandId) {
            setBrandId(savedBrandId)
            // If we have a brandId but no specific step, proceed to competitors
            if (!urlStep && !savedStep) setStep('competitors')
        }

        // Restore competitor and content plan data
        const savedCompetitors = localStorage.getItem(STORAGE_KEYS.COMPETITORS)
        if (savedCompetitors) {
            try {
                setCompetitors(JSON.parse(savedCompetitors))
            } catch { }
        }

        const savedSeeds = localStorage.getItem(STORAGE_KEYS.COMPETITOR_SEEDS)
        if (savedSeeds) {
            try {
                setCompetitorSeeds(JSON.parse(savedSeeds))
            } catch { }
        }

        const savedContentPlan = localStorage.getItem(STORAGE_KEYS.CONTENT_PLAN)
        if (savedContentPlan) {
            try {
                setContentPlan(JSON.parse(savedContentPlan))
            } catch { }
        }

        const savedPlanId = localStorage.getItem(STORAGE_KEYS.PLAN_ID)
        if (savedPlanId) setPlanId(savedPlanId)

        setIsHydrated(true)
    }, [searchParams])

    // Persist step to localStorage and URL
    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.STEP, step)

        // Update URL with current step and brandId
        const params = new URLSearchParams()
        params.set('step', step)
        if (brandId) params.set('brandId', brandId)

        // Use replaceState to avoid adding to browser history for every change
        window.history.replaceState(null, '', `?${params.toString()}`)
    }, [step, brandId, isHydrated])

    // Persist brand data to localStorage
    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.BRAND_URL, url)
    }, [url, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        if (brandData) {
            localStorage.setItem(STORAGE_KEYS.BRAND_DATA, JSON.stringify(brandData))
        } else {
            localStorage.removeItem(STORAGE_KEYS.BRAND_DATA)
        }
    }, [brandData, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        if (brandId) {
            localStorage.setItem(STORAGE_KEYS.BRAND_ID, brandId)
        }
    }, [brandId, isHydrated])

    // Brand DNA handlers
    const handleAnalyzeBrand = async () => {
        if (!url) return
        setAnalyzing(true)
        setError("")
        try {
            const res = await fetch("/api/analyze-brand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to analyze brand")
            setBrandData(data)
        } catch (e: any) {
            setError(e.message || "An error occurred")
        } finally {
            setAnalyzing(false)
        }
    }

    const handleSaveBrand = async () => {
        if (!brandData) return
        setSavingBrand(true)
        setError("")
        try {
            // Save brand data (style_dna is already included in brandData)
            const res = await saveBrandAction(url, brandData)
            if (!res.success || !res.brandId) {
                throw new Error(res.error || "Failed to save brand")
            }
            setBrandId(res.brandId)

            // No longer creating separate brand_voices entry
            // style_dna is saved as part of brand_details

            // Proceed directly to competitor analysis
            setStep("competitors")
            // Auto-start competitor analysis
            handleAnalyzeCompetitors()
        } catch (e: any) {
            setError(e.message || "Failed to save brand details")
        } finally {
            setSavingBrand(false)
        }
    }

    // Competitor Analysis handler
    const handleAnalyzeCompetitors = async () => {
        // URL is optional - we use brandContext for category-based competitor search
        if (!brandData) return
        setAnalyzingCompetitors(true)
        setError("")
        try {
            const res = await fetch("/api/analyze-competitors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: url || `https://${brandData.product_name.toLowerCase().replace(/\s+/g, '')}.com`, // Fallback URL for exclusion
                    brandContext: `${brandData.product_name} - ${brandData.product_identity.literally}. Target: ${brandData.audience.primary}`,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to analyze competitors")

            setCompetitors(data.competitors || [])
            setCompetitorSeeds(data.seeds || [])

            // Persist to localStorage
            localStorage.setItem(STORAGE_KEYS.COMPETITORS, JSON.stringify(data.competitors || []))
            localStorage.setItem(STORAGE_KEYS.COMPETITOR_SEEDS, JSON.stringify(data.seeds || []))

            // Auto-proceed to plan generation
            setStep("plan")
            handleGeneratePlan(data.seeds)
        } catch (e: any) {
            setError(e.message || "Failed to analyze competitors")
        } finally {
            setAnalyzingCompetitors(false)
        }
    }

    // Content Plan Generation handler
    const handleGeneratePlan = async (seeds: string[]) => {
        if (!brandData || seeds.length === 0) return
        setGeneratingPlan(true)
        setError("")
        try {
            const res = await fetch("/api/generate-content-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seeds, brandData }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to generate plan")

            setContentPlan(data.plan || [])
            localStorage.setItem(STORAGE_KEYS.CONTENT_PLAN, JSON.stringify(data.plan || []))
        } catch (e: any) {
            setError(e.message || "Failed to generate content plan")
        } finally {
            setGeneratingPlan(false)
        }
    }

    // Save Content Plan handler
    const handleSavePlan = async () => {
        if (contentPlan.length === 0) return
        setSavingPlan(true)
        setError("")
        try {
            const res = await fetch("/api/content-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    planData: contentPlan,
                    brandId,
                    competitorSeeds,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to save plan")

            setPlanId(data.id)
            localStorage.setItem(STORAGE_KEYS.PLAN_ID, data.id)

            // Proceed to GSC prompt
            setStep("gsc-prompt")
        } catch (e: any) {
            setError(e.message || "Failed to save content plan")
        } finally {
            setSavingPlan(false)
        }
    }

    // GSC Connection handler
    const handleConnectGSC = () => {
        // Redirect to GSC OAuth
        window.location.href = "/api/auth/gsc"
    }

    // Skip GSC and complete onboarding
    const handleSkipGSC = () => {
        clearOnboardingStorage()
        router.push("/content-plan")
    }

    // Fetch GSC sites after OAuth
    const fetchGscSites = async () => {
        setLoadingGscSites(true)
        setError("")
        try {
            const res = await fetch("/api/gsc/sites")
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to fetch sites")

            setGscSites(data.sites || [])

            // If only one site, auto-select it
            if (data.sites?.length === 1) {
                setSelectedSite(data.sites[0].siteUrl)
            }
        } catch (e: any) {
            setError(e.message || "Failed to fetch GSC sites")
        } finally {
            setLoadingGscSites(false)
        }
    }

    // Select site and proceed to enhancement
    const handleSelectSiteAndEnhance = async () => {
        if (!selectedSite) {
            setError("Please select a site")
            return
        }

        setStep("gsc-enhancing")
        setEnhancingWithGSC(true)
        setError("")

        try {
            // First, save the selected site
            await fetch("/api/gsc/sites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ siteUrl: selectedSite }),
            })

            // Call the new strategic GSC plan generation API
            // This uses proper filtering, deduplication, and LLM-based planning
            console.log("=== Calling GSC Strategic Plan Generation ===")
            const planRes = await fetch("/api/gsc/generate-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brandData: brandData,
                    competitorSeeds: competitorSeeds,
                    brandName: brandData?.product_name || "",
                }),
            })

            if (!planRes.ok) {
                const errorData = await planRes.json()
                throw new Error(errorData.error || "Failed to generate strategic plan from GSC data")
            }

            const { plan: gscBasedPlan } = await planRes.json()

            console.log("=== STRATEGIC GSC PLAN GENERATED ===")
            console.log("Plan items:", gscBasedPlan.length)
            console.log("Sample titles:", gscBasedPlan.slice(0, 3).map((p: any) => p.title))

            // Update existing plan in database using PUT
            if (planId) {
                const updateRes = await fetch("/api/content-plan", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        planId,
                        planData: gscBasedPlan,
                        gscEnhanced: true,
                    }),
                })

                if (!updateRes.ok) {
                    console.error("Failed to save plan to database")
                }
            }

            // Clear storage and redirect to content plan
            clearOnboardingStorage()
            router.push("/content-plan")
        } catch (e: any) {
            console.error("GSC plan generation failed:", e)
            setError(e.message || "Failed to generate strategic plan. You can continue without GSC.")
        } finally {
            setEnhancingWithGSC(false)
        }
    }

    // Complete with GSC enhancement
    const handleCompleteWithGSC = async () => {
        setEnhancingWithGSC(true)
        setError("")
        try {
            // Enhance plan with GSC data
            const res = await fetch("/api/gsc/fetch-insights", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planItems: contentPlan }),
            })

            if (res.ok) {
                const data = await res.json()
                // Update plan with enhanced items
                if (data.enhancedItems) {
                    await fetch("/api/content-plan", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            planId,
                            planData: data.enhancedItems,
                            gscEnhanced: true,
                        }),
                    })
                }
            }

            clearOnboardingStorage()
            router.push("/content-plan")
        } catch (e: any) {
            // Even on error, proceed to content plan
            clearOnboardingStorage()
            router.push("/content-plan")
        } finally {
            setEnhancingWithGSC(false)
        }
    }

    // Helper to update nested brand state
    const updateField = (path: string, value: any) => {
        if (!brandData) return
        const newData = { ...brandData }
        if (path.includes('.')) {
            const [parent, child] = path.split('.')
            // @ts-ignore
            newData[parent] = { ...newData[parent], [child]: value }
        } else {
            // @ts-ignore
            newData[path] = value
        }
        setBrandData(newData)
    }

    const updateArray = (field: keyof BrandDetails, value: string) => {
        const arr = value.split('\n').filter(line => line.trim() !== '')
        setBrandData(prev => prev ? ({ ...prev, [field]: arr }) : null)
    }

    // Progress indicator - simplified to show 3 main phases (voice step removed)
    const stepOrder: Step[] = ["brand", "competitors", "plan", "gsc-prompt", "gsc-reassurance", "complete"]
    const currentStepIndex = stepOrder.indexOf(step)

    const isStepComplete = (checkStep: Step) => {
        return stepOrder.indexOf(checkStep) < currentStepIndex
    }

    const isStepActive = (checkStep: Step) => {
        // Group steps into phases for display
        if (checkStep === "brand") return step === "brand"
        if (checkStep === "competitors" || checkStep === "plan") return step === "competitors" || step === "plan"
        return step === "gsc-prompt" || step === "gsc-reassurance" || step === "complete"
    }

    const ProgressIndicator = () => (
        <div className="flex items-center justify-center gap-2 mb-6">
            {/* Step 1: Brand DNA (includes voice extraction) */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${step === "brand" ? 'bg-stone-900 text-white' : isStepComplete("brand") ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-500'}`}>
                <Globe className="w-3.5 h-3.5" />
                <span>Brand</span>
                {isStepComplete("brand") && <BadgeCheck className="w-3 h-3 text-green-500" />}
            </div>
            <div className={`w-4 h-px bg-stone-200`} />

            {/* Step 2: Content Plan */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${(step === "competitors" || step === "plan") ? 'bg-stone-900 text-white' : isStepComplete("plan") ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-500'}`}>
                <Calendar className="w-3.5 h-3.5" />
                <span>Plan</span>
                {isStepComplete("plan") && <BadgeCheck className="w-3 h-3 text-green-500" />}
            </div>
            <div className={`w-4 h-px bg-stone-200`} />

            {/* Step 3: Complete/GSC */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${(step === "gsc-prompt" || step === "gsc-reassurance" || step === "complete") ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Insights</span>
            </div>
        </div>
    )

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 font-sans">
            <ProgressIndicator />

            {/* Island Container */}
            <motion.div
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`
          relative p-1 overflow-hidden w-full max-w-xl transition-all duration-300
          shadow-[0_0_0_1px_rgba(0,0,0,0.08),0px_1px_2px_rgba(0,0,0,0.04)]
          rounded-[20px]
          bg-stone-100
        `}
            >
                {/* Top Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-6 z-20 flex justify-center pointer-events-none">
                    <div className={`w-8 h-4 rounded-b-lg border-b border-x bg-stone-100 border-stone-200/50 flex items-center justify-center`}>
                        <ChevronUp className={`w-3 h-3 text-stone-400`} />
                    </div>
                </div>

                {/* Inner Card */}
                <div className={`
          relative border overflow-hidden transition-all rounded-[16px]
          bg-white border-stone-200
        `}>
                    <AnimatePresence mode="wait">
                        {step === "brand" && (
                            <motion.div
                                key="brand-step"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="p-6"
                            >
                                {!brandData ? (
                                    // URL Input Form
                                    <div className="space-y-6">
                                        <div className="text-center space-y-2">
                                            <h2 className={`text-xl font-bold text-stone-900`}>
                                                Let&apos;s understand your brand
                                            </h2>
                                            <p className={`text-sm text-stone-500`}>
                                                Share your website so we can understand your product and build your brand DNA & voice profile.
                                            </p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Input
                                                type="url"
                                                placeholder="https://yourwebsite.com"
                                                className={`flex-1 bg-stone-50 border-stone-200 py-2 px-3 text-sm`}
                                                value={url}
                                                onChange={(e) => setUrl(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeBrand()}
                                            />
                                            <Button
                                                onClick={handleAnalyzeBrand}
                                                disabled={analyzing || !url}
                                                className={`
                          px-6 font-semibold
                          bg-gradient-to-b from-stone-800 to-stone-950
                          hover:from-stone-700 hover:to-stone-900
                          shadow-sm
                        `}
                                            >
                                                {analyzing ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                        Analyzing...
                                                    </>
                                                ) : (
                                                    "Analyze"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    // Brand Review Form - Complete with all 10 sections
                                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className={`text-lg font-bold text-stone-900`}>Review Brand Details</h2>
                                                <p className={`text-xs text-stone-500`}>Verify extracted information</p>
                                            </div>

                                        </div>

                                        {/* 1. Product Identity */}
                                        <div className="space-y-3">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>1. Product Identity</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 text-stone-600`}>Product Name</label>
                                                    <Input value={brandData.product_name} onChange={e => updateField('product_name', e.target.value)} className="text-sm" />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 text-stone-600`}>What is it literally?</label>
                                                    <Input value={brandData.product_identity.literally} onChange={e => updateField('product_identity.literally', e.target.value)} className="text-sm" />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 text-stone-600`}>What is it emotionally?</label>
                                                    <Input value={brandData.product_identity.emotionally} onChange={e => updateField('product_identity.emotionally', e.target.value)} className="text-sm" />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 text-stone-600`}>What is it NOT?</label>
                                                    <Input value={brandData.product_identity.not} onChange={e => updateField('product_identity.not', e.target.value)} className="text-sm" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Mission */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>2. Mission</h3>
                                            <label className={`block text-xs font-medium text-stone-600`}>The "Why"</label>
                                            <Textarea value={brandData.mission} onChange={e => updateField('mission', e.target.value)} className="text-sm min-h-[60px]" />
                                        </div>

                                        {/* 3. Audience */}
                                        <div className="space-y-3">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>3. Audience</h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 text-stone-600`}>Primary Audience</label>
                                                    <Input value={brandData.audience.primary} onChange={e => updateField('audience.primary', e.target.value)} className="text-sm" />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 text-stone-600`}>Psychology (Desires/Fears)</label>
                                                    <Textarea value={brandData.audience.psychology} onChange={e => updateField('audience.psychology', e.target.value)} className="text-sm min-h-[60px]" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 4. Enemy */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>4. Enemy (What you fight against)</h3>
                                            <Textarea
                                                value={brandData.enemy.join('\n')}
                                                onChange={e => updateArray('enemy', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One item per line"
                                            />
                                            <p className={`text-[10px] text-right text-stone-400`}>One item per line</p>
                                        </div>

                                        {/* 5. Voice & Tone */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>5. Brand Voice & Tone</h3>
                                            <Textarea
                                                value={brandData.style_dna}
                                                onChange={e => updateArray('style_dna', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="Describe your brand's voice and tone in detail."
                                            />
                                            <p className={`text-[10px] text-right text-stone-400`}>Comprehensive writing style guide</p>
                                        </div>

                                        {/* 6. Unique Value Proposition */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>6. Unique Value Proposition</h3>
                                            <Textarea
                                                value={brandData.uvp.join('\n')}
                                                onChange={e => updateArray('uvp', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One item per line"
                                            />
                                            <p className={`text-[10px] text-right text-stone-400`}>One item per line</p>
                                        </div>

                                        {/* 7. Core Features */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>7. Core Features</h3>
                                            <Textarea
                                                value={brandData.core_features.join('\n')}
                                                onChange={e => updateArray('core_features', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One item per line"
                                            />
                                            <p className={`text-[10px] text-right text-stone-400`}>One item per line</p>
                                        </div>

                                        {/* 8. Pricing */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>8. Pricing</h3>
                                            <Textarea
                                                value={brandData.pricing?.join('\n') || ''}
                                                onChange={e => updateArray('pricing', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="e.g. Pro Plan: $29/mo"
                                            />
                                            <p className={`text-[10px] text-right text-stone-400`}>One line e.g. "Pro Plan: $29/mo"</p>
                                        </div>

                                        {/* 9. How it Works */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>9. How it Works</h3>
                                            <Textarea
                                                value={brandData.how_it_works?.join('\n') || ''}
                                                onChange={e => updateArray('how_it_works', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One step per line"
                                            />
                                            <p className={`text-[10px] text-right text-stone-400`}>One step per line</p>
                                        </div>

                                        {/* 10. Featured Image Style */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>10. Featured Image Style</h3>
                                            <label className={`block text-xs font-medium mb-1 text-stone-600`}>Style Preference</label>
                                            <select
                                                className={`w-full h-10 rounded-md border px-3 text-sm bg-white border-stone-200 text-stone-900`}
                                                value={brandData.image_style || "stock"}
                                                onChange={e => updateField('image_style', e.target.value)}
                                            >
                                                <option value="stock">Stock Photography (Professional, Realistic)</option>
                                                <option value="illustration">Modern Illustration (Flat, Vector)</option>
                                                <option value="indo">Indo (Vibrant, Cultural Elements)</option>
                                                <option value="minimalist">Minimalist (Clean, Abstract)</option>
                                                <option value="cyberpunk">Cyberpunk (Neon, Tech)</option>
                                                <option value="watercolor">Watercolor (Artistic, Soft)</option>
                                            </select>
                                            <p className={`text-[10px] text-right text-stone-400`}>Select the style for AI-generated featured images.</p>
                                        </div>

                                        {/* Continue Button */}
                                        <div className="pt-4 border-t border-stone-100  sticky bottom-0 bg-white/80 /80 backdrop-blur-sm py-4">
                                            <Button
                                                onClick={handleSaveBrand}
                                                disabled={savingBrand}
                                                className={`
                          w-full h-10 font-semibold
                          bg-gradient-to-b from-stone-800 to-stone-950
                          hover:from-stone-700 hover:to-stone-900
                        `}
                                            >
                                                {savingBrand ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        Continue
                                                        <ArrowRight className="w-4 h-4 ml-2" />
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 2: Competitor Analysis & Content Plan Generation */}
                        {(step === "competitors" || step === "plan") && (
                            <motion.div
                                key="plan-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-4 space-y-6"
                            >
                                {(analyzingCompetitors || generatingPlan) ? (
                                    // Loading State
                                    <div className="text-center space-y-6 py-8">
                                        <div className="relative w-16 h-16 mx-auto">
                                            <div className={`absolute inset-0 rounded-full border-4 border-stone-200`} />
                                            <div className={`absolute inset-0 rounded-full border-4 border-t-stone-600 animate-spin`} />
                                        </div>
                                        <div className="space-y-2">
                                            <h2 className={`text-lg font-bold text-stone-900`}>
                                                {analyzingCompetitors ? "Analyzing competitors..." : "Generating your 30-day content plan..."}
                                            </h2>
                                            <p className={`text-sm text-stone-500`}>
                                                {analyzingCompetitors
                                                    ? "Finding competitor content and extracting keywords"
                                                    : "Creating personalized blog topics for your brand"}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-center gap-2">
                                            {analyzingCompetitors ? (
                                                <>
                                                    <Users className={`w-4 h-4 text-stone-500`} />
                                                    <span className={`text-xs text-stone-500`}>Researching competitor keywords</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Calendar className={`w-4 h-4 text-stone-500`} />
                                                    <span className={`text-xs text-stone-500`}>Building your content calendar</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // Plan Display
                                    <>
                                        <div className="text-center space-y-2">
                                            <div className="flex items-center justify-center gap-2">
                                                <Sparkles className={`w-5 h-5 text-amber-500`} />
                                                <h2 className={`text-xl font-bold text-stone-900`}>
                                                    Your 30-Day Content Plan
                                                </h2>
                                            </div>
                                            <p className={`text-sm text-stone-500`}>
                                                {contentPlan.length} blog posts tailored to your brand
                                            </p>
                                        </div>

                                        {/* Plan Preview */}
                                        <div className={`rounded-xl border overflow-hidden bg-stone-50 border-stone-200`}>
                                            <div className="max-h-[300px] overflow-y-auto divide-y divide-stone-200">
                                                {contentPlan.slice(0, 10).map((item, i) => (
                                                    <div key={item.id} className={`p-3 flex items-start gap-3 hover:bg-stone-100`}>
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium bg-stone-200 text-stone-600`}>
                                                            {i + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate text-stone-900`}>
                                                                {item.title}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-200 text-stone-600`}>
                                                                    {item.main_keyword}
                                                                </span>
                                                                <span className={`text-[10px] capitalize text-stone-500`}>
                                                                    {item.intent}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {contentPlan.length > 10 && (
                                                <div className={`p-3 text-center text-xs text-stone-500`}>
                                                    +{contentPlan.length - 10} more posts in your plan
                                                </div>
                                            )}
                                        </div>

                                        {/* Save Button */}
                                        <Button
                                            onClick={handleSavePlan}
                                            disabled={savingPlan || contentPlan.length === 0}
                                            className={`
                                                w-full h-10 font-semibold
                                                bg-gradient-to-b from-stone-800 to-stone-950
                                                hover:from-stone-700 hover:to-stone-900
                                            `}
                                        >
                                            {savingPlan ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    Saving Plan...
                                                </>
                                            ) : (
                                                <>
                                                    Save & Continue
                                                    <ArrowRight className="w-4 h-4 ml-2" />
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Step 4: GSC Upgrade Prompt - Combined Value + Transparency */}
                        {step === "gsc-prompt" && (
                            <motion.div
                                key="gsc-prompt-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-4 space-y-5"
                            >
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <CheckCircle2 className={`w-6 h-6 text-green-500`} />
                                    </div>
                                    <h2 className={`text-xl font-bold text-stone-900`}>
                                        Your content plan is ready!
                                    </h2>
                                    <p className={`text-sm text-stone-500`}>
                                        Connect GSC to tailor it using your real search footprint
                                    </p>
                                </div>

                                {/* Value Unlocks + Transparency Card */}
                                <div className={`rounded-xl border p-4 space-y-4 bg-stone-50 border-stone-200`}>
                                    {/* What you unlock */}
                                    <div className="space-y-2.5">
                                        <p className={`text-xs font-medium text-stone-500`}>
                                            We&apos;ll use your data for:
                                        </p>
                                        <ul className="space-y-2">
                                            {[
                                                { icon: Zap, text: "A map of what Google already wants to rank you for." },
                                                { icon: Target, text: "The exact keywords where you're inches from page 1." },
                                                { icon: TrendingUp, text: "The hidden topics your brand is quietly building authority on." },
                                            ].map((item, i) => (
                                                <li key={i} className="flex items-start gap-2.5">
                                                    <item.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 text-stone-500`} />
                                                    <span className={`text-sm text-stone-600`}>
                                                        {item.text}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Divider */}
                                    <div className={`border-t border-stone-200`} />

                                    {/* Transparency Section */}
                                    <div className="space-y-2.5">
                                        <p className={`text-xs font-medium text-stone-500`}>
                                            Read-only. Zero changes. Zero storage.
                                        </p>
                                        <ul className="space-y-2">
                                            {[
                                                { icon: Lock, text: "We don't touch your account." },
                                                { icon: Ban, text: "We don't modify anything." },
                                                { icon: Trash2, text: "We don't store your raw GSC data." },
                                            ].map((item, i) => (
                                                <li key={i} className="flex items-center gap-2.5">
                                                    <item.icon className={`w-4 h-4 flex-shrink-0 text-stone-500`} />
                                                    <span className={`text-sm text-stone-600`}>
                                                        {item.text}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        <p className={`text-xs text-stone-500`}>
                                            We use it only to shape your content plan — then discard it on the way.
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleConnectGSC}
                                    className={`
                                        w-full h-10 font-semibold
                                        bg-gradient-to-b from-stone-800 to-stone-950
                                        hover:from-stone-700 hover:to-stone-900
                                    `}
                                >
                                    <Image src="/brands/search-console.svg" alt="" width={16} height={16} className="w-4 h-4 mr-2" />
                                    Connect Search Console
                                </Button>

                                {/* Skip Option */}
                                <button
                                    onClick={handleSkipGSC}
                                    className={`w-full text-center text-xs underline underline-offset-2 text-stone-500 hover:text-stone-400`}
                                >
                                    Continue without Search Console
                                </button>
                            </motion.div>
                        )}

                        {/* Step 6: GSC Site Selection */}
                        {step === "gsc-sites" && (
                            <motion.div
                                key="gsc-sites-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-4 space-y-6"
                            >
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <CheckCircle2 className={`w-6 h-6 text-green-500`} />
                                    </div>
                                    <h2 className={`text-xl font-bold text-stone-900`}>
                                        Connected to Search Console!
                                    </h2>
                                    <p className={`text-sm text-stone-500`}>
                                        Select which site to analyze
                                    </p>
                                </div>

                                {loadingGscSites ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className={`w-6 h-6 animate-spin text-stone-500`} />
                                    </div>
                                ) : gscSites.length === 0 ? (
                                    <div className={`text-center py-8 text-stone-500`}>
                                        <p className="text-sm">No sites found in your Search Console account.</p>
                                        <button
                                            onClick={handleSkipGSC}
                                            className="mt-4 text-sm underline"
                                        >
                                            Continue without GSC data
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`rounded-xl border overflow-hidden bg-stone-50 border-stone-200`}>
                                            <div className="max-h-[250px] overflow-y-auto divide-y divide-stone-200">
                                                {gscSites.map((site) => (
                                                    <button
                                                        key={site.siteUrl}
                                                        onClick={() => setSelectedSite(site.siteUrl)}
                                                        className={`w-full p-3 flex items-center gap-3 text-left transition-all ${selectedSite === site.siteUrl
                                                            ? 'bg-stone-200'
                                                            : 'hover:bg-stone-100'
                                                            }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedSite === site.siteUrl
                                                            ? 'border-green-500 bg-green-500'
                                                            : 'border-stone-300'
                                                            }`}>
                                                            {selectedSite === site.siteUrl && (
                                                                <CheckCircle2 className="w-3 h-3 text-white" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate text-stone-900`}>
                                                                {site.siteUrl.replace('sc-domain:', '').replace('https://', '').replace('http://', '')}
                                                            </p>
                                                            <p className={`text-xs text-stone-500`}>
                                                                {site.permissionLevel}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <Button
                                            onClick={handleSelectSiteAndEnhance}
                                            disabled={!selectedSite}
                                            className={`
                                                w-full h-10 font-semibold
                                                bg-gradient-to-b from-stone-800 to-stone-950
                                                hover:from-stone-700 hover:to-stone-900
                                                disabled:opacity-50
                                            `}
                                        >
                                            <TrendingUp className="w-4 h-4 mr-2" />
                                            Fetch Insights & Enhance Plan
                                        </Button>

                                        <button
                                            onClick={handleSkipGSC}
                                            className={`w-full text-center text-sm underline underline-offset-2 text-stone-500 hover:text-stone-600`}
                                        >
                                            Skip and continue without GSC data
                                        </button>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Step 7: GSC Enhancing (Loading State) */}
                        {step === "gsc-enhancing" && (
                            <motion.div
                                key="gsc-enhancing-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-4 space-y-6"
                            >
                                <div className="text-center space-y-6 py-8">
                                    <div className="relative w-16 h-16 mx-auto">
                                        <div className={`absolute inset-0 rounded-full border-4 border-stone-200`} />
                                        <div className={`absolute inset-0 rounded-full border-4 border-t-green-500 animate-spin`} />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className={`text-lg font-bold text-stone-900`}>
                                            Enhancing your content plan...
                                        </h2>
                                        <p className={`text-sm text-stone-500`}>
                                            Analyzing your search data to find opportunities
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <TrendingUp className={`w-4 h-4 text-stone-500`} />
                                        <span className={`text-xs text-stone-500`}>Adding opportunity scores and badges</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Error Display */}
            {error && (
                <div className="mt-6 max-w-xl w-full">
                    <div className={`p-4 rounded-xl text-sm border bg-red-50 text-red-600 border-red-100`}>
                        {error}
                    </div>
                </div>
            )}
        </div>
    )
}
