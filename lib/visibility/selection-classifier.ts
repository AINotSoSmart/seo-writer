/**
 * One whole-set critic for generated buyer questions.
 *
 * It does not score, rank, rewrite, or reclassify. It only removes questions
 * that fail one of the four measured boundaries in PROMPT_QUALITY_PLAN §11.
 */

import { getGeminiClient } from "@/utils/gemini/geminiClient"

const MODEL = "gemini-3.1-flash-lite"
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

Reject a question for exactly one primary reason:
- general_knowledge_answer: an assistant can answer it completely with explanation, technique, or steps.
- does_not_lead_to_external_solution: a useful answer does not plausibly need to name an external solution.
- synthetic_search_phrase: it reads like an SEO keyword, review-site heading, or manufactured variation rather than a natural chat message.
- duplicate_buyer_situation: another question in this set already represents the same underlying situation, even if the wording differs.

Do not rewrite questions. Do not reject a good question merely because it is informal or emotional. For every accepted question return an empty rejectionReason. Return exactly one decision for every index.

QUESTIONS
${questions.map((question, index) => `${index}. ${question}`).join("\n")}`
}

function isKnownReason(value: unknown): value is CriticRejectionReason {
    return typeof value === "string" && (CRITIC_REASONS as readonly string[]).includes(value)
}

export async function reviewPromptSet(
    questions: string[],
): Promise<{ reviews: PromptCriticReview[]; error?: string }> {
    if (questions.length === 0) return { reviews: [] }
    const batch = questions.slice(0, MAX_BATCH)

    try {
        const client = getGeminiClient()
        const response = await client.models.generateContent({
            model: MODEL,
            contents: [
                {
                    role: "user",
                    parts: [{ text: buildPromptCriticInstruction(batch) }],
                },
            ],
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
