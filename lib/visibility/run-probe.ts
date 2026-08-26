/**
 * Runs one AI-visibility probe end to end and preserves what it finds.
 *
 *     confirmed families
 *       -> buyer prompts        (prompt-builder.ts)
 *       -> answer engines       (engines.ts)
 *       -> counted facts        (answer-parser.ts)
 *       -> gaps                 (gap-mapper.ts)
 *       -> site-aware proposals (after the immutable measurement completes)
 *
 * The failure posture is inherited from `assembly.ts` and is the most important
 * thing in this file: **an engine that breaks must never be indistinguishable
 * from an engine that answered without naming the brand.** The first is a
 * broken key; the second is the product's entire finding. Conflating them
 * reports "you are invisible everywhere" to a customer whose real problem is a
 * missing environment variable, which is the most expensive way to be wrong
 * this product can be.
 */

import { createAdminClient } from "@/utils/supabase/admin"
import { discoverCompetitors } from "@/lib/audit/competitor-scanner"
import { mergeUserFirstCompetitors } from "@/lib/audit/merge-competitors"
import { failAuditRun } from "@/lib/audit/run-guards"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import { extractSearchPrefs } from "@/lib/tavily-search"
import { mapWithConcurrency } from "@/lib/harvest/types"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import type { ArticleCluster } from "@/lib/harvest/cluster-types"
import {
    askApiEngine,
    cloroConfigured,
    configuredEngines,
    ENGINE_SPECS,
    EngineError,
    estimateCredits,
    pollCloroTask,
    submitCloroTask,
    type AiEngine,
    type ScrapedAnswer,
} from "./engines"
import { parseAnswer, type ParsedAnswer, type ProbeCompetitor } from "./answer-parser"
import { mergeCapabilityContracts } from "./capability-binding"
import {
    summarisePrompt,
    summariseRun,
    toGapItems,
    type ProbedPrompt,
    type PromptOutcome,
    type RunSummary,
} from "./gap-mapper"
import { buildBuyerPrompts, DEFAULT_PROMPTS_PER_RUN } from "./prompt-builder"
import {
    encodeProbeFailureDetail,
    probeFailureCopy,
    type ProbeFailureCode,
} from "./failure-copy"
import { reconcileContentOpportunities } from "./opportunity-reconciliation"
import { deriveVisibilitySummaryV2 } from "./visibility-summary"
import { buildActionProposalsForRun } from "./action-proposal-planner"

/**
 * Cloro is a queue, not a synchronous API, so the run is two phases: submit
 * everything, then poll everything. Submitting 80 tasks takes seconds and lets
 * all of them run in Cloro's queue at once; the old one-at-a-time
 * submit-and-wait would have serialised an 80-job run into hours.
 */
const SUBMIT_CONCURRENCY = 8
const POLL_CONCURRENCY = 12
/** API-surface fallback only — provider rate limits are much tighter. */
const API_CONCURRENCY = 4

export interface EngineLedgerEntry {
    engine: AiEngine
    label: string
    /** consumer_app or api — never blend the two into one number. */
    surface: string
    attempted: number
    succeeded: number
    failed: number
    /** Cloro credits actually consumed. Cloro does not bill failed tasks. */
    creditsUsed: number
    errors: string[]
}
export class ProbeError extends Error {
    constructor(
        message: string,
        readonly reason:
            | "no_engines"
            | "no_scope"
            | "no_prompts"
            | "all_engines_failed"
            | "no_answers"
            | "opportunity_reconciliation_failed",
    ) {
        super(message)
        this.name = "ProbeError"
    }
}

export interface ProbeResult {
    runId: string
    summary: RunSummary
    clusters: ArticleCluster[]
    engineLedger: EngineLedgerEntry[]
    promptBuildErrors: string[]
    creditsUsed: number
    durationMs: number
}

export type ProbePhaseReporter = (phase: string, detail?: string) => Promise<void> | void

export interface RunProbeOptions {
    userId: string
    brandId: string
    auditId?: string | null
    subjectName: string
    subjectDomains: string[]
    subjectType: string
    competitors: ProbeCompetitor[]
    /** ISO-3166 alpha-2 — which country's answers Cloro is asked for. */
    countryCode?: string
    /** ISO-639-1 — the language the buyer questions are written in. */
    language?: string
    engines?: AiEngine[]
    maxPrompts?: number
    /** Pre-built or user-confirmed buyer prompts. If omitted, prompts are built from scope families. */
    prompts?: import("./prompt-builder").BuyerPrompt[]
    /**
     * Reuse a run row the caller already created. The API route inserts the row
     * so it can hand the client an id to poll immediately, then the Trigger task
     * adopts it — without this the client would have nothing to watch until the
     * background job got around to inserting.
     */
    existingRunId?: string
    onPhase?: ProbePhaseReporter
}

/** What the run ended up tracking, and whether that was a choice or a failure. */
export interface CompetitorTracking {
    competitors: ProbeCompetitor[]
    /** Competitors the customer named themselves. */
    supplied: number
    /** Competitors found by discovery and added to the list. */
    discovered: number
    discoveryAttempted: boolean
    /**
     * Discovery ran and produced nothing because it broke — no Tavily key, a
     * failed search, a failed filter. Distinct from "ran and found none",
     * because an empty rival column caused by a missing key must never read as
     * "no competitor was ever named". Same rule the engine ledger enforces one
     * stage later.
     */
    discoveryFailed: boolean
}

/**
 * Fills the tracked competitor list before any answer is parsed.
 *
 * `parseAnswer` counts mentions of the supplied list and nothing else, so this
 * list is the entire rival column. Before the pivot the harvest filled it at
 * its `competitor_discovery` phase; when onboarding stopped running the harvest
 * the only remaining source was whatever the customer typed on the extras
 * screen — and typing nothing silently disabled the product's main finding.
 *
 * The customer's own names always come first: `mergeUserFirstCompetitors` keeps
 * them and discovery only fills the remaining slots.
 */
async function ensureTrackedCompetitors(
    supabase: any,
    options: RunProbeOptions,
    report: ProbePhaseReporter,
): Promise<CompetitorTracking> {
    const supplied = options.competitors
    const slots = HARVEST_POLICY.maxCompetitors - supplied.length
    if (slots <= 0) {
        return {
            competitors: supplied,
            supplied: supplied.length,
            discovered: 0,
            discoveryAttempted: false,
            discoveryFailed: false,
        }
    }

    await report(
        "finding_rivals",
        supplied.length > 0
            ? `${supplied.length} named by you, looking for up to ${slots} more`
            : `looking for up to ${slots}`,
    )

    const { data: brand } = await supabase
        .from("brand_details")
        .select("brand_data, website_url")
        .eq("id", options.brandId)
        .maybeSingle()
    const brandData = brand?.brand_data
    if (!brandData?.product_name) {
        // Nothing to search with. Not a failure of discovery — it never ran.
        return {
            competitors: supplied,
            supplied: supplied.length,
            discovered: 0,
            discoveryAttempted: false,
            discoveryFailed: false,
        }
    }

    let attempted = 0
    let succeeded = 0
    let discovered: Array<{ name: string; url: string; domain: string }> = []
    try {
        discovered = await discoverCompetitors(
            brandData,
            slots,
            extractSearchPrefs(brandData),
            (call) => {
                attempted += 1
                if (call.succeeded) succeeded += 1
            },
            // Exact self-exclusion. Without it the scanner falls back to a
            // substring guess against the product name, which both misses the
            // customer's own site when the domain differs from the brand and
            // drops innocent rivals whose domain contains it.
            brand?.website_url ?? undefined,
        )
    } catch (error) {
        console.error("[Probe] Competitor discovery threw:", error)
    }

    const merged = mergeUserFirstCompetitors(
        supplied.map((competitor) => ({
            name: competitor.name,
            url: competitor.domain ? `https://${competitor.domain}` : competitor.name,
            domain: competitor.domain ?? undefined,
        })),
        discovered,
        HARVEST_POLICY.maxCompetitors,
    )

    const competitors: ProbeCompetitor[] = merged.map((competitor) => ({
        id: competitor.domain || competitor.url || competitor.name,
        name: competitor.name,
        domain: competitor.domain ?? null,
    }))

    const added = Math.max(0, competitors.length - supplied.length)
    if (added > 0) {
        // Persisted so the report, the next probe and the dashboard all name the
        // same rivals. The customer's entries survive: `merged` is user-first.
        await supabase
            .from("brand_details")
            .update({
                discovered_competitors: merged.map(({ name, url }) => ({ name, url })),
                updated_at: new Date().toISOString(),
            })
            .eq("id", options.brandId)
            .eq("user_id", options.userId)
    }

    await report(
        "finding_rivals",
        `${competitors.length} tracked (${added} discovered)`,
    )

    return {
        competitors,
        supplied: supplied.length,
        discovered: added,
        discoveryAttempted: true,
        discoveryFailed: attempted > 0 && succeeded === 0,
    }
}

/**
 * Executes the probe.
 *
 * Persists a run row before any engine is called, so a probe that dies halfway
 * leaves a `running` record with its ledger rather than vanishing — the same
 * reason `topical_audits` is written before the harvest starts.
 */
export async function runVisibilityProbe(
    families: AuditScopeFamily[],
    options: RunProbeOptions,
): Promise<ProbeResult> {
    const startedAt = Date.now()
    const supabase = createAdminClient() as any
    const report = async (phase: string, detail?: string) => {
        console.log(`[Probe] ${phase}${detail ? `: ${detail}` : ""}`)
        await options.onPhase?.(phase, detail)
    }

    if (families.length === 0) {
        throw new ProbeError(
            "The audit has no confirmed business scope to build prompts from.",
            "no_scope",
        )
    }

    const engines = options.engines?.length ? options.engines : configuredEngines()
    if (engines.length === 0) {
        throw new ProbeError(
            "No answer engine is configured. Set CLORO_API_KEY to measure the consumer surfaces (ChatGPT and Google AI Mode).",
            "no_engines",
        )
    }

    // No `public_token`. A probe run is customer data read behind login; it has
    // no unauthenticated share URL, so there is nothing for a token to address.
    let run: { id: string }
    if (options.existingRunId) {
        const { data: existing, error: existingError } = await supabase
            .from("ai_probe_runs")
            .update({ status: "running", updated_at: new Date().toISOString() })
            .eq("id", options.existingRunId)
            .select("id")
            .single()
        if (existingError || !existing) {
            throw new Error(
                `Could not adopt probe run ${options.existingRunId}: ${existingError?.message ?? "not found"}`,
            )
        }
        run = existing
    } else {
        const { data: created, error: runError } = await supabase
            .from("ai_probe_runs")
            .insert({
                user_id: options.userId,
                brand_id: options.brandId,
                audit_id: options.auditId ?? null,
                subject_name: options.subjectName,
                subject_domains: options.subjectDomains,
                competitors: options.competitors,
                engines,
                country_code: options.countryCode ?? null,
                status: "running",
                public_token: null,
            })
            .select("id")
            .single()
        if (runError || !created) {
            throw new Error(`Could not open a probe run: ${runError?.message ?? "unknown"}`)
        }
        run = created
    }
    const runId: string = run.id

    try {
        // ── 0. Rivals ───────────────────────────────────────────────────────
        // Runs first, and it is not optional. `parseAnswer` counts mentions of
        // the *supplied* list only — there is no open-ended entity extraction
        // anywhere in this pipeline, by design, because "Notion was named and
        // you weren't" is checkable and "the model thinks it saw a brand" is
        // not. The consequence is that an empty list makes the entire rival
        // column impossible: the report can say you are absent and can never
        // say who took your place, which is the finding customers actually buy.
        //
        // It runs before prompt building so discovered names join `entityTokens`
        // and a generated prompt cannot accidentally name a competitor.
        const competitorTracking = await ensureTrackedCompetitors(
            supabase,
            options,
            report,
        )
        const competitors = competitorTracking.competitors

        // ── 1. Prompts ──────────────────────────────────────────────────────
        await report("building_prompts", `${families.length} confirmed areas`)
        // Only the customer's own identity is contraband. Competitor names are
        // material: a buyer asking for a tool almost always frames it against
        // one they already use, and banning every rival name is what left the
        // generator writing abstract category questions.
        const subjectTokens = [options.subjectName, ...options.subjectDomains].filter(
            Boolean,
        )

        let promptsToUse: import("./prompt-builder").BuyerPrompt[] = []
        let promptBuildErrors: string[] = []
        /**
         * The generation funnel, frozen onto the run.
         *
         * Null when the caller supplied a confirmed set, because then no
         * generation happened and a row of zeros would read as a failed build
         * rather than a build that never ran.
         */
        let promptBuild: import("./prompt-builder").PromptBuildReport | null = null

        if (options.prompts && options.prompts.length > 0) {
            promptsToUse = options.prompts
        } else {
            const { data: brandRow } = await supabase
                .from("brand_details")
                .select("brand_data")
                .eq("id", options.brandId)
                .maybeSingle()
            const persona = (brandRow?.brand_data ?? {}) as {
                category?: string
                core_features?: string[]
                audience?: { primary?: string; psychology?: string }
                enemy?: string
                product_identity?: { not?: string }
                uvp?: string[]
                pricing?: string[]
            }

            const built = await buildBuyerPrompts(families, {
                subjectType: options.subjectType,
                language: options.language,
                subjectTokens,
                // Rivals are a rejection list, never context. Naming one in a
                // question asserts a capability we have no verified fact about,
                // and these questions are durable — a false premise persists for
                // the life of the subscription.
                rivalBrands: competitors.flatMap((competitor) =>
                    [competitor.name, competitor.domain].filter(
                        (value): value is string => Boolean(value),
                    ),
                ),
                // Everything a person would hand a model to write these by
                // hand: what it is, what it does, who has the problem. All of it
                // background — the templates that turned these into every
                // question are gone.
                context: {
                    category: persona.category,
                    coreFeatures: persona.core_features,
                    audience: persona.audience?.primary,
                    audiencePsychology: persona.audience?.psychology,
                    enemy: persona.enemy,
                    notThis: persona.product_identity?.not,
                    uvp: persona.uvp,
                    pricing: persona.pricing,
                },
                maxPrompts: options.maxPrompts ?? DEFAULT_PROMPTS_PER_RUN,
            })
            promptsToUse = built.prompts
            promptBuildErrors = built.report.errors
            promptBuild = built.report
            // Logged as well as persisted: on a run that dies before completion
            // the summary is never written, and that is exactly the run whose
            // funnel someone needs to read.
            console.log("[Probe] prompt funnel", JSON.stringify(promptBuild))
            await report(
                "building_prompts",
                `model returned ${promptBuild.modelReturned}, ` +
                    `${promptBuild.generatedCandidates} passed local gates, ` +
                    `${promptBuild.survivors} survived the critic`,
            )
        }

        if (promptsToUse.length === 0) {
            throw new ProbeError(
                `No buyer prompts could be built from the confirmed scope.${promptBuildErrors.length ? ` ${promptBuildErrors.join("; ")}` : ""}`,
                "no_prompts",
            )
        }

        await report(
            "estimated_cost",
            `~${estimateCredits(promptsToUse.length, engines)} Cloro credits`,
        )

        const promptRows = promptsToUse.map((prompt) => ({
            run_id: runId,
            user_id: options.userId,
            tracked_prompt_id: prompt.trackedPromptId ?? null,
            scope_family_id: prompt.scopeFamilyId,
            prompt: prompt.text,
            prompt_norm: prompt.textNorm,
            intent: prompt.intent,
            article_type: prompt.articleType,
            // Frozen onto the run. A question reclassified next month must not
            // retroactively move an old run between denominators — the run
            // reports the class it was actually measured under.
            selection_class: prompt.selectionClass,
            source_seed: prompt.sourceSeed,
        }))
        const { data: insertedPrompts, error: promptError } = await supabase
            .from("ai_probe_prompts")
            .insert(promptRows)
            .select(
                "id, tracked_prompt_id, prompt, prompt_norm, scope_family_id, intent, article_type, source_seed, selection_class",
            )
        if (promptError || !insertedPrompts) {
            throw new Error(`Could not persist prompts: ${promptError?.message ?? "unknown"}`)
        }

        // ── 2. Probe every prompt against every engine ──────────────────────
        await report(
            "probing_engines",
            `${insertedPrompts.length} prompts x ${engines.length} engines`,
        )

        type Job = { prompt: (typeof insertedPrompts)[number]; engine: AiEngine }
        const jobs: Job[] = []
        for (const prompt of insertedPrompts) {
            for (const engine of engines) jobs.push({ prompt, engine })
        }

        const ledger = new Map<AiEngine, EngineLedgerEntry>(
            engines.map((engine) => [
                engine,
                {
                    engine,
                    label: ENGINE_SPECS[engine].label,
                    surface: ENGINE_SPECS[engine].surface,
                    attempted: 0,
                    succeeded: 0,
                    failed: 0,
                    creditsUsed: 0,
                    errors: [],
                },
            ]),
        )
        const noteFailure = (engine: AiEngine, error: unknown) => {
            const entry = ledger.get(engine)!
            entry.failed++
            if (entry.errors.length < 3) {
                entry.errors.push(
                    error instanceof Error ? error.message : String(error),
                )
            }
        }

        const cloroJobs = jobs.filter(
            (job) => ENGINE_SPECS[job.engine].surface === "consumer_app",
        )
        const apiJobs = jobs.filter((job) => ENGINE_SPECS[job.engine].surface === "api")

        const answers: Array<{ job: Job; answer: ScrapedAnswer; taskId: string | null }> = []

        // Phase A: submit every Cloro task. Fast, and it puts the whole run into
        // Cloro's queue at once instead of waiting on each answer in turn.
        if (cloroJobs.length > 0) {
            if (!cloroConfigured()) {
                throw new ProbeError(
                    "CLORO_API_KEY is not configured, so the consumer surfaces cannot be measured.",
                    "no_engines",
                )
            }

            const submitted = await mapWithConcurrency(
                cloroJobs,
                SUBMIT_CONCURRENCY,
                async (job) => {
                    ledger.get(job.engine)!.attempted++
                    try {
                        const taskId = await submitCloroTask(
                            job.prompt.prompt,
                            job.engine,
                            { countryCode: options.countryCode },
                        )
                        return { job, taskId }
                    } catch (error) {
                        noteFailure(job.engine, error)
                        return null
                    }
                },
            )

            const queued = submitted.filter(
                (item): item is { job: Job; taskId: string } => item !== null,
            )
            await report("awaiting_answers", `${queued.length} queued`)

            // Phase B: poll. Each task carries its own deadline, so one slow
            // surface cannot hold the whole run past the task budget.
            const polled = await mapWithConcurrency(
                queued,
                POLL_CONCURRENCY,
                async ({ job, taskId }) => {
                    try {
                        const answer = await pollCloroTask(taskId, job.engine)
                        if (!answer.text.trim()) {
                            throw new EngineError(job.engine, "empty answer text")
                        }
                        const entry = ledger.get(job.engine)!
                        entry.succeeded++
                        // Cloro bills only successful extractions, so credits
                        // are counted here rather than at submit.
                        entry.creditsUsed += ENGINE_SPECS[job.engine].credits
                        return { job, answer, taskId }
                    } catch (error) {
                        noteFailure(job.engine, error)
                        return null
                    }
                },
            )
            for (const item of polled) if (item) answers.push(item)
        }

        // API-surface fallback. Synchronous, tighter concurrency, and every
        // answer it produces is stored with surface = "api".
        if (apiJobs.length > 0) {
            const apiAnswers = await mapWithConcurrency(
                apiJobs,
                API_CONCURRENCY,
                async (job) => {
                    ledger.get(job.engine)!.attempted++
                    try {
                        const answer = await askApiEngine(job.engine, job.prompt.prompt, {
                            countryCode: options.countryCode,
                        })
                        if (!answer.text.trim()) {
                            throw new EngineError(job.engine, "empty answer text")
                        }
                        ledger.get(job.engine)!.succeeded++
                        return { job, answer, taskId: null }
                    } catch (error) {
                        noteFailure(job.engine, error)
                        return null
                    }
                },
            )
            for (const item of apiAnswers) if (item) answers.push(item)
        }

        const engineLedger = [...ledger.values()]

        // Every request failing is a configuration or vendor failure, not a
        // finding. Refuse rather than report a fabricated invisibility.
        const totalAttempted = engineLedger.reduce((sum, entry) => sum + entry.attempted, 0)
        const totalFailed = engineLedger.reduce((sum, entry) => sum + entry.failed, 0)
        if (totalAttempted > 0 && totalFailed === totalAttempted) {
            throw new ProbeError(
                `Every answer-engine request failed: ${engineLedger
                    .map((entry) => `${entry.engine} ${entry.failed}/${entry.attempted}`)
                    .join(", ")}`,
                "all_engines_failed",
            )
        }

        const successful = answers
        if (successful.length === 0) {
            throw new ProbeError("No answer engine returned a usable answer.", "no_answers")
        }

        // ── 3. Parse into counted facts ─────────────────────────────────────
        await report("reading_answers", `${successful.length} answers`)

        const subject = {
            brandName: options.subjectName,
            domains: options.subjectDomains,
        }
        const byPrompt = new Map<string, ProbedPrompt>()
        const citationsByPromptEngine = new Map<
            string,
            Map<AiEngine, Array<{ url: string; title?: string }>>
        >()
        const resultRows: any[] = []

        for (const { job, answer, taskId } of successful) {
            const parsed: ParsedAnswer = parseAnswer(answer, subject, competitors)

            let entry = byPrompt.get(job.prompt.id)
            if (!entry) {
                entry = {
                    id: job.prompt.id,
                    text: job.prompt.prompt,
                    scopeFamilyId: job.prompt.scope_family_id,
                    intent: job.prompt.intent,
                    articleType: job.prompt.article_type,
                    sourceSeed: job.prompt.source_seed,
                    answers: [],
                }
                byPrompt.set(job.prompt.id, entry)
                citationsByPromptEngine.set(job.prompt.id, new Map())
            }
            entry.answers.push({
                engine: job.engine,
                model: answer.reportedModel,
                answerText: answer.text,
                parsed,
                searchQueries: answer.searchQueries,
            })
            citationsByPromptEngine.get(job.prompt.id)!.set(job.engine, answer.citations)

            resultRows.push({
                prompt_id: job.prompt.id,
                run_id: runId,
                user_id: options.userId,
                engine: job.engine,
                // What the surface said it used, not what we asked for. A
                // consumer surface silently changing model is exactly the kind
                // of drift a stored trend has to be able to explain.
                model: answer.reportedModel,
                surface: ENGINE_SPECS[job.engine].surface,
                cloro_task_id: taskId,
                credits_used: ENGINE_SPECS[job.engine].credits,
                // Stored in full. This is the provenance record — a truncated
                // answer is an unverifiable gap.
                answer_text: answer.text,
                citations: answer.citations,
                search_queries: answer.searchQueries,
                mention_count: parsed.mentionCount,
                citation_count: parsed.citationCount,
                total_citations: parsed.totalCitations,
                mention_position: parsed.mentionPosition,
                mentioned_entity_count: parsed.mentionedEntityCount,
                competitor_mentions: parsed.competitorMentions,
            })
        }

        // Chunked: a 60-prompt run across several engines carries full answer
        // text, comfortably past a single request's practical size.
        for (let i = 0; i < resultRows.length; i += 40) {
            const { error } = await supabase
                .from("ai_probe_results")
                .insert(resultRows.slice(i, i + 40))
            if (error) throw new Error(`Could not persist answers: ${error.message}`)
        }

        const prompts = [...byPrompt.values()]
        const outcomes = new Map<string, PromptOutcome>()
        for (const prompt of prompts) {
            outcomes.set(
                prompt.id,
                summarisePrompt(
                    prompt,
                    citationsByPromptEngine.get(prompt.id)!,
                ),
            )
        }

        for (const outcome of outcomes.values()) {
            const { error: outcomeError } = await supabase
                .from("ai_probe_prompts")
                .update({
                    answers_total: outcome.answersTotal,
                    answers_present: outcome.answersPresent,
                    mean_mention_position: outcome.meanMentionPosition,
                    verdict: outcome.verdict,
                })
                .eq("id", outcome.promptId)
            if (outcomeError) {
                throw new Error(
                    `Could not persist prompt outcome ${outcome.promptId}: ${outcomeError.message}`,
                )
            }
        }

        // ── 4. Observations → one durable opportunity per tracked question ─
        // This happens before clustering because the recurring backlog is the
        // product state. Editorial clusters are one possible production input;
        // they are never allowed to become a floor that deletes real findings.
        await report("reconciling_opportunities", `${outcomes.size} observed questions`)
        try {
            await reconcileContentOpportunities(
                supabase,
                runId,
                insertedPrompts,
                outcomes,
            )
        } catch (error) {
            throw new ProbeError(
                error instanceof Error
                    ? error.message
                    : "The recurring opportunity backlog could not be updated.",
                "opportunity_reconciliation_failed",
            )
        }

        const summary = Object.assign(
            summariseRun([...outcomes.values()], prompts),
            deriveVisibilitySummaryV2({
                prompts: prompts.map((prompt) => ({
                    id: prompt.id,
                    prompt: prompt.text,
                })),
                results: resultRows.map((result) => ({
                    promptId: result.prompt_id,
                    mentionCount: result.mention_count,
                    citationCount: result.citation_count,
                    mentionPosition: result.mention_position,
                    competitorMentions: result.competitor_mentions,
                })),
                competitors,
            }),
        )
        // Attached here rather than inside summariseRun: it is a fact about how
        // the rival list was assembled, not about the answers. Without it an
        // empty leaderboard is unreadable — "nobody beat you" and "we had
        // nobody to look for" render identically.
        summary.competitorTracking = {
            tracked: competitors.length,
            supplied: competitorTracking.supplied,
            discovered: competitorTracking.discovered,
            discoveryAttempted: competitorTracking.discoveryAttempted,
            discoveryFailed: competitorTracking.discoveryFailed,
        }

        // ── 5. Persist evidence; page-aware proposals are built only after
        // the run is immutable. Legacy editorial clustering is intentionally
        // absent: it was the source of duplicate, unreviewed article plans.
        await report("freezing_evidence", `${summary.absentPromptCount + summary.outrankedPromptCount} losing prompts`)

        const gaps = toGapItems(prompts, outcomes, runId, {
            capabilityContract: mergeCapabilityContracts(
                families.map((family) => family.capabilityContract),
            ),
        })
        const clusters: ArticleCluster[] = []

        // ── 6. Relational persistence to topical_audits (if auditId provided)
        if (options.auditId) {
            try {
                const clusterRows: never[] = []
                const articleRows: never[] = []

                const queryRows = gaps.map((gap) => ({
                    id: gap.queryId,
                    scope_family_id: gap.scopeFamilyId,
                    query: gap.query,
                    query_norm: gap.query.trim().toLowerCase(),
                    source: "ai_answer",
                    source_url: gap.sourceUrl,
                    source_seed: prompts.find((p) => p.id === gap.queryId)?.sourceSeed || gap.query,
                    observed_value: outcomes.get(gap.queryId)?.verdict || "absent",
                    source_context: gap.sourceContext,
                    intent_binding: gap.intentBinding,
                    observed_at: new Date().toISOString(),
                    embedding: null,
                    status: "gap",
                    covered_by_url: null,
                    covered_by_title: null,
                    coverage_similarity: 0,
                    competitor_matches: gap.competitors || [],
                }))

                // No losing prompt is the best possible result and the one that
                // has nothing to deliver — `finalize_audit_run` refuses an empty
                // pool. The audit row must still be closed, or it stays
                // `running` and blocks every future audit for this brand until
                // the 40-minute sweep. Said plainly, because "failed" here is a
                // storage state, not a verdict on the run.
                if (queryRows.length === 0) {
                    await failAuditRun(
                        supabase,
                        options.auditId,
                        "no_visibility_gaps",
                        "Nothing went wrong: every confirmed question already named you, so there was no missing coverage to plan articles from. The full answer record is on the visibility report.",
                    )
                } else {
                    const { error: finalizeError } = await supabase.rpc("finalize_audit_run", {
                        p_audit_id: options.auditId,
                        p_query_rows: queryRows,
                        p_cluster_rows: clusterRows,
                        p_article_rows: articleRows,
                        p_statistics: {
                            pool_size: queryRows.length,
                            article_count: articleRows.length,
                            cluster_count: clusterRows.length,
                            authority_score:
                                summary.answerCount > 0
                                    ? Math.round((summary.presentAnswerCount / summary.answerCount) * 100)
                                    : 0,
                            competitors_scanned: competitors.length,
                            user_pages_scanned: 0,
                            site_page_snapshot: [],
                        },
                        p_result_hash: `ai-probe-${runId}`,
                        p_policy_version: "ai-probe-v1.0.0",
                        p_source_call_ledger: engineLedger.map((e) => ({
                            source: e.engine,
                            attempted: e.attempted,
                            succeeded: e.succeeded,
                            failed: e.failed,
                            cached: 0,
                        })),
                    })

                    if (finalizeError) {
                        // This used to warn and continue, which produced the
                        // worst available outcome: the probe reported success,
                        // the dashboard rendered a cluster plan, and query_pool,
                        // audit_clusters and planned_articles were empty — so
                        // /content-plan offered to ship articles that did not
                        // exist. The measurement is still real and still on the
                        // report; the *plan* is what failed, and the audit row
                        // now says so.
                        console.error(
                            `[Probe] Could not finalize audit ${options.auditId}:`,
                            finalizeError.message,
                        )
                        await failAuditRun(
                            supabase,
                            options.auditId,
                            "finalize_failed",
                            `The answers were collected and saved, but the delivery plan could not be written: ${finalizeError.message}`,
                        )
                    }
                }
            } catch (persistErr) {
                const message =
                    persistErr instanceof Error ? persistErr.message : String(persistErr)
                console.error(
                    `[Probe] Error persisting audit tables for ${options.auditId}:`,
                    persistErr,
                )
                await failAuditRun(
                    supabase,
                    options.auditId,
                    "persist_failed",
                    `The answers were collected and saved, but the delivery plan could not be written: ${message}`,
                )
            }
        }

        const durationMs = Date.now() - startedAt
        const { error: completionError } = await supabase
            .from("ai_probe_runs")
            .update({
                status: "completed",
                // The list actually used, which is not the list the route
                // inserted when discovery added to it.
                competitors,
                prompt_count: summary.promptCount,
                answer_count: summary.answerCount,
                present_answer_count: summary.presentAnswerCount,
                gap_prompt_count: summary.absentPromptCount + summary.outrankedPromptCount,
                engine_ledger: engineLedger,
                credits_used: engineLedger.reduce(
                    (total, entry) => total + entry.creditsUsed,
                    0,
                ),
                // The funnel rides inside the summary rather than in a new
                // column: it is run-scoped, frozen at completion, and read by
                // operators exactly like every other number in here. Adding a
                // column would need a migration applied by hand for a field
                // whose only consumer is a diagnosis.
                summary: { ...summary, promptBuild },
                // Frozen with the run. The report reads this rather than
                // re-clustering, so the plan a customer was shown is the plan
                // that stays on screen.
                clusters: clusters.map((cluster) => ({
                    name: cluster.name,
                    scopeFamilyId: cluster.scopeFamilyId,
                    priority: cluster.priority,
                    articles: cluster.articles.map((article) => ({
                        title: article.title,
                        mainKeyword: article.mainKeyword,
                        articleType: article.articleType,
                        sourceQueryIds: article.sourceQueryIds,
                        articleContract: article.articleContract,
                        contractVersion: article.articleContract?.version,
                    })),
                })),
                completed_at: new Date().toISOString(),
                duration_ms: durationMs,
            })
            .eq("id", runId)
        if (completionError) {
            throw new Error(`Could not complete visibility run: ${completionError.message}`)
        }

        // The status update moves the bound cycle to awaiting_input through a
        // database trigger. Planning then inventories the real site and writes
        // reviewable grouped proposals; it never selects production work.
        try {
            await report("planning_actions", "checking the sitemap before proposing work")
            await buildActionProposalsForRun({ supabase, runId })
        } catch (planningError) {
            console.error(`[Probe] Action planning failed for ${runId}:`, planningError)
            await supabase
                .from("subscription_cycles")
                .update({ failure_code: "action_planning_failed" })
                .eq("measurement_run_id", runId)
                .eq("state", "awaiting_input")
        }

        return {
            runId,
            summary,
            clusters,
            engineLedger,
            promptBuildErrors,
            creditsUsed: engineLedger.reduce(
                (total, entry) => total + entry.creditsUsed,
                0,
            ),
            durationMs,
        }
    } catch (error) {
        // `failure_reason` is rendered verbatim on the waiting screen, so it
        // carries customer copy and the exception text goes to `phase_detail`
        // and the log. The first live run showed a founder
        // "CLORO_API_KEY is not configured" — an internal secret's name, on the
        // screen a paying customer would have seen.
        const detail = error instanceof Error ? error.message : String(error)
        const code: ProbeFailureCode =
            error instanceof ProbeError ? error.reason : "unknown"
        console.error(`[Probe] Run ${runId} failed (${code}):`, detail)
        await supabase
            .from("ai_probe_runs")
            .update({
                status: "failed",
                failure_reason: probeFailureCopy(code).message,
                phase: "failed",
                phase_detail: encodeProbeFailureDetail(code, detail),
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt,
            })
            .eq("id", runId)
        // Close the audit this probe was writing into. `create_customer_audit_with_scope`
        // refuses to open a second run while one is `running`, so a dead probe
        // would otherwise lock the brand out of every audit path — the probe and
        // the Google harvest both — until the stale sweep caught it 40 minutes
        // later. Guarded on `running`, so re-probing an already-finalized audit
        // cannot reopen and destroy it.
        if (options.auditId) {
            await failAuditRun(supabase, options.auditId, code, detail)
        }
        throw error
    }
}
