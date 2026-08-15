/**
 * The AI-visibility probe as a background task.
 *
 * This is not an optimisation — it is a correctness requirement. Cloro is an
 * async queue: a task is submitted, then polled until the real consumer surface
 * has answered, and upstream allows up to 30 minutes for that. No serverless
 * request can hold a 40-prompt × 2-engine run open that long, so a probe driven
 * from an API route would time out mid-flight and leave a `running` row with no
 * writer. The route now enqueues; this owns the run.
 */

import { task } from "@trigger.dev/sdk/v3"

import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import type { ProbeCompetitor } from "@/lib/visibility/answer-parser"
import type { AiEngine } from "@/lib/visibility/engines"
import { ProbeError, runVisibilityProbe } from "@/lib/visibility/run-probe"
import { encodeProbeFailureDetail } from "@/lib/visibility/failure-copy"
import { createAdminClient } from "@/utils/supabase/admin"

export interface RunProbePayload {
    runId: string
    userId: string
    brandId: string
    auditId: string | null
    subjectName: string
    subjectDomains: string[]
    subjectType: string
    competitors: ProbeCompetitor[]
    families: AuditScopeFamily[]
    engines: AiEngine[]
    /** ISO-3166 alpha-2. Which country's answers Cloro is asked for. */
    countryCode?: string
    /** ISO-639-1. The language the buyer questions are written in. */
    language?: string
    maxPrompts?: number
    prompts?: import("@/lib/visibility/prompt-builder").BuyerPrompt[]
}

export const runProbeTask = task({
    id: "run-visibility-probe",
    /**
     * 40 minutes. A Cloro task can take up to 20 by our own poll ceiling, and
     * the run also builds prompts, embeds gaps and clusters afterwards.
     */
    maxDuration: 2400,
    /**
     * One attempt. A retry would re-submit every Cloro task and bill the
     * credits twice for a run whose partial answers are already stored.
     */
    retry: { maxAttempts: 1 },
    run: async (payload: RunProbePayload) => {
        const supabase = createAdminClient() as any

        const setPhase = async (phase: string, detail?: string) => {
            await supabase
                .from("ai_probe_runs")
                .update({
                    phase,
                    phase_detail: detail ?? null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", payload.runId)
        }

        try {
            const result = await runVisibilityProbe(payload.families, {
                userId: payload.userId,
                brandId: payload.brandId,
                auditId: payload.auditId,
                subjectName: payload.subjectName,
                subjectDomains: payload.subjectDomains,
                subjectType: payload.subjectType,
                competitors: payload.competitors,
                countryCode: payload.countryCode,
                language: payload.language,
                engines: payload.engines,
                maxPrompts: payload.maxPrompts,
                prompts: payload.prompts,
                existingRunId: payload.runId,
                onPhase: setPhase,
            })

            return {
                runId: result.runId,
                promptCount: result.summary.promptCount,
                answerCount: result.summary.answerCount,
                gapCount:
                    result.summary.absentPromptCount + result.summary.outrankedPromptCount,
                clusterCount: result.clusters.length,
                creditsUsed: result.creditsUsed,
            }
        } catch (error) {
            // `runVisibilityProbe` already wrote customer copy to
            // `failure_reason` and the tagged operator detail to `phase_detail`.
            // This only covers a throw from BEFORE that handler could run — an
            // adoption failure, say — and it uses the same encoding so the two
            // cannot disagree about what a failed run looks like.
            const message = error instanceof Error ? error.message : String(error)
            await setPhase(
                "failed",
                encodeProbeFailureDetail(
                    error instanceof ProbeError ? error.reason : "unknown",
                    message,
                ),
            )
            throw error
        }
    },
})
