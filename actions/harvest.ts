"use server"

import { createClient } from "@/utils/supabase/server"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import {
    auditCheckoutFreshness,
    selectQualifiedProgramScope,
} from "@/lib/harvest/program-contract"

export interface ClusterSummary {
    id: string
    name: string
    priority: number
    articleCount: number
    competitorUrls: string[]
    qualified: boolean
}

export interface AuditScope {
    auditId: string
    poolSize: number
    articleCount: number
    clusterCount: number
    authorityScore: number
    clusters: ClusterSummary[]
    recommendedClusterIds: string[]
    recommendedArticleCount: number
    velocity: { tier: string; clustersPerMonth: number; months: number }[]
    checkoutEligible: boolean
    eligibilityReason: string | null
    /** Compatibility alias for the existing audit component. */
    belowViableThreshold: boolean
    publicToken: string | null
    completedAt: string | null
}

async function currentOwnedAudit(
    supabase: any,
    userId: string,
    brandId: string,
): Promise<any | null> {
    const { data: brand } = await supabase
        .from("brand_details")
        .select("current_audit_id")
        .eq("id", brandId)
        .eq("user_id", userId)
        .maybeSingle()

    if (!brand?.current_audit_id) return null

    const { data: audit } = await supabase
        .from("topical_audits")
        .select(
            "id, pool_size, article_count, cluster_count, authority_score, public_token, completed_at, run_status, requires_reaudit",
        )
        .eq("id", brand.current_audit_id)
        .eq("user_id", userId)
        .eq("brand_id", brandId)
        .maybeSingle()

    return audit || null
}

export async function getAuditScope(brandId: string): Promise<AuditScope | null> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const audit = await currentOwnedAudit(supabase as any, user.id, brandId)
    if (!audit || audit.run_status !== "completed") return null

    const [{ data: clusterRows, error }, { data: soldRows }] =
        await Promise.all([
            (supabase as any)
                .from("audit_clusters")
                .select("id, name, priority, article_count, competitor_urls")
                .eq("audit_id", audit.id)
                .order("priority", { ascending: true }),
            (supabase as any)
                .from("program_clusters")
                .select("audit_cluster_id, programs!inner(user_id, audit_id)")
                .eq("programs.user_id", user.id)
                .eq("programs.audit_id", audit.id),
        ])

    if (error) {
        console.error("[getAuditScope]", error)
        return null
    }

    const clusters: ClusterSummary[] = (clusterRows || []).map((cluster: any) => {
        const articleCount = Number(cluster.article_count || 0)
        return {
            id: cluster.id,
            name: cluster.name,
            priority: cluster.priority,
            articleCount,
            competitorUrls: Array.isArray(cluster.competitor_urls)
                ? cluster.competitor_urls
                : [],
            qualified:
                articleCount >= HARVEST_POLICY.minQualifiedClusterArticles &&
                articleCount <= HARVEST_POLICY.maxClusterArticles,
        }
    })

    const selection = selectQualifiedProgramScope(
        clusters,
        (soldRows || []).map((row: any) => row.audit_cluster_id),
        Boolean(audit.requires_reaudit),
    )
    const freshness = auditCheckoutFreshness(audit.completed_at)
    const checkoutEligible = selection.eligible && freshness.fresh
    const eligibilityReason = selection.reason || freshness.reason

    const velocity = [
        { tier: "close", clustersPerMonth: 1 },
        { tier: "accelerate", clustersPerMonth: 2 },
        { tier: "dominate", clustersPerMonth: 3 },
    ].map(({ tier, clustersPerMonth }) => ({
        tier,
        clustersPerMonth,
        months: Math.ceil(HARVEST_POLICY.recommendedClusterCount / clustersPerMonth),
    }))

    return {
        auditId: audit.id,
        poolSize: audit.pool_size || 0,
        articleCount:
            audit.article_count ||
            clusters.reduce((sum, cluster) => sum + cluster.articleCount, 0),
        clusterCount: clusters.length,
        authorityScore: audit.authority_score || 0,
        clusters,
        recommendedClusterIds: selection.selected.map((cluster) => cluster.id),
        recommendedArticleCount: selection.selectedArticleCount,
        velocity,
        checkoutEligible,
        eligibilityReason,
        belowViableThreshold: !checkoutEligible,
        publicToken: audit.public_token,
        completedAt: audit.completed_at,
    }
}

export interface ProgramProgress {
    programId: string
    tier: string
    clustersPerMonth: number
    totalArticles: number
    completedCount: number
    generatedCount: number
    deliveredCount: number
    publishedCount: number
    percentComplete: number
    clustersRemaining: number
    monthsRemaining: number
    status: string
    scopeStatus: string
    cancellationStatus: string
    additionalQualifiedClustersAvailable: boolean
}

export async function getProgramProgress(brandId: string): Promise<ProgramProgress | null> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: program } = await (supabase as any)
        .from("programs")
        .select(
            "id, audit_id, tier, clusters_per_month, total_articles, status, scope_status, cancellation_status",
        )
        .eq("brand_id", brandId)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    if (!program) return null

    const { data: programClusterRows } = await (supabase as any)
        .from("program_clusters")
        .select("audit_cluster_id, state")
        .eq("program_id", program.id)
    const clusterIds = (programClusterRows || []).map(
        (row: any) => row.audit_cluster_id,
    )

    const [{ data: articleRows }, { count: qualifiedCount }] = await Promise.all([
            clusterIds.length > 0
                ? (supabase as any)
                      .from("planned_articles")
                      .select(
                          "generation_status, delivery_status, publication_status, cluster_id",
                      )
                      .eq("audit_id", program.audit_id)
                      .in("cluster_id", clusterIds)
                : Promise.resolve({ data: [] }),
            (supabase as any)
                .from("audit_clusters")
                .select("id", { count: "exact", head: true })
                .eq("audit_id", program.audit_id)
                .gte("article_count", HARVEST_POLICY.minQualifiedClusterArticles)
                .lte("article_count", HARVEST_POLICY.maxClusterArticles),
        ])

    const articles = articleRows || []
    const generatedCount = articles.filter(
        (article: any) => article.generation_status === "generated",
    ).length
    const deliveredCount = articles.filter(
        (article: any) => article.delivery_status === "delivered",
    ).length
    const publishedCount = articles.filter(
        (article: any) => article.publication_status === "published",
    ).length
    const clustersRemaining = (programClusterRows || []).filter(
        (cluster: any) => cluster.state !== "delivered",
    ).length
    const total = Number(program.total_articles || articles.length)

    return {
        programId: program.id,
        tier: program.tier,
        clustersPerMonth: program.clusters_per_month,
        totalArticles: total,
        completedCount: deliveredCount,
        generatedCount,
        deliveredCount,
        publishedCount,
        percentComplete: total > 0 ? Math.round((deliveredCount / total) * 100) : 0,
        clustersRemaining,
        monthsRemaining: Math.ceil(
            clustersRemaining / Math.max(1, program.clusters_per_month),
        ),
        status: program.status,
        scopeStatus: program.scope_status,
        cancellationStatus: program.cancellation_status,
        additionalQualifiedClustersAvailable:
            Number(qualifiedCount || 0) > HARVEST_POLICY.recommendedClusterCount,
    }
}

export interface GapEvidence {
    query: string
    source: string
    sourceUrl: string | null
    status: string
    userMatchedUrl: string | null
    similarity: number | null
    competitors: Array<{ name: string; matchedUrl: string; similarity: number }>
}

export async function getGapEvidence(
    brandId: string,
    limit: number = 100,
): Promise<GapEvidence[]> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    const audit = await currentOwnedAudit(supabase as any, user.id, brandId)
    if (!audit) return []

    const { data, error } = await (supabase as any)
        .from("query_pool")
        .select(
            "query, source, source_url, status, covered_by_url, coverage_similarity, competitor_matches",
        )
        .eq("audit_id", audit.id)
        .in("status", ["gap", "partial"])
        .order("coverage_similarity", { ascending: true })
        .limit(Math.min(250, Math.max(1, limit)))

    if (error) {
        console.error("[getGapEvidence]", error)
        return []
    }

    return (data || []).map((row: any) => ({
        query: row.query,
        source: row.source,
        sourceUrl: row.source_url,
        status: row.status,
        userMatchedUrl: row.covered_by_url,
        similarity: row.coverage_similarity,
        competitors: Array.isArray(row.competitor_matches)
            ? row.competitor_matches.map((match: any) => ({
                  name: match.name,
                  matchedUrl: match.matchedUrl,
                  similarity: match.similarity,
              }))
            : [],
    }))
}

export interface PlannedArticleRow {
    id: string
    title: string
    mainKeyword: string
    supportingKeywords: string[]
    articleType: string
    isPillar: boolean
    generationStatus: string
    deliveryStatus: string
    publicationStatus: string
    status: string
    clusterId: string | null
}

export async function getPlannedArticles(
    brandId: string,
    clusterId?: string,
): Promise<PlannedArticleRow[]> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    const audit = await currentOwnedAudit(supabase as any, user.id, brandId)
    if (!audit) return []

    let query = (supabase as any)
        .from("planned_articles")
        .select(
            "id, title, main_keyword, supporting_keywords, article_type, is_pillar, generation_status, delivery_status, publication_status, cluster_id",
        )
        .eq("audit_id", audit.id)
        .order("is_pillar", { ascending: false })
    if (clusterId) query = query.eq("cluster_id", clusterId)

    const { data, error } = await query
    if (error) {
        console.error("[getPlannedArticles]", error)
        return []
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        mainKeyword: row.main_keyword,
        supportingKeywords: row.supporting_keywords || [],
        articleType: row.article_type,
        isPillar: row.is_pillar,
        generationStatus: row.generation_status,
        deliveryStatus: row.delivery_status,
        publicationStatus: row.publication_status,
        status: row.generation_status,
        clusterId: row.cluster_id,
    }))
}
