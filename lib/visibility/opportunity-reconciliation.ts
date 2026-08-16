/**
 * Converts one probe's counted prompt outcomes into the complete input for the
 * durable opportunity reconciler.
 *
 * This module deliberately decides no lifecycle state. PostgreSQL owns that
 * decision atomically beside tracked-question coverage, prior opportunities
 * and delivered actions. TypeScript only carries the observation facts across
 * the boundary and refuses to lose or duplicate one on the way.
 */

import type { ArticleType } from "@/lib/harvest/cluster-types"
import { scoreVisibilityGap, type PromptOutcome } from "./gap-mapper"

export const OPPORTUNITY_RECONCILIATION_POLICY = Object.freeze({
    version: "opportunity-reconciliation-v1",
    /**
     * A delivered action remains monitoring for this long. Delivery is not
     * publication, and publication is not immediate recrawl, so a new losing
     * observation inside this window must never trigger another draft.
     */
    monitoringDays: 21,
})

export interface ReconciliationPrompt {
    id: string
    tracked_prompt_id: string | null
    article_type: ArticleType
}

export interface OpportunityFinding {
    tracked_prompt_id: string
    verdict: PromptOutcome["verdict"]
    priority: number | null
    reason: string
}

export interface OpportunityReconciliationResult {
    observed: number
    inserted: number
    updated: number
    open: number
    needs_input: number
    monitoring: number
    resolved: number
    dismissed: number
}

export class OpportunityReconciliationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "OpportunityReconciliationError"
    }
}

function rivalSuffix(outcome: PromptOutcome): string {
    const rivals = outcome.rivals.length
    if (rivals === 0) return "."
    return `; ${rivals} tracked rival${rivals === 1 ? " was" : "s were"} named.`
}

/** Customer-readable evidence, never a synthetic score. */
export function opportunityEvidenceReason(outcome: PromptOutcome): string {
    if (outcome.verdict === "absent") {
        return `Absent from all ${outcome.answersTotal} captured answer${
            outcome.answersTotal === 1 ? "" : "s"
        }${rivalSuffix(outcome)}`
    }
    if (outcome.verdict === "outranked") {
        return `Named in ${outcome.answersPresent} of ${outcome.answersTotal} captured answers, but never first${rivalSuffix(
            outcome,
        )}`
    }
    return `Led at least one of ${outcome.answersTotal} captured answer${
        outcome.answersTotal === 1 ? "" : "s"
    }.`
}

/**
 * Builds exactly one finding for every prompt that produced a real outcome.
 * A prompt with no usable engine answer has no outcome and is intentionally
 * omitted: provider failure is not evidence that the brand was absent.
 */
export function buildOpportunityFindings(
    prompts: ReconciliationPrompt[],
    outcomes: Map<string, PromptOutcome>,
): OpportunityFinding[] {
    const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]))
    const trackedIds = new Set<string>()
    const findings: OpportunityFinding[] = []

    for (const outcome of outcomes.values()) {
        const prompt = promptById.get(outcome.promptId)
        if (!prompt) {
            throw new OpportunityReconciliationError(
                `Observed prompt ${outcome.promptId} was not persisted in this run.`,
            )
        }
        if (!prompt.tracked_prompt_id) {
            throw new OpportunityReconciliationError(
                `Observed prompt ${outcome.promptId} has no durable tracked-question identity.`,
            )
        }
        if (trackedIds.has(prompt.tracked_prompt_id)) {
            throw new OpportunityReconciliationError(
                `Tracked question ${prompt.tracked_prompt_id} appears more than once in this run.`,
            )
        }
        if (outcome.answersTotal < 1) {
            throw new OpportunityReconciliationError(
                `Observed prompt ${outcome.promptId} has no usable answers.`,
            )
        }

        trackedIds.add(prompt.tracked_prompt_id)
        findings.push({
            tracked_prompt_id: prompt.tracked_prompt_id,
            verdict: outcome.verdict,
            priority:
                outcome.verdict === "present"
                    ? null
                    : scoreVisibilityGap(outcome, prompt.article_type),
            reason: opportunityEvidenceReason(outcome),
        })
    }

    if (findings.length !== outcomes.size) {
        throw new OpportunityReconciliationError(
            "Not every observed prompt produced one reconciliation finding.",
        )
    }

    return findings
}

/** Calls the service-role-only atomic database reconciler. */
export async function reconcileContentOpportunities(
    supabase: {
        rpc: (
            name: string,
            args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message?: string } | null }>
    },
    runId: string,
    prompts: ReconciliationPrompt[],
    outcomes: Map<string, PromptOutcome>,
): Promise<OpportunityReconciliationResult> {
    const findings = buildOpportunityFindings(prompts, outcomes)
    const { data, error } = await supabase.rpc("reconcile_content_opportunities", {
        p_run_id: runId,
        p_findings: findings,
    })

    if (error) {
        throw new OpportunityReconciliationError(
            `Could not reconcile the recurring opportunity backlog: ${
                error.message ?? "unknown database error"
            }`,
        )
    }

    const result = data as Partial<OpportunityReconciliationResult> | null
    if (!result || result.observed !== findings.length) {
        throw new OpportunityReconciliationError(
            `The opportunity reconciler accounted for ${result?.observed ?? "no"} of ${
                findings.length
            } observed prompts.`,
        )
    }

    return result as OpportunityReconciliationResult
}
