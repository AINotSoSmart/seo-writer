/**
 * Harvest orchestrator and pool persistence.
 *
 * Runs all three harvesters, merges them with provenance-aware deduplication,
 * embeds the result, and upserts into `query_pool`.
 *
 * This function replaces `generateNicheBlueprint()`. The difference is the whole
 * pivot: the blueprint asked an LLM to imagine what a niche contains, whereas
 * this observes what the niche actually contains and records where it looked.
 */

import { createAdminClient } from "@/utils/supabase/admin"
import { generateEmbedding } from "@/lib/gemini-embedding"
import { BrandDetails } from "@/lib/schemas/brand"
import { extractSearchPrefs } from "@/lib/tavily-search"

import { harvestAutocomplete } from "./autocomplete"
import { harvestSerpQuestions } from "./serp-questions"
import { harvestCompetitorCorpus } from "./competitor-corpus"
import { buildNicheCentroid, filterByNicheRelevance } from "./niche-filter"
import {
    HarvestedQuery, SourceReport, dedupeQueries,
    mapWithConcurrency, brandTokensFromUrls,
} from "./types"

/** Country name → ISO alpha-2, for Google Autocomplete's `gl` parameter */
const COUNTRY_ISO: Record<string, string> = {
    "united states": "us", "united kingdom": "gb", australia: "au", canada: "ca",
    india: "in", germany: "de", france: "fr", japan: "jp", brazil: "br",
    netherlands: "nl", italy: "it", spain: "es", mexico: "mx", singapore: "sg",
    "new zealand": "nz", ireland: "ie", sweden: "se", switzerland: "ch",
    "south africa": "za", poland: "pl", norway: "no", denmark: "dk",
    "united arab emirates": "ae", philippines: "ph", indonesia: "id",
}

const EMBEDDING_CONCURRENCY = 5

export interface HarvestResult {
    poolSize: number
    bySource: Record<string, number>
    queries: HarvestedQuery[]
    /** Per-source outcome, including hard failures */
    reports: SourceReport[]
    /** Queries cut by the niche filter, worst-first, for inspection */
    droppedByNicheFilter: Array<{ query: string; source: string; similarity: number }>
    /** Rows lacking a source_url — must be zero */
    untraceableCount: number
}

/**
 * Thrown when a harvest cannot be trusted. Callers should surface this rather
 * than proceeding with a partial pool: a plan built on a silently-broken source
 * is exactly the failure mode this pipeline exists to prevent.
 */
export class HarvestIntegrityError extends Error {
    constructor(message: string, public readonly reports: SourceReport[]) {
        super(message)
        this.name = "HarvestIntegrityError"
    }
}

/**
 * Derives 2-6 short seed phrases from brand identity.
 *
 * Adapted from `gatherAutocompleteSeed()` in lib/plans/strategic-planner.ts,
 * which had the right idea but used the seeds only as prompt flavour text.
 * Here they are the root of the entire pool.
 */
export function deriveSeeds(brandData: BrandDetails): string[] {
    const seeds: string[] = []

    const literally = brandData.product_identity?.literally || brandData.category || ""
    if (literally) {
        const words = literally.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2)
        if (words.length >= 2) seeds.push(words.slice(0, 3).join(" "))
        if (words.length >= 1) seeds.push(words[0])
    }

    if (brandData.category) {
        seeds.push(brandData.category.toLowerCase())
    }

    if (Array.isArray(brandData.brand_keywords)) {
        for (const keyword of brandData.brand_keywords.slice(0, 3)) {
            const cleaned = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim()
            if (cleaned.length > 3 && cleaned.split(" ").length <= 4) seeds.push(cleaned)
        }
    }

    if (Array.isArray(brandData.core_features)) {
        for (const feature of brandData.core_features.slice(0, 2)) {
            const cleaned = feature.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim()
            if (cleaned.length > 3 && cleaned.split(" ").length <= 4) seeds.push(cleaned)
        }
    }

    // Deduplicate while preserving order, drop the product's own brand name
    // (nobody outside the company searches for it yet)
    const brandName = (brandData.product_name || "").toLowerCase().trim()
    const unique = Array.from(new Set(seeds)).filter((s) => s && s !== brandName)

    return unique.slice(0, 6)
}

/**
 * Merges harvests from all sources.
 *
 * Order matters: a query found on a real page is stronger evidence than the
 * same string from an autocomplete request, so page-backed sources are listed
 * first and win deduplication.
 */
function mergeHarvests(
    serpQuestions: HarvestedQuery[],
    competitorTopics: HarvestedQuery[],
    autocomplete: HarvestedQuery[]
): HarvestedQuery[] {
    return dedupeQueries([...serpQuestions, ...competitorTopics, ...autocomplete])
}

/**
 * Short prose describing the brand, used to disambiguate the seeds.
 *
 * Without this, "topical authority" embeds close to pharmacology and the pool
 * fills with transdermal drug-delivery queries.
 */
function buildBrandContext(brandData: BrandDetails): string {
    return [
        brandData.product_identity?.literally,
        brandData.category,
        brandData.audience?.primary ? `for ${brandData.audience.primary}` : "",
        Array.isArray(brandData.core_features) ? brandData.core_features.slice(0, 4).join(", ") : "",
    ]
        .filter(Boolean)
        .join(". ")
}

/**
 * Runs the full harvest for a brand and persists it to `query_pool`.
 *
 * @param competitorUrls  competitor homepages (from discovery or user input)
 */
export async function harvestQueryPool(
    userId: string,
    brandId: string,
    brandData: BrandDetails,
    competitorUrls: string[] = []
): Promise<HarvestResult> {
    const seeds = deriveSeeds(brandData)

    if (seeds.length === 0) {
        throw new Error(
            "Cannot harvest: no seed phrases could be derived from brand data. " +
            "The brand needs at least a category or product description."
        )
    }

    console.log(`[Harvest] Seeds: ${seeds.join(", ")}`)

    const searchPrefs = extractSearchPrefs(brandData)
    const countryCode = COUNTRY_ISO[(searchPrefs.country || "").toLowerCase()] || undefined

    // Brand tokens from the brand's own site and its competitors, so branded
    // support questions never enter the pool as targetable topics.
    const excludeBrands = [
        ...brandTokensFromUrls(competitorUrls),
        brandData.product_name?.toLowerCase().trim(),
    ].filter((b): b is string => Boolean(b) && b!.length >= 3)

    // Run all three sources concurrently — they hit different services
    const [autocomplete, serpQuestions, competitorTopics] = await Promise.all([
        harvestAutocomplete(seeds, { countryCode }),
        harvestSerpQuestions(seeds, searchPrefs, 6, excludeBrands),
        harvestCompetitorCorpus(competitorUrls, excludeBrands),
    ])

    const reports = [autocomplete.report, serpQuestions.report, competitorTopics.report]

    // A source that was configured and then failed every request is an outage,
    // not an empty result. Refuse to build a plan on top of it.
    const hardFailures = reports.filter((r) => r.hardFailure)
    if (hardFailures.length > 0) {
        const detail = hardFailures
            .map((r) => `${r.source} (${r.requestsFailed}/${r.requestsAttempted} failed: ${r.errors[0] || "unknown"})`)
            .join("; ")
        throw new HarvestIntegrityError(
            `Harvest aborted — source failure: ${detail}`,
            reports
        )
    }

    const merged = mergeHarvests(
        serpQuestions.queries,
        competitorTopics.queries,
        autocomplete.queries
    )

    if (merged.length === 0) {
        throw new HarvestIntegrityError("Harvest produced zero queries", reports)
    }

    // Provenance invariant: nothing enters the pool without a source URL.
    const untraceable = merged.filter((q) => !q.source_url)
    if (untraceable.length > 0) {
        throw new HarvestIntegrityError(
            `${untraceable.length}/${merged.length} harvested queries have no source_url. ` +
            `Every row must be traceable. First offender: "${untraceable[0].query}" (${untraceable[0].source})`,
            reports
        )
    }

    console.log(`[Harvest] Merged pool: ${merged.length} queries, all traceable`)

    // --- Relevance gate: observed does not mean relevant ---
    const embeddings = await mapWithConcurrency(merged, EMBEDDING_CONCURRENCY, (q) =>
        generateEmbedding(q.query, "RETRIEVAL_QUERY")
    )

    // `not` is the brand's own statement of what it isn't — exactly the
    // disambiguation the drift centroid needs, already collected at onboarding.
    const centroid = await buildNicheCentroid(
        seeds,
        buildBrandContext(brandData),
        brandData.product_identity?.not
    )
    const filtered = filterByNicheRelevance(merged, embeddings, centroid)

    if (filtered.kept.length === 0) {
        throw new HarvestIntegrityError(
            `Niche filter rejected all ${merged.length} queries — the centroid is probably wrong. ` +
            `Check the seeds: ${seeds.join(", ")}`,
            reports
        )
    }

    const keptQueries = filtered.kept.map((k) => k.query)

    const bySource = keptQueries.reduce<Record<string, number>>((acc, q) => {
        acc[q.source] = (acc[q.source] || 0) + 1
        return acc
    }, {})

    console.log(
        `[Harvest] Final pool: ${keptQueries.length} queries ` +
        `(${Object.entries(bySource).map(([s, n]) => `${s}=${n}`).join(", ")})`
    )

    await persistPool(userId, brandId, filtered.kept)

    return {
        poolSize: keptQueries.length,
        bySource,
        queries: keptQueries,
        reports,
        droppedByNicheFilter: filtered.dropped,
        untraceableCount: 0,
    }
}

/**
 * Upserts harvested queries that have already been embedded and filtered.
 *
 * Embedding happens upstream in `harvestQueryPool` because the niche filter
 * needs the vectors to judge relevance — re-embedding here would double the
 * cost for no benefit.
 *
 * Re-harvesting the same brand is an upsert on (brand_id, query_norm): existing
 * rows get `last_seen_at` bumped and keep their coverage state, new rows appear
 * as gaps. That is how the pool stays renewable month over month.
 */
export async function persistPool(
    userId: string,
    brandId: string,
    entries: Array<{ query: HarvestedQuery; embedding: number[] }>
): Promise<void> {
    const supabase = createAdminClient()

    const rows = entries.map(({ query: q, embedding }) => ({
        user_id: userId,
        brand_id: brandId,
        query: q.query,
        query_norm: q.query_norm,
        source: q.source,
        source_url: q.source_url,
        source_seed: q.source_seed,
        // Immutable record of what the source actually returned, and when.
        // Autocomplete results drift, so the URL alone is not enough evidence.
        observed_value: q.observed_value,
        observed_at: q.observed_at,
        embedding,
        last_seen_at: new Date().toISOString(),
    }))

    // Chunked upsert; pgvector payloads are large
    const CHUNK = 100
    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        const { error } = await (supabase as any)
            .from("query_pool")
            .upsert(chunk, { onConflict: "brand_id,query_norm", ignoreDuplicates: false })

        if (error) {
            console.error(`[Harvest] Failed to persist chunk ${i / CHUNK + 1}:`, error)
            throw new Error(`Pool persistence failed: ${error.message}`)
        }
    }

    console.log(`[Harvest] Persisted ${rows.length} queries to query_pool`)
}
