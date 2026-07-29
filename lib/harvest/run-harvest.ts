/**
 * The full closed-pool audit pipeline.
 *
 *   harvest ─▶ coverage ─▶ gaps ─▶ article units ─▶ clusters ─▶ persisted plan
 *
 * Replaces the old sequence in trigger/run-audit.ts, which began with
 * `generateNicheBlueprint()` inventing 40-60 topics from the brand's own
 * onboarding form and then scored the site against that imagined denominator.
 *
 * Nothing here originates in a model. The model writes headlines at the end and
 * nothing else.
 */

import { randomBytes } from "crypto"
import { createAdminClient } from "@/utils/supabase/admin"
import { BrandDetails } from "@/lib/schemas/brand"
import { extractSearchPrefs } from "@/lib/tavily-search"
import { discoverCompetitors } from "@/lib/audit/competitor-scanner"

import { harvestQueryPool } from "./pool"
import { loadQueryPool, scanCoverage, persistUserCoverage, SiteCoverageResult } from "./coverage"
import { computeGaps, loadPoolMeta, persistCompetitorMatches, GapAnalysisResult } from "./gap-engine"
import {
    collapseToArticles,
    groupIntoClusters,
    titleArticles,
    nameClusters,
    assertCollapseRatio,
    ArticleCluster,
} from "./clusterer"

/** Below this, a niche cannot support a recurring program */
export const MIN_VIABLE_ARTICLES = 25

const MAX_COMPETITORS = 4

export interface HarvestAuditResult {
    poolSize: number
    articleCount: number
    clusterCount: number
    authorityScore: number
    coveredCount: number
    gapCount: number
    competitorsScanned: number
    userPagesScanned: number
    publicToken: string
    /** True when the niche is too small to justify a subscription */
    belowViableThreshold: boolean
    clusters: ArticleCluster[]
    durationMs: number
}

export type PhaseReporter = (phase: string, detail?: string) => Promise<void> | void

export interface RunHarvestOptions {
    /** Progress callback so the Trigger task can stream status to the UI */
    onPhase?: PhaseReporter
    /**
     * Pre-resolved competitors. The Trigger task supplies these because it owns
     * the cached-competitor lookup and the app-store security gate; discovery
     * only runs here when they are absent.
     */
    competitors?: Array<{ name: string; url: string }>
}

/**
 * Runs the complete audit for a brand and persists pool, clusters, and planned
 * articles.
 */
export async function runHarvestAudit(
    userId: string,
    brandId: string,
    brandData: BrandDetails,
    brandUrl: string,
    options: RunHarvestOptions = {}
): Promise<HarvestAuditResult> {
    const { onPhase, competitors: providedCompetitors } = options
    const startedAt = Date.now()
    const report = async (phase: string, detail?: string) => {
        console.log(`[HarvestAudit] ${phase}${detail ? `: ${detail}` : ""}`)
        if (onPhase) await onPhase(phase, detail)
    }

    const searchPrefs = extractSearchPrefs(brandData)

    // --- 1. Competitors ---
    await report("competitor_discovery")
    const discovered = providedCompetitors?.length
        ? providedCompetitors
        : await discoverCompetitors(brandData, MAX_COMPETITORS, searchPrefs)
    const competitorUrls = discovered.map((c) => c.url)

    // --- 2. Harvest the observable universe ---
    await report("harvesting", `${competitorUrls.length} competitors`)
    const harvest = await harvestQueryPool(userId, brandId, brandData, competitorUrls)

    // --- 3. Coverage: user site, then each competitor ---
    const poolQueries = await loadQueryPool(brandId)

    await report("scanning_user_site", brandUrl)
    const userCoverage = await scanCoverage(brandUrl, brandData.product_name, poolQueries)
    await persistUserCoverage(brandId, userCoverage)

    await report("scanning_competitors", `${discovered.length} sites`)
    const competitorCoverages: SiteCoverageResult[] = []
    for (const competitor of discovered) {
        try {
            competitorCoverages.push(
                await scanCoverage(competitor.url, competitor.name, poolQueries)
            )
        } catch (error) {
            console.error(`[HarvestAudit] Competitor scan failed for ${competitor.url}:`, error)
        }
    }

    // --- 4. Gaps by set difference ---
    await report("computing_gaps")
    const poolMeta = await loadPoolMeta(brandId)
    const gapResult: GapAnalysisResult = computeGaps(userCoverage, competitorCoverages, poolMeta)
    await persistCompetitorMatches(brandId, gapResult.gaps)

    // --- 5. Collapse gaps into article units ---
    await report("clustering")
    const embeddingMap = new Map(poolQueries.map((q) => [q.id, q.embedding]))

    let units = collapseToArticles(gapResult.gaps, embeddingMap)
    assertCollapseRatio(gapResult.gapCount, units.length)

    units = await titleArticles(units)

    let clusters = groupIntoClusters(units)
    clusters = await nameClusters(clusters)

    // --- 6. Persist the plan ---
    await report("persisting")
    await persistClusters(userId, brandId, clusters)

    const publicToken = await ensurePublicToken(userId, brandId)

    const result: HarvestAuditResult = {
        poolSize: harvest.poolSize,
        articleCount: units.length,
        clusterCount: clusters.length,
        authorityScore: gapResult.authorityScore,
        coveredCount: gapResult.coveredCount,
        gapCount: gapResult.gapCount,
        competitorsScanned: competitorCoverages.length,
        userPagesScanned: userCoverage.pagesScanned,
        publicToken,
        belowViableThreshold: units.length < MIN_VIABLE_ARTICLES,
        clusters,
        durationMs: Date.now() - startedAt,
    }

    if (result.belowViableThreshold) {
        console.warn(
            `[HarvestAudit] Niche yields only ${units.length} articles — below the ` +
            `${MIN_VIABLE_ARTICLES} needed to justify a recurring program. ` +
            `The UI should offer a one-off instead of a subscription.`
        )
    }

    console.log(
        `[HarvestAudit] Complete in ${(result.durationMs / 1000).toFixed(1)}s: ` +
        `${result.poolSize} queries -> ${result.articleCount} articles -> ` +
        `${result.clusterCount} clusters. Authority ${result.authorityScore}%`
    )

    return result
}

/**
 * Replaces any existing plan for the brand with the freshly computed one.
 *
 * Deleting pending rows (and leaving published ones alone) is what makes a
 * re-harvest safe: articles already shipped stay in the burn-down, while the
 * unshipped remainder is recomputed against the current pool.
 */
async function persistClusters(
    userId: string,
    brandId: string,
    clusters: ArticleCluster[]
): Promise<void> {
    const supabase = createAdminClient()

    // Clear only unshipped work
    await (supabase as any)
        .from("planned_articles")
        .delete()
        .eq("brand_id", brandId)
        .in("status", ["pending", "scheduled"])

    await (supabase as any)
        .from("audit_clusters")
        .delete()
        .eq("brand_id", brandId)

    for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i]

        const { data: clusterRow, error: clusterError } = await (supabase as any)
            .from("audit_clusters")
            .insert({
                user_id: userId,
                brand_id: brandId,
                name: cluster.name,
                priority: i, // index doubles as priority — clusters arrive pre-sorted
                article_count: cluster.articles.length,
                competitor_urls: cluster.competitorUrls,
            })
            .select("id")
            .single()

        if (clusterError || !clusterRow) {
            console.error(`[HarvestAudit] Failed to insert cluster "${cluster.name}":`, clusterError)
            continue
        }

        const articleRows = cluster.articles.map((article, index) => ({
            user_id: userId,
            brand_id: brandId,
            cluster_id: clusterRow.id,
            title: article.title,
            main_keyword: article.mainKeyword,
            supporting_keywords: article.supportingKeywords,
            source_query_ids: article.sourceQueryIds,
            article_type: article.articleType,
            // Highest-priority article in the cluster becomes the hub every
            // other article links back to.
            is_pillar: index === 0,
            status: "pending",
        }))

        const { error: articleError } = await (supabase as any)
            .from("planned_articles")
            .insert(articleRows)

        if (articleError) {
            console.error(`[HarvestAudit] Failed to insert articles for "${cluster.name}":`, articleError)
        }
    }

    console.log(`[HarvestAudit] Persisted ${clusters.length} clusters`)
}

/**
 * Returns the brand's public audit token, creating one if absent.
 * Stable across re-harvests so a shared link never breaks.
 */
async function ensurePublicToken(userId: string, brandId: string): Promise<string> {
    const supabase = createAdminClient()

    const { data: existing } = await (supabase as any)
        .from("topical_audits")
        .select("public_token")
        .eq("user_id", userId)
        .eq("brand_id", brandId)
        .maybeSingle()

    if (existing?.public_token) return existing.public_token

    return randomBytes(16).toString("hex")
}
