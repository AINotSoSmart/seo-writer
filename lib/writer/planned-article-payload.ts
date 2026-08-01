/**
 * Loads the writer inputs a planned article would receive in production.
 *
 * Shared by `/api/writer/dry-run` and `/api/founder/test-article` so QA runs
 * exercise the same payload ship-cluster would trigger — without mutating
 * planned-article generation state.
 */

export interface PlannedWriterInputs {
    plannedArticleId: string
    brandId: string
    auditId: string
    title: string
    keyword: string
    articleType: string
    supportingKeywords: string[]
    sourceQueries: string[]
    subNodeIntents: string[]
    cluster: string
    clusterCompetitorUrls: string[]
    isPillar: boolean
    clusterPosition: number
    clusterId: string
    frozenLinks: Array<{ title: string; url: string; relationship?: string }>
}

export async function loadPlannedWriterInputs(
    db: any,
    plannedArticleId: string,
): Promise<PlannedWriterInputs | null> {
    const { data: planned, error } = await db
        .from("planned_articles")
        .select(
            "id, title, main_keyword, supporting_keywords, article_type, brand_id, audit_id, cluster_id, " +
                "source_query_ids, is_pillar, sub_node_intents",
        )
        .eq("id", plannedArticleId)
        .maybeSingle()

    if (error || !planned) return null

    const { data: siblings } = planned.cluster_id
        ? await db
              .from("planned_articles")
              .select("id")
              .eq("audit_id", planned.audit_id)
              .eq("cluster_id", planned.cluster_id)
              .order("is_pillar", { ascending: false })
        : { data: [] }
    const clusterPosition = Math.max(
        0,
        (siblings || []).findIndex((row: any) => row.id === planned.id),
    )

    const { data: sourceRows } = planned.source_query_ids?.length
        ? await db
              .from("query_pool")
              .select("query")
              .in("id", planned.source_query_ids)
        : { data: [] }

    const { data: cluster } = planned.cluster_id
        ? await db
              .from("audit_clusters")
              .select("name, competitor_urls")
              .eq("id", planned.cluster_id)
              .maybeSingle()
        : { data: null }

    const clusterCompetitorUrls = Array.isArray(cluster?.competitor_urls)
        ? (cluster.competitor_urls as unknown[])
              .map((entry) =>
                  typeof entry === "string" ? entry : String((entry as any)?.url || ""),
              )
              .filter(Boolean)
              .slice(0, 6)
        : []

    const { data: linkRows } = await db
        .from("planned_article_links")
        .select("target_url, anchor_text, relationship")
        .eq("source_article_id", planned.id)

    return {
        plannedArticleId: planned.id,
        brandId: planned.brand_id,
        auditId: planned.audit_id,
        title: planned.title,
        keyword: planned.main_keyword,
        articleType: planned.article_type || "informational",
        supportingKeywords: planned.supporting_keywords || [],
        sourceQueries: (sourceRows || []).slice(0, 8).map((row: any) => row.query),
        subNodeIntents: Array.isArray(planned.sub_node_intents)
            ? planned.sub_node_intents
            : [],
        cluster: cluster?.name || "",
        clusterCompetitorUrls,
        isPillar: Boolean(planned.is_pillar),
        clusterPosition,
        clusterId: planned.cluster_id || "",
        frozenLinks: (linkRows || []).map((row: any) => ({
            title: row.anchor_text,
            url: row.target_url,
            relationship: row.relationship,
        })),
    }
}
