/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import "server-only"

import { tasks } from "@trigger.dev/sdk/v3"

import { failAuditRun } from "@/lib/audit/run-guards"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import { resolveLanguage, resolveRegion } from "@/lib/target-market"
import { configuredEngines } from "@/lib/visibility/engines"
import { openAuditForBrand } from "@/lib/visibility/open-audit"
import { bindPromptsToAuditScope } from "@/lib/visibility/prompt-binding"
import type { BuyerPrompt } from "@/lib/visibility/prompt-builder"
import { isSelectionClass, UNKNOWN_SELECTION_CLASS } from "@/lib/visibility/selection-class"
import type { CapabilityContract } from "@/lib/writer/article-contract"
import type { runProbeTask } from "@/trigger/run-probe"

import { ENGINE_MEASURING_STALE_MINUTES, normalizeHost, weekStartFor } from "./schedule"
import { loadEngineSettings } from "./settings"

export class EngineStartError extends Error {
    constructor(message: string, readonly status: number = 409) {
        super(message)
        this.name = "EngineStartError"
    }
}

export interface StartedWeek {
    weekId: string
    runId: string
    alreadyRunning: boolean
}

/**
 * Starts this week's measurement for one tool.
 *
 * The same measurement the paid product sold — the tool's saved tracked
 * questions, asked of the configured consumer surfaces through the existing
 * `run-visibility-probe` task — with the payment and billing-cycle gates
 * removed. Idempotent per tool and week: a second call while the week is
 * measuring returns the live run instead of paying for another.
 */
export async function startEngineWeek(input: {
    admin: any
    userId: string
    brandId: string
    source: "schedule" | "manual"
}): Promise<StartedWeek> {
    const { admin, userId, brandId, source } = input
    const settings = await loadEngineSettings(admin, brandId)
    if (settings.userId !== userId) throw new EngineStartError("That tool is not yours.", 404)
    if (!settings.enabled && source === "schedule") {
        throw new EngineStartError("Weekly tracking is turned off for this tool.")
    }

    const weekStart = weekStartFor(new Date())
    const { data: existingWeek } = await admin
        .from("engine_weeks")
        .select("id, state, probe_run_id, started_at")
        .eq("brand_id", brandId)
        .eq("week_start", weekStart)
        .maybeSingle()

    if (existingWeek) {
        const startedAt = new Date(existingWeek.started_at).getTime()
        const live =
            ["measuring", "analysing", "producing"].includes(existingWeek.state) &&
            Date.now() - startedAt < ENGINE_MEASURING_STALE_MINUTES * 60_000
        // A live week is never doubled, and the scheduler never re-measures a
        // week it already started. Only the owner can ask for a fresh run of
        // the current week, which replaces its findings.
        if (live || source === "schedule") {
            return { weekId: existingWeek.id, runId: existingWeek.probe_run_id, alreadyRunning: true }
        }
    }

    const engines = configuredEngines()
    if (engines.length === 0) {
        throw new EngineStartError(
            "No answer-engine scraper is configured (BRIGHT_DATA_API_KEY or CLORO_API_KEY).",
            503,
        )
    }

    const opened = await openAuditForBrand(admin, userId, brandId)
    if (!opened.ok) {
        throw new EngineStartError(String(opened.body.error ?? "The audit could not be opened."), opened.status)
    }
    const auditId = opened.auditId
    const closeAudit = async (code: string, message: string) => {
        if (opened.opened) await failAuditRun(admin, auditId, code, message)
    }

    const { data: brand } = await admin
        .from("brand_details")
        .select("id, website_url, discovered_competitors, brand_data")
        .eq("id", brandId)
        .single()
    const brandData = (brand?.brand_data ?? {}) as {
        product_name?: string
        product_identity?: { literally?: string }
        target_region?: string
        target_language?: string
    }

    const { data: scopeRows } = await admin
        .from("audit_scope_families")
        .select("id, brand_scope_family_id, name, description, seed_keywords, priority, parent_scope_family_id, capability_contract")
        .eq("audit_id", auditId)
        .order("priority", { ascending: true })
    if (!scopeRows?.length) {
        await closeAudit("no_scope", "The tool has no confirmed product areas.")
        throw new EngineStartError("Confirm the tool's product areas before tracking it.")
    }
    const families: AuditScopeFamily[] = scopeRows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        seedKeywords: Array.isArray(row.seed_keywords) ? row.seed_keywords : [],
        priority: row.priority ?? 0,
        parentScopeFamilyId: row.parent_scope_family_id ?? null,
        capabilityContract: row.capability_contract as CapabilityContract,
    }))

    const { data: trackedRows } = await admin
        .from("tracked_prompts")
        .select("id, scope_family_id, prompt, prompt_norm, intent, article_type, source_seed, position, selection_class")
        .eq("brand_id", brandId)
        .eq("tracking_status", "active")
        .order("position", { ascending: true })
    if (!trackedRows?.length) {
        await closeAudit("tracked_prompts_incomplete", "The tool has no tracked buyer questions.")
        throw new EngineStartError("Save the tool's buyer questions before tracking it.")
    }

    const durable: BuyerPrompt[] = trackedRows.map((row: any) => ({
        trackedPromptId: row.id,
        text: row.prompt,
        textNorm: row.prompt_norm,
        scopeFamilyId: row.scope_family_id,
        intent: row.intent,
        articleType: row.article_type,
        selectionClass: isSelectionClass(row.selection_class) ? row.selection_class : UNKNOWN_SELECTION_CLASS,
        sourceSeed: row.source_seed,
    }))
    const { bound, unbound } = bindPromptsToAuditScope(
        durable,
        scopeRows.map((row: any) => ({
            id: row.id,
            brandScopeFamilyId: row.brand_scope_family_id ?? null,
            name: row.name,
            seedKeywords: Array.isArray(row.seed_keywords) ? row.seed_keywords : [],
        })),
    )
    if (unbound.length > 0) {
        await closeAudit("prompts_unbound", "Tracked questions no longer match the confirmed product areas.")
        throw new EngineStartError(
            `${unbound.length} tracked question(s) no longer match the tool's product areas. Review the questions.`,
        )
    }

    const discovered: Array<{ name?: string; url?: string }> = Array.isArray(brand?.discovered_competitors)
        ? brand.discovered_competitors
        : []
    const competitors = discovered
        .map((competitor) => {
            const domain = normalizeHost(competitor.url || "")
            return {
                id: domain ?? String(competitor.url ?? competitor.name ?? ""),
                name: competitor.name || domain || "",
                domain,
            }
        })
        .filter((competitor) => competitor.name.length > 0)

    const subjectHost = normalizeHost(brand?.website_url || "")
    const subjectName = brandData.product_name?.trim() || subjectHost || "the brand"
    const subjectDomains = settings.ownedHosts
    const countryCode = resolveRegion(brandData.target_region)

    const { data: run, error: runError } = await admin
        .from("ai_probe_runs")
        .insert({
            user_id: userId,
            brand_id: brandId,
            audit_id: auditId,
            subject_name: subjectName,
            subject_domains: subjectDomains,
            competitors,
            engines,
            country_code: countryCode,
            status: "running",
            phase: "queued",
            public_token: null,
        })
        .select("id")
        .single()
    if (runError || !run) {
        await closeAudit("probe_run_not_created", runError?.message ?? "no run row")
        throw new EngineStartError(`Could not open the measurement run: ${runError?.message}`, 500)
    }

    const { data: week, error: weekError } = await admin
        .from("engine_weeks")
        .upsert(
            {
                brand_id: brandId,
                user_id: userId,
                week_start: weekStart,
                probe_run_id: run.id,
                state: "measuring",
                trigger_source: source,
                stats: {},
                failure_reason: null,
                started_at: new Date().toISOString(),
                analysed_at: null,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "brand_id,week_start" },
        )
        .select("id")
        .single()
    if (weekError || !week) {
        throw new EngineStartError(`Could not record the week: ${weekError?.message}`, 500)
    }

    try {
        const handle = await tasks.trigger<typeof runProbeTask>("run-visibility-probe", {
            runId: run.id,
            userId,
            brandId,
            auditId,
            subjectName,
            subjectDomains,
            subjectAliases: settings.aliases,
            subjectType: brandData.product_identity?.literally || "Product or service",
            competitors,
            families,
            engines,
            countryCode,
            language: resolveLanguage(brandData.target_language),
            maxPrompts: bound.length,
            prompts: bound,
        })
        await admin.from("ai_probe_runs").update({ trigger_run_id: handle.id }).eq("id", run.id)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await admin
            .from("ai_probe_runs")
            .update({ status: "failed", failure_reason: `Could not enqueue: ${message}`, completed_at: new Date().toISOString() })
            .eq("id", run.id)
        await admin
            .from("engine_weeks")
            .update({ state: "failed", failure_reason: `Could not queue the measurement: ${message}`, updated_at: new Date().toISOString() })
            .eq("id", week.id)
        await closeAudit("queue_failed", message)
        throw new EngineStartError("The measurement could not be queued.", 500)
    }

    return { weekId: week.id, runId: run.id, alreadyRunning: false }
}
