/**
 * NDJSON stream contract for POST /api/analyze-brand.
 *
 * One analyze job, progressive events so onboarding can unlock scope review
 * before the persona fields finish — without a second request or fake timers.
 */

import type { BrandDetails, ScopeFamily } from "@/lib/schemas/brand"

export type AnalyzeBrandPhase =
    | "crawl_started"
    | "crawl_done"
    | "scope_started"
    | "scope_grounding"
    | "scope_refining"
    | "scope_ready"
    | "brand_ready"
    | "complete"
    | "error"

/**
 * A crawled page, carried between the two calls.
 *
 * `title` used to be dropped twice — once in `pagesFromCrawl`, again when the
 * `crawl_done` event mapped to `{ url }` only. It is the highest-value signal a
 * JS-rendered site still exposes, so it is now kept and used as a scope corpus
 * when the markdown extraction comes back empty.
 */
export interface AnalyzedPage {
    url: string
    title?: string
    content?: string
}

export interface AnalyzeBrandStreamEvent {
    phase: AnalyzeBrandPhase
    message?: string
    pages?: AnalyzedPage[]
    scope_families?: ScopeFamily[]
    scope_analysis_issues?: Array<{ family?: string; message: string }>
    unassigned_target_seeds?: string[]
    brand?: Partial<BrandDetails>
    data?: BrandDetails & {
        scope_analysis_issues?: Array<{ family?: string; message: string }>
        unassigned_target_seeds?: string[]
    }
    error?: string
}

export const ANALYZE_PHASE_COPY = {
    crawl_started: "Reading your site…",
    crawl_done: "Reading your site…",
    scope_started: "Finding product areas…",
    scope_grounding: "Finding product areas…",
    scope_refining: "Finding product areas…",
    scope_ready: "Finding product areas…",
    brand_ready: "Building brand profile…",
    complete: "Ready",
} as const

/**
 * The two waits, as ordered phase lists.
 *
 * Onboarding runs sequentially — brand details are confirmed before scope is
 * fetched — so each screen waits only on its own events. Both waits render with
 * the SAME component (`AnalyzePhaseList`); only the list differs. There is no
 * second loader style and no spinner.
 */
export const BRAND_ANALYZE_PHASES = [
    "crawl_started",
    "crawl_done",
    "brand_ready",
] as const satisfies readonly AnalyzeBrandPhase[]

export const SCOPE_ANALYZE_PHASES = [
    "scope_started",
    "scope_grounding",
    "scope_refining",
    "scope_ready",
] as const satisfies readonly AnalyzeBrandPhase[]

export function encodeAnalyzeEvent(event: AnalyzeBrandStreamEvent): string {
    return `${JSON.stringify(event)}\n`
}

/**
 * Consume an NDJSON body from /api/analyze-brand. Invokes onEvent for every
 * parsed line. Throws on transport failure or a terminal error phase.
 */
export async function consumeAnalyzeBrandStream(
    response: Response,
    onEvent: (event: AnalyzeBrandStreamEvent) => void,
): Promise<AnalyzeBrandStreamEvent> {
    if (!response.body) {
        throw new Error("No response body from brand analysis")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    const seen: {
        last: AnalyzeBrandStreamEvent | null
        withFamilies: AnalyzeBrandStreamEvent | null
    } = { last: null, withFamilies: null }

    const applyEvent = (event: AnalyzeBrandStreamEvent) => {
        seen.last = event
        if ((event.scope_families?.length ?? 0) > 0) seen.withFamilies = event
        onEvent(event)
        if (event.phase === "error") {
            throw new Error(event.error || "Brand analysis failed")
        }
        if (event.phase === "complete") return event
        return null
    }

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            let event: AnalyzeBrandStreamEvent
            try {
                event = JSON.parse(trimmed) as AnalyzeBrandStreamEvent
            } catch {
                continue
            }
            const finished = applyEvent(event)
            if (finished) return finished
        }
    }

    if (buffer.trim()) {
        try {
            const event = JSON.parse(buffer.trim()) as AnalyzeBrandStreamEvent
            const finished = applyEvent(event)
            if (finished) return finished
        } catch (error) {
            if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
                throw error
            }
        }
    }

    if (seen.last?.phase === "complete") return seen.last
    // Grounded families already unlocked the confirm screen. A killed function
    // during refine must not throw that away and pretend we found nothing.
    if (seen.withFamilies) return seen.withFamilies
    throw new Error(
        "Finding product areas hit a time limit before it finished. Retry — this does not mean your site sells nothing.",
    )
}

/** Empty persona shell so scope review can render before brand_ready. */
export function emptyBrandShell(
    scopeFamilies: ScopeFamily[],
    targetSeeds: string[],
): BrandDetails {
    return {
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
        brand_keywords: [],
        scope_families: scopeFamilies,
        target_seed_keywords: targetSeeds,
        search_country: "",
        search_topic: "general",
        article_length: "long",
        image_style: "stock",
        style_dna: "",
    }
}
