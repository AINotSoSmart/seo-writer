import "server-only"

import { createHash, randomUUID } from "crypto"

import { generateEmbedding } from "@/lib/gemini-embedding"
import { harvestAutocomplete } from "./autocomplete"
import { harvestCompetitorCorpus } from "./competitor-corpus"
import {
    findDuplicateArticlePairs,
    collapseToArticles,
    groupIntoClusters,
    absorbOrphanedUnits,
    buildParentByFamilyId,
    splitOversized,
    titleArticles,
    nameClusters,
    type ArticleCluster,
    type ArticleUnit,
} from "./clusterer"
import { type PoolQuery, scanCoverage, type SiteCoverageResult } from "./coverage"
import { computeGaps, type GapAnalysisResult, type GapItem } from "./gap-engine"
import { HARVEST_POLICY } from "./policy"
import { filterToSearchedQueries } from "./query-validation"
import {
    classifyQueriesToScope,
    type AuditScopeFamily,
    type ScopedHarvestedQuery,
    type ScopeDecision,
} from "./scope-classifier"
import { roundRobinCap, selectSerpSeeds } from "./scope-cap"
import { harvestSerpQuestions } from "./serp-questions"
import {
    brandTokensFromUrls,
    dedupeQueries,
    mapWithConcurrency,
    type HarvestedQuery,
    type QuerySource,
    type SourceReport,
} from "./types"
import {
    ARTICLE_CONTRACT_VERSION,
    capabilityFactIdsForOperation,
    selectIntentSizedLength,
    type ArticleContractIntent,
} from "@/lib/writer/article-contract"

const EMBEDDING_CONCURRENCY = 5

export interface HarvestInput {
    subjectUrl: string
    scopeFamilies: AuditScopeFamily[]
    competitors: string[]
    countryCode?: string
    subjectName?: string
    subjectType?: string
}

export function freezeArticleContracts(
    clusters: ArticleCluster[],
    families: AuditScopeFamily[],
    evidenceById: Map<string, { evidence: ScopedHarvestedQuery; embedding: number[] }>,
    input: Partial<HarvestInput>,
): void {
    const familyById = new Map(families.map((family) => [family.id, family]))

    for (const cluster of clusters) {
        cluster.articles.forEach((article, articleIndex) => {
            const queryIds = Array.from(new Set([
                ...article.sourceQueryIds,
                ...article.subNodes.flatMap((node) => node.sourceQueryIds),
            ]))
            const intents = queryIds.flatMap((queryId): ArticleContractIntent[] => {
                const query = evidenceById.get(queryId)?.evidence
                if (!query) return []
                const family = familyById.get(query.intent_binding.scopeFamilyId)
                return [{
                    queryId,
                    query: query.query,
                    sourceUrl: query.source_url || "",
                    sourceContext: query.source_context,
                    operationKey: query.intent_binding.operationKey,
                    capabilityFit: query.intent_binding.capabilityFit,
                    capabilityFactIds: capabilityFactIdsForOperation(
                        family?.capabilityContract,
                        query.intent_binding.operationKey,
                    ),
                }]
            })
            const primary = intents.find((intent) =>
                article.sourceQueryIds.includes(intent.queryId),
            ) || intents[0]
            if (!primary) {
                throw new HarvestAssemblyError(
                    `Article "${article.mainKeyword}" has no source intent.`,
                    "internal_consistency",
                )
            }
            const primaryBinding = evidenceById.get(primary.queryId)!.evidence.intent_binding
            const primaryFamily = familyById.get(primaryBinding.scopeFamilyId)
            const operation = primaryFamily?.capabilityContract.operations.find(
                (candidate) => candidate.key === primaryBinding.operationKey,
            )

            article.articleContract = {
                version: ARTICLE_CONTRACT_VERSION,
                entity: {
                    name: input.subjectName || "Customer site",
                    entityType: input.subjectType || "Product or service",
                    deliveryMode:
                        primaryFamily?.capabilityContract.deliveryMode ||
                        "Product or service",
                },
                primaryIntent: primary,
                requiredIntents: intents,
                scopeFamilyId: cluster.scopeFamilyId,
                solutionMode: primaryBinding.solutionMode,
                capabilityFactIds: Array.from(
                    new Set(intents.flatMap((intent) => intent.capabilityFactIds)),
                ),
                researchQuery: [
                    primary.query,
                    primaryFamily?.capabilityContract.deliveryMode,
                    operation?.action,
                ].filter(Boolean).join(" ").slice(0, 300),
                articleLength: selectIntentSizedLength({
                    isPillar: articleIndex === 0,
                    articleType: article.articleType,
                    absorbedIntentCount: article.subNodes.length,
                }),
            }
        })
    }
}

export interface AssembledQuery {
    id: string
    scopeFamilyId: string
    evidence: ScopedHarvestedQuery
    embedding: number[]
    userCoverage: SiteCoverageResult["coverage"][number]
    competitorMatches: GapItem["competitors"]
}

export interface HarvestStatistics {
    poolSize: number
    harvestedBeforeDemandFilter: number
    droppedByPreScopeCap: number
    droppedByFinalCap: number
    droppedByDemandFilter: number
    demandCheckFailures: number
    droppedByScopeFilter: number
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
    byScopeFamily: Record<string, number>
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
    /** Competitors that produced readable coverage (≤ maxCompetitors). */
    competitorsUsed: string[]
    /** Candidates skipped during coverage failover (sitemap/crawl failures). */
    competitorsSkipped: Array<{ url: string; reason: string }>
    droppedByDemandFilter: Array<{ query: string; source: string }>
    droppedByScopeFilter: Array<{
        query: string
        source: string
        /** Machine-readable so /verify can be grouped by rejection class. */
        decision: ScopeDecision
        reason: string
        suggestedFamilyId: string | null
    }>
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
    if (
        !input.subjectUrl ||
        !Array.isArray(input.scopeFamilies) ||
        input.scopeFamilies.length === 0
    ) {
        throw new HarvestAssemblyError(
            "A subject URL and at least one confirmed business family are required.",
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

    const competitors = Array.from(new Set(input.competitors || []))
    if (competitors.length > HARVEST_POLICY.maxCompetitorCandidates) {
        throw new HarvestAssemblyError(
            `The audit has ${competitors.length} competitor candidates; maximum is ${HARVEST_POLICY.maxCompetitorCandidates}. None were silently removed.`,
            "invalid_input",
        )
    }

    if (input.scopeFamilies.length > HARVEST_POLICY.maxScopeFamilies) {
        throw new HarvestAssemblyError(
            `Confirmed scope contains ${input.scopeFamilies.length} business areas; maximum is ${HARVEST_POLICY.maxScopeFamilies}.`,
            "invalid_scope",
        )
    }
    if (
        input.scopeFamilies.some(
            (family) =>
                !family.id ||
                !family.name.trim() ||
                !family.description.trim() ||
                family.seedKeywords.length === 0,
        )
    ) {
        throw new HarvestAssemblyError(
            "Every confirmed business area needs an ID, name, description, and search direction.",
            "invalid_scope",
        )
    }

    const scopeFamilies = input.scopeFamilies
        .map((family, priority) => ({
            ...family,
            name: family.name.trim(),
            description: family.description.trim(),
            seedKeywords: Array.from(
                new Set(
                    family.seedKeywords
                        .map((seed) => seed.trim().toLowerCase())
                        .filter(Boolean),
                ),
            ),
            priority,
        }))
    if (
        new Set(scopeFamilies.map((family) => family.id)).size !==
            scopeFamilies.length ||
        new Set(
            scopeFamilies.map((family) => family.name.toLowerCase()),
        ).size !== scopeFamilies.length
    ) {
        throw new HarvestAssemblyError(
            "Confirmed business area IDs and names must be unique.",
            "invalid_scope",
        )
    }
    if (scopeFamilies.length === 0) {
        throw new HarvestAssemblyError(
            "The confirmed business scope contains no usable search direction.",
            "invalid_scope",
        )
    }
    const totalSeeds = scopeFamilies.reduce(
        (sum, family) => sum + family.seedKeywords.length,
        0,
    )
    const oversizedFamily = scopeFamilies.find(
        (family) =>
            family.seedKeywords.length > HARVEST_POLICY.maxSeedsPerFamily,
    )
    if (oversizedFamily) {
        throw new HarvestAssemblyError(
            `"${oversizedFamily.name}" contains ${oversizedFamily.seedKeywords.length} search directions; maximum is ${HARVEST_POLICY.maxSeedsPerFamily}.`,
            "invalid_scope",
        )
    }
    if (totalSeeds > HARVEST_POLICY.maxTotalScopeSeeds) {
        throw new HarvestAssemblyError(
            `Confirmed scope contains ${totalSeeds} search directions; maximum is ${HARVEST_POLICY.maxTotalScopeSeeds}.`,
            "invalid_scope",
        )
    }

    return {
        ...input,
        subjectUrl: subjectUrl.toString(),
        scopeFamilies,
        competitors,
    }
}

function stableHash(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

const SOURCE_ORDER: QuerySource[] = [
    "paa",
    "competitor_sitemap",
    "autocomplete",
]

function sourceFamilyHint(
    query: HarvestedQuery,
    families: AuditScopeFamily[],
): string {
    const sourceSeed = (query.source_seed || "").toLowerCase()
    const matches = families.flatMap((family) =>
        family.seedKeywords
            .filter((seed) => sourceSeed.includes(seed.toLowerCase()))
            .map((seed) => ({ familyId: family.id, length: seed.length })),
    )
    matches.sort((left, right) => right.length - left.length)
    return matches[0]?.familyId || "__unassigned__"
}

function preferredScopeSourceKeys(families: AuditScopeFamily[]): string[] {
    return [
        ...families.flatMap((family) =>
            SOURCE_ORDER.map((source) => `${family.id}:${source}`),
        ),
        ...SOURCE_ORDER.map((source) => `__unassigned__:${source}`),
    ]
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
    const seeds = input.scopeFamilies.flatMap((family) => family.seedKeywords)
    const serpSeeds = selectSerpSeeds(
        input.scopeFamilies,
        HARVEST_POLICY.maxScopeSerpSeeds,
    )

    const [autocomplete, serpQuestions, competitorTopics] = await Promise.all([
        harvestAutocomplete(seeds, { countryCode: input.countryCode }),
        harvestSerpQuestions(
            serpSeeds,
            undefined,
            serpSeeds.length,
            excludeBrands,
            // The audited site is skipped as a question SOURCE. It is still read
            // in full by the coverage stage — that is a different job, and the
            // two must not be conflated.
            input.subjectUrl,
        ),
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
    const untraceable = deduped.filter(
        (query) => !query.source_url || !query.observed_value,
    )
    if (untraceable.length > 0) {
        throw new HarvestAssemblyError(
            `${untraceable.length} harvested queries are missing provenance.`,
            "untraceable_query",
            reports,
        )
    }
    // Demand validation is structural evidence that the phrase is searched.
    // Language and business relevance are decided together by the positive
    // confirmed-family assignment below; there is no language word list.
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
    const preferredKeys = preferredScopeSourceKeys(input.scopeFamilies)
    const preScopeCapped = roundRobinCap(
        demandFiltered.kept,
        HARVEST_POLICY.maxPreScopeQueries,
        (query) =>
            `${sourceFamilyHint(query, input.scopeFamilies)}:${query.source}`,
        preferredKeys,
    )

    if (preScopeCapped.length === 0) {
        throw new HarvestAssemblyError("Harvest produced zero queries.", "empty_harvest", reports)
    }

    // Only the competitors' own brand tokens, never the subject's: the customer
    // naming their own product is fine, a plan telling them to use a rival's is
    // not. `excludeBrands` above deliberately includes the subject for harvest
    // hygiene, so it cannot be reused here.
    const scopeClassified = await classifyQueriesToScope(
        preScopeCapped,
        input.scopeFamilies,
        brandTokensFromUrls(input.competitors),
    )
    liveLedger.push({
        source: "scope_classification",
        attempted: scopeClassified.callsAttempted,
        succeeded: scopeClassified.callsSucceeded,
        failed:
            scopeClassified.callsAttempted - scopeClassified.callsSucceeded,
        cached: 0,
    })
    await options.onProgress?.({
        phase: "validating_business_scope",
        sourceCallLedger: [...liveLedger],
    })
    if (scopeClassified.kept.length === 0) {
        throw new HarvestAssemblyError(
            "No observed searches directly belonged to the confirmed business scope.",
            "scope_filter_empty",
            reports,
        )
    }
    const scopedQueries = roundRobinCap(
        scopeClassified.kept,
        HARVEST_POLICY.maxQueries,
        (query) => `${query.scope_family_id}:${query.source}`,
        preferredKeys,
    )

    const embeddings = await mapWithConcurrency(
        scopedQueries,
        EMBEDDING_CONCURRENCY,
        (query) => generateEmbedding(query.query, "RETRIEVAL_QUERY"),
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
        attempted: scopedQueries.length,
        succeeded: scopedQueries.length,
        failed: 0,
        cached: 0,
    })
    await options.onProgress?.({
        phase: "scanning_user_site",
        sourceCallLedger: [...liveLedger],
    })

    const poolQueries: PoolQuery[] = []
    const poolMeta = new Map<
        string,
        {
            source: QuerySource
            sourceUrl: string | null
            scopeFamilyId: string
            sourceContext: string
            intentBinding: (typeof scopedQueries)[number]["intent_binding"]
        }
    >()
    const evidenceById = new Map<
        string,
        {
            evidence: (typeof scopedQueries)[number]
            embedding: number[]
        }
    >()

    for (let index = 0; index < scopedQueries.length; index++) {
        const query = scopedQueries[index]
        const embedding = embeddings[index]
        if (!embedding) {
            throw new HarvestAssemblyError(
                `Missing embedding for scoped query "${query.query}".`,
                "embedding_failure",
                reports,
            )
        }
        const id = randomUUID()
        poolQueries.push({ id, query: query.query, embedding })
        poolMeta.set(id, {
            source: query.source,
            sourceUrl: query.source_url,
            scopeFamilyId: query.scope_family_id,
            sourceContext: query.source_context,
            intentBinding: query.intent_binding,
        })
        evidenceById.set(id, { evidence: query, embedding })
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
    // Candidates may exceed maxCompetitors. Try in order until the working set
    // is full; unreadable sites are skipped so one blocked rival (e.g. no
    // sitemap) cannot abort an otherwise healthy audit.
    const competitorCoverages: SiteCoverageResult[] = []
    const competitorsUsed: string[] = []
    const competitorsSkipped: Array<{ url: string; reason: string }> = []
    for (const competitor of input.competitors) {
        if (competitorCoverages.length >= HARVEST_POLICY.maxCompetitors) break
        try {
            const coverage = await scanCoverage(
                competitor,
                competitor,
                poolQueries,
                "competitor",
            )
            if (coverage.pagesScanned === 0) {
                const reason = "no readable content pages"
                console.warn(
                    `[Assembly] Skipping competitor ${competitor}: ${reason}`,
                )
                competitorsSkipped.push({ url: competitor, reason })
                continue
            }
            competitorCoverages.push(coverage)
            competitorsUsed.push(competitor)
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : "unknown error"
            console.warn(
                `[Assembly] Skipping competitor ${competitor}: ${reason}`,
            )
            competitorsSkipped.push({ url: competitor, reason })
        }
    }
    if (competitorsSkipped.length > 0) {
        console.log(
            `[Assembly] Competitor coverage: ${competitorsUsed.length} usable, ` +
                `${competitorsSkipped.length} skipped` +
                (competitorsUsed.length < HARVEST_POLICY.maxCompetitors
                    ? ` (wanted ${HARVEST_POLICY.maxCompetitors})`
                    : ""),
        )
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
    let articleUnits: ArticleUnit[] = []
    for (const family of input.scopeFamilies) {
        const familyGaps = gapResult.gaps.filter(
            (gap) => gap.scopeFamilyId === family.id,
        )
        const familyUnits = collapseToArticles(familyGaps, embeddingMap)
        articleUnits = articleUnits.concat(familyUnits)

        if (familyGaps.length === 0) {
            console.warn(
                `[Assembly] Family "${family.name}" (${family.id}): 0 gaps — ` +
                    `no unmet demand-backed queries after coverage (no cluster).`,
            )
            continue
        }

        if (familyUnits.length < HARVEST_POLICY.minQualifiedClusterArticles) {
            // Too thin for a cluster of its own. Its units are absorbed into
            // another domain's cluster below — never discarded, never padded.
            console.log(
                `[Assembly] Family "${family.name}" (${family.id}): ` +
                    `${familyGaps.length} gaps → ${familyUnits.length} unique articles ` +
                    `(below ${HARVEST_POLICY.minQualifiedClusterArticles}) — ` +
                    `will be absorbed into the nearest qualifying cluster.`,
            )
        }
    }
    articleUnits = await titleArticles(articleUnits, input.scopeFamilies)

    // Sub-areas declared at scope confirmation roll into their parent's
    // clustering pool so thin child + parent demand can clear the node floor
    // together (e.g. "Add Person to Photo" under "AI Family Portrait").
    const clusterRoots = input.scopeFamilies.filter(
        (family) => !family.parentScopeFamilyId,
    )
    const childIdsByParent = new Map<string, string[]>()
    for (const family of input.scopeFamilies) {
        if (!family.parentScopeFamilyId) continue
        const siblings = childIdsByParent.get(family.parentScopeFamilyId) || []
        siblings.push(family.id)
        childIdsByParent.set(family.parentScopeFamilyId, siblings)
    }

    const unitsForClusterRoot = (root: (typeof input.scopeFamilies)[number]) => {
        const childIds = new Set(childIdsByParent.get(root.id) || [])
        const rolled = articleUnits
            .filter(
                (unit) =>
                    unit.scopeFamilyId === root.id || childIds.has(unit.scopeFamilyId),
            )
            .map((unit) => {
                if (unit.scopeFamilyId === root.id) return unit
                return {
                    ...unit,
                    originScopeFamilyId: unit.originScopeFamilyId ?? unit.scopeFamilyId,
                    scopeFamilyId: root.id,
                }
            })
        if (childIds.size > 0 && rolled.length > 0) {
            const own = articleUnits.filter((u) => u.scopeFamilyId === root.id).length
            const fromChildren = rolled.length - own
            if (fromChildren > 0) {
                console.log(
                    `[Assembly] Family "${root.name}": clustering ${own} own + ` +
                        `${fromChildren} sub-area article units ` +
                        `(${rolled.length} total)`,
                )
            }
        }
        return rolled
    }

    // Group per cluster root (parent domains), then absorb orphans across the
    // audit. Absorption has to happen here rather than inside groupIntoClusters,
    // which only ever sees one family's units at a time.
    const groupings = clusterRoots.map((family) =>
        groupIntoClusters(unitsForClusterRoot(family)),
    )
    const absorbed = absorbOrphanedUnits(
        groupings.flatMap((grouping) => grouping.clusters),
        groupings.flatMap((grouping) => grouping.orphanedUnits),
        splitOversized,
        { parentByFamilyId: buildParentByFamilyId(input.scopeFamilies) },
    )
    let clusters = absorbed.clusters
    const unsoldUnits = absorbed.unsold
    clusters = await nameClusters(clusters)
    const familyPriority = new Map(
        input.scopeFamilies.map((family) => [family.id, family.priority]),
    )
    clusters.sort(
        (left, right) =>
            (familyPriority.get(left.scopeFamilyId) ?? 99) -
                (familyPriority.get(right.scopeFamilyId) ?? 99) ||
            right.priority - left.priority,
    )
    freezeArticleContracts(clusters, input.scopeFamilies, evidenceById, input)

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
    const tooSmall = clusters.filter(
        (cluster) =>
            cluster.articles.length < HARVEST_POLICY.minQualifiedClusterArticles,
    )
    if (tooSmall.length > 0) {
        throw new HarvestAssemblyError(
            `A cluster contains ${tooSmall[0].articles.length} articles; minimum is ${HARVEST_POLICY.minQualifiedClusterArticles}.`,
            "cluster_too_small",
            reports,
        )
    }

    const collapseRatio = gapResult.gapCount
        ? articleUnits.length / gapResult.gapCount
        : 0

    // Inside one confirmed family, no two articles may be near-duplicates.
    // Cross-family similarity is not a merge failure: two separately confirmed
    // customer jobs can use adjacent language while remaining distinct products.
    const duplicatePairs = input.scopeFamilies.flatMap((family) =>
        findDuplicateArticlePairs(
            articleUnits.filter(
                (article) => article.scopeFamilyId === family.id,
            ),
        ),
    )
    if (duplicatePairs.length > 0) {
        const sample = duplicatePairs
            .slice(0, 3)
            .map((pair) => `"${pair.a}" ~ "${pair.b}" (${pair.similarity})`)
            .join("; ")
        throw new HarvestAssemblyError(
            `${duplicatePairs.length} article pairs were not merged: ${sample}`,
            "duplicate_articles",
            reports,
        )
    }

    // Catastrophic-breakage ceiling only. The collapse ratio measures how much
    // phrasing redundancy a niche happens to contain, not whether clustering
    // worked — a healthy 13-cluster audit was previously rejected at 48.4%
    // purely because its competitors published a lot of FAQ pages. See the
    // comment on `collapseExpectedMax` in policy.ts.
    if (
        gapResult.gapCount >= HARVEST_POLICY.minGapsForCollapseCheck &&
        collapseRatio > HARVEST_POLICY.collapseCeiling
    ) {
        throw new HarvestAssemblyError(
            `Collapse ratio ${(collapseRatio * 100).toFixed(1)}% exceeds the ${
                HARVEST_POLICY.collapseCeiling * 100
            }% ceiling — same-intent queries are not merging at all.`,
            "collapse_ratio",
            reports,
        )
    }

    if (
        gapResult.gapCount >= HARVEST_POLICY.minGapsForCollapseCheck &&
        (collapseRatio < HARVEST_POLICY.collapseExpectedMin ||
            collapseRatio > HARVEST_POLICY.collapseExpectedMax)
    ) {
        // Telemetry, not a gate. Usually means an unusual source mix.
        console.warn(
            `[Assembly] Collapse ratio ${(collapseRatio * 100).toFixed(1)}% is outside the ` +
            `expected ${HARVEST_POLICY.collapseExpectedMin * 100}-${HARVEST_POLICY.collapseExpectedMax * 100}% band. ` +
            `Pool composition: ${reports.map((r) => `${r.source}=${r.queriesFound}`).join(", ")}`
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
            scopeFamilyId: source.evidence.scope_family_id,
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
    const byScopeFamily = assembledQueries.reduce<Record<string, number>>(
        (counts, query) => {
            counts[query.scopeFamilyId] =
                (counts[query.scopeFamilyId] || 0) + 1
            return counts
        },
        {},
    )
    const statistics: HarvestStatistics = {
        poolSize: assembledQueries.length,
        harvestedBeforeDemandFilter: deduped.length,
        droppedByPreScopeCap:
            demandFiltered.kept.length - preScopeCapped.length,
        droppedByFinalCap:
            scopeClassified.kept.length - scopedQueries.length,
        droppedByDemandFilter: demandFiltered.dropped.length,
        demandCheckFailures: demandFiltered.checkFailures,
        droppedByScopeFilter: scopeClassified.dropped.length,
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
        byScopeFamily,
    }

    const sourceCallLedger: HarvestOutput["sourceCallLedger"] = liveLedger
    const resultHash = stableHash({
        policyVersion: HARVEST_POLICY.version,
        queries: assembledQueries.map((query) => ({
            query: query.evidence.query_norm,
            scopeFamilyId: query.scopeFamilyId,
            source: query.evidence.source,
            sourceUrl: query.evidence.source_url,
            sourceContext: query.evidence.source_context,
            intentBinding: query.evidence.intent_binding,
            coverage: query.userCoverage.status,
            competitors: query.competitorMatches.map((match) => match.matchedUrl).sort(),
        })).sort((a, b) => a.query.localeCompare(b.query)),
        clusters: clusters.map((cluster) =>
            [
                cluster.scopeFamilyId,
                ...cluster.articles
                    .map((article) => [article.mainKeyword, article.articleContract])
                    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
            ],
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
        competitorsUsed,
        competitorsSkipped,
        droppedByDemandFilter: demandFiltered.dropped,
        droppedByScopeFilter: scopeClassified.dropped,
    }
}
