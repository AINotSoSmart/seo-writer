"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
// No Loader2: onboarding has exactly one waiting treatment, the step list.
import { ChevronUp, ArrowRight } from "lucide-react"
import { getUserBrands, saveBrandAction } from "@/actions/brand"
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
import { Button } from "@/components/ui/button"
import { CustomSpinner } from "@/components/CustomSpinner"
import { ProbeConsole } from "@/components/visibility/probe-console"
import { ScopeResults } from "@/components/audit/scope-results"
import { findScopeBlockers } from "@/components/onboarding/scope-family-review"
import { trimFamiliesToSearchCap } from "@/lib/scope-search-cap"
import { applyMarketDefaults } from "@/lib/target-market"
import {
    ANALYZE_PHASE_COPY,
    consumeAnalyzeBrandStream,
    emptyBrandShell,
    type AnalyzeBrandPhase,
    type AnalyzedPage,
} from "@/lib/analyze-brand/stream"
import {
    persistCrawlPages,
    restoreCrawlPages,
} from "@/lib/brand-analyze-corpus"
// One screen per file. The route owns the state machine, the data calls and the
// recovery effects; each screen owns its own markup. See the onboardingSurface()
// helper in the contract suite for why copy assertions read this directory
// rather than the route alone — greping one file would turn every future
// extraction into a silently lost assertion.
import { SiteStep } from "@/components/onboarding/steps/site-step"
import { ProfileStep } from "@/components/onboarding/steps/profile-step"
import { ScopeStep } from "@/components/onboarding/steps/scope-step"
import { PromptsStep, type PromptItem } from "@/components/onboarding/steps/prompts-step"
import { ExtrasStep } from "@/components/onboarding/steps/extras-step"

const STORAGE_KEYS = {
    STEP: 'onboarding_step',
    BRAND_URL: 'onboarding_brand_url',
    BRAND_DATA: 'onboarding_brand_data',
    BRAND_ID: 'onboarding_brand_id',
    COMPETITORS: 'onboarding_competitors',
    SCOPE_ANALYSIS_ISSUES: 'onboarding_scope_analysis_issues',
    TARGET_SEEDS: 'onboarding_target_seeds',
    PROMPTS: 'onboarding_prompts',
    /**
     * The live probe run. Persisted the moment the run id exists, so a refresh
     * mid-probe adopts the run in flight instead of buying a second one — every
     * probe spends real answer-engine credits.
     */
    PROBE_RUN_ID: 'onboarding_probe_run_id',
    ANALYZING_STARTED_AT: 'onboarding_analyzing_started_at',
    SCOPE_STARTED_AT: 'onboarding_scope_started_at',
    CRAWL_PAGES: 'onboarding_crawl_pages',
} as const

/**
 * One screen, one question, in order.
 *
 * `brand` (the URL form), `profile` and `scope` were previously all the single
 * value `"brand"`, swapped by a `!brandData` ternary — which is why persona and
 * scope, produced by two model calls that finish at different times, landed on
 * one screen half-filled. Each value below now waits only on its own data.
 *
 * `brand` keeps its name: `resetToBrandStep` must still land on the first
 * screen, and that string is pinned by the deleted-brand recovery test.
 */
type Step = "brand" | "profile" | "scope" | "prompts" | "extras" | "audit" | "audit-results"

/** Legacy sessions persisted `step: "brand"` for what is now three screens. */
function migrateLegacyStep(step: string | null, hasBrandData: boolean): Step | null {
    if (!step) return null
    if (step === "brand") return hasBrandData ? "profile" : "brand"
    return step as Step
}

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
    const [targetSeeds, setTargetSeeds] = useState<string[]>([])
    const [analyzing, setAnalyzing] = useState(false)
    const [analyzePhase, setAnalyzePhase] = useState<string>(ANALYZE_PHASE_COPY.crawl_started)
    const [analysisInterrupted, setAnalysisInterrupted] = useState(false)
    const [brandData, setBrandData] = useState<BrandDetails | null>(null)
    /** The persona call returned a validated profile — step 2 can render. */
    const [brandProfileReady, setBrandProfileReady] = useState(false)
    /** The scope call returned product areas — step 3 can render. */
    const [scopeReady, setScopeReady] = useState(false)
    /** Every phase whose event has arrived, so the list can tick them off even
     *  when several land at once. */
    const [phasesSeen, setPhasesSeen] = useState<Set<AnalyzeBrandPhase>>(new Set())
    /** Pages read, from the `crawl_done` payload the client used to throw away. */
    const [pageCount, setPageCount] = useState(0)
    /** The step-1 crawl, handed to the scope call so it does not repeat it. */
    const [crawledPages, setCrawledPages] = useState<AnalyzedPage[]>([])
    const [scopeLoading, setScopeLoading] = useState(false)
    const [scopeAnalysisIssues, setScopeAnalysisIssues] = useState<
        Array<{ family?: string; message: string }>
    >([])
    const [seedsWithoutDemand, setSeedsWithoutDemand] = useState<string[]>([])
    const [savingBrand, setSavingBrand] = useState(false)
    const [brandId, setBrandId] = useState<string | null>(null)
    const [auditScope, setAuditScope] = useState<AuditScope | null>(null)
    const [gapEvidence, setGapEvidence] = useState<GapEvidence[]>([])
    const [plannedArticles, setPlannedArticles] = useState<PlannedArticleRow[]>([])
    const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null)
    const [isLoadingScope, setIsLoadingScope] = useState(false)
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)

    const [prompts, setPrompts] = useState<PromptItem[]>([])
    /** The probe run this session is watching, if one is already in flight. */
    const [probeRunId, setProbeRunId] = useState<string | null>(null)
    /**
     * Competitor discovery, started while the founder reads the prompts screen
     * so the confirmation list is already filled when they reach it. The list is
     * not optional — mentions are counted against tracked names only — so making
     * them recall four domains from memory would be the wrong ask.
     */
    const [discoveringCompetitors, setDiscoveringCompetitors] = useState(false)
    const competitorDiscoveryRef = useRef(false)
    const [promptsLoading, setPromptsLoading] = useState(false)
    const [regeneratingFamilyId, setRegeneratingFamilyId] = useState<string | null>(null)
    const [promptsError, setPromptsError] = useState("")

    const [error, setError] = useState("")

    /** Recomputed live so Continue explains itself instead of failing server-side. */
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

    const clearOnboardingStorage = useCallback(() => {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key)
        })
    }, [])

    /**
     * Wipes every trace of a brand that no longer exists and restarts onboarding.
     *
     * Onboarding persists `step` and `brandId` in localStorage (and the URL), so
     * deleting a brand server-side left the browser pointing at something gone.
     * `getAuditScope` returns null for BOTH "no completed audit yet" and "this
     * brand does not exist", so the audit-results step threw
     * "the audit finished, but its scope could not be loaded" and kept `step`
     * and `brandId` set — every refresh reproduced it, with no way out.
     */
    const resetToBrandStep = useCallback(
        (message: string) => {
            clearOnboardingStorage()
            setBrandId(null)
            setUrl("")
            setBrandData(null)
            setBrandProfileReady(false)
            setScopeAnalysisIssues([])
            setSeedsWithoutDemand([])
            setCompetitors([])
            setTargetSeeds([])
            setPrompts([])
            setPromptsError("")
            setProbeRunId(null)
            setCrawledPages([])
            setAuditScope(null)
            setGapEvidence([])
            setPlannedArticles([])
            setProgramProgress(null)
            setError(message)
            setStep("brand")
            router.replace("/onboarding")
        },
        [clearOnboardingStorage, router],
    )

    useEffect(() => {
        if (typeof window === 'undefined') return

        const urlStep = searchParams.get('step')
        const urlBrandId = searchParams.get('brandId')

        // Restore saved data from localStorage
        const savedUrl = localStorage.getItem(STORAGE_KEYS.BRAND_URL)
        const savedBrandData = localStorage.getItem(STORAGE_KEYS.BRAND_DATA)
        const savedBrandId = urlBrandId || localStorage.getItem(STORAGE_KEYS.BRAND_ID)
        const savedCompetitors = localStorage.getItem(STORAGE_KEYS.COMPETITORS)
        const savedScopeIssues = localStorage.getItem(
            STORAGE_KEYS.SCOPE_ANALYSIS_ISSUES,
        )
        const savedTargetSeeds = localStorage.getItem(STORAGE_KEYS.TARGET_SEEDS)
        const analyzingStartedAt = localStorage.getItem(
            STORAGE_KEYS.ANALYZING_STARTED_AT,
        )
        const scopeStartedAt = localStorage.getItem(
            STORAGE_KEYS.SCOPE_STARTED_AT,
        )
        const restoredPages = restoreCrawlPages(STORAGE_KEYS.CRAWL_PAGES)
        if (restoredPages.length > 0) setCrawledPages(restoredPages)

        // Only clear storage if: user completed onboarding (has brandId) AND has no unsaved brandData
        // This allows fresh start for returning users while preserving progress for those mid-onboarding
        if (!urlStep && !urlBrandId && savedBrandId && !savedBrandData) {
            clearOnboardingStorage()
            setBrandId(null)
            setUrl("")
            setBrandData(null)
            setScopeAnalysisIssues([])
            setCompetitors([])
            setTargetSeeds([])
            setIsHydrated(true)
            return
        }

        // Restore URL (strip protocol if present from old data)
        if (savedUrl) setUrl(savedUrl.replace(/^https?:\/\//i, ''))

        // Restore brand data if exists (saves API costs on refresh!)
        if (savedBrandData) {
            try {
                const parsed = JSON.parse(savedBrandData)
                const restoredFamilies = trimFamiliesToSearchCap(
                    parsed.scope_families || [],
                )
                setBrandData({ ...parsed, scope_families: restoredFamilies })
                /**
                 * Continue requires categories, not just a product name.
                 *
                 * This used to key on `product_name` alone, so a session
                 * restored mid-analysis — persona saved, scope not yet —
                 * re-opened with Continue ENABLED and zero categories. Combined
                 * with extraction notes restored from a SEPARATE key, that is
                 * exactly the reported screenshot: "Extraction notes (1)" sitting
                 * above an empty category list, with no way forward.
                 */
                const restoredReady =
                    Boolean(parsed?.product_name?.trim()) && restoredFamilies.length > 0
                setBrandProfileReady(restoredReady)
                setScopeReady(restoredFamilies.length > 0)
                // Notes describe families. If the families did not survive the
                // reload, the notes must not either.
                if (restoredFamilies.length === 0) {
                    setScopeAnalysisIssues([])
                    localStorage.removeItem(STORAGE_KEYS.SCOPE_ANALYSIS_ISSUES)
                }
            } catch { }
        }
        if (savedTargetSeeds) {
            try {
                setTargetSeeds(JSON.parse(savedTargetSeeds))
            } catch {
                setTargetSeeds([])
            }
        }
        if (savedCompetitors) {
            try {
                setCompetitors(JSON.parse(savedCompetitors))
            } catch {
                setCompetitors([])
            }
        }
        if (savedScopeIssues) {
            try {
                setScopeAnalysisIssues(JSON.parse(savedScopeIssues))
            } catch {
                setScopeAnalysisIssues([])
            }
        }
        const savedPrompts = localStorage.getItem(STORAGE_KEYS.PROMPTS)
        if (savedPrompts) {
            try {
                setPrompts(JSON.parse(savedPrompts))
            } catch {
                setPrompts([])
            }
        }
        // Restored before the audit step renders, so the console adopts the run
        // in flight rather than starting — and paying for — a second one.
        const savedProbeRunId = localStorage.getItem(STORAGE_KEYS.PROBE_RUN_ID)
        if (savedProbeRunId) setProbeRunId(savedProbeRunId)

        // Restore brandId if exists
        if (savedBrandId) {
            setBrandId(savedBrandId)
        }

        // A refresh mid-analyze cannot resume the in-flight request, but URL /
        // seeds / competitors are still here — tell the founder to re-run.
        // Do not auto-call handleAnalyzeBrand; the server corpus skips Tavily
        // if the crawl already finished.
        if (analyzingStartedAt && !savedBrandData) {
            localStorage.removeItem(STORAGE_KEYS.ANALYZING_STARTED_AT)
            setAnalysisInterrupted(true)
            setError(
                "Last analysis was interrupted — your website and searches are still here. Run Analyze again.",
            )
        }

        if (scopeStartedAt) {
            localStorage.removeItem(STORAGE_KEYS.SCOPE_STARTED_AT)
            const restoredFamilies = savedBrandData
                ? (() => {
                      try {
                          return trimFamiliesToSearchCap(
                              JSON.parse(savedBrandData).scope_families || [],
                          )
                      } catch {
                          return []
                      }
                  })()
                : []
            if (restoredFamilies.length === 0) {
                setError(
                    "Last look was interrupted — your website and pages are still here. Look again.",
                )
            }
        }

        // Restore step from URL or fallback to saved step, or default to brand.
        // Legacy sessions stored "brand" for what is now three screens, so a
        // restore with brand data in hand resumes at the profile screen.
        const hasBrandData = Boolean(savedBrandData)
        const restoredStep =
            migrateLegacyStep(urlStep, hasBrandData) ??
            migrateLegacyStep(localStorage.getItem(STORAGE_KEYS.STEP), hasBrandData)
        if (restoredStep) setStep(restoredStep)

        setIsHydrated(true)
    }, [searchParams])

    /**
     * A restored brandId must still exist before any step trusts it.
     *
     * Onboarding restores `step` and `brandId` from localStorage and the URL, so
     * a brand deleted server-side leaves the browser pointing at something gone.
     * Every downstream step then failed in its own confusing way — audit-results
     * threw "scope could not be loaded" and kept the stale state so refreshing
     * reproduced it forever, and the audit step auto-started a run that 404'd
     * with "Brand not found". One check here covers all of them.
     */
    useEffect(() => {
        if (!isHydrated || !brandId || step === "brand") return
        let cancelled = false

        const verifyBrandStillExists = async () => {
            try {
                const owned = await getUserBrands()
                if (cancelled) return
                const stillExists = (owned || []).some(
                    (brand: { id: string }) => brand.id === brandId,
                )
                if (!stillExists) {
                    resetToBrandStep(
                        "That brand was deleted, so its audit is gone too. Start again by adding a website.",
                    )
                }
            } catch {
                // Never strand the user on a transient lookup failure — the
                // per-step checks still catch a genuinely missing brand.
            }
        }

        void verifyBrandStillExists()
        return () => {
            cancelled = true
        }
        // Deliberately only on hydration/brand change, not on every step change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated, brandId])

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
        localStorage.setItem(
            STORAGE_KEYS.SCOPE_ANALYSIS_ISSUES,
            JSON.stringify(scopeAnalysisIssues),
        )
    }, [scopeAnalysisIssues, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.COMPETITORS, JSON.stringify(competitors))
    }, [competitors, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        localStorage.setItem(STORAGE_KEYS.TARGET_SEEDS, JSON.stringify(targetSeeds))
    }, [targetSeeds, isHydrated])

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
        persistCrawlPages(STORAGE_KEYS.CRAWL_PAGES, crawledPages)
    }, [crawledPages, isHydrated])

    useEffect(() => {
        if (!isHydrated) return
        if (brandId) {
            localStorage.setItem(STORAGE_KEYS.BRAND_ID, brandId)
        }
    }, [brandId, isHydrated])

    // Brand DNA handlers
    const handleAnalyzeBrand = async () => {
        if (!url) return
        if (targetSeeds.length > 12) {
            setError("Add no more than 12 main customer searches.")
            return
        }
        setAnalyzing(true)
        setAnalyzePhase(ANALYZE_PHASE_COPY.crawl_started)
        setAnalysisInterrupted(false)
        setBrandProfileReady(false)
        setScopeReady(false)
        setPhasesSeen(new Set())
        setPageCount(0)
        setBrandData(null)
        setScopeAnalysisIssues([])
        setSeedsWithoutDemand([])
        setError("")
        localStorage.setItem(
            STORAGE_KEYS.ANALYZING_STARTED_AT,
            String(Date.now()),
        )
        let completed = false
        try {
            const res = await fetch("/api/analyze-brand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: `https://${url}`,
                    targetSeeds,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to analyze brand")
            }

            const complete = await consumeAnalyzeBrandStream(res, (event) => {
                if (event.message) setAnalyzePhase(event.message)
                setPhasesSeen((current) => new Set(current).add(event.phase))
                if (event.phase === "crawl_done" && Array.isArray(event.pages)) {
                    setPageCount(event.pages.length)
                    if (event.pages.some((page) => (page.content || "").trim())) {
                        setCrawledPages(event.pages)
                        persistCrawlPages(STORAGE_KEYS.CRAWL_PAGES, event.pages)
                    }
                }

                if (event.phase === "brand_ready" && event.brand) {
                    setBrandData((current) => ({
                        ...emptyBrandShell(
                            current?.scope_families || [],
                            targetSeeds,
                        ),
                        ...current,
                        ...event.brand,
                        scope_families: current?.scope_families || [],
                        target_seed_keywords: targetSeeds,
                    }))
                }

                if (event.phase === "complete" && event.data) {
                    // MERGE, never replace — the founder may already be editing.
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
                    // The crawl, handed forward so the scope call need not repeat it.
                    if (Array.isArray(event.pages)) {
                        setCrawledPages(event.pages)
                        persistCrawlPages(STORAGE_KEYS.CRAWL_PAGES, event.pages)
                    }
                    setBrandProfileReady(true)
                    completed = true
                }
            })

            const data = complete.data
            if (!data) throw new Error("Failed to analyze brand")
            // Guess the market from the domain before the founder sees the
            // screen. A `.de` site defaulting to United States is a wrong
            // measurement nobody would think to check.
            setBrandData((current) =>
                current ? applyMarketDefaults(current, url) : current,
            )
            setStep("profile")
        } catch (e: any) {
            setError(e.message || "An error occurred")
            if (!completed) {
                setBrandData(null)
                setBrandProfileReady(false)
                setScopeReady(false)
                // The families are gone; notes about them must go too, or they
                // reappear next to an empty list after a reload.
                setScopeAnalysisIssues([])
                localStorage.removeItem(STORAGE_KEYS.SCOPE_ANALYSIS_ISSUES)
            }
        } finally {
            localStorage.removeItem(STORAGE_KEYS.ANALYZING_STARTED_AT)
            setAnalyzing(false)
            setAnalyzePhase(ANALYZE_PHASE_COPY.crawl_started)
        }
    }

    /**
     * Step 2 → 3. Fetches the product areas, re-using the crawl from step 1.
     *
     * Deliberately a second request rather than part of the first: the founder
     * confirms their brand details before this runs, so the scope screen is
     * never half-populated. It costs one LLM call, not another site crawl.
     */
    const handleFindScope = async (seeds: string[] = targetSeeds) => {
        setStep("scope")
        setScopeLoading(true)
        setScopeReady(false)
        setPhasesSeen(new Set())
        setError("")
        localStorage.setItem(
            STORAGE_KEYS.SCOPE_STARTED_AT,
            String(Date.now()),
        )
        try {
            const res = await fetch("/api/analyze-brand/scope", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: `https://${url}`,
                    pages: crawledPages,
                    targetSeeds: seeds,
                    brandProfile: brandData
                        ? {
                              product_name: brandData.product_name,
                              product_identity: {
                                  literally: brandData.product_identity.literally,
                              },
                              category: brandData.category || "",
                              core_features: brandData.core_features || [],
                              how_it_works: brandData.how_it_works || [],
                              uvp: brandData.uvp || [],
                          }
                        : null,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to find product areas")
            }

            await consumeAnalyzeBrandStream(res, (event) => {
                if (event.message) setAnalyzePhase(event.message)
                setPhasesSeen((current) => new Set(current).add(event.phase))

                const incomingFamilies = event.scope_families
                if (incomingFamilies && incomingFamilies.length > 0) {
                    setScopeReady(true)
                    setError("")
                    const families = trimFamiliesToSearchCap(incomingFamilies)
                    setScopeAnalysisIssues(
                        Array.isArray(event.scope_analysis_issues)
                            ? event.scope_analysis_issues
                            : [],
                    )
                    setBrandData((current) =>
                        current
                            ? { ...current, scope_families: families, target_seed_keywords: seeds }
                            : emptyBrandShell(families, seeds),
                    )

                    // Advisory only, never awaited — see the incident note on
                    // findSeedsWithoutDemand in lib/harvest/query-validation.ts.
                    const flat = families.flatMap((family) => family.seed_keywords || [])
                    if (flat.length > 0) {
                        fetch("/api/analyze-brand/demand-check", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ seeds: flat }),
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
                }
            })
        } catch (e: any) {
            setError(e.message || "Could not work out what you sell")
        } finally {
            localStorage.removeItem(STORAGE_KEYS.SCOPE_STARTED_AT)
            setScopeLoading(false)
        }
    }

    /**
     * Step 3 → 4. Generates candidate buyer prompts from the confirmed scope.
     *
     * Scoped to each confirmed family. If the user already confirmed or edited
     * prompts, they are reused unless the business scope changed.
     */
    const handleProceedToPrompts = async () => {
        setStep("prompts")
        setPromptsError("")

        const activeFamilies = (brandData?.scope_families || []).filter((f) => f.enabled !== false)
        const hasAllFamilies =
            activeFamilies.length > 0 &&
            activeFamilies.every((f) =>
                prompts.some((p) => p.scopeFamilyId === (f.id || f.name) || p.sourceSeed === f.name),
            )

        if (prompts.length > 0 && hasAllFamilies) {
            return
        }

        setPromptsLoading(true)
        try {
            const res = await fetch("/api/visibility/prompts/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scopeFamilies: activeFamilies,
                    productName: brandData?.product_name,
                    subjectType: brandData?.product_identity?.literally,
                    // Buyers ask in their own language, so the questions the
                    // founder reviews must already be in it — regenerating them
                    // later in a different language would invalidate the review.
                    language: brandData?.target_language,
                    // Persona and features, so a question can open from the
                    // buyer's situation instead of restating the category.
                    audience: brandData?.audience?.primary,
                    coreFeatures: brandData?.core_features,
                    competitors,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "Failed to generate candidate buyer questions")
            }

            const items: PromptItem[] = (data.prompts || []).map((p: any, idx: number) => ({
                ...p,
                id: `prompt-${idx}-${Date.now()}`,
            }))

            setPrompts(items)
            localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(items))
        } catch (err: any) {
            setPromptsError(
                err.message || "Could not generate buyer questions. You can add them manually.",
            )
        } finally {
            setPromptsLoading(false)
        }
    }

    /** Regenerates candidate buyer questions for a single scope family. */
    const handleRegenerateFamily = async (familyId: string) => {
        const activeFamilies = (brandData?.scope_families || []).filter((f) => f.enabled !== false)
        const target = activeFamilies.find((f) => (f.id || f.name) === familyId)
        if (!target) return

        setRegeneratingFamilyId(familyId)
        setPromptsError("")
        try {
            const res = await fetch("/api/visibility/prompts/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scopeFamilies: [target],
                    familyId: target.id || familyId,
                    productName: brandData?.product_name,
                    subjectType: brandData?.product_identity?.literally,
                    // Buyers ask in their own language, so the questions the
                    // founder reviews must already be in it — regenerating them
                    // later in a different language would invalidate the review.
                    language: brandData?.target_language,
                    // Persona and features, so a question can open from the
                    // buyer's situation instead of restating the category.
                    audience: brandData?.audience?.primary,
                    coreFeatures: brandData?.core_features,
                    competitors,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "Failed to regenerate questions for this area")
            }

            const newItems: PromptItem[] = (data.prompts || []).map((p: any, idx: number) => ({
                ...p,
                id: `prompt-${familyId}-${idx}-${Date.now()}`,
            }))

            const remaining = prompts.filter(
                (p) => p.scopeFamilyId !== familyId && p.sourceSeed !== target.name,
            )
            const updated = [...remaining, ...newItems]
            setPrompts(updated)
            localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(updated))
        } catch (err: any) {
            setPromptsError(err.message || "Failed to regenerate questions for this area")
        } finally {
            setRegeneratingFamilyId(null)
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
            target_seed_keywords: cleanArray(brandData.target_seed_keywords),
            scope_families: brandData.scope_families
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

            // A fresh save is a fresh measurement. Any run id left over from an
            // earlier attempt would be adopted by the console and reported as
            // this brand's result.
            localStorage.removeItem(STORAGE_KEYS.PROBE_RUN_ID)
            setProbeRunId(null)

            // The confirmed scope is now frozen in brand_scope_families, which
            // is everything the probe needs to open its own audit. Next screen
            // asks the confirmed questions.
            setStep("audit")

        } catch (e: any) {
            setError(e.message || "Failed to save brand details")
        } finally {
            setSavingBrand(false)
        }
    }

    /**
     * Fills the competitor list before the founder is asked to confirm it.
     *
     * Started on the prompts screen rather than the extras screen: discovery is
     * a Tavily search plus a model filter and takes real seconds, and the
     * founder is busy reading questions during exactly that window. Runs once,
     * and never overwrites names they typed themselves.
     */
    useEffect(() => {
        if (!isHydrated) return
        if (step !== "prompts" && step !== "extras") return
        if (competitorDiscoveryRef.current) return
        if (competitors.length > 0) return
        if (!brandData?.product_name || !url) return

        competitorDiscoveryRef.current = true
        setDiscoveringCompetitors(true)

        const brandContext = [
            brandData.product_name,
            brandData.product_identity?.literally,
            brandData.category,
        ]
            .filter(Boolean)
            .join(" — ")

        void fetch("/api/analyze-competitors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: `https://${url}`,
                brandContext,
                searchPrefs: {
                    country: brandData.search_country || "",
                    topic: brandData.search_topic || "general",
                },
            }),
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                const found: string[] = (data?.competitorBrands || [])
                    .map((brand: { domain?: string; url?: string }) =>
                        (brand.domain || brand.url || "").trim(),
                    )
                    .filter(Boolean)
                if (found.length === 0) return
                // Still never clobbers a founder who typed while we searched.
                setCompetitors((current) =>
                    current.length > 0
                        ? current
                        : Array.from(new Set(found)).slice(0, 4),
                )
            })
            .catch(() => {
                // Discovery is a convenience, not a gate. The screen already
                // explains why the list matters and accepts typed entries.
            })
            .finally(() => setDiscoveringCompetitors(false))
    }, [
        brandData?.product_name,
        brandData?.category,
        brandData?.product_identity?.literally,
        brandData?.search_country,
        brandData?.search_topic,
        competitors.length,
        isHydrated,
        step,
        url,
    ])

    /** Persisted immediately: a refresh must adopt this run, never buy another. */
    const handleProbeStarted = useCallback((runId: string) => {
        setProbeRunId(runId)
        localStorage.setItem(STORAGE_KEYS.PROBE_RUN_ID, runId)
    }, [])

    /**
     * Onboarding ends on the visibility report, not on the old scope screen.
     *
     * The probe finalizes its own audit through `finalize_audit_run`, so the
     * permanent views — `/audit` and `/content-plan` — are already populated by
     * the time this fires. The report is where the finding is: which questions
     * name a competitor instead of the customer, with the verbatim answer
     * behind every claim.
     */
    const handleProbeComplete = useCallback(
        (runId: string) => {
            clearOnboardingStorage()
            router.push(`/visibility/${runId}`)
        },
        [clearOnboardingStorage, router],
    )


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

                const [scope, gaps, articles, progress, ownedBrands] = await Promise.all([
                    getAuditScope(brandId),
                    getGapEvidence(brandId),
                    getPlannedArticles(brandId),
                    getProgramProgress(brandId),
                    getUserBrands(),
                ])

                if (!scope) {
                    // Distinguish "no scope yet" from "this brand is gone".
                    // Without this the deleted-brand case is unrecoverable: the
                    // error leaves step and brandId set, so every refresh
                    // repeats it forever.
                    const brandStillExists = (ownedBrands || []).some(
                        (owned: { id: string }) => owned.id === brandId,
                    )
                    if (!brandStillExists) {
                        resetToBrandStep(
                            "That brand was deleted, so its audit is gone too. Start again by adding a website.",
                        )
                        return
                    }
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
    }, [auditScope, brandId, isHydrated, isLoadingScope, step, resetToBrandStep])

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
        <div className={`flex min-h-[calc(100vh-5rem)] flex-col px-4 py-6 font-sans sm:px-6 ${brandData && step === "brand" ? "items-stretch sm:items-center" : "items-center justify-center"}`}>
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
          ${step === "audit-results" ? "max-w-[1400px] w-full px-4 sm:px-6" : brandData ? "max-w-3xl" : "max-w-xl"}
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
                            {/* Where am I, and what is left.
                                Steps 1 and 2 are the same route and swap on a
                                ternary, so without this the screen simply changed
                                underneath the founder — and the island resizes at
                                the same moment, which read as a jump to nowhere. */}
                            {step !== "audit-results" && (
                                <ol className="flex justify-center items-center gap-1 border-b border-stone-100 px-4 py-3 text-[10px] sm:px-6">
                                    {[
                                        { key: "site", label: "Website", done: step !== "brand", active: step === "brand" },
                                        { key: "profile", label: "Your brand", done: ["scope", "prompts", "extras", "audit"].includes(step), active: step === "profile" },
                                        { key: "scope", label: "Topics", done: ["prompts", "extras", "audit"].includes(step), active: step === "scope" },
                                        { key: "prompts", label: "Questions", done: ["extras", "audit"].includes(step), active: step === "prompts" },
                                        { key: "audit", label: "Rivals", done: false, active: step === "extras" || step === "audit" },
                                    ].map((entry, entryIndex) => (
                                        <li key={entry.key} className="flex items-center gap-1">
                                            {entryIndex > 0 ? <span className="text-stone-300">·</span> : null}
                                            <span
                                                className={
                                                    entry.active
                                                        ? "font-medium text-stone-900"
                                                        : entry.done
                                                          ? "text-stone-400"
                                                          : "text-stone-300"
                                                }
                                            >
                                                <span className="font-mono tabular-nums">
                                                    {entry.done ? "✓" : entryIndex + 1}
                                                </span>{" "}
                                                {entry.label}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                            <AnimatePresence mode="wait">
                                {step === "brand" && (
                                    <motion.div
                                        key="brand-step"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="px-4 py-6 sm:px-6"
                                    >
                                        <SiteStep
                                            url={url}
                                            onUrlChange={setUrl}
                                            analyzing={analyzing}
                                            analyzePhase={analyzePhase}
                                            analysisInterrupted={analysisInterrupted}
                                            phasesSeen={phasesSeen}
                                            pageCount={pageCount}
                                            onAnalyze={handleAnalyzeBrand}
                                        />
                                    </motion.div>
                                )}

                                {step === "profile" && brandData && (
                                    <motion.div
                                        key="profile-step"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="px-4 py-6 sm:px-6"
                                    >
                                        <ProfileStep
                                            brand={brandData}
                                            onFieldChange={updateField}
                                            onArrayTextChange={(field, value) =>
                                                updateArray(field, value)
                                            }
                                            onPillChange={(field, value) =>
                                                setBrandData((prev) =>
                                                    prev ? { ...prev, [field]: value } : null,
                                                )
                                            }
                                            onConfirm={() => handleFindScope()}
                                        />
                                    </motion.div>
                                )}

                                {step === "scope" && brandData && (
                                    <motion.div
                                        key="scope-step"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="px-4 py-6 sm:px-6"
                                    >
                                        <ScopeStep
                                            brand={brandData}
                                            targetSeeds={targetSeeds}
                                            seedsWithoutDemand={seedsWithoutDemand}
                                            scopeLoading={scopeLoading}
                                            scopeReady={scopeReady}
                                            phasesSeen={phasesSeen}
                                            scopeAnalysisIssues={scopeAnalysisIssues}
                                            scopeBlockers={scopeBlockers}
                                            error={error}
                                            onFamiliesChange={(scope_families) =>
                                                setBrandData((current) =>
                                                    current ? { ...current, scope_families } : current,
                                                )
                                            }
                                            onTargetSeedsChange={(seeds) => {
                                                // Both, deliberately: the component reads the prop,
                                                // the server validator reads brandData.
                                                setTargetSeeds(seeds)
                                                setBrandData((current) =>
                                                    current
                                                        ? { ...current, target_seed_keywords: seeds }
                                                        : current,
                                                )
                                            }}
                                            onLookAgain={handleFindScope}
                                            onRestart={() => resetToBrandStep("")}
                                            onContinue={handleProceedToPrompts}
                                        />
                                    </motion.div>
                                )}

                                {step === "prompts" && brandData && (
                                    <motion.div
                                        key="prompts-step"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="px-4 py-6 sm:px-6"
                                    >
                                        <PromptsStep
                                            prompts={prompts}
                                            scopeFamilies={brandData.scope_families || []}
                                            productName={brandData.product_name || ""}
                                            loading={promptsLoading}
                                            regeneratingFamilyId={regeneratingFamilyId}
                                            error={promptsError}
                                            onPromptsChange={(newPrompts) => {
                                                setPrompts(newPrompts)
                                                localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(newPrompts))
                                            }}
                                            onRegenerateFamily={handleRegenerateFamily}
                                            onBack={() => setStep("scope")}
                                            onContinue={() => setStep("extras")}
                                        />
                                    </motion.div>
                                )}

                                {step === "extras" && brandData && (
                                    <motion.div
                                        key="extras-step"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="px-4 py-6 sm:px-6"
                                    >
                                        <ExtrasStep
                                            brand={brandData}
                                            competitors={competitors}
                                            discovering={discoveringCompetitors}
                                            onCompetitorsChange={setCompetitors}
                                            onFieldChange={updateField}
                                            saving={savingBrand}
                                            onStart={handleSaveBrand}
                                        />
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
                                        <ProbeConsole
                                            brandId={brandId}
                                            prompts={prompts}
                                            existingRunId={probeRunId}
                                            onRunStarted={handleProbeStarted}
                                            onComplete={handleProbeComplete}
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
                                                {/* Breathing text, not a spinner — same language as the
                                                    step loader, which is the only waiting treatment here. */}
                                                <motion.p
                                                    className="text-stone-500 text-sm"
                                                    animate={isLoadingScope ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
                                                    transition={
                                                        isLoadingScope
                                                            ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                                                            : { duration: 0.2 }
                                                    }
                                                >
                                                    {isLoadingScope
                                                        ? "Loading the verified scope and source evidence…"
                                                        : "Audit scope is not available yet."}
                                                </motion.p>
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
