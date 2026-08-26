/**
 * One whole-set critic for generated buyer questions.
 *
 * It does not score, rank, rewrite, or reclassify. It removes questions that
 * fail a measured boundary in PROMPT_QUALITY_PLAN §11.
 *
 * ## Why it no longer judges duplicates
 *
 * `duplicate_buyer_situation` stays in `CRITIC_REASONS` because stored rows
 * carry it, but the instruction no longer asks for it. It was rejecting
 * questions this critic is not equipped to judge.
 *
 * Duplication is a claim about two buyer situations, and this call sees neither
 * one: it receives bare question text, with no product, no capabilities, no
 * audience, and no `scenario` labels. The generator has all of that — it writes
 * the scenario for each question — and `buildBuyerPrompts` already rejects on
 * it before anything reaches here.
 *
 * A measured run made the split obvious. The generator declared all
 * twenty-five scenarios distinct, so scenario dedup rejected **zero**. This
 * critic — a smaller model, reading a context-free list — then rejected
 * **nine** as duplicates. Two judges disagreeing that sharply is not two
 * opinions; it is one judge working without the evidence.
 *
 * So duplication is settled where the context lives, and the critic keeps the
 * three boundaries it can actually see in the text itself.
 */

import { getGeminiClient } from "@/utils/gemini/geminiClient"

// Was flash-lite. This call is the last gate before a question becomes a
// durable, paid, monthly-measured row, and its remaining rejections are taste
// judgements — is this a real chat message or a manufactured search phrase —
// which is exactly what a lite model is worst at. It runs once per generation,
// so the cost difference is a rounding error against the Cloro spend the
// questions it approves will incur every cycle. Same model the scope extractor
// already uses for the other consequential decision in this pipeline.
const MODEL = "gemini-3-flash-preview"
// Production sends at most 25. The larger ceiling lets the development-only
// regression harness review all 36 labelled negatives without truncating them.
const MAX_BATCH = 60

export const CRITIC_REASONS = [
    "general_knowledge_answer",
    "does_not_lead_to_external_solution",
    "synthetic_search_phrase",
    "duplicate_buyer_situation",
    "invalid_critic_response",
    "critic_unavailable",
] as const

export type CriticRejectionReason = (typeof CRITIC_REASONS)[number]

export interface PromptCriticReview {
    text: string
    accepted: boolean
    rejectionReason: CriticRejectionReason | null
}

const RESPONSE_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        decisions: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    index: { type: "INTEGER" as const },
                    accepted: { type: "BOOLEAN" as const },
                    rejectionReason: { type: "STRING" as const },
                },
                required: ["index", "accepted", "rejectionReason"],
            },
        },
    },
    required: ["decisions"],
}

export function buildPromptCriticInstruction(questions: string[]): string {
    return `Review this complete set of candidate questions for an AI recommendation measurement.

Keep a question only when it reads like something a real person would type while trying to find or choose a product, tool, service, app, or provider for their situation.

Reject a question for exactly one primary reason. Judge each question on its own text; do not reject one for resembling another in the list:
- general_knowledge_answer: an assistant can answer it completely with explanation, technique, or steps.
- does_not_lead_to_external_solution: a useful answer does not plausibly need to name an external solution.
- synthetic_search_phrase: it reads like an SEO keyword, review-site heading, or manufactured variation rather than a natural chat message.

Do not rewrite questions. Do not reject a good question merely because it is informal or emotional. For every accepted question return an empty rejectionReason. Return exactly one decision for every index.

QUESTIONS
${questions.map((question, index) => `${index}. ${question}`).join("\n")}`
}

function isKnownReason(value: unknown): value is CriticRejectionReason {
    return typeof value === "string" && (CRITIC_REASONS as readonly string[]).includes(value)
}

/** One call. Throws so the caller can decide whether to retry or fail closed. */
async function reviewOnce(batch: string[]): Promise<Map<number, PromptCriticReview>> {
    const client = getGeminiClient()
    const response = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: buildPromptCriticInstruction(batch) }] }],
        config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
        },
    })
    const parsed = JSON.parse(response.text || "{}") as {
        decisions?: Array<Record<string, unknown>>
    }
    const decisions = Array.isArray(parsed.decisions) ? parsed.decisions : []
    const byIndex = new Map<number, PromptCriticReview>()
    for (const decision of decisions) {
        const index = Number(decision.index)
        if (!Number.isInteger(index) || index < 0 || index >= batch.length) continue
        const accepted = decision.accepted === true
        const reason = accepted
            ? null
            : isKnownReason(decision.rejectionReason)
              ? decision.rejectionReason
              : "invalid_critic_response"
        byIndex.set(index, { text: batch[index], accepted, rejectionReason: reason })
    }
    return byIndex
}

export async function reviewPromptSet(
    questions: string[],
): Promise<{ reviews: PromptCriticReview[]; error?: string }> {
    if (questions.length === 0) return { reviews: [] }
    const batch = questions.slice(0, MAX_BATCH)

    try {
        // RETRY BEFORE FAILING CLOSED.
        //
        // A decision missing from the response means the question is deleted as
        // `invalid_critic_response`. That is the correct direction to fail — an
        // unjudged question must not reach a paying customer — but it made a
        // model that dropped trailing array items indistinguishable from a model
        // that rejected those questions. One retry separates flakiness from a
        // verdict; a question still unjudged after two attempts is still failed
        // closed, so the policy is unchanged.
        const byIndex = await reviewOnce(batch)
        if (byIndex.size < batch.length) {
            const second = await reviewOnce(batch)
            for (const [index, review] of second) {
                if (!byIndex.has(index)) byIndex.set(index, review)
            }
        }

        return {
            reviews: batch.map(
                (text, index) =>
                    byIndex.get(index) ?? {
                        text,
                        accepted: false,
                        rejectionReason: "invalid_critic_response",
                    },
            ),
        }
    } catch (error) {
        console.error("[Prompt critic] Review call failed:", error)
        return {
            reviews: batch.map((text) => ({
                text,
                accepted: false,
                rejectionReason: "critic_unavailable",
            })),
            error: error instanceof Error ? error.message : "critic failed",
        }
    }
}
