/* eslint-disable @typescript-eslint/no-explicit-any -- forward Phase 3 relations and RPCs are absent from generated database types until migration. */
import { schedules } from "@trigger.dev/sdk/v3"

import { loadPlannedWriterInputs } from "@/lib/writer/planned-article-payload"
import { createAdminClient } from "@/utils/supabase/admin"
import { generateBlogPost } from "./generate-blog"

type ProgramRow = {
    id: string
    user_id: string
    brand_id: string
}

type CycleRow = {
    id: string
    program_id: string
    state: "producing" | "ready"
}

type ActionRow = {
    id: string
    resolution_type: "create" | "refresh"
    state: "selected" | "generating" | "ready" | "failed"
    retry_count: number
    generation_started_at: string | null
}

/**
 * Advances only work that reconciliation/ranking has already selected.
 * Measurement, opportunity reconciliation and action selection are separate
 * phases; this worker may never manufacture work to fill the allowance.
 */
export const cycleLifecycleScheduler = schedules.task({
    id: "subscription-cycle-lifecycle",
    cron: "0 * * * *",
    queue: { concurrencyLimit: 1 },
    maxDuration: 900,
    run: async () => {
        const supabase = createAdminClient() as any
        const { data: programs, error } = await supabase
            .from("programs")
            .select("id, user_id, brand_id")
            .eq("status", "active")

        if (error) throw new Error(`Cycle lifecycle load failed: ${error.message}`)

        let triggered = 0
        let delivered = 0
        let failed = 0

        for (const program of (programs || []) as ProgramRow[]) {
            const { data: cycles, error: cycleError } = await supabase
                .from("subscription_cycles")
                .select("id, program_id, state")
                .eq("program_id", program.id)
                .in("state", ["producing", "ready"])
                .order("period_start", { ascending: true })

            if (cycleError) {
                console.error(`[CycleLifecycle] ${program.id}:`, cycleError)
                continue
            }

            for (const cycle of (cycles || []) as CycleRow[]) {
                if (cycle.state === "ready") {
                    if (await deliverCycle(supabase, cycle.id)) delivered++
                    else failed++
                    continue
                }

                const result = await advanceCycle(supabase, program, cycle)
                triggered += result.triggered
                failed += result.failed
                if (result.ready && (await deliverCycle(supabase, cycle.id))) {
                    delivered++
                }
            }
        }

        return { programs: programs?.length || 0, triggered, delivered, failed }
    },
})

async function advanceCycle(
    supabase: any,
    program: ProgramRow,
    cycle: CycleRow,
): Promise<{ triggered: number; failed: number; ready: boolean }> {
    const { data: actionRows, error } = await supabase
        .from("cycle_actions")
        .select("id, resolution_type, state, retry_count, generation_started_at")
        .eq("cycle_id", cycle.id)
        .order("rank", { ascending: true })

    if (error) {
        await noteCycleFailure(supabase, cycle.id, error.message)
        return { triggered: 0, failed: 1, ready: false }
    }

    const actions = (actionRows || []) as ActionRow[]
    if (actions.length === 0) {
        await supabase
            .from("subscription_cycles")
            .update({ state: "ready", failure_code: null, updated_at: new Date().toISOString() })
            .eq("id", cycle.id)
            .eq("state", "producing")
        return { triggered: 0, failed: 0, ready: true }
    }

    let triggered = 0
    let failed = 0

    for (const action of actions) {
        if (action.state === "ready") continue

        // Refreshes are an explicit founder-assisted path at launch. Sending
        // one through the create writer would produce a second article instead
        // of a reviewed replacement for the confirmed existing page.
        if (action.resolution_type === "refresh") continue

        const { data: planned } = await supabase
            .from("planned_articles")
            .select("id, article_id, slug, generation_status")
            .eq("cycle_action_id", action.id)
            .maybeSingle()

        if (!planned) {
            await markActionFailed(supabase, action.id, "selected_action_has_no_output")
            failed++
            continue
        }

        if (planned.generation_status === "generated") {
            await markActionReady(supabase, action.id)
            continue
        }
        if (action.state === "generating" || planned.generation_status === "generating") {
            const startedAt = action.generation_started_at
                ? new Date(action.generation_started_at).getTime()
                : Number.NaN
            const stale = Number.isFinite(startedAt) && Date.now() - startedAt > 60 * 60 * 1000
            if (stale) {
                await markActionFailed(supabase, action.id, "generation_lease_expired")
                await supabase
                    .from("planned_articles")
                    .update({
                        generation_status: "failed",
                        generation_error: "generation_lease_expired",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", planned.id)
                    .eq("generation_status", "generating")
            }
            continue
        }

        const { data: claimRows, error: claimError } = await supabase.rpc(
            "claim_cycle_action",
            { p_cycle_action_id: action.id },
        )
        const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows
        if (claimError || !claim?.planned_article_id) {
            if (claimError) {
                await markActionFailed(supabase, action.id, claimError.message)
                failed++
            }
            continue
        }

        try {
            await triggerAction(
                supabase,
                program,
                cycle.id,
                action.id,
                claim.planned_article_id,
                Number(claim.retry_count || 1),
            )
            triggered++
        } catch (triggerError) {
            const failureCode = triggerError instanceof Error
                ? triggerError.message
                : "generation_trigger_failed"
            await supabase
                .from("planned_articles")
                .update({
                    generation_status: "failed",
                    generation_error: failureCode.slice(0, 500),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", claim.planned_article_id)
                .eq("generation_status", "generating")
            await markActionFailed(
                supabase,
                action.id,
                failureCode,
            )
            failed++
        }
    }

    const { count: remaining } = await supabase
        .from("cycle_actions")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", cycle.id)
        .neq("state", "ready")

    if ((remaining || 0) === 0) {
        await supabase
            .from("subscription_cycles")
            .update({ state: "ready", failure_code: null, updated_at: new Date().toISOString() })
            .eq("id", cycle.id)
            .eq("state", "producing")
        return { triggered, failed, ready: true }
    }

    return { triggered, failed, ready: false }
}

async function triggerAction(
    supabase: any,
    program: ProgramRow,
    cycleId: string,
    actionId: string,
    plannedArticleId: string,
    retryCount: number,
): Promise<void> {
    const inputs = await loadPlannedWriterInputs(supabase, plannedArticleId)
    if (!inputs) throw new Error("selected_output_writer_contract_missing")

    const { data: planned } = await supabase
        .from("planned_articles")
        .select("article_id, slug")
        .eq("id", plannedArticleId)
        .single()

    let articleId = planned?.article_id
    if (!articleId) {
        const { data: article, error } = await supabase
            .from("articles")
            .insert({
                brand_id: program.brand_id,
                keyword: inputs.keyword,
                slug: planned?.slug,
                status: "queued",
                user_id: program.user_id,
                planned_article_id: plannedArticleId,
                delivery_visible_at: null,
            })
            .select("id")
            .single()
        if (error || !article) {
            throw new Error(error?.message || "article_row_creation_failed")
        }
        articleId = article.id
    }

    const { data: claimed, error: stateError } = await supabase
        .from("planned_articles")
        .update({
            article_id: articleId,
            status: "writing",
            generation_status: "generating",
            generation_error: null,
            retry_count: retryCount,
            shipped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", plannedArticleId)
        .in("generation_status", ["planned", "queued", "failed"])
        .select("id")
        .maybeSingle()
    if (stateError) throw new Error(stateError.message)
    if (!claimed) return

    await generateBlogPost.trigger(
        {
            articleId,
            keyword: inputs.keyword,
            brandId: program.brand_id,
            title: inputs.title,
            articleType: inputs.articleType,
            supportingKeywords: inputs.supportingKeywords,
            plannedArticleId,
            articleContract: inputs.articleContract,
            capabilityFacts: inputs.capabilityFacts,
            auditBrandSnapshot: inputs.auditBrandSnapshot,
            frozenLinks: inputs.frozenLinks,
            cluster: inputs.cluster,
            sourceQueries: inputs.sourceQueries,
            clusterCompetitorUrls: inputs.clusterCompetitorUrls,
            subNodeIntents: inputs.subNodeIntents,
            isPillar: inputs.isPillar,
            clusterPosition: inputs.clusterPosition,
            clusterId: inputs.clusterId,
        },
        { idempotencyKey: `${cycleId}:${actionId}:${retryCount}` },
    )
}

async function markActionReady(supabase: any, actionId: string): Promise<void> {
    await supabase
        .from("cycle_actions")
        .update({
            state: "ready",
            ready_at: new Date().toISOString(),
            failure_code: null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", actionId)
        .in("state", ["selected", "generating", "failed"])
}

async function markActionFailed(
    supabase: any,
    actionId: string,
    failureCode: string,
): Promise<void> {
    await supabase
        .from("cycle_actions")
        .update({
            state: "failed",
            failure_code: failureCode.slice(0, 500),
            updated_at: new Date().toISOString(),
        })
        .eq("id", actionId)
        .neq("state", "delivered")
}

async function noteCycleFailure(
    supabase: any,
    cycleId: string,
    failureCode: string,
): Promise<void> {
    await supabase
        .from("subscription_cycles")
        .update({ failure_code: failureCode.slice(0, 500), updated_at: new Date().toISOString() })
        .eq("id", cycleId)
        .neq("state", "delivered")
}

async function deliverCycle(supabase: any, cycleId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("deliver_subscription_cycle", {
        p_cycle_id: cycleId,
    })
    if (error) {
        await noteCycleFailure(supabase, cycleId, error.message)
        return false
    }
    return Boolean(data)
}
