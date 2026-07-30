"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Loader2, ChevronUp, ArrowRight, Sparkles, Eye, Globe, Globe2, Plus } from "lucide-react"
import { saveBrandAction } from "@/actions/brand"
import { canAccessOnboarding } from "@/actions/onboarding"
import {
    getAuditScope,
    getGapEvidence,
    getPlannedArticles,
    getProgramProgress,
    type AuditScope,
    type GapEvidence,
    type PlannedArticleRow,
    type ProgramProgress,
} from "@/actions/harvest"
import { BrandDetails } from "@/lib/schemas/brand"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { CustomSpinner } from "@/components/CustomSpinner"
import { PillInput } from "@/components/ui/pill-input"
import { AuditConsole } from "@/components/audit/audit-console"
import { ScopeResults } from "@/components/audit/scope-results"

const STORAGE_KEYS = {
    STEP: 'onboarding_step',
    BRAND_URL: 'onboarding_brand_url',
    BRAND_DATA: 'onboarding_brand_data',
    BRAND_ID: 'onboarding_brand_id',
} as const

type Step = "brand" | "audit" | "audit-results"

export default function OnboardingPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [isHydrated, setIsHydrated] = useState(false)
    const [isCheckingAccess, setIsCheckingAccess] = useState(true)
    const [step, setStep] = useState<Step>("brand")

    useEffect(() => {
        async function checkOnboardingAccess() {
            const urlStep = searchParams.get('step')
            const { allowed, redirectTo } = await canAccessOnboarding(urlStep || undefined)
            if (!allowed && redirectTo) {
                router.replace(redirectTo)
                return
            }
            setIsCheckingAccess(false)
        }
        checkOnboardingAccess()
    }, [router, searchParams])

    const [url, setUrl] = useState("")
    const [competitors, setCompetitors] = useState<string[]>([])
    const [analyzing, setAnalyzing] = useState(false)
    const [brandData, setBrandData] = useState<BrandDetails | null>(null)
    const [savingBrand, setSavingBrand] = useState(false)
    const [brandId, setBrandId] = useState<string | null>(null)
    const [auditScope, setAuditScope] = useState<AuditScope | null>(null)
    const [gapEvidence, setGapEvidence] = useState<GapEvidence[]>([])
    const [plannedArticles, setPlannedArticles] = useState<PlannedArticleRow[]>([])
    const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null)
    const [isLoadingScope, setIsLoadingScope] = useState(false)
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)

    const [error, setError] = useState("")

    const clearOnboardingStorage = useCallback(() => {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key)
        })
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return

        const urlStep = searchParams.get('step')
        const urlBrandId = searchParams.get('brandId')

        // Restore saved data from localStorage
        const savedUrl = localStorage.getItem(STORAGE_KEYS.BRAND_URL)
        const savedBrandData = localStorage.getItem(STORAGE_KEYS.BRAND_DATA)
        const savedBrandId = urlBrandId || localStorage.getItem(STORAGE_KEYS.BRAND_ID)

        // Only clear storage if: user completed onboarding (has brandId) AND has no unsaved brandData
        // This allows fresh start for returning users while preserving progress for those mid-onboarding
        if (!urlStep && !urlBrandId && savedBrandId && !savedBrandData) {
            clearOnboardingStorage()
            setBrandId(null)
            setUrl("")
            setBrandData(null)
            setIsHydrated(true)
            return
        }

        // Restore URL (strip protocol if present from old data)
        if (savedUrl) setUrl(savedUrl.replace(/^https?:\/\//i, ''))

        // Restore brand data if exists (saves API costs on refresh!)
        if (savedBrandData) {
            try {
                setBrandData(JSON.parse(savedBrandData))
            } catch { }
        }

        // Restore brandId if exists
        if (savedBrandId) {
            setBrandId(savedBrandId)
        }

        // Restore step from URL or fallback to saved step, or default to brand
        const savedStep = localStorage.getItem(STORAGE_KEYS.STEP) as Step
        if (urlStep) {
            setStep(urlStep as Step)
        } else if (savedStep) {
            setStep(savedStep)
        }

        setIsHydrated(true)
    }, [searchParams])

    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.STEP, step)
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
                body: JSON.stringify({ url: `https://${url}` }),
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

    // Helper to clean array data
    const cleanArray = (arr: string[] | undefined) => {
        if (!arr) return []
        return arr.map(item => item.trim()).filter(item => item !== "")
    }

    const handleSaveBrand = async () => {
        if (!brandData) return
        if (!url || url.trim() === '') {
            setError("Website URL is required. Please enter your website domain.")
            return
        }

        // Clean data before saving (remove empty lines)
        const cleanData: BrandDetails = {
            ...brandData,
            enemy: cleanArray(brandData.enemy),
            uvp: cleanArray(brandData.uvp),
            how_it_works: cleanArray(brandData.how_it_works),
            core_features: cleanArray(brandData.core_features),
            pricing: cleanArray(brandData.pricing),
            brand_keywords: cleanArray(brandData.brand_keywords),
        }

        setSavingBrand(true)
        setError("")
        try {
            // Save brand data (style_dna is already included in brandData)
            const fullUrl = `https://${url.trim()}`
            const res = await saveBrandAction(fullUrl, cleanData, competitors.length > 0 ? competitors : undefined)
            if (!res.success) {
                throw new Error('error' in res ? res.error : "Failed to save brand")
            }
            if (!res.brandId) {
                throw new Error("Failed to save brand - no brandId returned")
            }
            const savedBrandId = res.brandId
            setBrandId(savedBrandId)

            // Instead of triggering plan immediately, go to audit step
            setStep("audit")

        } catch (e: any) {
            setError(e.message || "Failed to save brand details")
        } finally {
            setSavingBrand(false)
        }
    }

    // Audit completion handler
    const handleAuditComplete = () => {
        setStep("audit-results")
    }


    // The immutable harvest is already the plan. Never mirror it into the
    // legacy content_plans table or run a second paid harvest.
    const handleOpenSavedAudit = () => {
        clearOnboardingStorage()
        router.push("/audit")
    }

    // Load the closed-pool read model after completion and on refresh.
    useEffect(() => {
        if (!isHydrated || !brandId || step !== 'audit-results' || auditScope || isLoadingScope) return

        const fetchScope = async () => {
            setIsLoadingScope(true)
            try {
                const statusResponse = await fetch(`/api/topical-audit?brandId=${brandId}`, {
                    cache: "no-store",
                })
                const status = statusResponse.ok ? await statusResponse.json() : null
                if (status?.status === "running") {
                    setStep('audit')
                    return
                }

                const [scope, gaps, articles, progress] = await Promise.all([
                    getAuditScope(brandId),
                    getGapEvidence(brandId),
                    getPlannedArticles(brandId),
                    getProgramProgress(brandId),
                ])

                if (!scope) {
                    throw new Error("The audit finished, but its scope could not be loaded. Please run it again.")
                }

                setAuditScope(scope)
                setGapEvidence(gaps)
                setPlannedArticles(articles)
                setProgramProgress(progress)
            } catch (e) {
                console.error("Failed to load audit scope:", e)
                setError(e instanceof Error ? e.message : "Failed to load audit scope")
            } finally {
                setIsLoadingScope(false)
            }
        }
        void fetchScope()
    }, [auditScope, brandId, isHydrated, isLoadingScope, step])

    // NOTE: Plan generation is now fully handled in Trigger.dev

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

    // Updated helper: NO FILTERING on change to allow newlines
    const updateArray = (field: keyof BrandDetails, value: string) => {
        // Just split by newlines, preserving empty ones for editing
        const arr = value.split('\n')
        setBrandData(prev => prev ? ({ ...prev, [field]: arr }) : null)
    }


    return (
        <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 py-12 font-sans sm:px-6">
            {/* Show loading while checking access */}
            {isCheckingAccess ? (
                <div className="flex flex-col items-center gap-3 text-stone-500">
                    <CustomSpinner className="w-10 h-10" />
                </div>
            ) : (
                <>


                    {/* Island Container */}
                    <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={`
          relative p-1 overflow-hidden w-full transition-all duration-300
          shadow-[0_0_0_1px_rgba(0,0,0,0.08),0px_1px_2px_rgba(0,0,0,0.04)]
          rounded-[20px]
          bg-stone-100
          ${step === "audit-results" ? "max-w-[1400px] w-full px-4 sm:px-6" : "max-w-xl"}
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
                                        className="px-4 py-6 sm:px-6"
                                    >
                                        {!brandData ? (
                                            // URL Input Form
                                            <div className="space-y-6">
                                                <div className="text-center space-y-3">
                                                    <div className="flex justify-center">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center border border-stone-200">
                                                            <Sparkles className="w-6 h-6 text-stone-600" />
                                                        </div>
                                                    </div>
                                                    <h2 className={`text-xl font-bold text-stone-900`}>
                                                        Let&apos;s understand your brand
                                                    </h2>
                                                    <p className={`text-sm text-stone-500`}>
                                                        Share your website so we can understand your product and build your brand DNA & voice profile.
                                                    </p>
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="flex-1 flex">
                                                        <span className="inline-flex items-center px-3 text-sm text-stone-500 bg-stone-100 border border-r-0 border-stone-200 rounded-l-md font-medium select-none">
                                                            https://
                                                        </span>
                                                        <Input
                                                            type="text"
                                                            placeholder="yourwebsite.com"
                                                            className="flex-1 bg-stone-50 border-stone-200 py-2 px-3 text-sm rounded-l-none focus:ring-0 focus:outline-none focus-visible:ring-0"
                                                            value={url}
                                                            onChange={(e) => setUrl(e.target.value.replace(/^https?:\/\//i, ''))}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeBrand()}
                                                        />
                                                    </div>
                                                    <Button
                                                        onClick={handleAnalyzeBrand}
                                                        disabled={analyzing || !url}
                                                        className={`
                          px-6 font-semibold gap-2
                          bg-gradient-to-b from-stone-800 to-stone-950
                          hover:from-stone-700 hover:to-stone-900
                          shadow-sm
                        `}
                                                    >
                                                        <motion.div
                                                            animate={analyzing ? {
                                                                scale: [1, 1.2, 1],
                                                                rotate: [0, 180, 360],
                                                            } : {}}
                                                            transition={{
                                                                duration: 2,
                                                                repeat: Infinity,
                                                                ease: "easeInOut"
                                                            }}
                                                        >
                                                            <Globe className="w-4 h-4 text-white" />
                                                        </motion.div>
                                                        {analyzing ? "Analyzing..." : "Analyze"}
                                                    </Button>
                                                </div>

                                                {/* Optional Competitor Input */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-xs font-medium text-stone-500">
                                                            Know your competitors? <span className="text-stone-400">(optional — improves audit accuracy)</span>
                                                        </label>
                                                    </div>
                                                    <PillInput
                                                        value={competitors}
                                                        onChange={setCompetitors}
                                                        placeholder="e.g. competitor.com (press Enter to add)"
                                                        variant="url"
                                                    />
                                                    {competitors.length === 0 && (
                                                        <p className="text-[10px] text-stone-400">
                                                            We&apos;ll auto-discover competitors if you skip this
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            // Brand Review Form - Complete with all 10 sections
                                            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h2 className={`text-lg font-bold text-stone-900`}>Review Brand Details</h2>
                                                        <p className={`text-xs text-stone-500`}>We recommend adding more detailed brand data to get better and accurate articles later</p>
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

                                                {/* 4. Strategic Positioning */}
                                                <div className="space-y-3">
                                                    <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>4. Strategic Positioning</h3>
                                                    <div>
                                                        <label className={`block text-xs font-medium mb-1 text-stone-600`}>Category</label>
                                                        <Input
                                                            value={brandData.category || ''}
                                                            onChange={e => updateField('category', e.target.value)}
                                                            className="text-sm"
                                                            placeholder="e.g., Privacy-First Web Analytics, AI Photo Restoration"
                                                        />
                                                        <p className={`text-[10px] text-stone-400 mt-1`}>How would you describe your product category?</p>
                                                    </div>
                                                    <div className="mt-3">
                                                        <label className={`block text-xs font-medium mb-1 text-stone-600`}>Brand Keywords</label>
                                                        <PillInput
                                                            value={brandData.brand_keywords || []}
                                                            onChange={arr => setBrandData(prev => prev ? ({ ...prev, brand_keywords: arr }) : null)}
                                                            className="min-h-[60px]"
                                                            placeholder="Type keyword and press Enter"
                                                        />
                                                        <p className={`text-[10px] text-stone-400 mt-1`}>Search terms users would type to find your product (e.g. "ai photo restoration", "restore old photos")</p>
                                                    </div>
                                                </div>

                                                {/* 5. Enemy */}
                                                <div className="space-y-2">
                                                    <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>5. Enemy (What you fight against)</h3>
                                                    <Textarea
                                                        value={brandData.enemy.join('\n')}
                                                        onChange={e => updateArray('enemy', e.target.value)}
                                                        className="text-sm"
                                                        placeholder="Describe the problem or enemy you are fighting against..."
                                                        rows={4}
                                                    />
                                                </div>

                                                {/* 6. Voice & Tone */}
                                                <div className="space-y-2">
                                                    <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>6. Brand Voice & Tone</h3>
                                                    <Textarea
                                                        value={brandData.style_dna}
                                                        onChange={e => updateField('style_dna', e.target.value)}
                                                        className="text-sm"
                                                        placeholder="Describe your brand's voice and tone in detail."
                                                        rows={4}
                                                    />
                                                    <p className={`text-[10px] text-right text-stone-400`}>Comprehensive writing style guide</p>
                                                </div>

                                                {/* 7. Unique Value Proposition */}
                                                <div className="space-y-2">
                                                    <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>7. Unique Value Proposition</h3>
                                                    <Textarea
                                                        value={brandData.uvp.join('\n')}
                                                        onChange={e => updateArray('uvp', e.target.value)}
                                                        className="text-sm"
                                                        placeholder="What makes your product unique?"
                                                        rows={4}
                                                    />
                                                </div>

                                                {/* 8. Core Features */}
                                                <div className="space-y-2">
                                                    <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>8. Core Features</h3>
                                                    <PillInput
                                                        value={brandData.core_features}
                                                        onChange={arr => setBrandData(prev => prev ? ({ ...prev, core_features: arr }) : null)}
                                                        className="min-h-[80px]"
                                                        placeholder="Type feature and press Enter"
                                                    />
                                                    <p className={`text-[10px] text-right text-stone-400`}>Press Enter to add feature</p>
                                                </div>

                                                {/* 9. Pricing */}
                                                <div className="space-y-2">
                                                    <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>9. Pricing</h3>
                                                    <PillInput
                                                        value={brandData.pricing || []}
                                                        onChange={arr => setBrandData(prev => prev ? ({ ...prev, pricing: arr }) : null)}
                                                        className="min-h-[80px]"
                                                        placeholder="Type plan and press Enter"
                                                    />
                                                    <p className={`text-[10px] text-right text-stone-400`}>One line e.g. "Pro Plan: $29/mo"</p>
                                                </div>

                                                {/* 10. How it Works */}
                                                <div className="space-y-2">
                                                    <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>10. How it Works</h3>
                                                    <Textarea
                                                        value={brandData.how_it_works?.join('\n') || ''}
                                                        onChange={e => updateArray('how_it_works', e.target.value)}
                                                        className="text-sm"
                                                        placeholder="One step per line"
                                                        rows={4}
                                                    />
                                                </div>

                                                {/* 11. Featured Image Style */}
                                                <div className="space-y-2">
                                                    <h3 className={`text-sm font-semibold border-b pb-2 border-stone-100 text-stone-900`}>11. Featured Image Style</h3>
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

                                                {/* Continue Button + Research Settings (sticky footer) */}
                                                <div className="pt-4 border-t border-stone-100  sticky bottom-0 bg-white/80 /80 backdrop-blur-sm py-4 space-y-4">
                                                    {/* Research Settings */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-semibold text-stone-600 mb-1">🌏 Search Country</label>
                                                            <select
                                                                className="w-full h-9 rounded-md border px-2 text-sm bg-white border-stone-200 text-stone-900"
                                                                value={brandData.search_country || ""}
                                                                onChange={e => updateField('search_country', e.target.value)}
                                                            >
                                                                <option value="">Global (No filter)</option>
                                                                <option value="australia">Australia</option>
                                                                <option value="united states">United States</option>
                                                                <option value="united kingdom">United Kingdom</option>
                                                                <option value="canada">Canada</option>
                                                                <option value="india">India</option>
                                                                <option value="germany">Germany</option>
                                                                <option value="france">France</option>
                                                                <option value="japan">Japan</option>
                                                                <option value="brazil">Brazil</option>
                                                                <option value="netherlands">Netherlands</option>
                                                                <option value="singapore">Singapore</option>
                                                                <option value="new zealand">New Zealand</option>
                                                                <option value="ireland">Ireland</option>
                                                                <option value="south africa">South Africa</option>
                                                                <option value="united arab emirates">UAE</option>
                                                                <option value="sweden">Sweden</option>
                                                                <option value="switzerland">Switzerland</option>
                                                                <option value="italy">Italy</option>
                                                                <option value="spain">Spain</option>
                                                                <option value="mexico">Mexico</option>
                                                                <option value="south korea">South Korea</option>
                                                                <option value="indonesia">Indonesia</option>
                                                                <option value="philippines">Philippines</option>
                                                                <option value="malaysia">Malaysia</option>
                                                                <option value="thailand">Thailand</option>
                                                                <option value="poland">Poland</option>
                                                                <option value="nigeria">Nigeria</option>
                                                                <option value="pakistan">Pakistan</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-semibold text-stone-600 mb-1">📚 Topic Source</label>
                                                            <select
                                                                className="w-full h-9 rounded-md border px-2 text-sm bg-white border-stone-200 text-stone-900"
                                                                value={brandData.search_topic || "general"}
                                                                onChange={e => updateField('search_topic', e.target.value)}
                                                            >
                                                                <option value="general">General (Web)</option>
                                                                <option value="news">News</option>
                                                                <option value="finance">Finance</option>
                                                                <option value="journal">Journal (Research)</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-stone-400">These settings filter research sources for audits, plans, and articles.</p>

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

                                {step === "audit" && brandData && brandId && (
                                    <motion.div
                                        key="audit-step"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="p-6"
                                    >
                                        <AuditConsole
                                            brandData={brandData}
                                            brandId={brandId}
                                            brandUrl={`https://${url.trim()}`}
                                            onComplete={handleAuditComplete}
                                        />
                                    </motion.div>
                                )}

                                {step === "audit-results" && (
                                    <motion.div
                                        key="audit-results-step"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="p-6"
                                    >
                                                {auditScope ? (
                                            <div className="space-y-8">
                                                <ScopeResults
                                                    scope={auditScope}
                                                    gaps={gapEvidence}
                                                    articles={plannedArticles}
                                                    brandName={brandData?.product_name || "Your Site"}
                                                    progress={programProgress}
                                                />
                                                <div className="flex flex-col items-center gap-3 border-t border-stone-200 pt-7 text-center">
                                                    <p className="max-w-xl text-sm text-stone-500">
                                                        This audit is saved permanently in your dashboard. You can
                                                        return to every cluster, article, and source before purchasing.
                                                    </p>
                                                    <Button
                                                        onClick={handleOpenSavedAudit}
                                                        disabled={isGeneratingPlan}
                                                        variant="outline"
                                                    >
                                                        Open Saved Audit
                                                        <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 space-y-4">
                                                <p className="text-stone-500 text-sm">
                                                    {isLoadingScope
                                                        ? "Loading the verified scope and source evidence..."
                                                        : "Audit scope is not available yet."}
                                                </p>
                                                {isLoadingScope && <Loader2 className="mx-auto h-5 w-5 animate-spin text-stone-500" />}
                                            </div>
                                        )}
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
                </>
            )}
        </div>
    )
}
