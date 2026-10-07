/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import { logger, schedules, task } from "@trigger.dev/sdk/v3"

import { analyseWeek } from "@/lib/engine/analyse"
import { EngineStartError, startEngineWeek } from "@/lib/engine/measure"
import { advanceCreate, markFailed, produceRefresh, startCreate } from "@/lib/engine/produce"
import { ENGINE_WEEKLY_CRON, ENGINE_WEEKLY_TIMEZONE } from "@/lib/engine/schedule"
import { createAdminClient } from "@/utils/supabase/admin"

/** Refreshes are retried at most this many times before the action shows as failed. */
const MAX_REFRESH_ATTEMPTS = 3

/**
 * Monday 08:30 GMT: start the week's measurement for every tool that has
 * tracking on and saved questions. The measurement finishing triggers the
 * analysis (trigger/run-probe.ts), which triggers production.
 */
export const engineWeeklyScheduler = schedules.task({
    id: "engine-weekly-run",
    cron: { pattern: ENGINE_WEEKLY_CRON, timezone: ENGINE_WEEKLY_TIMEZONE, environments: ["PRODUCTION"] },
    queue: { concurrencyLimit: 1 },
    maxDuration: 600,
    run: async () => {
        const admin = createAdminClient() as any
        const { data: brands } = await admin
            .from("brand_details")
            .select("id, user_id")
            .is("deleted_at", null)
        const started: string[] = []
        const skipped: Array<{ brandId: string; reason: string }> = []
        for (const brand of brands ?? []) {
            const { count } = await admin
                .from("tracked_prompts")
                .select("id", { count: "exact", head: true })
                .eq("brand_id", brand.id)
                .eq("tracking_status", "active")
            if (!count) {
                skipped.push({ brandId: brand.id, reason: "no tracked questions" })
                continue
            }
            try {
                const week = await startEngineWeek({ admin, userId: brand.user_id, brandId: brand.id, source: "schedule" })
                if (!week.alreadyRunning) started.push(brand.id)
                else skipped.push({ brandId: brand.id, reason: "this week already started" })
            } catch (error) {
                const reason = error instanceof EngineStartError ? error.message : String(error)
                logger.warn("Engine week not started", { brandId: brand.id, reason })
                skipped.push({ brandId: brand.id, reason })
            }
        }
        return { started, skipped }
    },
})

export const engineAnalyseWeekTask = task({
    id: "engine-analyse-week",
    queue: { concurrencyLimit: 2 },
    maxDuration: 1800,
    retry: { maxAttempts: 2 },
    run: async (payload: { weekId: string }) => {
        const admin = createAdminClient() as any
        try {
            const result = await analyseWeek(admin, payload.weekId)
            if (result.state === "producing") await startProduction(admin, payload.weekId)
            return result
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            await admin
                .from("engine_weeks")
                .update({ state: "failed", failure_reason: `Analysis failed: ${message}`.slice(0, 1000), updated_at: new Date().toISOString() })
                .eq("id", payload.weekId)
            throw error
        }
    },
})

export const engineProduceRefreshTask = task({
    id: "engine-produce-refresh",
    queue: { concurrencyLimit: 2 },
    maxDuration: 600,
    retry: { maxAttempts: MAX_REFRESH_ATTEMPTS },
    onFailure: async ({ payload, error }: { payload: { actionId: string }; error: unknown }) => {
        const admin = createAdminClient() as any
        await markFailed(admin, payload.actionId, error instanceof Error ? error.message : String(error))
    },
    run: async (payload: { actionId: string }) => {
        const admin = createAdminClient() as any
        return { state: await produceRefresh(admin, payload.actionId) }
    },
})

async function startProduction(admin: any, weekId: string): Promise<void> {
    const { data: actions } = await admin
        .from("engine_actions")
        .select("id, kind")
        .eq("week_id", weekId)
        .eq("state", "planned")
    for (const action of actions ?? []) {
        if (action.kind === "create") {
            await startCreate(admin, action.id)
        } else if (action.kind === "refresh") {
            await admin
                .from("engine_actions")
                .update({ state: "producing", updated_at: new Date().toISOString() })
                .eq("id", action.id)
            await engineProduceRefreshTask.trigger({ actionId: action.id }, { idempotencyKey: `refresh:${action.id}` })
        }
    }
}

/**
 * Hourly: moves written articles through the draft-time duplicate guard and
 * closes weeks whose work is all produced. Also unsticks a week whose
 * measurement or analysis died without reporting.
 */
export const engineAdvance = schedules.task({
    id: "engine-advance",
    cron: "15 * * * *",
    queue: { concurrencyLimit: 1 },
    maxDuration: 900,
    run: async () => {
        const admin = createAdminClient() as any
        const { data: producing } = await admin
            .from("engine_actions")
            .select("id, week_id, brand_id, kind, state, title, prompts, article_id, duplicate_check, updated_at")
            .eq("kind", "create")
            .eq("state", "producing")
        let advanced = 0
        for (const action of producing ?? []) {
            try {
                const next = await advanceCreate(admin, action)
                if (next !== action.state) advanced++
            } catch (error) {
                logger.warn("Could not advance create action", { actionId: action.id, error: String(error) })
            }
        }

        // A refresh stuck in producing for a day lost its task.
        const dayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString()
        await admin
            .from("engine_actions")
            .update({ state: "failed", failure_reason: "Production stopped without reporting.", updated_at: new Date().toISOString() })
            .eq("kind", "refresh")
            .eq("state", "producing")
            .lt("updated_at", dayAgo)

        const { data: weeks } = await admin.from("engine_weeks").select("id").eq("state", "producing")
        for (const week of weeks ?? []) {
            const { count } = await admin
                .from("engine_actions")
                .select("id", { count: "exact", head: true })
                .eq("week_id", week.id)
                .in("state", ["planned", "producing"])
            if (!count) {
                await admin.from("engine_weeks").update({ state: "ready", updated_at: new Date().toISOString() }).eq("id", week.id)
            }
        }

        // Measurement or analysis that never reported back.
        const sixHoursAgo = new Date(Date.now() - 6 * 3_600_000).toISOString()
        await admin
            .from("engine_weeks")
            .update({ state: "failed", failure_reason: "The run stopped without reporting.", updated_at: new Date().toISOString() })
            .in("state", ["measuring", "analysing"])
            .lt("updated_at", sixHoursAgo)

        return { advanced }
    },
})
