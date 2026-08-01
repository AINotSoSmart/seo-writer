import "server-only"

import { PRODUCT_TRUTH } from "@/config/product-truth"
import { createAdminClient } from "@/utils/supabase/admin"
import {
    auditCheckoutFreshness,
    selectQualifiedProgramScope,
} from "./program-contract"
import {
    buildFrozenGraph,
    type FrozenGraph,
    type GraphArticleInput,
} from "./link-graph"

export type VelocityTier = "close" | "accelerate" | "dominate"

export interface PurchaseIntentResult {
    id: string
    pricingPlanId: string
    dodoProductId: string
    graph: FrozenGraph
}

export class PurchaseIntentError extends Error {
    constructor(message: string, public readonly code: string, public readonly status = 422) {
        super(message)
        this.name = "PurchaseIntentError"
    }
}

function asEmbedding(value: unknown): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite)
    if (typeof value === "string") {
        return value
            .replace(/^\[|\]$/g, "")
            .split(",")
            .map(Number)
            .filter(Number.isFinite)
    }
    return []
}

export async function createProgramPurchaseIntent(input: {
    userId: string
    auditId: string
    tier: VelocityTier
    publicationUrlPattern: string
}): Promise<PurchaseIntentResult> {
    const supabase = createAdminClient() as any
    const { data: audit, error: auditError } = await supabase
        .from("topical_audits")
        .select(
            "id, user_id, brand_id, subject_url, site_page_snapshot, run_status, completed_at, requires_reaudit, scope_hash",
        )
        .eq("id", input.auditId)
        .eq("user_id", input.userId)
        .single()
    if (auditError || !audit) {
        throw new PurchaseIntentError("Audit not found.", "audit_not_found", 404)
    }
    if (audit.run_status !== "completed" || audit.requires_reaudit) {
        throw new PurchaseIntentError(
            "Run a fresh completed audit before checkout.",
            "audit_not_eligible",
        )
    }
    if (!audit.brand_id) {
        throw new PurchaseIntentError(
            "Claim this audit before checkout.",
            "audit_not_claimed",
        )
    }
    const freshness = auditCheckoutFreshness(audit.completed_at)
    if (!freshness.fresh) {
        throw new PurchaseIntentError(
            freshness.reason!,
            "audit_stale",
        )
    }

    const { data: brand } = await supabase
        .from("brand_details")
        .select("current_audit_id, website_url, scope_hash")
        .eq("id", audit.brand_id)
        .eq("user_id", input.userId)
        .single()
    if (!brand || brand.current_audit_id !== audit.id) {
        throw new PurchaseIntentError(
            "Checkout requires the brand's current completed audit.",
            "audit_not_current",
        )
    }
    if (!audit.scope_hash || brand.scope_hash !== audit.scope_hash) {
        throw new PurchaseIntentError(
            "The confirmed business scope changed after this audit. Run a fresh audit before checkout.",
            "scope_changed",
        )
    }

    const { data: plan } = await supabase
        .from("dodo_pricing_plans")
        .select("id, dodo_product_id, metadata, name, price, currency")
        .eq("is_active", true)
        .ilike("name", input.tier)
        .limit(1)
        .maybeSingle()
    if (!plan?.id || !plan.dodo_product_id) {
        throw new PurchaseIntentError(
            `The ${input.tier} plan is not configured for checkout.`,
            "plan_unavailable",
            503,
        )
    }
    const tierTruth = PRODUCT_TRUTH.tiers[input.tier]
    if (
        Number(plan.price) !== tierTruth.price ||
        String(plan.currency || "USD").toUpperCase() !== tierTruth.currency
    ) {
        throw new PurchaseIntentError(
            `The ${input.tier} plan price does not match the product contract.`,
            "plan_misconfigured",
            503,
        )
    }

    const { data: soldRows } = await supabase
        .from("program_clusters")
        .select("audit_cluster_id, programs!inner(user_id)")
        .eq("programs.user_id", input.userId)
    const sold = new Set<string>(
        (soldRows || []).map((row: any) => String(row.audit_cluster_id)),
    )

    const [
        { data: clusterRows, error: clusterError },
        { data: scopeRows, error: scopeError },
    ] = await Promise.all([
        supabase
            .from("audit_clusters")
            .select("id, scope_family_id, priority, article_count")
            .eq("audit_id", audit.id)
            .order("priority", { ascending: true }),
        supabase
            .from("audit_scope_families")
            .select("id, priority, capability_contract")
            .eq("audit_id", audit.id),
    ])
    if (clusterError) throw new PurchaseIntentError(clusterError.message, "cluster_load_failed")
    if (scopeError) throw new PurchaseIntentError(scopeError.message, "scope_load_failed")
    if (
        !(scopeRows || []).length ||
        (scopeRows || []).some(
            (scope: any) => scope.capability_contract?.version !== "capability-v1",
        )
    ) {
        throw new PurchaseIntentError(
            "This audit predates verified capability contracts. Run a fresh audit before checkout.",
            "audit_contract_missing",
        )
    }
    const scopePriority = new Map(
        (scopeRows || []).map((scope: any) => [
            String(scope.id),
            Number(scope.priority || 0),
        ]),
    )

    const selection = selectQualifiedProgramScope(
        (clusterRows || []).map((cluster: any) => ({
            id: cluster.id,
            priority: Number(cluster.priority || 0),
            articleCount: Number(cluster.article_count || 0),
            scopeFamilyId: String(cluster.scope_family_id),
            scopeFamilyPriority:
                scopePriority.get(String(cluster.scope_family_id)) ?? 99,
        })),
        sold,
        false,
    )
    if (!selection.eligible) {
        throw new PurchaseIntentError(
            selection.reason ||
                "This audit does not contain a qualified cluster to sell.",
            "small_niche",
        )
    }
    const clusterIds = selection.selected.map((cluster) => cluster.id)

    const { data: articleRows, error: articleError } = await supabase
        .from("planned_articles")
        .select(
            "id, cluster_id, title, main_keyword, is_pillar, source_query_ids, article_contract, contract_version",
        )
        .eq("audit_id", audit.id)
        .in("cluster_id", clusterIds)
    if (articleError || !articleRows) {
        throw new PurchaseIntentError(
            articleError?.message || "Planned articles are unavailable.",
            "article_load_failed",
        )
    }
    if (
        articleRows.some(
            (article: any) =>
                article.contract_version !== "article-contract-v1" ||
                article.article_contract?.version !== "article-contract-v1",
        )
    ) {
        throw new PurchaseIntentError(
            "This audit is missing frozen writer contracts. Run a fresh audit before checkout.",
            "article_contract_missing",
        )
    }
    const queryIds: string[] = Array.from(
        new Set<string>(
            articleRows.flatMap((article: any) =>
                (article.source_query_ids || []).map(String),
            ),
        ),
    )
    const { data: queryRows } = await supabase
        .from("query_pool")
        .select("id, embedding")
        .eq("audit_id", audit.id)
        .in("id", queryIds)
    const embeddingById = new Map<string, number[]>(
        (queryRows || []).map((query: any) => [
            String(query.id),
            asEmbedding(query.embedding),
        ]),
    )
    const graphArticles: GraphArticleInput[] = articleRows.map((article: any) => {
        const sourceId = (article.source_query_ids || [])[0]
        const embedding = embeddingById.get(sourceId) || []
        if (embedding.length === 0) {
            throw new PurchaseIntentError(
                `Article ${article.id} has no source embedding.`,
                "missing_embedding",
            )
        }
        return {
            id: article.id,
            clusterId: article.cluster_id,
            title: article.title,
            mainKeyword: article.main_keyword,
            isPillar: Boolean(article.is_pillar),
            embedding,
        }
    })

    const existingLinks = (
        Array.isArray(audit.site_page_snapshot)
            ? audit.site_page_snapshot
            : []
    )
        .map((row: any) => ({
            url: row.url,
            title: row.title || row.url,
            embedding: asEmbedding(row.embedding),
        }))
        .filter((row: any) => row.embedding.length > 0)

    const graph = buildFrozenGraph(
        input.publicationUrlPattern,
        audit.subject_url || brand.website_url,
        graphArticles,
        existingLinks,
    )

    const { data: intent, error: intentError } = await supabase
        .from("program_purchase_intents")
        .insert({
            user_id: input.userId,
            brand_id: audit.brand_id,
            audit_id: audit.id,
            pricing_plan_id: plan.id,
            tier: input.tier,
            cluster_ids: clusterIds,
            publication_url_pattern: graph.publicationUrlPattern,
            graph_snapshot: graph,
        })
        .select("id")
        .single()
    if (intentError || !intent) {
        throw new PurchaseIntentError(
            intentError?.message || "Failed to freeze the purchase scope.",
            "intent_create_failed",
            500,
        )
    }

    return {
        id: intent.id,
        pricingPlanId: plan.id,
        dodoProductId: plan.dodo_product_id,
        graph,
    }
}
