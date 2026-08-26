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

/**
 * The same model the generator uses, chosen on measured throughput.
 *
 * This was `gemini-3-flash-preview`, and it made onboarding time out. Four
 * equal chunks of twelve questions were dispatched at the same instant: two
 * came back in 2.8s and 6.6s, and the other two took **209s and 214s**. Same
 * model, same batch size, same moment — that is a quota queue, not a hard
 * problem. Preview models carry tight concurrency limits, and the SDK's backoff
 * turns a throttle into a multi-minute stall with no error to catch.
 *
 * `gemini-3.7-flash` is what the generator already calls twice per build
 * without stalling, and on a hand-checked set it returned the same verdicts.
 * Judgement quality was never the reason to leave flash-lite — the reason was
 * that it over-rejected duplicates, and that job has since moved to the
 * generator, which holds the brand context.
 */
const MODEL = "gemini-3.7-flash"
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

/**
 * Reviews one chunk and returns decisions keyed by the chunk's own indices.
 *
 * Retries once when the response comes back short. A decision missing from the
 * response deletes that question as `invalid_critic_response`, which is the
 * correct direction to fail — an unjudged question must not reach a paying
 * customer — but without a retry a model that drops trailing array items is
 * indistinguishable from a model that rejected those questions.
 */
async function reviewChunk(chunk: string[]): Promise<Map<number, PromptCriticReview>> {
    const decisions = await reviewOnce(chunk)
    if (decisions.size < chunk.length) {
        const second = await reviewOnce(chunk)
        for (const [index, review] of second) {
            if (!decisions.has(index)) decisions.set(index, review)
        }
    }
    return decisions
}

/**
 * How many questions one critic call judges.
 *
 * MEASURED, not guessed. This call's latency is wildly superlinear in batch
 * size once the questions are real: fifteen genuine buyer questions came back
 * in about six seconds, while thirty-seven took **197 seconds** — enough on its
 * own to blow the API route's timeout and hand a founder a gateway error
 * halfway through onboarding.
 *
 * Chunking is also the semantically correct shape now. This critic used to
 * judge `duplicate_buyer_situation`, which genuinely needed the whole set in
 * one call. That job moved to the generator, which has the brand context and
 * writes the `scenario` labels. What is left — is this answerable from general
 * knowledge, does it lead anywhere external, is it a real chat message or a
 * manufactured search phrase — is a judgement about one question's own text,
 * which is exactly what the instruction now tells it to do.
 */
const CRITIC_CHUNK_SIZE = 12

export async function reviewPromptSet(
    questions: string[],
): Promise<{ reviews: PromptCriticReview[]; error?: string }> {
    if (questions.length === 0) return { reviews: [] }
    const batch = questions.slice(0, MAX_BATCH)

    try {
        const chunks: string[][] = []
        for (let start = 0; start < batch.length; start += CRITIC_CHUNK_SIZE) {
            chunks.push(batch.slice(start, start + CRITIC_CHUNK_SIZE))
        }

        // TWO AT A TIME, NOT ALL AT ONCE.
        //
        // Unbounded `Promise.all` over the chunks is what exposed the quota
        // queue described above: four simultaneous requests had two of them
        // parked for three and a half minutes. Two in flight keeps the wall
        // clock roughly halved without ever presenting the API with a burst.
        const results: Array<Map<number, PromptCriticReview>> = []
        for (let index = 0; index < chunks.length; index += 2) {
            const pair = await Promise.all(
                chunks.slice(index, index + 2).map((chunk) => reviewChunk(chunk)),
            )
            results.push(...pair)
        }

        const byIndex = new Map<number, PromptCriticReview>()
        results.forEach((decisions, chunkIndex) => {
            const offset = chunkIndex * CRITIC_CHUNK_SIZE
            for (const [local, review] of decisions) byIndex.set(offset + local, review)
        })

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
