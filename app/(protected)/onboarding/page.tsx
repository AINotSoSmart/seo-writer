"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Loader2, ChevronUp, ArrowRight, Globe, Sparkles, BadgeCheck, PenTool, Users, Calendar, TrendingUp, Zap, Target, ExternalLink, Shield, CheckCircle2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { saveBrandAction } from "@/actions/brand"
import { BrandDetails } from "@/lib/schemas/brand"
import { STYLE_PRESETS } from "@/lib/presets"
import { StyleDNA } from "@/lib/schemas/style"
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
    VOICE_METHOD: 'onboarding_voice_method',
    VOICE_PRESET: 'onboarding_voice_preset',
    VOICE_MIMIC_URL: 'onboarding_voice_mimic_url',
    VOICE_NAME: 'onboarding_voice_name',
    VOICE_STYLE_JSON: 'onboarding_voice_style_json',
    COMPETITORS: 'onboarding_competitors',
    COMPETITOR_SEEDS: 'onboarding_competitor_seeds',
    CONTENT_PLAN: 'onboarding_content_plan',
    PLAN_ID: 'onboarding_plan_id',
} as const

type Step = "brand" | "voice" | "competitors" | "plan" | "gsc-prompt" | "gsc-reassurance" | "gsc-sites" | "gsc-enhancing" | "complete"

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
    const [isDark, setIsDark] = useState(false)

    // Brand DNA State
    const [url, setUrl] = useState("")
    const [analyzing, setAnalyzing] = useState(false)
    const [brandData, setBrandData] = useState<BrandDetails | null>(null)
    const [savingBrand, setSavingBrand] = useState(false)
    const [brandId, setBrandId] = useState<string | null>(null)

    // Voice State
    const [creationMethod, setCreationMethod] = useState<"preset" | "mimic">("preset")
    const [presetKey, setPresetKey] = useState("linkedin-influencer")
    const [mimicUrl, setMimicUrl] = useState("")
    const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false)
    const [voiceName, setVoiceName] = useState("")
    const [styleJson, setStyleJson] = useState(JSON.stringify(STYLE_PRESETS["linkedin-influencer"], null, 2))
    const [savingVoice, setSavingVoice] = useState(false)

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

    // Parse styleJson into a usable object for preview
    const parsedStyle = useMemo<StyleDNA | null>(() => {
        try {
            return JSON.parse(styleJson)
        } catch {
            return null
        }
    }, [styleJson])

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

        // Restore step (handle all valid steps)
        const savedStep = urlStep || localStorage.getItem(STORAGE_KEYS.STEP)
        const validSteps: Step[] = ["brand", "voice", "competitors", "plan", "gsc-prompt", "gsc-reassurance", "gsc-sites", "gsc-enhancing", "complete"]
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
            // If we have a brandId but no specific step, set to voice
            if (!urlStep && !savedStep) setStep('voice')
        }

        // Restore voice settings
        const savedMethod = localStorage.getItem(STORAGE_KEYS.VOICE_METHOD) as "preset" | "mimic" | null
        if (savedMethod) setCreationMethod(savedMethod)

        const savedPreset = localStorage.getItem(STORAGE_KEYS.VOICE_PRESET)
        if (savedPreset) setPresetKey(savedPreset)

        const savedMimicUrl = localStorage.getItem(STORAGE_KEYS.VOICE_MIMIC_URL)
        if (savedMimicUrl) setMimicUrl(savedMimicUrl)

        const savedVoiceName = localStorage.getItem(STORAGE_KEYS.VOICE_NAME)
        if (savedVoiceName) setVoiceName(savedVoiceName)

        const savedStyleJson = localStorage.getItem(STORAGE_KEYS.VOICE_STYLE_JSON)
        if (savedStyleJson) setStyleJson(savedStyleJson)

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

    // Persist voice data to localStorage
    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.VOICE_METHOD, creationMethod)
    }, [creationMethod, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.VOICE_PRESET, presetKey)
    }, [presetKey, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.VOICE_MIMIC_URL, mimicUrl)
    }, [mimicUrl, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.VOICE_NAME, voiceName)
    }, [voiceName, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.VOICE_STYLE_JSON, styleJson)
    }, [styleJson, isHydrated])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
        }
    }, [])

    useEffect(() => {
        if (creationMethod === "preset" && presetKey && STYLE_PRESETS[presetKey]) {
            setStyleJson(JSON.stringify(STYLE_PRESETS[presetKey], null, 2))
            const prettyName = presetKey.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
            setVoiceName(prettyName)
        }
    }, [presetKey, creationMethod])

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
            const res = await saveBrandAction(url, brandData)
            if (!res.success || !res.brandId) {
                throw new Error(res.error || "Failed to save brand")
            }
            setBrandId(res.brandId)
            setStep("voice")
        } catch (e: any) {
            setError(e.message || "Failed to save brand details")
        } finally {
            setSavingBrand(false)
        }
    }

    // Voice handlers
    const handleAnalyzeStyle = async () => {
        if (!mimicUrl) return
        setIsAnalyzingStyle(true)
        setError("")
        try {
            const res = await fetch("/api/extract-style", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: mimicUrl }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Failed to analyze style")
            setStyleJson(JSON.stringify(json, null, 2))
            try {
                const domain = new URL(mimicUrl).hostname.replace("www.", "")
                setVoiceName(`Style from ${domain}`)
            } catch {
                setVoiceName("My Custom Style")
            }
        } catch (e: any) {
            setError(e.message || "Failed to analyze style")
        } finally {
            setIsAnalyzingStyle(false)
        }
    }

    const handleSaveVoice = async () => {
        if (!voiceName || !styleJson) {
            setError("Please provide a voice name")
            return
        }
        setSavingVoice(true)
        setError("")
        try {
            let parsed
            try {
                parsed = JSON.parse(styleJson)
            } catch {
                throw new Error("Invalid JSON format")
            }

            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) throw new Error("User not authenticated")

            const { error } = await supabase
                .from("brand_voices")
                .insert({
                    name: voiceName,
                    style_dna: parsed,
                    user_id: user.id,
                    is_default: true,
                })

            if (error) throw error

            // Proceed to competitor analysis step (not redirecting yet)
            setStep("competitors")
            // Auto-start competitor analysis
            handleAnalyzeCompetitors()
        } catch (e: any) {
            setError(e.message || "Failed to save voice")
        } finally {
            setSavingVoice(false)
        }
    }

    // Competitor Analysis handler
    const handleAnalyzeCompetitors = async () => {
        if (!url || !brandData) return
        setAnalyzingCompetitors(true)
        setError("")
        try {
            const res = await fetch("/api/analyze-competitors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url,
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

            // Then fetch insights from that site
            const insightsRes = await fetch("/api/gsc/fetch-insights")
            if (!insightsRes.ok) {
                throw new Error("Failed to fetch GSC insights")
            }
            const insights = await insightsRes.json()

            // Enhance the existing content plan with GSC data
            const enhancedPlan = contentPlan.map(item => {
                // Find matching opportunity by keyword
                const match = insights.top_opportunities?.find((opp: any) =>
                    item.main_keyword.toLowerCase().includes(opp.query.toLowerCase()) ||
                    opp.query.toLowerCase().includes(item.main_keyword.toLowerCase())
                )

                if (match) {
                    return {
                        ...item,
                        opportunity_score: match.opportunity_score,
                        badge: match.badge,
                        gsc_impressions: match.impressions,
                        gsc_position: match.position,
                        gsc_ctr: match.ctr,
                    }
                }
                return item
            })

            // Sort by opportunity score (items with GSC data first)
            enhancedPlan.sort((a, b) => {
                if (a.opportunity_score && b.opportunity_score) {
                    return b.opportunity_score - a.opportunity_score
                }
                if (a.opportunity_score) return -1
                if (b.opportunity_score) return 1
                return 0
            })

            // Update plan in database
            if (planId) {
                await fetch("/api/content-plan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        planData: enhancedPlan,
                        brandId,
                        competitorSeeds,
                        gscEnhanced: true,
                    }),
                })
            }

            // Clear storage and redirect to content plan
            clearOnboardingStorage()
            router.push("/content-plan")
        } catch (e: any) {
            setError(e.message || "Failed to enhance plan with GSC data")
            // Even on error, allow user to skip
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

    // Progress indicator - simplified to show 4 main phases
    const stepOrder: Step[] = ["brand", "voice", "competitors", "plan", "gsc-prompt", "gsc-reassurance", "complete"]
    const currentStepIndex = stepOrder.indexOf(step)

    const isStepComplete = (checkStep: Step) => {
        return stepOrder.indexOf(checkStep) < currentStepIndex
    }

    const isStepActive = (checkStep: Step) => {
        // Group steps into phases for display
        if (checkStep === "brand") return step === "brand"
        if (checkStep === "voice") return step === "voice"
        if (checkStep === "competitors" || checkStep === "plan") return step === "competitors" || step === "plan"
        return step === "gsc-prompt" || step === "gsc-reassurance" || step === "complete"
    }

    const ProgressIndicator = () => (
        <div className="flex items-center justify-center gap-2 mb-6">
            {/* Step 1: Brand DNA */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${step === "brand" ? (isDark ? 'bg-stone-800 text-white' : 'bg-stone-900 text-white') : isStepComplete("brand") ? (isDark ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-700') : (isDark ? 'bg-stone-800 text-stone-500' : 'bg-stone-100 text-stone-400')}`}>
                <Globe className="w-3.5 h-3.5" />
                <span>Brand</span>
                {isStepComplete("brand") && <BadgeCheck className="w-3 h-3 text-green-500" />}
            </div>
            <div className={`w-4 h-px ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`} />

            {/* Step 2: Voice Style */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${step === "voice" ? (isDark ? 'bg-stone-800 text-white' : 'bg-stone-900 text-white') : isStepComplete("voice") ? (isDark ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-700') : (isDark ? 'bg-stone-800 text-stone-500' : 'bg-stone-100 text-stone-400')}`}>
                <PenTool className="w-3.5 h-3.5" />
                <span>Voice</span>
                {isStepComplete("voice") && <BadgeCheck className="w-3 h-3 text-green-500" />}
            </div>
            <div className={`w-4 h-px ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`} />

            {/* Step 3: Content Plan */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${(step === "competitors" || step === "plan") ? (isDark ? 'bg-stone-800 text-white' : 'bg-stone-900 text-white') : isStepComplete("plan") ? (isDark ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-700') : (isDark ? 'bg-stone-800 text-stone-500' : 'bg-stone-100 text-stone-400')}`}>
                <Calendar className="w-3.5 h-3.5" />
                <span>Plan</span>
                {isStepComplete("plan") && <BadgeCheck className="w-3 h-3 text-green-500" />}
            </div>
            <div className={`w-4 h-px ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`} />

            {/* Step 4: Complete/GSC */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${(step === "gsc-prompt" || step === "gsc-reassurance" || step === "complete") ? (isDark ? 'bg-stone-800 text-white' : 'bg-stone-900 text-white') : (isDark ? 'bg-stone-800 text-stone-500' : 'bg-stone-100 text-stone-400')}`}>
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Insights</span>
            </div>
        </div>
    )

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 font-sans">
            <ProgressIndicator />

            {/* Island Container */}
            <motion.div
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`
          relative p-1 overflow-hidden w-full max-w-xl transition-all duration-300
          shadow-[0_0_0_1px_rgba(0,0,0,0.08),0px_1px_2px_rgba(0,0,0,0.04)]
          rounded-[20px]
          ${isDark ? 'bg-stone-800' : 'bg-stone-100'}
        `}
            >
                {/* Top Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-6 z-20 flex justify-center pointer-events-none">
                    <div className={`w-8 h-4 rounded-b-lg border-b border-x ${isDark ? 'bg-stone-800 border-stone-700' : 'bg-stone-100 border-stone-200/50'} flex items-center justify-center`}>
                        <ChevronUp className={`w-3 h-3 ${isDark ? 'text-stone-500' : 'text-stone-400'}`} />
                    </div>
                </div>

                {/* Inner Card */}
                <div className={`
          relative border overflow-hidden transition-all rounded-[16px]
          ${isDark ? 'bg-stone-900 border-stone-700' : 'bg-white border-stone-200'}
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
                                            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                Let&apos;s understand your brand
                                            </h2>
                                            <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                                Enter your website URL to extract your brand identity
                                            </p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Input
                                                type="url"
                                                placeholder="https://yourwebsite.com"
                                                className={`flex-1 ${isDark ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-200'}`}
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
                          dark:from-stone-200 dark:to-stone-400 dark:text-stone-900
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

                                        <div className="text-center">
                                            <button
                                                className={`text-xs underline underline-offset-4 cursor-pointer ${isDark ? 'text-stone-500 hover:text-stone-300' : 'text-stone-500 hover:text-stone-900'}`}
                                                onClick={() => setBrandData({
                                                    product_name: "",
                                                    product_identity: { literally: "", emotionally: "", not: "" },
                                                    mission: "",
                                                    audience: { primary: "", psychology: "" },
                                                    enemy: [],
                                                    voice_tone: [],
                                                    uvp: [],
                                                    core_features: [],
                                                    pricing: [],
                                                    how_it_works: [],
                                                    image_style: "stock",
                                                })}
                                            >
                                                Or enter details manually
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // Brand Review Form - Complete with all 10 sections
                                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>Review Brand Details</h2>
                                                <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Verify extracted information</p>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setBrandData(null)} className="text-xs">
                                                Re-Analyze
                                            </Button>
                                        </div>

                                        {/* 1. Product Identity */}
                                        <div className="space-y-3">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>1. Product Identity</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>Product Name</label>
                                                    <Input value={brandData.product_name} onChange={e => updateField('product_name', e.target.value)} className="text-sm" />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>What is it literally?</label>
                                                    <Input value={brandData.product_identity.literally} onChange={e => updateField('product_identity.literally', e.target.value)} className="text-sm" />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>What is it emotionally?</label>
                                                    <Input value={brandData.product_identity.emotionally} onChange={e => updateField('product_identity.emotionally', e.target.value)} className="text-sm" />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>What is it NOT?</label>
                                                    <Input value={brandData.product_identity.not} onChange={e => updateField('product_identity.not', e.target.value)} className="text-sm" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Mission */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>2. Mission</h3>
                                            <label className={`block text-xs font-medium ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>The "Why"</label>
                                            <Textarea value={brandData.mission} onChange={e => updateField('mission', e.target.value)} className="text-sm min-h-[60px]" />
                                        </div>

                                        {/* 3. Audience */}
                                        <div className="space-y-3">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>3. Audience</h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>Primary Audience</label>
                                                    <Input value={brandData.audience.primary} onChange={e => updateField('audience.primary', e.target.value)} className="text-sm" />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>Psychology (Desires/Fears)</label>
                                                    <Textarea value={brandData.audience.psychology} onChange={e => updateField('audience.psychology', e.target.value)} className="text-sm min-h-[60px]" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 4. Enemy */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>4. Enemy (What you fight against)</h3>
                                            <Textarea
                                                value={brandData.enemy.join('\n')}
                                                onChange={e => updateArray('enemy', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One item per line"
                                            />
                                            <p className={`text-[10px] text-right ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>One item per line</p>
                                        </div>

                                        {/* 5. Voice & Tone */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>5. Voice & Tone</h3>
                                            <Textarea
                                                value={brandData.voice_tone.join('\n')}
                                                onChange={e => updateArray('voice_tone', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One item per line"
                                            />
                                            <p className={`text-[10px] text-right ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>One item per line</p>
                                        </div>

                                        {/* 6. Unique Value Proposition */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>6. Unique Value Proposition</h3>
                                            <Textarea
                                                value={brandData.uvp.join('\n')}
                                                onChange={e => updateArray('uvp', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One item per line"
                                            />
                                            <p className={`text-[10px] text-right ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>One item per line</p>
                                        </div>

                                        {/* 7. Core Features */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>7. Core Features</h3>
                                            <Textarea
                                                value={brandData.core_features.join('\n')}
                                                onChange={e => updateArray('core_features', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One item per line"
                                            />
                                            <p className={`text-[10px] text-right ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>One item per line</p>
                                        </div>

                                        {/* 8. Pricing */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>8. Pricing</h3>
                                            <Textarea
                                                value={brandData.pricing?.join('\n') || ''}
                                                onChange={e => updateArray('pricing', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="e.g. Pro Plan: $29/mo"
                                            />
                                            <p className={`text-[10px] text-right ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>One line e.g. "Pro Plan: $29/mo"</p>
                                        </div>

                                        {/* 9. How it Works */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>9. How it Works</h3>
                                            <Textarea
                                                value={brandData.how_it_works?.join('\n') || ''}
                                                onChange={e => updateArray('how_it_works', e.target.value)}
                                                className="text-sm min-h-[60px]"
                                                placeholder="One step per line"
                                            />
                                            <p className={`text-[10px] text-right ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>One step per line</p>
                                        </div>

                                        {/* 10. Featured Image Style */}
                                        <div className="space-y-2">
                                            <h3 className={`text-sm font-semibold border-b pb-2 ${isDark ? 'border-stone-800 text-white' : 'border-stone-100 text-stone-900'}`}>10. Featured Image Style</h3>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>Style Preference</label>
                                            <select
                                                className={`w-full h-10 rounded-md border px-3 text-sm ${isDark ? 'bg-stone-950 border-stone-800 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
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
                                            <p className={`text-[10px] ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>Select the style for AI-generated featured images.</p>
                                        </div>

                                        {/* Continue Button */}
                                        <div className="pt-4 border-t border-stone-100 dark:border-stone-800 sticky bottom-0 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm py-4">
                                            <Button
                                                onClick={handleSaveBrand}
                                                disabled={savingBrand}
                                                className={`
                          w-full h-10 font-semibold
                          bg-gradient-to-b from-stone-800 to-stone-950
                          hover:from-stone-700 hover:to-stone-900
                          dark:from-stone-200 dark:to-stone-400 dark:text-stone-900
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

                        {step === "voice" && (
                            <motion.div
                                key="voice-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-6 space-y-6"
                            >
                                <div className="text-center space-y-2">
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                        Set your writing voice
                                    </h2>
                                    <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                        Choose a style which suits your brand voice
                                    </p>
                                </div>

                                {/* Method Selector */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setCreationMethod("preset")}
                                        className={`p-3 rounded-lg border text-left transition-all ${creationMethod === 'preset' ? (isDark ? 'border-stone-600 bg-stone-800' : 'border-stone-400 bg-stone-50') : (isDark ? 'border-stone-800 hover:bg-stone-800' : 'border-stone-200 hover:bg-stone-50')}`}
                                    >
                                        <span className={`font-semibold text-sm block mb-0.5 ${isDark ? 'text-white' : 'text-stone-900'}`}>Use Voice Preset</span>
                                        <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Quick start templates</span>
                                    </button>
                                    <button
                                        onClick={() => setCreationMethod("mimic")}
                                        className={`p-3 rounded-lg border text-left transition-all ${creationMethod === 'mimic' ? (isDark ? 'border-stone-600 bg-stone-800' : 'border-stone-400 bg-stone-50') : (isDark ? 'border-stone-800 hover:bg-stone-800' : 'border-stone-200 hover:bg-stone-50')}`}
                                    >
                                        <span className={`font-semibold text-sm block mb-0.5 ${isDark ? 'text-white' : 'text-stone-900'}`}>Mimic your Brand</span>
                                        <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Extarct writing style</span>
                                    </button>
                                </div>

                                {creationMethod === "preset" ? (
                                    <div className="space-y-2">
                                        <label className={`block text-xs font-medium ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>Choose a Preset</label>
                                        <select
                                            value={presetKey}
                                            onChange={e => setPresetKey(e.target.value)}
                                            className={`w-full h-10 rounded-md border px-3 text-sm ${isDark ? 'bg-stone-950 border-stone-800 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
                                        >
                                            {Object.keys(STYLE_PRESETS).map(key => (
                                                <option key={key} value={key}>
                                                    {key.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className={`block text-xs font-medium ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>Enter URL to Mimic</label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={mimicUrl}
                                                onChange={e => setMimicUrl(e.target.value)}
                                                placeholder="https://example.com/blog/article"
                                                className={`flex-1 ${isDark ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-200'}`}
                                            />
                                            <Button
                                                onClick={handleAnalyzeStyle}
                                                disabled={isAnalyzingStyle || !mimicUrl}
                                                variant="outline"
                                                className="px-4"
                                            >
                                                {isAnalyzingStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Voice Name */}
                                <div className="space-y-2">
                                    <label className={`block text-xs font-medium ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>Voice Name</label>
                                    <Input
                                        value={voiceName}
                                        onChange={e => setVoiceName(e.target.value)}
                                        placeholder="e.g. Technical SEO Expert"
                                        className={`${isDark ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-200'}`}
                                    />
                                </div>

                                {/* Voice Style Preview Card */}
                                {parsedStyle && (
                                    <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-stone-900/50 border-stone-800' : 'bg-white border-stone-200'}`}>
                                        <div className={`px-4 py-2.5 border-b ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-200'}`}>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-stone-900'}`}>Voice Style Preview</span>
                                                <span className={`text-[10px] ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>Editable in settings</span>
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-4 max-h-[280px] overflow-y-auto">
                                            {/* Tone */}
                                            <div>
                                                <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>Tone</span>
                                                <p className={`text-sm font-medium mt-0.5 ${isDark ? 'text-white' : 'text-stone-900'}`}>{parsedStyle.tone}</p>
                                            </div>

                                            {/* Perspective & Formality Row */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>Perspective</span>
                                                    <p className={`text-sm font-medium capitalize mt-0.5 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                        {parsedStyle.perspective?.replace('-', ' ') || 'Neutral'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>Formality</span>
                                                    <p className={`text-sm font-medium capitalize mt-0.5 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                        {parsedStyle.formality || 'Professional'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Sentence Structure */}
                                            {parsedStyle.sentence_structure && (
                                                <div>
                                                    <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>Sentence Style</span>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${isDark ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-700'}`}>
                                                            {parsedStyle.sentence_structure.avg_length} length
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${isDark ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-700'}`}>
                                                            {parsedStyle.sentence_structure.complexity}
                                                        </span>
                                                        {parsedStyle.sentence_structure.use_of_questions && (
                                                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${isDark ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-700'}`}>
                                                                Uses questions
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Narrative Rules */}
                                            {parsedStyle.narrative_rules && parsedStyle.narrative_rules.length > 0 && (
                                                <div>
                                                    <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>Writing Rules</span>
                                                    <ul className="mt-1.5 space-y-1">
                                                        {parsedStyle.narrative_rules.slice(0, 4).map((rule, i) => (
                                                            <li key={i} className={`text-xs flex items-start gap-2 ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
                                                                <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${isDark ? 'bg-stone-500' : 'bg-stone-400'}`} />
                                                                <span>{rule}</span>
                                                            </li>
                                                        ))}
                                                        {parsedStyle.narrative_rules.length > 4 && (
                                                            <li className={`text-xs ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                                                                +{parsedStyle.narrative_rules.length - 4} more rules
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Words to Avoid */}
                                            {parsedStyle.avoid_words && parsedStyle.avoid_words.length > 0 && (
                                                <div>
                                                    <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>Words to Avoid</span>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {parsedStyle.avoid_words.slice(0, 6).map((word, i) => (
                                                            <span key={i} className={`px-2 py-0.5 rounded text-[11px] font-medium line-through ${isDark ? 'bg-stone-800 text-stone-500' : 'bg-stone-100 text-stone-500'}`}>
                                                                {word}
                                                            </span>
                                                        ))}
                                                        {parsedStyle.avoid_words.length > 6 && (
                                                            <span className={`text-[11px] ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                                                                +{parsedStyle.avoid_words.length - 6} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Continue Button */}
                                <Button
                                    onClick={handleSaveVoice}
                                    disabled={savingVoice || !voiceName}
                                    className={`
                    w-full h-10 font-semibold
                    bg-gradient-to-b from-stone-800 to-stone-950
                    hover:from-stone-700 hover:to-stone-900
                    dark:from-stone-200 dark:to-stone-400 dark:text-stone-900
                  `}
                                >
                                    {savingVoice ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Continue to Content Plan
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        )}

                        {/* Step 3: Competitor Analysis & Content Plan Generation */}
                        {(step === "competitors" || step === "plan") && (
                            <motion.div
                                key="plan-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-6 space-y-6"
                            >
                                {(analyzingCompetitors || generatingPlan) ? (
                                    // Loading State
                                    <div className="text-center space-y-6 py-8">
                                        <div className="relative w-16 h-16 mx-auto">
                                            <div className={`absolute inset-0 rounded-full border-4 ${isDark ? 'border-stone-700' : 'border-stone-200'}`} />
                                            <div className={`absolute inset-0 rounded-full border-4 border-t-stone-600 animate-spin`} />
                                        </div>
                                        <div className="space-y-2">
                                            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                {analyzingCompetitors ? "Analyzing competitors..." : "Generating your 30-day content plan..."}
                                            </h2>
                                            <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                                {analyzingCompetitors
                                                    ? "Finding competitor content and extracting keywords"
                                                    : "Creating personalized blog topics for your brand"}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-center gap-2">
                                            {analyzingCompetitors ? (
                                                <>
                                                    <Users className={`w-4 h-4 ${isDark ? 'text-stone-400' : 'text-stone-500'}`} />
                                                    <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Researching competitor keywords</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Calendar className={`w-4 h-4 ${isDark ? 'text-stone-400' : 'text-stone-500'}`} />
                                                    <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Building your content calendar</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // Plan Display
                                    <>
                                        <div className="text-center space-y-2">
                                            <div className="flex items-center justify-center gap-2">
                                                <Sparkles className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
                                                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                    Your 30-Day Content Plan
                                                </h2>
                                            </div>
                                            <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                                {contentPlan.length} blog posts tailored to your brand
                                            </p>
                                        </div>

                                        {/* Plan Preview */}
                                        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-stone-800/50 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
                                            <div className="max-h-[300px] overflow-y-auto divide-y divide-stone-200 dark:divide-stone-700">
                                                {contentPlan.slice(0, 10).map((item, i) => (
                                                    <div key={item.id} className={`p-3 flex items-start gap-3 ${isDark ? 'hover:bg-stone-800' : 'hover:bg-stone-100'}`}>
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium ${isDark ? 'bg-stone-700 text-stone-300' : 'bg-stone-200 text-stone-600'}`}>
                                                            {i + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                                {item.title}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-stone-700 text-stone-300' : 'bg-stone-200 text-stone-600'}`}>
                                                                    {item.main_keyword}
                                                                </span>
                                                                <span className={`text-[10px] capitalize ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                                                                    {item.intent}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {contentPlan.length > 10 && (
                                                <div className={`p-3 text-center text-xs ${isDark ? 'bg-stone-800 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
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
                                                dark:from-stone-200 dark:to-stone-400 dark:text-stone-900
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

                        {/* Step 4: GSC Upgrade Prompt */}
                        {step === "gsc-prompt" && (
                            <motion.div
                                key="gsc-prompt-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-6 space-y-6"
                            >
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <CheckCircle2 className={`w-6 h-6 text-green-500`} />
                                    </div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                        Your content plan is ready!
                                    </h2>
                                    <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                        Want to make it even better?
                                    </p>
                                </div>

                                {/* GSC Upgrade Card */}
                                <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'bg-stone-800/50 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`}>
                                            <TrendingUp className={`w-5 h-5 ${isDark ? 'text-stone-300' : 'text-stone-600'}`} />
                                        </div>
                                        <div>
                                            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                Connect Google Search Console
                                            </h3>
                                            <p className={`text-xs mt-0.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                                Personalize your plan with real search data
                                            </p>
                                        </div>
                                    </div>

                                    <ul className="space-y-2">
                                        {[
                                            { icon: Zap, text: "High-impact topics with proven impressions" },
                                            { icon: Target, text: "Quick-win keywords on page 2" },
                                            { icon: TrendingUp, text: "Low CTR opportunities to fix" },
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-center gap-2">
                                                <item.icon className={`w-3.5 h-3.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`} />
                                                <span className={`text-xs ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
                                                    {item.text}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        onClick={() => setStep("gsc-reassurance")}
                                        className={`
                                            w-full h-10 font-semibold
                                            bg-gradient-to-b from-stone-800 to-stone-950
                                            hover:from-stone-700 hover:to-stone-900
                                            dark:from-stone-200 dark:to-stone-400 dark:text-stone-900
                                        `}
                                    >
                                        <TrendingUp className="w-4 h-4 mr-2" />
                                        Connect Search Console
                                    </Button>
                                </div>

                                {/* Skip Option */}
                                <button
                                    onClick={handleSkipGSC}
                                    className={`w-full text-center text-sm underline underline-offset-2 ${isDark ? 'text-stone-400 hover:text-stone-300' : 'text-stone-500 hover:text-stone-600'}`}
                                >
                                    Continue without Search Console
                                </button>
                            </motion.div>
                        )}

                        {/* Step 5: GSC Reassurance Screen */}
                        {step === "gsc-reassurance" && (
                            <motion.div
                                key="gsc-reassurance-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-6 space-y-6"
                            >
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <Shield className={`w-6 h-6 ${isDark ? 'text-stone-300' : 'text-stone-600'}`} />
                                    </div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                        We only read your search data
                                    </h2>
                                    <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                        Read-only access, nothing more
                                    </p>
                                </div>

                                {/* What We Access */}
                                <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'bg-stone-800/50 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
                                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                        What we access:
                                    </h3>
                                    <ul className="space-y-2">
                                        {[
                                            "Keywords you already rank for",
                                            "Pages near the top of Google",
                                            "Topics with growth potential",
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                <span className={`text-xs ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
                                                    {item}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* What We Don't Do */}
                                <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'bg-stone-800/30 border-stone-700' : 'bg-white border-stone-200'}`}>
                                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                        We never:
                                    </h3>
                                    <ul className="space-y-2">
                                        {[
                                            "Modify anything in your account",
                                            "Access your analytics or emails",
                                            "Store raw GSC data",
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-center gap-2">
                                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isDark ? 'border-stone-600' : 'border-stone-300'}`}>
                                                    <span className={`w-1.5 h-0.5 ${isDark ? 'bg-stone-500' : 'bg-stone-400'}`} />
                                                </span>
                                                <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                                    {item}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Connect Button */}
                                <Button
                                    onClick={handleConnectGSC}
                                    className={`
                                        w-full h-10 font-semibold
                                        bg-gradient-to-b from-stone-800 to-stone-950
                                        hover:from-stone-700 hover:to-stone-900
                                        dark:from-stone-200 dark:to-stone-400 dark:text-stone-900
                                    `}
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Connect Securely with Google
                                </Button>

                                {/* Skip Option */}
                                <button
                                    onClick={handleSkipGSC}
                                    className={`w-full text-center text-sm underline underline-offset-2 ${isDark ? 'text-stone-400 hover:text-stone-300' : 'text-stone-500 hover:text-stone-600'}`}
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
                                className="p-6 space-y-6"
                            >
                                <div className="text-center space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <CheckCircle2 className={`w-6 h-6 text-green-500`} />
                                    </div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                        Connected to Search Console!
                                    </h2>
                                    <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                        Select which site to analyze
                                    </p>
                                </div>

                                {loadingGscSites ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-stone-400' : 'text-stone-500'}`} />
                                    </div>
                                ) : gscSites.length === 0 ? (
                                    <div className={`text-center py-8 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
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
                                        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-stone-800/50 border-stone-700' : 'bg-stone-50 border-stone-200'}`}>
                                            <div className="max-h-[250px] overflow-y-auto divide-y divide-stone-200 dark:divide-stone-700">
                                                {gscSites.map((site) => (
                                                    <button
                                                        key={site.siteUrl}
                                                        onClick={() => setSelectedSite(site.siteUrl)}
                                                        className={`w-full p-3 flex items-center gap-3 text-left transition-all ${selectedSite === site.siteUrl
                                                            ? (isDark ? 'bg-stone-700' : 'bg-stone-200')
                                                            : (isDark ? 'hover:bg-stone-800' : 'hover:bg-stone-100')
                                                            }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedSite === site.siteUrl
                                                            ? 'border-green-500 bg-green-500'
                                                            : (isDark ? 'border-stone-600' : 'border-stone-300')
                                                            }`}>
                                                            {selectedSite === site.siteUrl && (
                                                                <CheckCircle2 className="w-3 h-3 text-white" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                                                {site.siteUrl.replace('sc-domain:', '').replace('https://', '').replace('http://', '')}
                                                            </p>
                                                            <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
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
                                                dark:from-stone-200 dark:to-stone-400 dark:text-stone-900
                                                disabled:opacity-50
                                            `}
                                        >
                                            <TrendingUp className="w-4 h-4 mr-2" />
                                            Fetch Insights & Enhance Plan
                                        </Button>

                                        <button
                                            onClick={handleSkipGSC}
                                            className={`w-full text-center text-sm underline underline-offset-2 ${isDark ? 'text-stone-400 hover:text-stone-300' : 'text-stone-500 hover:text-stone-600'}`}
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
                                className="p-6 space-y-6"
                            >
                                <div className="text-center space-y-6 py-8">
                                    <div className="relative w-16 h-16 mx-auto">
                                        <div className={`absolute inset-0 rounded-full border-4 ${isDark ? 'border-stone-700' : 'border-stone-200'}`} />
                                        <div className={`absolute inset-0 rounded-full border-4 border-t-green-500 animate-spin`} />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                                            Enhancing your content plan...
                                        </h2>
                                        <p className={`text-sm ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                            Analyzing your search data to find opportunities
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <TrendingUp className={`w-4 h-4 ${isDark ? 'text-stone-400' : 'text-stone-500'}`} />
                                        <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Adding opportunity scores and badges</span>
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
                    <div className={`p-4 rounded-xl text-sm border ${isDark ? 'bg-red-900/20 text-red-400 border-red-800' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {error}
                    </div>
                </div>
            )}
        </div>
    )
}
