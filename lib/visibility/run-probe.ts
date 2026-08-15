/**
 * Runs one AI-visibility probe end to end and clusters what it finds.
 *
 *     confirmed families
 *       -> buyer prompts        (prompt-builder.ts)
 *       -> answer engines       (engines.ts)
 *       -> counted facts        (answer-parser.ts)
 *       -> gaps                 (gap-mapper.ts)
 *       -> clusters             (lib/harvest/clusterer.ts, unchanged)
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
import { generateEmbedding } from "@/lib/gemini-embedding"
import { mapWithConcurrency } from "@/lib/harvest/types"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import {
    collapseToArticles,
    groupIntoClusters,
    nameClusters,
    splitOversized,
    titleArticles,
} from "@/lib/harvest/clusterer"
import { absorbOrphanedUnits } from "@/lib/harvest/absorption"
import type { ArticleCluster, ArticleUnit } from "@/lib/harvest/cluster-types"
import {
    askEngine,
    configuredEngines,
    ENGINE_MODELS,
    EngineError,
    type AiEngine,
} from "./engines"
import { parseAnswer, type ParsedAnswer, type ProbeCompetitor } from "./answer-parser"
import {
    summarisePrompt,
    summariseRun,
    toGapItems,
    type ProbedPrompt,
    type PromptOutcome,
    type RunSummary,
} from "./gap-mapper"
import { buildBuyerPrompts, MAX_PROMPTS_PER_RUN } from "./prompt-builder"

/** Concurrent engine calls in flight. Engines rate-limit; four is polite. */
const PROBE_CONCURRENCY = 4
const EMBEDDING_CONCURRENCY = 8

export interface EngineLedgerEntry {
    engine: AiEngine
    model: string
    attempted: number
    succeeded: number
    failed: number
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
            | "no_answers",
    ) {
        super(message)
        this.name = "ProbeError"
    }
}

export interface ProbeResult {
    runId: string
    publicToken: string
    summary: RunSummary
    clusters: ArticleCluster[]
    engineLedger: EngineLedgerEntry[]
    promptBuildErrors: string[]
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
    countryCode?: string
    engines?: AiEngine[]
    maxPrompts?: number
    onPhase?: ProbePhaseReporter
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
            "No answer engine is configured. Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY or PERPLEXITY_API_KEY.",
            "no_engines",
        )
    }

    const { data: run, error: runError } = await supabase
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
        })
        .select("id, public_token")
        .single()
    if (runError || !run) {
        throw new Error(`Could not open a probe run: ${runError?.message ?? "unknown"}`)
    }
    const runId: string = run.id

    try {
        // ── 1. Prompts ──────────────────────────────────────────────────────
        await report("building_prompts", `${families.length} confirmed areas`)
        const entityTokens = [
            options.subjectName,
            ...options.subjectDomains,
            ...options.competitors.map((competitor) => competitor.name),
        ].filter(Boolean)

        const built = await buildBuyerPrompts(families, {
            subjectType: options.subjectType,
            entityTokens,
            maxPrompts: options.maxPrompts ?? MAX_PROMPTS_PER_RUN,
        })
        if (built.prompts.length === 0) {
            throw new ProbeError(
                `No buyer prompts could be built from the confirmed scope. ${built.report.errors.join("; ")}`,
                "no_prompts",
            )
        }

        const promptRows = built.prompts.map((prompt) => ({
            run_id: runId,
            user_id: options.userId,
            scope_family_id: prompt.scopeFamilyId,
            prompt: prompt.text,
            prompt_norm: prompt.textNorm,
            intent: prompt.intent,
            article_type: prompt.articleType,
            source_seed: prompt.sourceSeed,
        }))
        const { data: insertedPrompts, error: promptError } = await supabase
            .from("ai_probe_prompts")
            .insert(promptRows)
            .select("id, prompt, prompt_norm, scope_family_id, intent, article_type, source_seed")
        if (promptError || !insertedPrompts) {
            throw new Error(`Could not persist prompts: ${promptError?.message ?? "unknown"}`)
        }

        // ── 2. Probe every prompt against every engine ──────────────────────
        await report(
            "probing_engines",
            `${insertedPrompts.length} prompts × ${engines.length} engines`,
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
                    model: ENGINE_MODELS[engine],
                    attempted: 0,
                    succeeded: 0,
                    failed: 0,
                    errors: [],
                },
            ]),
        )

        const answered = await mapWithConcurrency(jobs, PROBE_CONCURRENCY, async (job) => {
            const entry = ledger.get(job.engine)!
            entry.attempted++
            try {
                const answer = await askEngine(job.engine, job.prompt.prompt, {
                    countryCode: options.countryCode,
                })
                entry.succeeded++
                return { job, answer }
            } catch (error) {
                entry.failed++
                if (entry.errors.length < 3) {
                    entry.errors.push(
                        error instanceof EngineError
                            ? error.message
                            : String(error instanceof Error ? error.message : error),
                    )
                }
                // Swallowed deliberately: one engine failing on one prompt must
                // not abort the run. The ledger carries the failure, and the
                // hard-failure check below decides whether the run is trustable.
                return null
            }
        })

        const engineLedger = [...ledger.values()]

        // Every engine broken on every attempt is a configuration failure, not
        // a finding. Refuse rather than report a fabricated invisibility.
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

        const successful = answered.filter(
            (item): item is { job: Job; answer: Awaited<ReturnType<typeof askEngine>> } =>
                item !== null,
        )
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
        const citationsByPromptEngine = new Map<string, Map<AiEngine, Array<{ url: string }>>>()
        const resultRows: any[] = []

        for (const { job, answer } of successful) {
            const parsed: ParsedAnswer = parseAnswer(answer, subject, options.competitors)

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
                model: ENGINE_MODELS[job.engine],
                answerText: answer.text,
                parsed,
            })
            citationsByPromptEngine.get(job.prompt.id)!.set(job.engine, answer.citations)

            resultRows.push({
                prompt_id: job.prompt.id,
                run_id: runId,
                user_id: options.userId,
                engine: job.engine,
                model: ENGINE_MODELS[job.engine],
                // Stored in full. This is the provenance record — a truncated
                // answer is an unverifiable gap.
                answer_text: answer.text,
                citations: answer.citations,
                mention_count: parsed.mentionCount,
                citation_count: parsed.citationCount,
                total_citations: parsed.totalCitations,
                mention_position: parsed.mentionPosition,
                mentioned_entity_count: parsed.mentionedEntityCount,
                competitor_mentions: parsed.competitorMentions,
            })
        }

        // Chunked: a 60-prompt × 4-engine run is 240 rows carrying full answer
        // text, which is comfortably past a single request's practical size.
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
                summarisePrompt(prompt, citationsByPromptEngine.get(prompt.id)!),
            )
        }

        for (const outcome of outcomes.values()) {
            await supabase
                .from("ai_probe_prompts")
                .update({
                    answers_total: outcome.answersTotal,
                    answers_present: outcome.answersPresent,
                    mean_mention_position: outcome.meanMentionPosition,
                    verdict: outcome.verdict,
                })
                .eq("id", outcome.promptId)
        }

        const summary = summariseRun([...outcomes.values()])

        // ── 4. Gaps → the existing clusterer, unchanged ─────────────────────
        await report("clustering", `${summary.absentPromptCount + summary.outrankedPromptCount} losing prompts`)

        const gaps = toGapItems(prompts, outcomes, runId)
        const clusters = await clusterVisibilityGaps(gaps, families)

        const durationMs = Date.now() - startedAt
        await supabase
            .from("ai_probe_runs")
            .update({
                status: "completed",
                prompt_count: summary.promptCount,
                answer_count: summary.answerCount,
                present_answer_count: summary.presentAnswerCount,
                gap_prompt_count: summary.absentPromptCount + summary.outrankedPromptCount,
                engine_ledger: engineLedger,
                summary,
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
                    })),
                })),
                completed_at: new Date().toISOString(),
                duration_ms: durationMs,
            })
            .eq("id", runId)

        return {
            runId,
            publicToken: run.public_token,
            summary,
            clusters,
            engineLedger,
            promptBuildErrors: built.report.errors,
            durationMs,
        }
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        await supabase
            .from("ai_probe_runs")
            .update({
                status: "failed",
                failure_reason: reason.slice(0, 1000),
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt,
            })
            .eq("id", runId)
        throw error
    }
}

/**
 * Groups visibility gaps into clusters using the Google-harvest machinery.
 *
 * Nothing here is new. That is the point of the whole design: the clusterer
 * takes `GapItem[]` and does not care whether the gap came from a SERP or from
 * ChatGPT declining to mention you.
 */
export async function clusterVisibilityGaps(
    gaps: ReturnType<typeof toGapItems>,
    families: AuditScopeFamily[],
): Promise<ArticleCluster[]> {
    if (gaps.length === 0) return []

    const embeddings = await mapWithConcurrency(gaps, EMBEDDING_CONCURRENCY, (gap) =>
        generateEmbedding(gap.query, "RETRIEVAL_QUERY"),
    )
    const embeddingMap = new Map<string, number[]>()
    gaps.forEach((gap, index) => {
        const embedding = embeddings[index]
        if (embedding) embeddingMap.set(gap.queryId, embedding)
    })

    let units: ArticleUnit[] = []
    for (const family of families) {
        const familyGaps = gaps.filter((gap) => gap.scopeFamilyId === family.id)
        if (familyGaps.length === 0) continue
        units = units.concat(collapseToArticles(familyGaps, embeddingMap))
    }
    if (units.length === 0) return []

    units = await titleArticles(units, families)

    // Sub-areas roll into their parent's pool, matching assembly.ts — thin
    // child demand and parent demand clear the cluster floor together.
    const childIdsByParent = new Map<string, string[]>()
    for (const family of families) {
        if (!family.parentScopeFamilyId) continue
        const siblings = childIdsByParent.get(family.parentScopeFamilyId) || []
        siblings.push(family.id)
        childIdsByParent.set(family.parentScopeFamilyId, siblings)
    }
    const parentByFamilyId = new Map<string, string>()
    for (const family of families) {
        if (family.parentScopeFamilyId) {
            parentByFamilyId.set(family.id, family.parentScopeFamilyId)
        }
    }

    const roots = families.filter((family) => !family.parentScopeFamilyId)
    const groupings = roots.map((root) => {
        const childIds = new Set(childIdsByParent.get(root.id) || [])
        const rolled = units
            .filter((unit) => unit.scopeFamilyId === root.id || childIds.has(unit.scopeFamilyId))
            .map((unit) =>
                unit.scopeFamilyId === root.id
                    ? unit
                    : {
                          ...unit,
                          originScopeFamilyId: unit.originScopeFamilyId ?? unit.scopeFamilyId,
                          scopeFamilyId: root.id,
                      },
            )
        return groupIntoClusters(rolled)
    })

    const absorbed = absorbOrphanedUnits(
        groupings.flatMap((grouping) => grouping.clusters),
        groupings.flatMap((grouping) => grouping.orphanedUnits),
        splitOversized,
        { parentByFamilyId },
    )

    return nameClusters(absorbed.clusters)
}
