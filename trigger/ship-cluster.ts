import { schedules } from "@trigger.dev/sdk/v3"

import { scheduleEndOfScopeCancellation } from "@/lib/harvest/billing-lifecycle"
import { createAdminClient } from "@/utils/supabase/admin"
import { generateBlogPost } from "./generate-blog"

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
            "id, title, main_keyword, supporting_keywords, article_type, slug, target_url, article_id, generation_status, retry_count",
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
            await generateBlogPost.trigger({
                articleId,
                keyword: planned.main_keyword,
                brandId: program.brand_id,
                title: planned.title,
                articleType: planned.article_type || "informational",
                supportingKeywords: planned.supporting_keywords || [],
                plannedArticleId: planned.id,
                frozenLinks,
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
