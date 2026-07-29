import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

import { harvestAutocomplete } from "@/lib/harvest/autocomplete"
import { harvestSerpQuestions } from "@/lib/harvest/serp-questions"
import { harvestCompetitorCorpus } from "@/lib/harvest/competitor-corpus"
import {
    dedupeQueries, mapWithConcurrency, capProportionally,
    brandTokensFromUrls, QuerySource,
} from "@/lib/harvest/types"
import { buildNicheCentroid, filterByNicheRelevance, NICHE_RELEVANCE_FLOOR } from "@/lib/harvest/niche-filter"
import { filterToSearchedQueries } from "@/lib/harvest/query-validation"
import { generateEmbedding } from "@/lib/gemini-embedding"
import { scanCoverage, PoolQuery, SiteCoverageResult } from "@/lib/harvest/coverage"
import { computeGaps } from "@/lib/harvest/gap-engine"
import { collapseToArticles, groupIntoClusters, assertCollapseRatio } from "@/lib/harvest/clusterer"

/**
 * Acceptance criteria this endpoint enforces.
 *
 * The first run "passed" while 86% of gaps were untraceable and the SERP source
 * had silently failed authentication, because the endpoint reported numbers
 * without judging them. It now returns an explicit pass/fail per check.
 */
const ACCEPTANCE = {
    /** Share of gaps that must carry a source_url */
    MIN_TRACEABLE_RATIO: 1.0,
    /** Documented collapse range — articles as a share of gaps */
    COLLAPSE_MIN: 0.25,
    COLLAPSE_MAX: 0.40,
    /**
     * Collapse is undefined on a tiny pool: 21 already-distinct gaps cannot
     * merge down to 25-40% no matter how good the clusterer is. Below this the
     * check reports INCONCLUSIVE rather than a misleading pass or fail.
     */
    MIN_GAPS_FOR_COLLAPSE: 60,
    /** Largest permitted cluster */
    MAX_CLUSTER_SIZE: 15,
}

type CheckState = "PASS" | "FAIL" | "INCONCLUSIVE"

interface Check {
    name: string
    state: CheckState
    detail: string
}

/**
 * Dev-only dry run of the closed-pool pipeline.
 *
 * Runs harvest → coverage → gaps → clustering entirely in memory, writing
 * nothing to the database, so the output can be inspected before any of it is
 * shown to a customer.
 *
 * This exists to make the provenance test executable. Sample `provenance` from
 * the response, open each `sourceUrl`, and confirm the query genuinely appears
 * there. Any row that cannot be traced back to its source is a bug in the
 * harvest, not a threshold that needs tuning.
 *
 *   curl -X POST http://localhost:3000/api/harvest/verify \
 *     -H 'content-type: application/json' \
 *     -d '{"url":"https://example.com","seeds":["ai photo restoration"],
 *          "competitors":["https://competitor.com"]}'
 */

export const maxDuration = 300

interface VerifyRequest {
    url: string
    seeds: string[]
    competitors?: string[]
    countryCode?: string
    /** Cap the pool before embedding, to keep a smoke test cheap */
    maxQueries?: number
    /**
     * One sentence describing the product, used to disambiguate the seeds.
     * Without it "topical authority" embeds toward pharmacology and the pool
     * fills with transdermal drug-delivery queries.
     */
    brandContext?: string
    /**
     * What the seeds must NOT mean, for ambiguous words. With the seed
     * "topical authority", passing "topical medication, dermatology, drug
     * delivery" rejects pharmacology queries that a plain relevance floor
     * cannot separate from real SEO topics.
     */
    excludeContext?: string
}

const EMBEDDING_CONCURRENCY = 5
const PROVENANCE_SAMPLE_SIZE = 20

export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 404 })
    }

    const startedAt = Date.now()

    try {
        const body = (await req.json()) as VerifyRequest
        const {
            url, seeds, competitors = [], countryCode,
            maxQueries = 400, brandContext, excludeContext,
        } = body

        if (!url || !Array.isArray(seeds) || seeds.length === 0) {
            return NextResponse.json(
                { error: "Provide `url` and a non-empty `seeds` array" },
                { status: 400 }
            )
        }

        // Brand tokens from the target and its competitors. Their branded
        // support questions are real page content but not topics anyone else
        // can write about.
        const excludeBrands = brandTokensFromUrls([url, ...competitors])

        // --- 1. Harvest ---
        const [autocomplete, serpQuestions, competitorTopics] = await Promise.all([
            harvestAutocomplete(seeds, { countryCode }),
            harvestSerpQuestions(seeds, undefined, 6, excludeBrands),
            harvestCompetitorCorpus(competitors, excludeBrands),
        ])

        const reports = [autocomplete.report, serpQuestions.report, competitorTopics.report]
        const hardFailures = reports.filter((r) => r.hardFailure)

        // A source that failed every request must not be reported as success.
        if (hardFailures.length > 0) {
            return NextResponse.json(
                {
                    verdict: "FAIL",
                    reason: "source_failure",
                    detail: hardFailures.map(
                        (r) => `${r.source}: ${r.requestsFailed}/${r.requestsAttempted} requests failed`
                    ),
                    reports,
                },
                { status: 424 }
            )
        }

        // Page-backed sources come first so verifiable provenance wins dedup,
        // matching lib/harvest/pool.ts
        // Page-derived strings have perfect provenance but include navigation,
        // testimonials and marketing copy. Keep only those with actual search
        // demand before spending embeddings on them.
        const demandFiltered = await filterToSearchedQueries(
            dedupeQueries([
                ...serpQuestions.queries,
                ...competitorTopics.queries,
                ...autocomplete.queries,
            ]),
            { countryCode }
        )

        // Cap proportionally, never by truncation — a tail slice zeroed out the
        // entire autocomplete source on an earlier run.
        const merged = capProportionally(demandFiltered.kept, maxQueries)

        if (merged.length === 0) {
            return NextResponse.json(
                { verdict: "FAIL", reason: "empty_harvest", reports },
                { status: 422 }
            )
        }

        // --- 2. Embed in memory (no persistence) ---
        const rawEmbeddings = await mapWithConcurrency(merged, EMBEDDING_CONCURRENCY, (q) =>
            generateEmbedding(q.query, "RETRIEVAL_QUERY")
        )

        // --- 3. Niche relevance gate ---
        const centroid = await buildNicheCentroid(seeds, brandContext, excludeContext)
        const filtered = filterByNicheRelevance(merged, rawEmbeddings, centroid)

        if (filtered.kept.length === 0) {
            return NextResponse.json(
                {
                    verdict: "FAIL",
                    reason: "niche_filter_rejected_everything",
                    detail: `Centroid rejected all ${merged.length} queries. Check seeds: ${seeds.join(", ")}`,
                    distribution: filtered.distribution,
                    reports,
                },
                { status: 422 }
            )
        }

        const bySource = filtered.kept.reduce<Record<string, number>>((acc, k) => {
            acc[k.query.source] = (acc[k.query.source] || 0) + 1
            return acc
        }, {})

        const poolQueries: PoolQuery[] = []
        const poolMeta = new Map<string, { source: QuerySource; sourceUrl: string | null }>()

        for (const { query, embedding } of filtered.kept) {
            const id = randomUUID()
            poolQueries.push({ id, query: query.query, embedding })
            poolMeta.set(id, { source: query.source, sourceUrl: query.source_url })
        }

        // --- 3. Coverage ---
        const userCoverage = await scanCoverage(url, "User site", poolQueries)

        const competitorCoverages: SiteCoverageResult[] = []
        for (const competitor of competitors) {
            try {
                competitorCoverages.push(await scanCoverage(competitor, competitor, poolQueries))
            } catch (error) {
                console.error(`[Verify] Competitor scan failed for ${competitor}:`, error)
            }
        }

        // --- 4. Gaps and clustering ---
        const gapResult = computeGaps(userCoverage, competitorCoverages, poolMeta)

        const embeddingMap = new Map(poolQueries.map((q) => [q.id, q.embedding]))
        const units = collapseToArticles(gapResult.gaps, embeddingMap)

        let collapseError: string | null = null
        try {
            assertCollapseRatio(gapResult.gapCount, units.length)
        } catch (error: any) {
            collapseError = error.message
        }

        const clusters = groupIntoClusters(units)

        // --- 5. Acceptance checks ---
        const withSourceUrl = gapResult.gaps.filter((g) => g.sourceUrl)
        const traceableRatio = gapResult.gapCount ? withSourceUrl.length / gapResult.gapCount : 0
        const collapseRatio = gapResult.gapCount ? units.length / gapResult.gapCount : 0
        const largestCluster = clusters.reduce((max, c) => Math.max(max, c.articles.length), 0)

        const collapseMeasurable = gapResult.gapCount >= ACCEPTANCE.MIN_GAPS_FOR_COLLAPSE

        const checks: Check[] = [
            {
                name: "provenance",
                state: traceableRatio >= ACCEPTANCE.MIN_TRACEABLE_RATIO ? "PASS" : "FAIL",
                detail: `${withSourceUrl.length}/${gapResult.gapCount} gaps traceable (${(traceableRatio * 100).toFixed(1)}%), require 100%`,
            },
            {
                name: "collapse_ratio",
                state: !collapseMeasurable
                    ? "INCONCLUSIVE"
                    : collapseRatio >= ACCEPTANCE.COLLAPSE_MIN && collapseRatio <= ACCEPTANCE.COLLAPSE_MAX
                        ? "PASS"
                        : "FAIL",
                detail: collapseMeasurable
                    ? `${(collapseRatio * 100).toFixed(1)}%, require ${ACCEPTANCE.COLLAPSE_MIN * 100}-${ACCEPTANCE.COLLAPSE_MAX * 100}%`
                    : `only ${gapResult.gapCount} gaps; need >=${ACCEPTANCE.MIN_GAPS_FOR_COLLAPSE} to measure (observed ${(collapseRatio * 100).toFixed(1)}%)`,
            },
            {
                name: "cluster_size",
                state: largestCluster <= ACCEPTANCE.MAX_CLUSTER_SIZE ? "PASS" : "FAIL",
                detail: `largest cluster ${largestCluster}, max ${ACCEPTANCE.MAX_CLUSTER_SIZE}`,
            },
            {
                name: "sources_healthy",
                state: reports.every((r) => !r.hardFailure) ? "PASS" : "FAIL",
                detail: reports
                    .map((r) => `${r.source}=${r.queriesFound}${r.requestsFailed ? ` (${r.requestsFailed} failed)` : ""}`)
                    .join(", "),
            },
            {
                name: "all_sources_represented",
                state: reports.every((r) => r.queriesFound === 0 || (bySource[r.source] || 0) > 0)
                    ? "PASS"
                    : "FAIL",
                detail: `pool composition ${JSON.stringify(bySource)} vs harvested ${JSON.stringify(
                    Object.fromEntries(reports.map((r) => [r.source, r.queriesFound]))
                )}`,
            },
        ]

        // An inconclusive check is not a pass. A run that cannot measure
        // something must not claim it verified it.
        const verdict: CheckState = checks.some((c) => c.state === "FAIL")
            ? "FAIL"
            : checks.some((c) => c.state === "INCONCLUSIVE")
                ? "INCONCLUSIVE"
                : "PASS"

        // Sample from source-backed gaps only — the sample must be able to
        // perform the test it claims to expose.
        const provenance = withSourceUrl.slice(0, PROVENANCE_SAMPLE_SIZE).map((g) => ({
            query: g.query,
            source: g.source,
            sourceUrl: g.sourceUrl,
            userStatus: g.userStatus,
            userSimilarity: g.userSimilarity,
            competitorUrls: g.competitors.map((c) => c.matchedUrl),
        }))

        return NextResponse.json({
            verdict,
            checks,
            summary: {
                poolSize: poolQueries.length,
                bySource,
                harvestedBeforeFilter: merged.length,
                droppedByDemandFilter: demandFiltered.dropped.length,
                demandCheckFailures: demandFiltered.checkFailures,
                droppedByNicheFilter: filtered.dropped.length,
                userPagesScanned: userCoverage.pagesScanned,
                competitorsScanned: competitorCoverages.length,
                covered: gapResult.coveredCount,
                partial: gapResult.partialCount,
                gaps: gapResult.gapCount,
                authorityScore: gapResult.authorityScore,
                articleUnits: units.length,
                clusters: clusters.length,
                clusterSizes: clusters.map((c) => c.articles.length),
                collapseRatio: `${(collapseRatio * 100).toFixed(1)}%`,
                collapseError,
                durationMs: Date.now() - startedAt,
            },
            reports,
            demandFilter: {
                dropped: demandFiltered.dropped.length,
                checkFailures: demandFiltered.checkFailures,
                // Page furniture rejected for having no search demand
                droppedSample: demandFiltered.dropped.slice(0, 25),
            },
            nicheFilter: {
                floor: NICHE_RELEVANCE_FLOOR,
                distribution: filtered.distribution,
                // Worst-first, so drift like medical "topical" shows up at the top
                droppedSample: filtered.dropped.slice(0, 25),
                // Lowest-scoring survivors — the calibration data for the floor
                weakestKept: filtered.weakestKept,
            },
            provenanceCoverage: {
                gapsWithSourceUrl: withSourceUrl.length,
                gapsTotal: gapResult.gapCount,
                gapsWithCompetitorEvidence: gapResult.gaps.filter((g) => g.competitors.length > 0).length,
            },
            // Open each sourceUrl and confirm the query is actually on that page.
            provenance,
            clusters: clusters.map((c) => ({
                name: c.name,
                articleCount: c.articles.length,
                sampleArticles: c.articles.slice(0, 5).map((a) => ({
                    mainKeyword: a.mainKeyword,
                    supportingKeywords: a.supportingKeywords,
                    articleType: a.articleType,
                })),
            })),
        })
    } catch (error: any) {
        console.error("[Verify] Failed:", error)
        return NextResponse.json(
            { error: error.message || "Verification run failed" },
            { status: 500 }
        )
    }
}
