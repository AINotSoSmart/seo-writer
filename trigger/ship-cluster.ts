import { schedules } from "@trigger.dev/sdk/v3"

import { scheduleEndOfScopeCancellation } from "@/lib/harvest/billing-lifecycle"
import { createAdminClient } from "@/utils/supabase/admin"
import { generateBlogPost } from "./generate-blog"
import {
    resolveCapabilityFacts,
    type ArticleContract,
    type CapabilityContract,
} from "@/lib/writer/article-contract"

const MAX_GENERATION_RETRIES = 2

type ProgramRow = {
    id: string
    user_id: string
    brand_id: string
    audit_id: string
    dodo_subscription_id: string
    scope_status: string
    cancellation_status: string
}

/**
 * The only recurring closed-pool worker:
 * - starts due clusters,
 * - retries failed members,
 * - releases ready clusters atomically,
 * - retries end-of-scope cancellation.
 */
export const programLifecycleScheduler = schedules.task({
    id: "program-lifecycle",
    cron: "0 * * * *",
    queue: { concurrencyLimit: 1 },
    maxDuration: 900,
    run: async () => {
        const supabase = createAdminClient() as any
        const now = new Date().toISOString()
        const { data: programs, error } = await supabase
            .from("programs")
            .select(
                "id, user_id, brand_id, audit_id, dodo_subscription_id, scope_status, cancellation_status",
            )
            .in("scope_status", ["active", "paused", "scope_delivered"])

        if (error) throw new Error(`Program lifecycle load failed: ${error.message}`)
        let generated = 0
        let delivered = 0
        let blocked = 0

        for (const program of (programs || []) as ProgramRow[]) {
            if (
                program.scope_status === "scope_delivered" &&
                ["active", "error", "request_pending"].includes(
                    program.cancellation_status,
                )
            ) {
                try {
                    await scheduleEndOfScopeCancellation(program.id)
                } catch (cancellationError) {
                    console.error(
                        `[ProgramLifecycle] Cancellation retry failed for ${program.id}:`,
                        cancellationError,
                    )
                }
                continue
            }
            if (program.scope_status === "paused") continue

            const { data: clusters } = await supabase
                .from("program_clusters")
                .select("id, audit_cluster_id, state, scheduled_for, retry_count")
                .eq("program_id", program.id)
                .in("state", ["scheduled", "generating", "blocked", "ready"])
                .order("sequence", { ascending: true })

            for (const cluster of clusters || []) {
                if (cluster.state === "scheduled" && cluster.scheduled_for > now) continue

                if (cluster.state === "ready") {
                    const completed = await deliverCluster(supabase, program, cluster.id)
                    delivered++
                    if (completed) {
                        try {
                            await scheduleEndOfScopeCancellation(program.id)
                        } catch (cancellationError) {
                            console.error(
                                `[ProgramLifecycle] End-of-scope cancellation failed for ${program.id}:`,
                                cancellationError,
                            )
                        }
                    }
                    continue
                }

                const outcome = await advanceCluster(
                    supabase,
                    program,
                    cluster.id,
                    cluster.audit_cluster_id,
                )
                generated += outcome.triggered
                if (outcome.blocked) blocked++
                if (outcome.ready) {
                    const completed = await deliverCluster(supabase, program, cluster.id)
                    delivered++
                    if (completed) {
                        try {
                            await scheduleEndOfScopeCancellation(program.id)
                        } catch (cancellationError) {
                            console.error(
                                `[ProgramLifecycle] End-of-scope cancellation failed for ${program.id}:`,
                                cancellationError,
                            )
                        }
                    }
                }
            }
        }

        return { programs: programs?.length || 0, generated, delivered, blocked }
    },
})

async function advanceCluster(
    supabase: any,
    program: ProgramRow,
    programClusterId: string,
    auditClusterId: string,
): Promise<{ triggered: number; blocked: boolean; ready: boolean }> {
    const { data: plannedRows, error } = await supabase
        .from("planned_articles")
        .select(
            "id, title, main_keyword, supporting_keywords, article_type, slug, target_url, article_id, generation_status, retry_count, source_query_ids, is_pillar, sub_node_intents, article_contract, contract_version",
        )
        .eq("audit_id", program.audit_id)
        .eq("cluster_id", auditClusterId)
        .order("is_pillar", { ascending: false })
    if (error || !plannedRows?.length) {
        await markClusterBlocked(
            supabase,
            programClusterId,
            error?.message || "cluster_has_no_articles",
        )
        return { triggered: 0, blocked: true, ready: false }
    }
    if (
        plannedRows.some(
            (article: any) =>
                article.contract_version !== "article-contract-v1" ||
                !article.article_contract,
        )
    ) {
        await markClusterBlocked(
            supabase,
            programClusterId,
            "audit_requires_writer_contract_refresh",
        )
        return { triggered: 0, blocked: true, ready: false }
    }

    const [{ data: audit }, { data: scopeRows }] = await Promise.all([
        supabase
            .from("topical_audits")
            .select("brand_snapshot")
            .eq("id", program.audit_id)
            .maybeSingle(),
        supabase
            .from("audit_scope_families")
            .select("capability_contract")
            .eq("audit_id", program.audit_id),
    ])
    const capabilityContracts = (scopeRows || [])
        .map((row: any) => row.capability_contract)
        .filter(Boolean) as CapabilityContract[]

    const allGenerated = plannedRows.every(
        (article: any) => article.generation_status === "generated",
    )
    if (allGenerated) {
        await supabase
            .from("program_clusters")
            .update({
                state: "ready",
                ready_at: new Date().toISOString(),
                failure_code: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", programClusterId)
        return { triggered: 0, blocked: false, ready: true }
    }

    const candidates = plannedRows.filter((article: any) =>
        ["planned", "queued", "failed"].includes(article.generation_status),
    )

    // The audit's own evidence, loaded once per cluster and batched rather than
    // per article. Until this existed the writer researched every topic from
    // scratch with a generic Tavily search, while the exact real searches that
    // justified the article sat unused in query_pool — the product's entire
    // claim is that those searches are real and traceable.
    const clusterEvidence = await loadClusterEvidence(
        supabase,
        auditClusterId,
        candidates,
    )
    const exhausted = candidates.filter(
        (article: any) =>
            article.generation_status === "failed" &&
            Number(article.retry_count || 0) >= MAX_GENERATION_RETRIES,
    )
    if (exhausted.length > 0) {
        await markClusterBlocked(
            supabase,
            programClusterId,
            "article_retry_limit_reached",
        )
        return { triggered: 0, blocked: true, ready: false }
    }

    await supabase
        .from("program_clusters")
        .update({
            state: "generating",
            generation_started_at: new Date().toISOString(),
            failure_code: null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", programClusterId)

    let triggered = 0
    for (const planned of candidates) {
        const { data: consumed, error: consumeError } = await supabase.rpc(
            "consume_program_credit",
            {
                p_planned_article_id: planned.id,
                p_dodo_subscription_id: program.dodo_subscription_id,
            },
        )
        if (consumeError || !consumed) {
            await markClusterBlocked(
                supabase,
                programClusterId,
                "billing_allowance_unavailable",
            )
            return { triggered, blocked: true, ready: false }
        }

        let articleId = planned.article_id
        if (!articleId) {
            const { data: article, error: articleError } = await supabase
                .from("articles")
                .insert({
                    brand_id: program.brand_id,
                    keyword: planned.main_keyword,
                    slug: planned.slug,
                    status: "queued",
                    user_id: program.user_id,
                    planned_article_id: planned.id,
                    delivery_visible_at: null,
                })
                .select("id")
                .single()
            if (articleError || !article) {
                await markArticleFailed(
                    supabase,
                    planned.id,
                    articleError?.message || "article_row_creation_failed",
                )
                continue
            }
            articleId = article.id
        }

        const frozenLinks = await loadFrozenLinks(supabase, program.id, planned.id)
        const nextRetryCount = Number(planned.retry_count || 0) + 1
        const { data: claimedState, error: queueStateError } = await supabase
            .from("planned_articles")
            .update({
                article_id: articleId,
                status: "writing",
                generation_status: "generating",
                generation_error: null,
                retry_count: nextRetryCount,
                shipped_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", planned.id)
            .in("generation_status", ["planned", "queued", "failed"])
            .select("id")
            .maybeSingle()
        if (queueStateError || !claimedState) {
            if (!queueStateError) continue
            await markArticleFailed(
                supabase,
                planned.id,
                `generation_state_update_failed: ${queueStateError.message}`,
            )
            continue
        }

        try {
            const articleContract = planned.article_contract as ArticleContract
            await generateBlogPost.trigger({
                articleId,
                keyword: planned.main_keyword,
                brandId: program.brand_id,
                title: planned.title,
                articleType: planned.article_type || "informational",
                supportingKeywords: planned.supporting_keywords || [],
                plannedArticleId: planned.id,
                articleContract,
                capabilityFacts: resolveCapabilityFacts(
                    capabilityContracts,
                    articleContract.capabilityFactIds,
                ),
                auditBrandSnapshot:
                    audit?.brand_snapshot && typeof audit.brand_snapshot === "object"
                        ? audit.brand_snapshot
                        : {},
                frozenLinks,
                cluster: clusterEvidence.clusterName || "",
                sourceQueries: clusterEvidence.queriesByArticle.get(planned.id) || [],
                clusterCompetitorUrls: clusterEvidence.competitorUrls,
                // Intents from a domain too thin to sustain its own cluster.
                // They were absorbed into this article and MUST be answered as
                // H2/FAQ sections, or the demand that justified keeping them
                // never reaches a page.
                subNodeIntents: Array.isArray(planned.sub_node_intents)
                    ? planned.sub_node_intents
                    : [],
                isPillar: Boolean(planned.is_pillar),
                // Drives deterministic intro-pattern rotation. Taken from the
                // full cluster ordering (not the retry-filtered candidate list)
                // so a retried article keeps the same opening shape it would
                // have had on the first attempt.
                clusterPosition: plannedRows.findIndex((row: any) => row.id === planned.id),
                clusterId: auditClusterId,
            }, {
                idempotencyKey: `${planned.id}:${nextRetryCount}`,
            })
            triggered++
        } catch (triggerError) {
            await markArticleFailed(
                supabase,
                planned.id,
                triggerError instanceof Error ? triggerError.message : "generation_trigger_failed",
            )
        }
    }

    return { triggered, blocked: false, ready: false }
}

/** Most observed searches to hand one article. Enough to steer, not a dump. */
const MAX_SOURCE_QUERIES_PER_ARTICLE = 8

type ClusterEvidence = {
    clusterName: string | null
    competitorUrls: string[]
    /** planned_article.id -> the real searches that article exists to answer */
    queriesByArticle: Map<string, string[]>
}

/**
 * Loads the audit evidence behind a cluster in two queries total, regardless of
 * how many articles it holds.
 *
 * Failure here is deliberately non-fatal: this enriches the writer's context,
 * and losing it must degrade article quality rather than block a paid cluster
 * that is otherwise ready to generate.
 */
async function loadClusterEvidence(
    supabase: any,
    auditClusterId: string,
    candidates: Array<{ id: string; source_query_ids?: string[] | null }>,
): Promise<ClusterEvidence> {
    const empty: ClusterEvidence = {
        clusterName: null,
        competitorUrls: [],
        queriesByArticle: new Map(),
    }

    try {
        const { data: cluster } = await supabase
            .from("audit_clusters")
            .select("name, competitor_urls")
            .eq("id", auditClusterId)
            .maybeSingle()

        const wantedIds = Array.from(
            new Set(
                candidates.flatMap((article) =>
                    (article.source_query_ids || []).slice(
                        0,
                        MAX_SOURCE_QUERIES_PER_ARTICLE,
                    ),
                ),
            ),
        )

        const { data: queryRows } = wantedIds.length
            ? await supabase
                  .from("query_pool")
                  .select("id, query")
                  .in("id", wantedIds)
            : { data: [] }

        const queryById = new Map<string, string>(
            (queryRows || []).map((row: any) => [row.id, row.query]),
        )
        const queriesByArticle = new Map<string, string[]>()
        for (const article of candidates) {
            const queries = (article.source_query_ids || [])
                .slice(0, MAX_SOURCE_QUERIES_PER_ARTICLE)
                .map((id: string) => queryById.get(id))
                .filter((query: string | undefined): query is string => Boolean(query))
            if (queries.length > 0) queriesByArticle.set(article.id, queries)
        }

        const competitorUrls = Array.isArray(cluster?.competitor_urls)
            ? (cluster.competitor_urls as unknown[])
                  .map((entry) =>
                      typeof entry === "string"
                          ? entry
                          : String((entry as any)?.url || ""),
                  )
                  .filter(Boolean)
                  .slice(0, 6)
            : []

        return {
            clusterName: cluster?.name || null,
            competitorUrls,
            queriesByArticle,
        }
    } catch (evidenceError) {
        console.warn(
            "[ShipCluster] Could not load audit evidence; generating without it:",
            evidenceError,
        )
        return empty
    }
}

async function loadFrozenLinks(
    supabase: any,
    programId: string,
    sourceArticleId: string,
): Promise<Array<{ title: string; url: string; relationship: string }>> {
    const { data: rows } = await supabase
        .from("planned_article_links")
        .select("target_article_id, target_url, anchor_text, relationship")
        .eq("program_id", programId)
        .eq("source_article_id", sourceArticleId)
    return (rows || []).map((row: any) => ({
        title: row.anchor_text,
        url: row.target_url,
        relationship: row.relationship,
    }))
}

async function deliverCluster(
    supabase: any,
    program: ProgramRow,
    programClusterId: string,
): Promise<boolean> {
    // Re-read status immediately before the transactional release so a pause
    // clicked while generation was running is respected.
    const { data: current } = await supabase
        .from("programs")
        .select("scope_status")
        .eq("id", program.id)
        .single()
    if (current?.scope_status !== "active") return false

    const { data: completed, error } = await supabase.rpc(
        "deliver_program_cluster",
        { p_program_cluster_id: programClusterId },
    )
    if (error) {
        await markClusterBlocked(supabase, programClusterId, error.message)
        return false
    }
    return Boolean(completed)
}

async function markClusterBlocked(
    supabase: any,
    programClusterId: string,
    failureCode: string,
): Promise<void> {
    await supabase
        .from("program_clusters")
        .update({
            state: "blocked",
            failure_code: failureCode.slice(0, 500),
            retry_count: 1,
            updated_at: new Date().toISOString(),
        })
        .eq("id", programClusterId)
}

async function markArticleFailed(
    supabase: any,
    plannedArticleId: string,
    message: string,
): Promise<void> {
    await supabase
        .from("planned_articles")
        .update({
            status: "failed",
            generation_status: "failed",
            generation_error: message.slice(0, 1000),
            updated_at: new Date().toISOString(),
        })
        .eq("id", plannedArticleId)
}
