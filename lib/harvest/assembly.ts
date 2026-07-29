import "server-only"

import { createHash, randomUUID } from "crypto"

import { generateEmbedding } from "@/lib/gemini-embedding"
import { harvestAutocomplete } from "./autocomplete"
import { harvestCompetitorCorpus } from "./competitor-corpus"
import {
    collapseToArticles,
    groupIntoClusters,
    titleArticles,
    nameClusters,
    type ArticleCluster,
    type ArticleUnit,
} from "./clusterer"
import { type PoolQuery, scanCoverage, type SiteCoverageResult } from "./coverage"
import { computeGaps, type GapAnalysisResult, type GapItem } from "./gap-engine"
import { buildNicheCentroid, filterByNicheRelevance } from "./niche-filter"
import { HARVEST_POLICY } from "./policy"
import { filterToSearchedQueries } from "./query-validation"
import { harvestSerpQuestions } from "./serp-questions"
import {
    brandTokensFromUrls,
    capProportionally,
    dedupeQueries,
    mapWithConcurrency,
    type HarvestedQuery,
    type QuerySource,
    type SourceReport,
} from "./types"

const EMBEDDING_CONCURRENCY = 5

export interface HarvestInput {
    subjectUrl: string
    seeds: string[]
    competitors: string[]
    countryCode?: string
    brandContext?: string
    excludeContext?: string
    subjectName?: string
}

export interface AssembledQuery {
    id: string
    evidence: HarvestedQuery
    embedding: number[]
    userCoverage: SiteCoverageResult["coverage"][number]
    competitorMatches: GapItem["competitors"]
}

export interface HarvestStatistics {
    poolSize: number
    harvestedBeforeDemandFilter: number
    droppedByDemandFilter: number
    demandCheckFailures: number
    droppedByNicheFilter: number
    userPagesScanned: number
    competitorsScanned: number
    coveredCount: number
    partialCount: number
    gapCount: number
    authorityScore: number
    articleCount: number
    clusterCount: number
    clusterSizes: number[]
    collapseRatio: number
    bySource: Record<string, number>
}

export interface HarvestOutput {
    queries: AssembledQuery[]
    gaps: GapItem[]
    articleUnits: ArticleUnit[]
    clusters: ArticleCluster[]
    reports: SourceReport[]
    statistics: HarvestStatistics
    sourceCallLedger: Array<{
        source: string
        attempted: number
        succeeded: number
        failed: number
        cached: number
    }>
    sitePages: Array<{ url: string; title: string; embedding: number[] }>
    policyVersion: string
    resultHash: string
    droppedByDemandFilter: Array<{ query: string; source: string }>
    droppedByNicheFilter: Array<{ query: string; source: string; similarity: number }>
}

export class HarvestAssemblyError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly reports: SourceReport[] = [],
    ) {
        super(message)
        this.name = "HarvestAssemblyError"
    }
}

export interface HarvestAssemblyProgress {
    phase: string
    sourceCallLedger: HarvestOutput["sourceCallLedger"]
}

type AssemblyOptions = {
    onProgress?: (
        progress: HarvestAssemblyProgress,
    ) => Promise<void> | void
}

function validateInput(input: HarvestInput): HarvestInput {
    if (!input.subjectUrl || !Array.isArray(input.seeds) || input.seeds.length === 0) {
        throw new HarvestAssemblyError(
            "A subject URL and at least one seed are required.",
            "invalid_input",
        )
    }

    let subjectUrl: URL
    try {
        subjectUrl = new URL(input.subjectUrl)
    } catch {
        throw new HarvestAssemblyError("The subject URL is invalid.", "invalid_input")
    }
    if (!["http:", "https:"].includes(subjectUrl.protocol)) {
        throw new HarvestAssemblyError("The subject URL must use HTTP or HTTPS.", "invalid_input")
    }

    const competitors = Array.from(new Set(input.competitors || [])).slice(
        0,
        HARVEST_POLICY.maxCompetitors,
    )

    return {
        ...input,
        subjectUrl: subjectUrl.toString(),
        seeds: Array.from(new Set(input.seeds.map((seed) => seed.trim()).filter(Boolean))).slice(0, 6),
        competitors,
    }
}

function stableHash(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

/**
 * Authoritative in-memory closed-pool pipeline. It performs no database writes.
 * Production persists this exact output through finalize_audit_run().
 */
export async function assembleHarvest(
    rawInput: HarvestInput,
    options: AssemblyOptions = {},
): Promise<HarvestOutput> {
    const input = validateInput(rawInput)
    const excludeBrands = brandTokensFromUrls([input.subjectUrl, ...input.competitors])

    const [autocomplete, serpQuestions, competitorTopics] = await Promise.all([
        harvestAutocomplete(input.seeds, { countryCode: input.countryCode }),
        harvestSerpQuestions(input.seeds, undefined, 6, excludeBrands),
        harvestCompetitorCorpus(input.competitors, excludeBrands),
    ])

    const reports = [autocomplete.report, serpQuestions.report, competitorTopics.report]
    const liveLedger: HarvestOutput["sourceCallLedger"] = reports.map(
        (report) => ({
            source: String(report.source),
            attempted: report.requestsAttempted,
            succeeded: Math.max(
                0,
                report.requestsAttempted - report.requestsFailed,
            ),
            failed: report.requestsFailed,
            cached: 0,
        }),
    )
    await options.onProgress?.({
        phase: "harvesting",
        sourceCallLedger: [...liveLedger],
    })
    const hardFailures = reports.filter((report) => report.hardFailure)
    if (hardFailures.length > 0) {
        throw new HarvestAssemblyError(
            `A configured harvest source failed: ${hardFailures
                .map((report) => `${report.source} ${report.requestsFailed}/${report.requestsAttempted}`)
                .join(", ")}`,
            "source_failure",
            reports,
        )
    }

    const deduped = dedupeQueries([
        ...serpQuestions.queries,
        ...competitorTopics.queries,
        ...autocomplete.queries,
    ])
    const demandFiltered = await filterToSearchedQueries(deduped, {
        countryCode: input.countryCode,
    })
    liveLedger.push({
        source: "demand_autocomplete",
        attempted: demandFiltered.requestsAttempted,
        succeeded: Math.max(
            0,
            demandFiltered.requestsAttempted - demandFiltered.checkFailures,
        ),
        failed: demandFiltered.checkFailures,
        cached: 0,
    })
    await options.onProgress?.({
        phase: "harvesting",
        sourceCallLedger: [...liveLedger],
    })
    if (
        demandFiltered.requestsAttempted > 0 &&
        demandFiltered.checkFailures === demandFiltered.requestsAttempted
    ) {
        throw new HarvestAssemblyError(
            "Search-demand validation failed for every attempted query.",
            "demand_source_failure",
            reports,
        )
    }
    const capped = capProportionally(demandFiltered.kept, HARVEST_POLICY.maxQueries)

    if (capped.length === 0) {
        throw new HarvestAssemblyError("Harvest produced zero queries.", "empty_harvest", reports)
    }
    const untraceable = capped.filter(
        (query) => !query.source_url || !query.observed_value,
    )
    if (untraceable.length > 0) {
        throw new HarvestAssemblyError(
            `${untraceable.length} harvested queries are missing provenance.`,
            "untraceable_query",
            reports,
        )
    }

    const embeddings = await mapWithConcurrency(capped, EMBEDDING_CONCURRENCY, (query) =>
        generateEmbedding(query.query, "RETRIEVAL_QUERY"),
    )
    if (embeddings.some((embedding) => embedding === null)) {
        throw new HarvestAssemblyError(
            "One or more query embeddings failed.",
            "embedding_failure",
            reports,
        )
    }
    liveLedger.push({
        source: "query_embedding",
        attempted: capped.length,
        succeeded: capped.length,
        failed: 0,
        cached: 0,
    })
    await options.onProgress?.({
        phase: "scanning_user_site",
        sourceCallLedger: [...liveLedger],
    })

    const centroid = await buildNicheCentroid(
        input.seeds,
        input.brandContext,
        input.excludeContext,
    )
    const nicheFiltered = filterByNicheRelevance(
        capped,
        embeddings as number[][],
        centroid,
    )
    if (nicheFiltered.kept.length === 0) {
        throw new HarvestAssemblyError(
            "The niche relevance filter rejected every query.",
            "niche_filter_empty",
            reports,
        )
    }

    const poolQueries: PoolQuery[] = []
    const poolMeta = new Map<string, { source: QuerySource; sourceUrl: string | null }>()
    const evidenceById = new Map<string, { evidence: HarvestedQuery; embedding: number[] }>()

    for (const kept of nicheFiltered.kept) {
        const id = randomUUID()
        poolQueries.push({ id, query: kept.query.query, embedding: kept.embedding })
        poolMeta.set(id, {
            source: kept.query.source,
            sourceUrl: kept.query.source_url,
        })
        evidenceById.set(id, { evidence: kept.query, embedding: kept.embedding })
    }

    const userCoverage = await scanCoverage(
        input.subjectUrl,
        input.subjectName || "Customer site",
        poolQueries,
    )
    if (userCoverage.pagesScanned === 0) {
        throw new HarvestAssemblyError(
            "Coverage scanning could not read any content pages from the audited site.",
            "subject_coverage_failure",
            reports,
        )
    }
    await options.onProgress?.({
        phase: "scanning_competitors",
        sourceCallLedger: [...liveLedger],
    })
    const competitorCoverages: SiteCoverageResult[] = []
    for (const competitor of input.competitors) {
        try {
            const coverage = await scanCoverage(
                competitor,
                competitor,
                poolQueries,
            )
            if (coverage.pagesScanned === 0) {
                throw new Error("no readable content pages")
            }
            competitorCoverages.push(coverage)
        } catch (error) {
            throw new HarvestAssemblyError(
                `Coverage scanning failed for configured competitor ${competitor}: ${
                    error instanceof Error ? error.message : "unknown error"
                }`,
                "competitor_coverage_failure",
                reports,
            )
        }
    }
    const coverageRequestCount =
        userCoverage.pagesAttempted +
        competitorCoverages.reduce(
            (sum, coverage) => sum + coverage.pagesAttempted,
            0,
        )
    const coverageSuccessCount =
        userCoverage.pagesScanned +
        competitorCoverages.reduce(
            (sum, coverage) => sum + coverage.pagesScanned,
            0,
        )
    liveLedger.push({
        source: "site_coverage",
        attempted: coverageRequestCount,
        succeeded: coverageSuccessCount,
        failed: Math.max(0, coverageRequestCount - coverageSuccessCount),
        cached: 0,
    })
    await options.onProgress?.({
        phase: "computing_gaps",
        sourceCallLedger: [...liveLedger],
    })

    const gapResult: GapAnalysisResult = computeGaps(
        userCoverage,
        competitorCoverages,
        poolMeta,
    )
    await options.onProgress?.({
        phase: "clustering",
        sourceCallLedger: [...liveLedger],
    })
    const embeddingMap = new Map(poolQueries.map((query) => [query.id, query.embedding]))
    let articleUnits = collapseToArticles(gapResult.gaps, embeddingMap)
    articleUnits = await titleArticles(articleUnits)
    let clusters = groupIntoClusters(articleUnits)
    clusters = await nameClusters(clusters)

    const largestCluster = clusters.reduce(
        (largest, cluster) => Math.max(largest, cluster.articles.length),
        0,
    )
    if (largestCluster > HARVEST_POLICY.maxClusterArticles) {
        throw new HarvestAssemblyError(
            `A cluster contains ${largestCluster} articles; maximum is ${HARVEST_POLICY.maxClusterArticles}.`,
            "cluster_too_large",
            reports,
        )
    }

    const collapseRatio = gapResult.gapCount
        ? articleUnits.length / gapResult.gapCount
        : 0
    if (
        gapResult.gapCount >= HARVEST_POLICY.minGapsForCollapseCheck &&
        (collapseRatio < HARVEST_POLICY.collapseMin ||
            collapseRatio > HARVEST_POLICY.collapseMax)
    ) {
        throw new HarvestAssemblyError(
            `Collapse ratio ${(collapseRatio * 100).toFixed(1)}% is outside ${
                HARVEST_POLICY.collapseMin * 100
            }-${HARVEST_POLICY.collapseMax * 100}%.`,
            "collapse_ratio",
            reports,
        )
    }

    const gapById = new Map(gapResult.gaps.map((gap) => [gap.queryId, gap]))
    const coverageById = new Map(
        userCoverage.coverage.map((coverage) => [coverage.queryId, coverage]),
    )
    const assembledQueries: AssembledQuery[] = poolQueries.map((query) => {
        const source = evidenceById.get(query.id)
        if (!source) {
            throw new HarvestAssemblyError(
                `Missing evidence for query ${query.id}.`,
                "internal_consistency",
                reports,
            )
        }
        const coverage = coverageById.get(query.id)
        if (!coverage) {
            throw new HarvestAssemblyError(
                `Missing coverage for query ${query.id}.`,
                "internal_consistency",
                reports,
            )
        }
        return {
            id: query.id,
            evidence: source.evidence,
            embedding: source.embedding,
            userCoverage: coverage,
            competitorMatches: gapById.get(query.id)?.competitors || [],
        }
    })

    const bySource = assembledQueries.reduce<Record<string, number>>((counts, query) => {
        counts[query.evidence.source] = (counts[query.evidence.source] || 0) + 1
        return counts
    }, {})
    const statistics: HarvestStatistics = {
        poolSize: assembledQueries.length,
        harvestedBeforeDemandFilter: deduped.length,
        droppedByDemandFilter: demandFiltered.dropped.length,
        demandCheckFailures: demandFiltered.checkFailures,
        droppedByNicheFilter: nicheFiltered.dropped.length,
        userPagesScanned: userCoverage.pagesScanned,
        competitorsScanned: competitorCoverages.length,
        coveredCount: gapResult.coveredCount,
        partialCount: gapResult.partialCount,
        gapCount: gapResult.gapCount,
        authorityScore: gapResult.authorityScore,
        articleCount: articleUnits.length,
        clusterCount: clusters.length,
        clusterSizes: clusters.map((cluster) => cluster.articles.length),
        collapseRatio,
        bySource,
    }

    const sourceCallLedger: HarvestOutput["sourceCallLedger"] = liveLedger
    const resultHash = stableHash({
        policyVersion: HARVEST_POLICY.version,
        queries: assembledQueries.map((query) => ({
            query: query.evidence.query_norm,
            source: query.evidence.source,
            sourceUrl: query.evidence.source_url,
            coverage: query.userCoverage.status,
            competitors: query.competitorMatches.map((match) => match.matchedUrl).sort(),
        })).sort((a, b) => a.query.localeCompare(b.query)),
        clusters: clusters.map((cluster) =>
            cluster.articles.map((article) => article.mainKeyword).sort(),
        ).sort((a, b) => a.join("|").localeCompare(b.join("|"))),
    })

    return {
        queries: assembledQueries,
        gaps: gapResult.gaps,
        articleUnits,
        clusters,
        reports,
        statistics,
        sourceCallLedger,
        sitePages: userCoverage.pages,
        policyVersion: HARVEST_POLICY.version,
        resultHash,
        droppedByDemandFilter: demandFiltered.dropped,
        droppedByNicheFilter: nicheFiltered.dropped,
    }
}
