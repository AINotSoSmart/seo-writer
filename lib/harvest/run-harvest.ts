/**
 * Production adapter for the shared in-memory harvest.
 *
 * This module owns only progress reporting and immutable persistence. All
 * discovery filtering, coverage, gap, and clustering behavior lives in
 * assembly.ts and is therefore identical to /api/harvest/verify.
 */

import { randomUUID } from "crypto"

import { createAdminClient } from "@/utils/supabase/admin"
import type { BrandDetails } from "@/lib/schemas/brand"
import { extractSearchPrefs } from "@/lib/tavily-search"
import { assembleHarvest, type HarvestOutput } from "./assembly"
import { deriveSeeds } from "./pool"
import { HARVEST_POLICY } from "./policy"
import { selectQualifiedProgramScope } from "./program-contract"

const COUNTRY_ISO: Record<string, string> = {
    "united states": "us",
    "united kingdom": "gb",
    australia: "au",
    canada: "ca",
    india: "in",
    germany: "de",
    france: "fr",
    japan: "jp",
    brazil: "br",
    netherlands: "nl",
    italy: "it",
    spain: "es",
    mexico: "mx",
    singapore: "sg",
    "new zealand": "nz",
    ireland: "ie",
    sweden: "se",
    switzerland: "ch",
    "south africa": "za",
    poland: "pl",
    norway: "no",
    denmark: "dk",
    "united arab emirates": "ae",
    philippines: "ph",
    indonesia: "id",
}

export interface HarvestAuditResult {
    auditId: string
    poolSize: number
    articleCount: number
    clusterCount: number
    authorityScore: number
    coveredCount: number
    gapCount: number
    competitorsScanned: number
    userPagesScanned: number
    publicToken: string
    belowViableThreshold: boolean
    policyVersion: string
    resultHash: string
    durationMs: number
}

export type PhaseReporter = (phase: string, detail?: string) => Promise<void> | void

export interface RunHarvestOptions {
    auditId: string
    onPhase?: PhaseReporter
    competitors: Array<{ name: string; url: string }>
    initialSourceCallLedger?: HarvestOutput["sourceCallLedger"]
    onSourceProgress?: (
        phase: string,
        ledger: HarvestOutput["sourceCallLedger"],
    ) => Promise<void> | void
}

function brandContext(brand: BrandDetails): string {
    return [
        brand.product_identity?.literally,
        brand.category,
        brand.audience?.primary ? `for ${brand.audience.primary}` : "",
        Array.isArray(brand.core_features) ? brand.core_features.slice(0, 4).join(", ") : "",
    ]
        .filter(Boolean)
        .join(". ")
}

export function isSubscriptionEligible(
    clusters: Array<{ articles: unknown[] }>,
): boolean {
    return selectQualifiedProgramScope(
        clusters.map((cluster, index) => ({
            id: String(index),
            priority: index,
            articleCount: cluster.articles.length,
        })),
        [],
        false,
    ).eligible
}

export async function persistHarvestOutput(
    auditId: string,
    output: HarvestOutput,
): Promise<{ publicToken: string }> {
    const supabase = createAdminClient() as any
    const clusterIds = output.clusters.map(() => randomUUID())
    const clusterRows = output.clusters.map((cluster, index) => ({
        id: clusterIds[index],
        name: cluster.name,
        description: "",
        priority: index,
        article_count: cluster.articles.length,
        competitor_urls: cluster.competitorUrls,
    }))
    const articleRows = output.clusters.flatMap((cluster, clusterIndex) =>
        cluster.articles.map((article, articleIndex) => ({
            id: randomUUID(),
            cluster_id: clusterIds[clusterIndex],
            title: article.title,
            main_keyword: article.mainKeyword,
            supporting_keywords: article.supportingKeywords,
            source_query_ids: article.sourceQueryIds,
            article_type: article.articleType,
            intent_role: articleIndex === 0 ? "pillar" : "supporting",
            is_pillar: articleIndex === 0,
        })),
    )
    const queryRows = output.queries.map((query) => ({
        id: query.id,
        query: query.evidence.query,
        query_norm: query.evidence.query_norm,
        source: query.evidence.source,
        source_url: query.evidence.source_url,
        source_seed: query.evidence.source_seed,
        observed_value: query.evidence.observed_value,
        observed_at: query.evidence.observed_at,
        embedding: query.embedding,
        status: query.userCoverage.status,
        covered_by_url: query.userCoverage.matchedUrl,
        covered_by_title: query.userCoverage.matchedTitle,
        coverage_similarity: query.userCoverage.similarity,
        competitor_matches: query.competitorMatches,
    }))

    const { error: finalizeError } = await supabase.rpc("finalize_audit_run", {
        p_audit_id: auditId,
        p_query_rows: queryRows,
        p_cluster_rows: clusterRows,
        p_article_rows: articleRows,
        p_statistics: {
            pool_size: output.statistics.poolSize,
            article_count: output.statistics.articleCount,
            cluster_count: output.statistics.clusterCount,
            authority_score: output.statistics.authorityScore,
            competitors_scanned: output.statistics.competitorsScanned,
            user_pages_scanned: output.statistics.userPagesScanned,
            site_page_snapshot: output.sitePages,
        },
        p_result_hash: output.resultHash,
        p_policy_version: output.policyVersion,
        p_source_call_ledger: output.sourceCallLedger,
    })
    if (finalizeError) {
        throw new Error(`Audit finalization failed: ${finalizeError.message}`)
    }

    const { data: audit } = await supabase
        .from("topical_audits")
        .select("public_token")
        .eq("id", auditId)
        .single()
    return { publicToken: audit?.public_token || "" }
}

export async function runHarvestAudit(
    userId: string,
    brandId: string,
    brandData: BrandDetails,
    brandUrl: string,
    options: RunHarvestOptions,
): Promise<HarvestAuditResult> {
    const startedAt = Date.now()
    const report = async (phase: string, detail?: string) => {
        console.log(`[HarvestAudit] ${phase}${detail ? `: ${detail}` : ""}`)
        if (options.onPhase) await options.onPhase(phase, detail)
    }

    const seeds = deriveSeeds(brandData)
    if (seeds.length === 0) {
        throw new Error("The brand needs a category or product description before an audit can run.")
    }
    const competitors = options.competitors
        .slice(0, HARVEST_POLICY.maxCompetitors)
        .map((competitor) => competitor.url)
    const prefs = extractSearchPrefs(brandData)
    const countryCode = COUNTRY_ISO[(prefs.country || "").toLowerCase()]

    await report("harvesting", `${competitors.length} competitors`)
    const output = await assembleHarvest(
        {
            subjectUrl: brandUrl,
            subjectName: brandData.product_name || "Customer site",
            seeds,
            competitors,
            countryCode,
            brandContext: brandContext(brandData),
            excludeContext: brandData.product_identity?.not,
        },
        {
            onProgress: async (progress) => {
                await report(progress.phase)
                await options.onSourceProgress?.(
                    progress.phase,
                    progress.sourceCallLedger,
                )
            },
        },
    )
    if (options.initialSourceCallLedger?.length) {
        output.sourceCallLedger = [
            ...options.initialSourceCallLedger,
            ...output.sourceCallLedger,
        ]
    }
    await report("persisting")

    const persisted = await persistHarvestOutput(options.auditId, output)

    return {
        auditId: options.auditId,
        poolSize: output.statistics.poolSize,
        articleCount: output.statistics.articleCount,
        clusterCount: output.statistics.clusterCount,
        authorityScore: output.statistics.authorityScore,
        coveredCount: output.statistics.coveredCount,
        gapCount: output.statistics.gapCount,
        competitorsScanned: output.statistics.competitorsScanned,
        userPagesScanned: output.statistics.userPagesScanned,
        publicToken: persisted.publicToken,
        belowViableThreshold: !isSubscriptionEligible(output.clusters),
        policyVersion: output.policyVersion,
        resultHash: output.resultHash,
        durationMs: Date.now() - startedAt,
    }
}
