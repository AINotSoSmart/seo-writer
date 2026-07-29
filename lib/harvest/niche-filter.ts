/**
 * Niche relevance filter.
 *
 * Harvesting from ambiguous seeds pulls in neighbouring domains. Verification of
 * the first run found "difference between topical and transdermal drug delivery"
 * in a pool seeded with "topical authority", and celebrity-voice/deepfake topics
 * that entered only because they sit in a competitor's sitemap.
 *
 * Both are the same defect: a string can be genuinely observed and still have
 * nothing to do with the customer's niche. Provenance proves a query is real; it
 * does not prove it is relevant. This filter is the second gate.
 *
 * Every decision is inspectable — `dropped` is returned in full so a human can
 * see exactly what was cut and why, rather than trusting a threshold.
 */

import { generateEmbedding } from "@/lib/gemini-embedding"
import { cosineSimilarity } from "@/lib/audit/site-scanner"
import { HarvestedQuery } from "./types"

/**
 * Minimum cosine to the niche centroid for a query to survive.
 *
 * CALIBRATED 2026-07-29 against flipaeo.com, n=300, seeds
 * ["ai seo writer", "topical authority content"].
 *
 * Observed distribution: min 0.377, p25 0.539, median 0.631, p75 0.698, max 0.785.
 *
 * The pharmacology drift from the ambiguous word "topical" formed a distinct
 * population between 0.42 and 0.46 — "is topical finasteride available in
 * india", "topical administration contraindications", "tacrolimus ointment".
 * Legitimate niche queries began at roughly p25 (0.539). A floor of 0.50 sits
 * in the gap between the two populations.
 *
 * At the previous value of 0.42 this filter dropped 3 of 300 rows and let every
 * one of those medical queries through.
 *
 * Re-check whenever seeds change materially: the gap between populations is
 * niche-specific. `weakestKept` in the verifier response is the data for it.
 */
export const NICHE_RELEVANCE_FLOOR = 0.50

/**
 * Laxer floor for strings read off real pages.
 *
 * Autocomplete is unanchored — it returns whatever Google's index associates
 * with the seed, which is how pharmacology arrived from "topical authority", so
 * it needs the full floor. Page-derived strings were read from a page the
 * harvest already selected as in-niche and have separately passed the search
 * demand check, so holding them to the same bar cut legitimate product
 * questions: "What file formats are supported?", "How long does restoration
 * take?", "Before and after examples". The drift centroid still guards them.
 */
export const PAGE_DERIVED_RELEVANCE_FLOOR = 0.38

export interface ScoredQuery {
    query: string
    source: string
    similarity: number
}

export interface NicheFilterResult<T> {
    kept: T[]
    dropped: ScoredQuery[]
    /**
     * Lowest-scoring rows that survived, worst first.
     *
     * Essential for calibration: on the run where the floor was 0.42 and the
     * observed minimum was 0.443, nothing was dropped and the response gave no
     * way to see what *nearly* was. These are the candidates for the next
     * floor adjustment.
     */
    weakestKept: ScoredQuery[]
    distribution: { min: number; p25: number; median: number; p75: number; max: number }
}

export interface NicheCentroids {
    niche: number[]
    /** Optional centroid describing what the seeds are NOT about */
    drift: number[] | null
}

/**
 * Builds the centroid(s) used to judge relevance.
 *
 * WHY A SECOND CENTROID: a single niche centroid cannot separate populations
 * that sit at the same distance from it. On the 2026-07-29 run,
 * "what is topical agent" (pharmacology, junk) scored 0.505 and "How to Create
 * and Optimize Your Robots.txt File" (legitimate SEO) scored 0.507. No floor
 * separates those. Raising it discards real topics; lowering it keeps drug
 * queries.
 *
 * A drift centroid resolves it by asking a different question: is this string
 * closer to the niche or to the thing the ambiguous seed word also means?
 *
 * @param excludeContext  what the seeds must NOT mean — e.g. "topical
 *                        medication, dermatology, drug delivery" when the seed
 *                        is "topical authority". Optional; without it the
 *                        filter falls back to a plain floor.
 */
export async function buildNicheCentroid(
    seeds: string[],
    brandContext?: string,
    excludeContext?: string
): Promise<NicheCentroids | null> {
    const parts = [...seeds]
    if (brandContext?.trim()) parts.push(brandContext.trim())

    if (parts.length === 0) return null

    try {
        // Embedded as documents: a centroid represents a body of subject matter
        // and queries are matched against it.
        const niche = await generateEmbedding(parts.join(". "), "RETRIEVAL_DOCUMENT")

        const drift = excludeContext?.trim()
            ? await generateEmbedding(excludeContext.trim(), "RETRIEVAL_DOCUMENT")
            : null

        return { niche, drift }
    } catch (error) {
        console.error("[NicheFilter] Failed to build centroid:", error)
        return null
    }
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
    return sorted[index]
}

/**
 * Drops queries semantically distant from the niche centroid.
 *
 * @param queries     harvested rows, parallel to `embeddings`
 * @param embeddings  query embeddings; a null entry means the row is kept
 *                    (we do not drop on missing evidence)
 * @param centroid    from buildNicheCentroid; null disables filtering entirely
 */
export function filterByNicheRelevance(
    queries: HarvestedQuery[],
    embeddings: (number[] | null)[],
    centroids: NicheCentroids | null,
    floor: number = NICHE_RELEVANCE_FLOOR
): NicheFilterResult<{ query: HarvestedQuery; embedding: number[] }> {
    const kept: Array<{ query: HarvestedQuery; embedding: number[] }> = []
    const dropped: ScoredQuery[] = []
    const keptScores: ScoredQuery[] = []
    const similarities: number[] = []
    let droppedByDrift = 0

    for (let i = 0; i < queries.length; i++) {
        const embedding = embeddings[i]
        if (!embedding) continue // no vector, cannot match or judge

        if (!centroids) {
            kept.push({ query: queries[i], embedding })
            continue
        }

        const similarity = cosineSimilarity(centroids.niche, embedding)
        similarities.push(similarity)

        // Drift check first: a string closer to the excluded meaning than to the
        // niche is rejected regardless of how it scores against the floor. This
        // is what separates "topical agent" from "robots.txt file" when both sit
        // at ~0.505 against the niche centroid.
        if (centroids.drift) {
            const driftSimilarity = cosineSimilarity(centroids.drift, embedding)
            if (driftSimilarity > similarity) {
                droppedByDrift++
                dropped.push({
                    query: queries[i].query,
                    source: queries[i].source,
                    similarity: Math.round(similarity * 1000) / 1000,
                })
                continue
            }
        }

        // Page-derived rows carry contextual grounding autocomplete lacks
        const effectiveFloor =
            queries[i].source === "autocomplete" ? floor : PAGE_DERIVED_RELEVANCE_FLOOR

        if (similarity >= effectiveFloor) {
            kept.push({ query: queries[i], embedding })
            keptScores.push({
                query: queries[i].query,
                source: queries[i].source,
                similarity: Math.round(similarity * 1000) / 1000,
            })
        } else {
            dropped.push({
                query: queries[i].query,
                source: queries[i].source,
                similarity: Math.round(similarity * 1000) / 1000,
            })
        }
    }

    const sorted = [...similarities].sort((a, b) => a - b)
    const distribution = {
        min: Number(percentile(sorted, 0).toFixed(3)),
        p25: Number(percentile(sorted, 25).toFixed(3)),
        median: Number(percentile(sorted, 50).toFixed(3)),
        p75: Number(percentile(sorted, 75).toFixed(3)),
        max: Number(percentile(sorted, 100).toFixed(3)),
    }

    console.log(
        `[NicheFilter] Distribution (n=${sorted.length}): ` +
        `min=${distribution.min} p25=${distribution.p25} median=${distribution.median} ` +
        `p75=${distribution.p75} max=${distribution.max}`
    )
    console.log(
        `[NicheFilter] Kept ${kept.length}, dropped ${dropped.length} ` +
        `(${droppedByDrift} closer to the excluded meaning, ${dropped.length - droppedByDrift} below floor ${floor})`
    )

    // Sort worst-first so the inspection sample shows the clearest rejections
    dropped.sort((a, b) => a.similarity - b.similarity)
    keptScores.sort((a, b) => a.similarity - b.similarity)

    return { kept, dropped, weakestKept: keptScores.slice(0, 25), distribution }
}
