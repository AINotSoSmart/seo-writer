"use server"

import { createClient } from "@/utils/supabase/server"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import {
    selectQualifiedProgramScope,
} from "@/lib/harvest/program-contract"

export interface ClusterSummary {
    id: string
    scopeFamilyId: string
    scopeFamilyName: string
    scopeFamilyPriority: number
    name: string
    description: string | null
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
    checkoutEligible: boolean
    eligibilityReason: string | null
    /** A program has already been purchased from this audit. */
    hasActiveProgram: boolean
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

    const [{ data: clusterRows, error }, { data: scopeRows }, { data: activeProgram }] =
        await Promise.all([
            (supabase as any)
                .from("audit_clusters")
                .select(
                    "id, scope_family_id, name, description, priority, article_count, competitor_urls",
                )
                .eq("audit_id", audit.id)
                .order("priority", { ascending: true }),
            (supabase as any)
                .from("audit_scope_families")
                .select("id, name, priority")
                .eq("audit_id", audit.id),
            (supabase as any)
                .from("programs")
                .select("id")
                .eq("user_id", user.id)
                .eq("brand_id", brandId)
                .in("status", ["pending", "active", "paused"])
                .limit(1)
                .maybeSingle(),
        ])

    if (error) {
        console.error("[getAuditScope]", error)
        return null
    }

    const scopeById = new Map(
        (scopeRows || []).map((scope: any) => [scope.id, scope]),
    )
    const clusters: ClusterSummary[] = (clusterRows || []).map((cluster: any) => {
        const articleCount = Number(cluster.article_count || 0)
        const scope = scopeById.get(cluster.scope_family_id) as any
        return {
            id: cluster.id,
            scopeFamilyId: cluster.scope_family_id,
            scopeFamilyName: scope?.name || "Unverified legacy scope",
            scopeFamilyPriority: Number(scope?.priority ?? 99),
            name: cluster.name,
            description: cluster.description,
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
        [],
        Boolean(audit.requires_reaudit),
    )
    const checkoutEligible = false
    const eligibilityReason = "Legacy audit reports are evidence only; subscriptions start from confirmed tracked questions."

    /**
     * Once a program is bought, every cluster in it is "sold", so
     * `selectQualifiedProgramScope` correctly returns zero remaining — it
     * answers "can they buy ANOTHER program", not "is this audit any good".
     *
     * Reporting that raw result to a paying customer produced this on the audit
     * page immediately after a successful purchase:
     *
     *   "Not eligible for a program yet. This site currently has 0 unsold
     *    qualified clusters."
     *   "The selected six contain 0 articles."
     *
     * ...directly above the 58 articles they had just paid for. The purchased
     * scope is the right thing to show them, so it takes precedence here.
     */
    const hasActiveProgram = Boolean(activeProgram)
    const displayClusterIds = selection.selected.map((cluster) => cluster.id)
    const displayArticleCount = selection.selectedArticleCount

    return {
        auditId: audit.id,
        poolSize: audit.pool_size || 0,
        articleCount:
            audit.article_count ||
            clusters.reduce((sum, cluster) => sum + cluster.articleCount, 0),
        clusterCount: clusters.length,
        authorityScore: audit.authority_score || 0,
        clusters,
        recommendedClusterIds: displayClusterIds,
        recommendedArticleCount: displayArticleCount,
        checkoutEligible,
        eligibilityReason,
        /** True when this audit already has a bought program. */
        hasActiveProgram,
        // "Below viable threshold" must mean the audit is too small to sell —
        // never "already sold", which is the opposite situation.
        belowViableThreshold: !checkoutEligible && !hasActiveProgram,
        publicToken: audit.public_token,
        completedAt: audit.completed_at,
    }
}

export interface ProgramProgress {
    programId: string
    planId: string
    status: string
    totalCycles: number
    currentCycleState: string | null
    selectedActions: number
    readyActions: number
    deliveredActions: number
    percentComplete: number
}

export async function getProgramProgress(brandId: string): Promise<ProgramProgress | null> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: program } = await (supabase as any)
        .from("programs")
        .select("id, plan_id, status")
        .eq("brand_id", brandId)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    if (!program) return null

    const { data: cycles } = await (supabase as any)
        .from("subscription_cycles")
        .select("id, state, period_start, cycle_actions(id, state)")
        .eq("program_id", program.id)
        .order("period_start", { ascending: false })

    const cycleRows = cycles || []
    const actions = cycleRows.flatMap((cycle: any) => cycle.cycle_actions || [])
    const readyActions = actions.filter((action: any) =>
        ["ready", "delivered"].includes(action.state),
    ).length
    const deliveredActions = actions.filter(
        (action: any) => action.state === "delivered",
    ).length
    const currentCycle = cycleRows.find((cycle: any) => cycle.state !== "delivered") || cycleRows[0]

    return {
        programId: program.id,
        planId: program.plan_id,
        status: program.status,
        totalCycles: cycleRows.length,
        currentCycleState: currentCycle?.state || null,
        selectedActions: actions.length,
        readyActions,
        deliveredActions,
        percentComplete:
            actions.length > 0
                ? Math.round((deliveredActions / actions.length) * 100)
                : currentCycle?.state === "delivered"
                  ? 100
                  : 0,
    }
}

export interface GapEvidence {
    id: string
    scopeFamilyId: string
    query: string
    observedValue: string
    source: string
    sourceUrl: string | null
    status: string
    userMatchedUrl: string | null
    similarity: number | null
    competitors: Array<{ name: string; matchedUrl: string; similarity: number }>
}

export async function getGapEvidence(
    brandId: string,
    limit: number = HARVEST_POLICY.maxQueries,
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
            "id, scope_family_id, query, observed_value, source, source_url, status, covered_by_url, coverage_similarity, competitor_matches",
        )
        .eq("audit_id", audit.id)
        .in("status", ["gap", "partial"])
        .order("coverage_similarity", { ascending: true })
        .limit(Math.min(HARVEST_POLICY.maxQueries, Math.max(1, limit)))

    if (error) {
        console.error("[getGapEvidence]", error)
        return []
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        scopeFamilyId: row.scope_family_id,
        query: row.query,
        observedValue: row.observed_value || row.query,
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
    scopeFamilyId: string
    title: string
    mainKeyword: string
    supportingKeywords: string[]
    sourceQueryIds: string[]
    articleType: string
    isPillar: boolean
    generationStatus: string
    deliveryStatus: string
    publicationStatus: string
    status: string
    clusterId: string | null
    targetUrl: string | null
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
            "id, scope_family_id, title, main_keyword, supporting_keywords, source_query_ids, article_type, is_pillar, generation_status, delivery_status, publication_status, cluster_id, target_url",
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
        scopeFamilyId: row.scope_family_id,
        title: row.title,
        mainKeyword: row.main_keyword,
        supportingKeywords: row.supporting_keywords || [],
        sourceQueryIds: row.source_query_ids || [],
        articleType: row.article_type,
        isPillar: row.is_pillar,
        generationStatus: row.generation_status,
        deliveryStatus: row.delivery_status,
        publicationStatus: row.publication_status,
        status: row.generation_status,
        clusterId: row.cluster_id,
        targetUrl: row.target_url,
    }))
}
