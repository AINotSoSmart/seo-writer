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
    | "scope_ready"
    | "brand_ready"
    | "complete"
    | "error"

export interface AnalyzeBrandStreamEvent {
    phase: AnalyzeBrandPhase
    message?: string
    pages?: Array<{ url: string }>
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
    scope_ready: "Finding product areas…",
    brand_ready: "Building brand profile…",
    complete: "Ready",
} as const

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
    let lastEvent: AnalyzeBrandStreamEvent | null = null

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
            lastEvent = event
            onEvent(event)
            if (event.phase === "error") {
                throw new Error(event.error || "Brand analysis failed")
            }
            if (event.phase === "complete") {
                return event
            }
        }
    }

    if (buffer.trim()) {
        try {
            const event = JSON.parse(buffer.trim()) as AnalyzeBrandStreamEvent
            lastEvent = event
            onEvent(event)
            if (event.phase === "error") {
                throw new Error(event.error || "Brand analysis failed")
            }
            if (event.phase === "complete") return event
        } catch (error) {
            if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
                throw error
            }
        }
    }

    if (lastEvent?.phase === "complete") return lastEvent
    throw new Error("Brand analysis ended before a complete result")
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
