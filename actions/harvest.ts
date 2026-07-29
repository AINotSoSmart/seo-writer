"use server"

import { createClient } from "@/utils/supabase/server"
import { MIN_VIABLE_ARTICLES } from "@/lib/harvest/run-harvest"

/**
 * Read side of the closed-pool audit.
 *
 * These replace the reads in actions/audit.ts, which pull the old
 * blueprint-shaped columns. The scope numbers here come from counted rows in
 * query_pool / audit_clusters / planned_articles rather than from a model.
 */

export interface ClusterSummary {
    id: string
    name: string
    priority: number
    articleCount: number
    competitorUrls: string[]
}

export interface AuditScope {
    poolSize: number
    articleCount: number
    clusterCount: number
    authorityScore: number
    clusters: ClusterSummary[]
    /** Clusters recommended for the first program (the rest render greyed out) */
    recommendedClusterIds: string[]
    recommendedArticleCount: number
    /** Months to close the recommended program at each velocity tier */
    velocity: { tier: string; clustersPerMonth: number; months: number }[]
    /** True when the niche cannot sustain a recurring program */
    belowViableThreshold: boolean
    publicToken: string | null
}

/** How many clusters the default recommended program covers */
const RECOMMENDED_CLUSTER_COUNT = 6

/**
 * Loads the scope figures for a brand's most recent harvest.
 */
export async function getAuditScope(brandId: string): Promise<AuditScope | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: audit } = await (supabase as any)
        .from("topical_audits")
        .select("pool_size, article_count, cluster_count, authority_score, public_token")
        .eq("user_id", user.id)
        .eq("brand_id", brandId)
        .maybeSingle()

    const { data: clusterRows } = await (supabase as any)
        .from("audit_clusters")
        .select("id, name, priority, article_count, competitor_urls")
        .eq("brand_id", brandId)
        .order("priority", { ascending: true })

    const clusters: ClusterSummary[] = (clusterRows || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        priority: c.priority,
        articleCount: c.article_count,
        competitorUrls: Array.isArray(c.competitor_urls) ? c.competitor_urls : [],
    }))

    if (!audit && clusters.length === 0) return null

    const recommended = clusters.slice(0, RECOMMENDED_CLUSTER_COUNT)
    const recommendedArticleCount = recommended.reduce((sum, c) => sum + c.articleCount, 0)

    // Velocity is what's sold: the same scope closed at different speeds.
    const velocity = [
        { tier: "close", clustersPerMonth: 1 },
        { tier: "accelerate", clustersPerMonth: 2 },
        { tier: "dominate", clustersPerMonth: 4 },
    ].map(({ tier, clustersPerMonth }) => ({
        tier,
        clustersPerMonth,
        months: Math.max(1, Math.ceil(recommended.length / clustersPerMonth)),
    }))

    const articleCount = audit?.article_count ?? clusters.reduce((s, c) => s + c.articleCount, 0)

    return {
        poolSize: audit?.pool_size ?? 0,
        articleCount,
        clusterCount: clusters.length,
        authorityScore: audit?.authority_score ?? 0,
        clusters,
        recommendedClusterIds: recommended.map((c) => c.id),
        recommendedArticleCount,
        velocity,
        belowViableThreshold: articleCount < MIN_VIABLE_ARTICLES,
        publicToken: audit?.public_token ?? null,
    }
}

/** Clusters shipped per month for each velocity tier */
export const TIER_VELOCITY: Record<string, number> = {
    close: 1,
    accelerate: 2,
    dominate: 4,
}

/**
 * Starts a program: commits the customer to a prioritized subset of clusters and
 * puts each on the delivery calendar.
 *
 * Called on purchase, not at audit time — the audit is free and shows the whole
 * map, but the tier (and therefore the schedule) only exists once someone buys.
 * Every article in a cluster gets the same date so `clusterShipper` releases the
 * batch whole.
 */
export async function startProgram(
    brandId: string,
    tier: "close" | "accelerate" | "dominate",
    clusterIds?: string[]
): Promise<{ ok: boolean; programId?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "Unauthorized" }

    const clustersPerMonth = TIER_VELOCITY[tier] ?? 1

    const scope = await getAuditScope(brandId)
    if (!scope) return { ok: false, error: "No audit found for this brand" }

    const included = clusterIds?.length ? clusterIds : scope.recommendedClusterIds
    if (included.length === 0) return { ok: false, error: "No clusters to schedule" }

    const totalArticles = scope.clusters
        .filter((c) => included.includes(c.id))
        .reduce((sum, c) => sum + c.articleCount, 0)

    // One active program per brand — the partial unique index enforces it too
    const { error: closeError } = await (supabase as any)
        .from("programs")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("brand_id", brandId)
        .eq("status", "active")

    if (closeError) return { ok: false, error: closeError.message }

    const { data: program, error: insertError } = await (supabase as any)
        .from("programs")
        .insert({
            user_id: user.id,
            brand_id: brandId,
            tier,
            clusters_per_month: clustersPerMonth,
            clusters_included: included,
            total_articles: totalArticles,
            completed_count: 0,
            status: "active",
        })
        .select("id")
        .single()

    if (insertError || !program) {
        return { ok: false, error: insertError?.message || "Failed to create program" }
    }

    // Space clusters by tier velocity; first ships immediately
    const daysBetween = Math.max(1, Math.round(30 / clustersPerMonth))
    const orderedClusters = scope.clusters.filter((c) => included.includes(c.id))

    for (let i = 0; i < orderedClusters.length; i++) {
        const date = new Date()
        date.setDate(date.getDate() + i * daysBetween)
        const scheduledDate = date.toISOString().split("T")[0]

        const { error: scheduleError } = await (supabase as any)
            .from("planned_articles")
            .update({ scheduled_date: scheduledDate, status: "scheduled", updated_at: new Date().toISOString() })
            .eq("brand_id", brandId)
            .eq("cluster_id", orderedClusters[i].id)
            .eq("status", "pending")

        if (scheduleError) {
            console.error(`[startProgram] Failed to schedule cluster ${orderedClusters[i].id}:`, scheduleError)
        }
    }

    return { ok: true, programId: program.id }
}

export interface ProgramProgress {
    tier: string
    clustersPerMonth: number
    totalArticles: number
    completedCount: number
    percentComplete: number
    clustersRemaining: number
    monthsRemaining: number
    status: string
}

/**
 * Burn-down state. This is what keeps a customer paying past month three: the
 * bar is visibly incomplete and the finish line is a date, not a vibe.
 */
export async function getProgramProgress(brandId: string): Promise<ProgramProgress | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: program } = await (supabase as any)
        .from("programs")
        .select("tier, clusters_per_month, total_articles, completed_count, clusters_included, status")
        .eq("brand_id", brandId)
        .in("status", ["active", "paused", "completed"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!program) return null

    const includedClusterIds = Array.isArray(program.clusters_included)
        ? program.clusters_included
        : []

    let remainingQuery = (supabase as any)
        .from("planned_articles")
        .select("cluster_id")
        .eq("brand_id", brandId)
        .in("status", ["pending", "scheduled"])

    if (includedClusterIds.length > 0) {
        remainingQuery = remainingQuery.in("cluster_id", includedClusterIds)
    }

    const { data: remainingClusters } = await remainingQuery

    const clustersRemaining = new Set(
        (remainingClusters || []).map((r: any) => r.cluster_id).filter(Boolean)
    ).size

    const total = program.total_articles || 0
    const done = program.completed_count || 0

    return {
        tier: program.tier,
        clustersPerMonth: program.clusters_per_month,
        totalArticles: total,
        completedCount: done,
        percentComplete: total > 0 ? Math.round((done / total) * 100) : 0,
        clustersRemaining,
        monthsRemaining: Math.ceil(clustersRemaining / Math.max(1, program.clusters_per_month)),
        status: program.status,
    }
}

export interface GapEvidence {
    query: string
    source: string
    /** Where the query was observed — the claim a reader can verify */
    sourceUrl: string | null
    status: string
    userMatchedUrl: string | null
    similarity: number | null
    competitors: Array<{ name: string; matchedUrl: string; similarity: number }>
}

/**
 * Loads gap rows with their provenance.
 *
 * This is the evidence layer: every row names the URL the query was read from
 * and the competitor pages currently answering it. It is also what the
 * provenance verification test samples from — if any row here cannot be traced
 * to a real source, the harvest has a bug.
 */
export async function getGapEvidence(
    brandId: string,
    limit: number = 100
): Promise<GapEvidence[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await (supabase as any)
        .from("query_pool")
        .select("query, source, source_url, status, covered_by_url, coverage_similarity, competitor_matches")
        .eq("brand_id", brandId)
        .in("status", ["gap", "partial"])
        .order("coverage_similarity", { ascending: true })
        .limit(limit)

    if (error) {
        console.error("[getGapEvidence] Failed:", error)
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
            ? row.competitor_matches.map((c: any) => ({
                name: c.name,
                matchedUrl: c.matchedUrl,
                similarity: c.similarity,
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
    status: string
    clusterId: string | null
}

/**
 * Loads the planned articles for a brand, optionally scoped to one cluster.
 */
export async function getPlannedArticles(
    brandId: string,
    clusterId?: string
): Promise<PlannedArticleRow[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let query = (supabase as any)
        .from("planned_articles")
        .select("id, title, main_keyword, supporting_keywords, article_type, is_pillar, status, cluster_id")
        .eq("brand_id", brandId)
        .order("is_pillar", { ascending: false })

    if (clusterId) query = query.eq("cluster_id", clusterId)

    const { data, error } = await query

    if (error) {
        console.error("[getPlannedArticles] Failed:", error)
        return []
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        mainKeyword: row.main_keyword,
        supportingKeywords: row.supporting_keywords || [],
        articleType: row.article_type,
        isPillar: row.is_pillar,
        status: row.status,
        clusterId: row.cluster_id,
    }))
}
