/**
 * Gap engine — pure set difference, zero LLM involvement.
 *
 * This replaces `performGapAnalysis()` in lib/plans/gap-analysis.ts, which
 * asked an LLM to classify topics into "saturated / partial / blue ocean"
 * without giving it any counts to classify from, and whose "blue ocean" list
 * was seeded by `missingAngles` — an LLM answering "what topics are NOT covered
 * but SHOULD be?", i.e. pure invention.
 *
 * Here a gap is defined, not guessed:
 *
 *     gaps = query_pool − user_covered
 *
 * and every gap carries the URL where the query was observed plus the
 * competitor URLs that currently answer it. Both are clickable, which means
 * any claim this system makes can be checked by the person reading it.
 */

import { createAdminClient } from "@/utils/supabase/admin"
import { SiteCoverageResult, CoverageStatus } from "./coverage"
import { QuerySource } from "./types"
import type { QueryIntentBinding } from "../writer/article-contract"

export interface CompetitorMatch {
    name: string
    url: string
    matchedUrl: string
    similarity: number
}

export interface GapItem {
    queryId: string
    query: string
    /** Confirmed commercial family that positively owns this search intent. */
    scopeFamilyId: string
    /** Where we observed this query — the provenance claim */
    source: QuerySource
    sourceUrl: string | null
    sourceContext: string
    intentBinding: QueryIntentBinding
    /** User's current state for this query */
    userStatus: CoverageStatus
    userMatchedUrl: string | null
    userSimilarity: number
    /** Competitors currently answering it */
    competitors: CompetitorMatch[]
    /** Deterministic ranking score, 0-100 */
    priority: number
}

export interface GapAnalysisResult {
    gaps: GapItem[]
    totalPoolSize: number
    coveredCount: number
    partialCount: number
    gapCount: number
    /** Share of the observed niche the user currently owns, 0-100 */
    authorityScore: number
}

/**
 * Provenance weighting.
 *
 * A query read off a page that currently ranks is stronger evidence of real
 * demand than an autocomplete string, because someone already decided it was
 * worth writing about and Google already decided it was worth ranking.
 */
const SOURCE_WEIGHT: Record<QuerySource, number> = {
    paa: 30,
    competitor_sitemap: 20,
    autocomplete: 10,
}

/**
 * Scores a gap deterministically. No model call, no randomness — the same
 * inputs always produce the same ordering.
 */
function scoreGap(
    source: QuerySource,
    userStatus: CoverageStatus,
    competitorCount: number
): number {
    let score = SOURCE_WEIGHT[source] ?? 10

    // Competitor coverage is the strongest demand signal available: someone
    // with budget already validated this topic. Saturates at 5.
    score += Math.min(competitorCount, 5) * 10

    // A partial match is a cheaper win than starting from nothing, but a total
    // gap is a larger absolute opportunity.
    if (userStatus === "gap") score += 15
    else if (userStatus === "partial") score += 5

    return Math.max(0, Math.min(100, score))
}

/**
 * Computes gaps by differencing the pool against user coverage, and annotates
 * each with competitor ownership.
 *
 * @param userCoverage         result of scanCoverage() on the user's own site
 * @param competitorCoverages  same computation run per competitor
 */
export function computeGaps(
    userCoverage: SiteCoverageResult,
    competitorCoverages: SiteCoverageResult[],
    poolMeta: Map<
        string,
        {
            source: QuerySource
            sourceUrl: string | null
            scopeFamilyId: string
            sourceContext: string
            intentBinding: QueryIntentBinding
        }
    >
): GapAnalysisResult {
    // Index competitor coverage by query for O(1) lookup
    const competitorIndex = new Map<string, CompetitorMatch[]>()

    for (const competitor of competitorCoverages) {
        for (const c of competitor.coverage) {
            // Only "covered" counts as a competitor owning the query. Partial
            // matches are not evidence that somebody else has claimed it.
            if (c.status !== "covered" || !c.matchedUrl) continue

            const existing = competitorIndex.get(c.queryId) || []
            existing.push({
                name: competitor.siteName,
                url: competitor.siteUrl,
                matchedUrl: c.matchedUrl,
                similarity: c.similarity,
            })
            competitorIndex.set(c.queryId, existing)
        }
    }

    const gaps: GapItem[] = []
    let coveredCount = 0
    let partialCount = 0

    for (const userQuery of userCoverage.coverage) {
        if (userQuery.status === "covered") {
            coveredCount++
            continue // Not a gap — the user already owns it
        }
        if (userQuery.status === "partial") partialCount++

        const meta = poolMeta.get(userQuery.queryId)
        if (!meta?.scopeFamilyId) {
            throw new Error(
                `Query ${userQuery.queryId} has no confirmed business scope`,
            )
        }
        const source = meta?.source ?? "autocomplete"
        const competitors = competitorIndex.get(userQuery.queryId) || []

        gaps.push({
            queryId: userQuery.queryId,
            query: userQuery.query,
            scopeFamilyId: meta.scopeFamilyId,
            source,
            sourceUrl: meta?.sourceUrl ?? null,
            sourceContext: meta.sourceContext,
            intentBinding: meta.intentBinding,
            userStatus: userQuery.status,
            userMatchedUrl: userQuery.matchedUrl,
            userSimilarity: userQuery.similarity,
            competitors,
            priority: scoreGap(source, userQuery.status, competitors.length),
        })
    }

    // Highest priority first; ties broken by competitor count then alphabetically
    // so ordering is stable across runs.
    gaps.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        if (b.competitors.length !== a.competitors.length) {
            return b.competitors.length - a.competitors.length
        }
        return a.query.localeCompare(b.query)
    })

    const totalPoolSize = userCoverage.coverage.length
    const authorityScore = totalPoolSize > 0
        ? Math.round((coveredCount / totalPoolSize) * 100)
        : 0

    console.log(
        `[GapEngine] Pool ${totalPoolSize}: ${coveredCount} covered, ` +
        `${partialCount} partial, ${gaps.length} gaps. Authority ${authorityScore}%`
    )

    const withEvidence = gaps.filter((g) => g.competitors.length > 0).length
    console.log(`[GapEngine] ${withEvidence}/${gaps.length} gaps have competitor evidence`)

    return {
        gaps,
        totalPoolSize,
        coveredCount,
        partialCount,
        gapCount: gaps.length,
        authorityScore,
    }
}

/**
 * Loads the provenance map needed by computeGaps().
 */
export async function loadPoolMeta(
    brandId: string
): Promise<
    Map<
        string,
        {
            source: QuerySource
            sourceUrl: string | null
            scopeFamilyId: string
        }
    >
> {
    const supabase = createAdminClient()

    const { data, error } = await (supabase as any)
        .from("query_pool")
        .select("id, source, source_url, scope_family_id")
        .eq("brand_id", brandId)

    if (error) {
        throw new Error(`Failed to load pool metadata: ${error.message}`)
    }

    const map = new Map<
        string,
        {
            source: QuerySource
            sourceUrl: string | null
            scopeFamilyId: string
        }
    >()
    for (const row of data || []) {
        map.set(row.id, {
            source: row.source,
            sourceUrl: row.source_url,
            scopeFamilyId: row.scope_family_id,
        })
    }

    return map
}

/**
 * Writes competitor ownership back onto `query_pool` so the audit UI can render
 * the evidence layer without recomputing.
 */
export async function persistCompetitorMatches(
    brandId: string,
    gaps: GapItem[]
): Promise<void> {
    const supabase = createAdminClient()
    const withCompetitors = gaps.filter((g) => g.competitors.length > 0)

    const CHUNK = 100
    for (let i = 0; i < withCompetitors.length; i += CHUNK) {
        const chunk = withCompetitors.slice(i, i + CHUNK)

        await Promise.all(
            chunk.map((g) =>
                (supabase as any)
                    .from("query_pool")
                    .update({ competitor_matches: g.competitors })
                    .eq("id", g.queryId)
                    .eq("brand_id", brandId)
            )
        )
    }

    console.log(`[GapEngine] Persisted competitor evidence for ${withCompetitors.length} queries`)
}
