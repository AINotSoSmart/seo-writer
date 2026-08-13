"use client"
import React, { useState, useEffect, useMemo, useRef } from "react"
import { saveBrandAction, updateBrandAction } from "@/actions/brand"
import { BrandDetails } from "@/lib/schemas/brand"
import { Loader2, ArrowLeft, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PillInput } from "@/components/ui/pill-input"
import {
    BrandDetailsEditor,
    type BrandArrayTextField,
    type BrandPillField,
} from "@/components/brand-details-editor"
import {
    ScopeFamilyReview,
    ScopeFamilySkeleton,
    findScopeBlockers,
    focusScopeField,
} from "@/components/onboarding/scope-family-review"
import { trimFamiliesToSearchCap } from "@/lib/scope-search-cap"
import {
    ANALYZE_PHASE_COPY,
    consumeAnalyzeBrandStream,
    emptyBrandShell,
    type AnalyzedPage,
} from "@/lib/analyze-brand/stream"
import {
    persistCrawlPages,
    restoreCrawlPages,
} from "@/lib/brand-analyze-corpus"

const ANALYZING_STARTED_KEY = "brand_onboarding_analyzing_started_at"
const SCOPE_STARTED_KEY = "brand_onboarding_scope_started_at"
const CRAWL_PAGES_KEY = "brand_onboarding_crawl_pages"

interface BrandOnboardingProps {
    onComplete: (brandId: string) => void
    onCancel: () => void
    initialData?: BrandDetails
    initialUrl?: string
    brandId?: string
}

export default function BrandOnboarding({ onComplete, onCancel, initialData, initialUrl, brandId }: BrandOnboardingProps) {
    const [url, setUrl] = useState(initialUrl || "")
    const [analyzing, setAnalyzing] = useState(false)
    const [analyzePhase, setAnalyzePhase] = useState<string>(ANALYZE_PHASE_COPY.crawl_started)
    const [saving, setSaving] = useState(false)
    const [brandData, setBrandData] = useState<BrandDetails | null>(initialData || null)
    const [brandProfileReady, setBrandProfileReady] = useState(Boolean(initialData?.product_name?.trim()))
    const [brandFieldsReady, setBrandFieldsReady] = useState(Boolean(initialData?.product_name?.trim()))
    /** See page.tsx — `brand_ready` lands before `scope_ready`, so this is the
     *  only honest signal for "is the category list ready yet". */
    const [scopeReady, setScopeReady] = useState(
        Boolean(initialData?.scope_families?.length),
    )
    const [targetSeeds, setTargetSeeds] = useState<string[]>(
        initialData?.target_seed_keywords || [],
    )
    const [seedsWithoutDemand, setSeedsWithoutDemand] = useState<string[]>([])
    const [error, setError] = useState("")
    const [crawledPages, setCrawledPages] = useState<AnalyzedPage[]>([])

    /** Same live pre-flight as onboarding — see findScopeBlockers. */
    const scopeBlockers = useMemo(
        () =>
            brandData
                ? findScopeBlockers(
                      brandData.scope_families || [],
                      brandData.target_seed_keywords || targetSeeds,
                  )
                : [],
        [brandData, targetSeeds],
    )

    useEffect(() => {
        if (typeof window === "undefined") return
        const restored = restoreCrawlPages(CRAWL_PAGES_KEY)
        if (restored.length > 0) setCrawledPages(restored)
        const started = localStorage.getItem(ANALYZING_STARTED_KEY)
        if (started && !initialData) {
            localStorage.removeItem(ANALYZING_STARTED_KEY)
            setError(
                "Last analysis was interrupted — your website and searches are still here. Run Analyze again.",
            )
        }
        const scopeStarted = localStorage.getItem(SCOPE_STARTED_KEY)
        if (scopeStarted && !initialData?.scope_families?.length) {
            localStorage.removeItem(SCOPE_STARTED_KEY)
            setError(
                "Last look was interrupted — your website and pages are still here. Run Analyze again.",
            )
        } else if (scopeStarted) {
            localStorage.removeItem(SCOPE_STARTED_KEY)
        }
    }, [initialData])

    const handleAnalyze = async () => {
        if (!url) return
        if (targetSeeds.length > 12) {
            setError("Add no more than 12 main customer searches.")
            return
        }
        setAnalyzing(true)
        setAnalyzePhase(ANALYZE_PHASE_COPY.crawl_started)
        setBrandProfileReady(false)
        setBrandFieldsReady(false)
        setScopeReady(false)
        setBrandData(null)
        setSeedsWithoutDemand([])
        setError("")
        localStorage.setItem(ANALYZING_STARTED_KEY, String(Date.now()))
        let completed = false
        let crawled: AnalyzedPage[] = crawledPages
        try {
            const res = await fetch("/api/analyze-brand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, targetSeeds }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to analyze brand")
            }

            const complete = await consumeAnalyzeBrandStream(res, (event) => {
                if (event.message) setAnalyzePhase(event.message)

                if (event.phase === "crawl_done" && Array.isArray(event.pages)) {
                    if (event.pages.some((page) => (page.content || "").trim())) {
                        crawled = event.pages
                        setCrawledPages(event.pages)
                        persistCrawlPages(CRAWL_PAGES_KEY, event.pages)
                    }
                }

                if (event.phase === "brand_ready" && event.brand) {
                    setBrandFieldsReady(true)
                    setBrandData((current) => ({
                        ...emptyBrandShell(current?.scope_families || [], targetSeeds),
                        ...current,
                        ...event.brand,
                        scope_families: current?.scope_families || [],
                        target_seed_keywords: targetSeeds,
                    }))
                }

                if (event.phase === "complete" && event.data) {
                    // MERGE, never replace — see the same handler in
                    // app/(onboarding)/onboarding/page.tsx for why. Replacing
                    // discarded every edit made during the wait.
                    const { scope_families: _ignored, ...persona } = event.data
                    setBrandData((current) => ({
                        ...(current ?? emptyBrandShell([], targetSeeds)),
                        ...persona,
                        scope_families: current?.scope_families ?? [],
                        target_seed_keywords:
                            current?.target_seed_keywords ??
                            persona.target_seed_keywords ??
                            targetSeeds,
                        search_country: current?.search_country || persona.search_country || "",
                        search_topic: current?.search_topic || persona.search_topic || "general",
                    }))
                    if (Array.isArray(event.pages)) {
                        crawled = event.pages
                        setCrawledPages(event.pages)
                        persistCrawlPages(CRAWL_PAGES_KEY, event.pages)
                    }
                    setBrandFieldsReady(true)
                    setBrandProfileReady(true)
                    completed = true
                }
            })

            const data = complete.data
            if (!data) throw new Error("Failed to analyze brand")

            localStorage.removeItem(ANALYZING_STARTED_KEY)
            localStorage.setItem(SCOPE_STARTED_KEY, String(Date.now()))
            // Scope is a SECOND call now (see app/api/analyze-brand/scope).
            // Settings is a single screen rather than a wizard, so it chains the
            // two immediately instead of pausing to confirm the persona — but it
            // must chain them, or re-analysing here would silently wipe the
            // brand's product areas.
            const scopeRes = await fetch("/api/analyze-brand/scope", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url,
                    pages: crawled,
                    targetSeeds,
                    brandProfile: data
                        ? {
                              product_name: data.product_name,
                              product_identity: {
                                  literally: data.product_identity?.literally || "",
                              },
                              category: data.category || "",
                              core_features: data.core_features || [],
                              how_it_works: data.how_it_works || [],
                              uvp: data.uvp || [],
                          }
                        : null,
                }),
            })
            if (!scopeRes.ok) {
                const scopeErr = await scopeRes.json().catch(() => ({}))
                throw new Error(scopeErr.error || "Failed to find product areas")
            }
            await consumeAnalyzeBrandStream(scopeRes, (event) => {
                if (event.message) setAnalyzePhase(event.message)
                if (event.scope_families) {
                    setScopeReady(true)
                    const families = trimFamiliesToSearchCap(event.scope_families)
                    setBrandData((current) =>
                        current
                            ? { ...current, scope_families: families }
                            : emptyBrandShell(families, targetSeeds),
                    )
                    data.scope_families = families
                }
            })

            // Advisory-only and intentionally NOT awaited before this screen
            // renders — see the incident note on findSeedsWithoutDemand in
            // lib/harvest/query-validation.ts. Badges appear a moment later,
            // or not at all if this is slow or fails.
            const seeds: string[] = (data.scope_families || []).flatMap(
                (family: { seed_keywords?: string[] }) => family.seed_keywords || [],
            )
            if (seeds.length > 0) {
                fetch("/api/analyze-brand/demand-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ seeds }),
                })
                    .then((r) => r.json())
                    .then((demand) =>
                        setSeedsWithoutDemand(
                            Array.isArray(demand.seedsWithoutDemand)
                                ? demand.seedsWithoutDemand
                                : [],
                        ),
                    )
                    .catch(() => {})
            }
        } catch (e: any) {
            setError(e.message || "An error occurred")
            if (!completed) {
                setBrandData(null)
                setBrandFieldsReady(false)
                setBrandProfileReady(false)
            }
        } finally {
            localStorage.removeItem(ANALYZING_STARTED_KEY)
            localStorage.removeItem(SCOPE_STARTED_KEY)
            setAnalyzing(false)
            setAnalyzePhase(ANALYZE_PHASE_COPY.crawl_started)
        }
    }

    // Validate that required fields are filled
    const isValidBrand = (data: BrandDetails): boolean => {
        if (!data.product_name?.trim()) return false
        if (!data.product_identity?.literally?.trim()) return false
        if (!data.mission?.trim()) return false
        if (!data.audience?.primary?.trim()) return false
        if (!data.category?.trim()) return false
        return true
    }

    // Helper to clean array data before sending to DB
    const cleanArray = (arr: string[] | undefined) => {
        if (!arr) return []
        return arr.map(item => item.trim()).filter(item => item !== "")
    }

    const handleSave = async () => {
        if (!brandData) return

        // 1. Clean the data here
        // For textareas (Enemy, UVP, How it Works), we split by newline if they haven't been already
        // Pill inputs (Pricing, Core Features) are already arrays
        const cleanData: BrandDetails = {
            ...brandData,
            enemy: cleanArray(brandData.enemy),
            uvp: cleanArray(brandData.uvp),
            how_it_works: cleanArray(brandData.how_it_works),
            core_features: cleanArray(brandData.core_features),
            pricing: cleanArray(brandData.pricing),
            target_seed_keywords: cleanArray(
                brandData.target_seed_keywords || targetSeeds,
            ),
            scope_families: (brandData.scope_families || [])
                .filter((family) => family.enabled)
                .map((family, priority) => ({
                    ...family,
                    name: family.name.trim(),
                    description: family.description.trim(),
                    seed_keywords: cleanArray(family.seed_keywords),
                    priority,
                    enabled: true,
                })),
        }

        // Validate required fields
        if (!isValidBrand(cleanData)) {
            setError("Please fill in all required fields: Product Name, Product Identity, Category, Mission, and Primary Audience")
            return
        }

        setSaving(true)
        setError("")
        try {
            if (brandId) {
                // Update existing - pass cleanData instead of brandData
                const res = await updateBrandAction(brandId, cleanData)
                if (!res.success) {
                    throw new Error(res.error || "Failed to update brand")
                }
                onComplete(brandId)
            } else {
                // Create new - pass cleanData instead of brandData
                const res = await saveBrandAction(url, cleanData)
                if (!res.success) {
                    throw new Error('error' in res ? res.error : "Failed to save brand")
                }
                if (!res.brandId) {
                    throw new Error("Failed to save brand - no brandId returned")
                }
                onComplete(res.brandId)
            }
        } catch (e: any) {
            setError(e.message || "Failed to save brand details")
        } finally {
            setSaving(false)
        }
    }

    // Helper to update nested state
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

    if (!brandData) {
        return (
            <div className="w-full mx-auto space-y-6 p-4 sm:p-6 bg-white">
                <Button variant="ghost" size="sm" onClick={onCancel} className="mb-2 -ml-2 text-stone-500 hover:text-stone-900">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <div className="space-y-2 text-center">
                    <h2 className="text-xl font-bold text-stone-900">Let&apos;s understand your brand</h2>
                    <p className="text-sm text-stone-500">Enter your website URL to automatically extract your brand identity.</p>
                </div>

                <div className="space-y-4">
                    <Input
                        type="url"
                        placeholder="https://example.com"
                        className="flex-1 w-full"
                        value={url}
                        disabled={analyzing}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">
                            What do people type into Google to find a tool like yours?
                        </label>
                        <PillInput
                            value={targetSeeds}
                            onChange={setTargetSeeds}
                            placeholder="e.g. ai photo restoration"
                            disabled={analyzing}
                        />
                        <p className="mt-1 text-[10px] text-stone-400">
                            Not your brand name — the words a stranger would search. Two to
                            five words each. These decide what the whole audit researches,
                            so anything you add here we treat as correct.
                        </p>
                    </div>
                    <Button onClick={handleAnalyze} disabled={analyzing || !url} className="w-full bg-stone-900 text-white">
                        {analyzing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {analyzePhase}
                            </>
                        ) : (
                            "Analyze Brand"
                        )}
                    </Button>
                    {analyzing && (
                        <p className="text-center text-[11px] text-stone-400">
                            Usually 1–3 minutes. Keep this tab open —
                            refreshing cannot resume the in-flight read.
                        </p>
                    )}
                </div>
                <div className="text-center">
                    <button
                        className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
                        onClick={() => {
                            setBrandData({
                            product_name: "",
                            product_identity: { literally: "", emotionally: "", not: "" },
                            mission: "",
                            audience: { primary: "", psychology: "" },
                            enemy: [],
                            category: "",
                            uvp: [],
                            core_features: [],
                            pricing: [],
                            how_it_works: [],
                            image_style: "stock",
                            style_dna: "",
                            brand_keywords: [], // Added to fix type error
                            scope_families: [],
                            target_seed_keywords: targetSeeds,
                            search_country: "",
                            search_topic: "general",
                            article_length: "long",
                        })
                            setBrandFieldsReady(true)
                            setBrandProfileReady(true)
                        }}
                    >
                        Skip and fill manually
                    </button>
                </div>

                {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-md border border-red-100">{error}</p>}
            </div>
        )
    }

    return (
        <div className="w-full mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-stone-900">Review Brand Details</h2>
                    <p className="text-sm text-stone-500">Verify extracted information before saving</p>
                </div>
                <Button variant="outline" size="sm" onClick={onCancel} className="w-full sm:w-auto border-stone-200">
                    <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                    Back
                </Button>
            </div>

            <div className="grid gap-6 p-4 sm:p-6 bg-white rounded-xl border border-stone-200">
                {/* Keyed on scopeReady, not brandFieldsReady — the old branch was
                    true exactly when its message was wrong. */}
                {analyzing && !brandProfileReady && (
                    <p className="text-xs text-stone-500">
                        {scopeReady
                            ? "Brand voice still loading… You can confirm product areas now."
                            : "Finding product areas… this is the slow part."}
                    </p>
                )}
                {analyzing && (brandData.scope_families?.length ?? 0) === 0 ? (
                    <ScopeFamilySkeleton />
                ) : (
                <ScopeFamilyReview
                    families={brandData.scope_families || []}
                    targetSeeds={brandData.target_seed_keywords || targetSeeds}
                    seedsWithoutDemand={seedsWithoutDemand}
                    onChange={(scope_families) =>
                        setBrandData((current) =>
                            current ? { ...current, scope_families } : current,
                        )
                    }
                    onChangeTargetSeeds={(seeds) => {
                        setTargetSeeds(seeds)
                        setBrandData((current) =>
                            current ? { ...current, target_seed_keywords: seeds } : current,
                        )
                    }}
                />
                )}

                {!analyzing && scopeBlockers.length > 0 && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                        <p className="text-[11px] font-medium text-amber-900">
                            {scopeBlockers.length === 1
                                ? "One thing left before this can be saved"
                                : `${scopeBlockers.length} things left before this can be saved`}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                            {scopeBlockers.map((blocker, index) => (
                                <li key={`${blocker.familyId}-${blocker.field}-${index}`}>
                                    <button
                                        type="button"
                                        onClick={() => focusScopeField(blocker)}
                                        className="text-left text-[11px] leading-snug text-amber-800 underline-offset-2 hover:underline"
                                    >
                                        {blocker.familyName ? `${blocker.familyName}: ` : ""}
                                        {blocker.message}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {brandFieldsReady ? (
                    <BrandDetailsEditor
                        brand={brandData}
                        onFieldChange={updateField}
                        onArrayTextChange={(field: BrandArrayTextField, value) =>
                            setBrandData((prev) => (prev ? { ...prev, [field]: value.split("\n") } : null))
                        }
                        onPillChange={(field: BrandPillField, value) =>
                            setBrandData((prev) => (prev ? { ...prev, [field]: value } : null))
                        }
                    />
                ) : (
                    <p className="text-sm text-stone-400">Brand voice &amp; details loading…</p>
                )}

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}

                <div className="flex justify-end pt-4 sticky bottom-0 bg-white/80 backdrop-blur-sm py-4 border-t border-stone-100 mt-4">
                    <Button onClick={handleSave} disabled={saving || analyzing || !brandProfileReady} className="w-full sm:w-auto px-8 bg-stone-900 text-white hover:bg-stone-800">
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                            </>
                        ) : brandId ? "Update Brand" : "Save & Continue"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
