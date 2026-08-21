/**
 * Judges a batch of candidate buyer questions on entity-selection probability.
 *
 * One call per batch, not one per question. A brand generates up to 40
 * candidates per confirmed area across up to 3 areas, so per-candidate calls
 * would be ~120 round trips to decide something the model can answer for the
 * whole list at once.
 *
 * The judgement itself, and the rule applied to it, live in
 * `selection-judgement.ts` — dependency-free so both can be calibrated and
 * tested without a network. This file only gets the answers.
 */

import { getGeminiClient } from "@/utils/gemini/geminiClient"

import { SELECTION_CLASSES } from "./selection-class"
import {
    normaliseJudgement,
    type JudgedPrompt,
    type SelectionJudgement,
} from "./selection-judgement"

const MODEL = "gemini-3.1-flash-lite"

/** Bounded so one malformed family cannot send a 400-item prompt. */
const MAX_BATCH = 60

export interface SelectionClassifierContext {
    /** What the product is — "browser tool that restores old family photos". */
    subjectType: string
    category?: string
    /** Verified capabilities. The brand-capability test is judged against these. */
    coreFeatures?: string[]
}

const RESPONSE_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        judgements: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    index: { type: "INTEGER" as const },
                    answerableWithoutProduct: { type: "BOOLEAN" as const },
                    benefitsFromNamingProducts: { type: "BOOLEAN" as const },
                    brandCanSatisfy: { type: "BOOLEAN" as const },
                    naturalness: { type: "NUMBER" as const },
                    selectionClass: { type: "STRING" as const },
                },
                required: [
                    "index",
                    "answerableWithoutProduct",
                    "benefitsFromNamingProducts",
                    "brandCanSatisfy",
                    "naturalness",
                    "selectionClass",
                ],
            },
        },
    },
    required: ["judgements"],
}

export function buildJudgementPrompt(
    questions: string[],
    context: SelectionClassifierContext,
): string {
    const features = (context.coreFeatures || []).filter(Boolean).slice(0, 8)
    const classes = SELECTION_CLASSES.map(
        (entry) => `- ${entry.key}: ${entry.label} — e.g. "${entry.example}"`,
    ).join("\n")

    return `You are grading questions for an AI-visibility measurement. The measurement asks: when a buyer types this into an assistant, does the assistant recommend this product?

That only means something if a good answer NAMES PRODUCTS. A question an assistant answers with pure technique produces no recommendation, so the brand's absence from it proves nothing.

THE PRODUCT BEING MEASURED
It is: ${context.subjectType}
${context.category ? `Category: ${context.category}\n` : ""}${features.length ? `What it can actually do:\n${features.map((feature) => `- ${feature}`).join("\n")}\n` : ""}
For each question, judge four things honestly. Do not be generous — a wrong "yes" pollutes the measurement.

1. answerableWithoutProduct — Could a knowledgeable assistant answer this completely and helpfully WITHOUT recommending or naming any tool, app, service or brand? Tutorials, explanations of how a technique works, and yes/no feasibility questions are all TRUE. If the honest answer is a list of tools, it is FALSE.

2. benefitsFromNamingProducts — Would a high-quality answer naturally name one or more products, services or providers?

3. brandCanSatisfy — Judging ONLY from "what it can actually do" above, could this product genuinely serve the need behind the question? If the question is about something the product does not do, this is FALSE even if the topic is adjacent.

4. naturalness — 0 to 1. Would a real person type this into a chat box? Search-engine keyword strings ("best AI photo tool 2026") score low. Messy, specific, situational sentences score high.

Then label selectionClass with exactly one of:
${classes}

THE QUESTIONS
${questions.map((question, index) => `${index}. ${question}`).join("\n")}

Return one judgement per question, with its index.`
}

/**
 * Judges every question, returning them in input order.
 *
 * Fails CLOSED. If the call throws or returns nothing, every question gets the
 * default judgement from `normaliseJudgement`, which scores 0 — so an outage
 * rejects candidates rather than silently admitting the tutorials this exists
 * to remove. The caller sees an empty accepted set and a reported error, which
 * is the loud failure; quietly shipping an unfiltered set is the quiet one.
 */
export async function judgeSelectionPrompts(
    questions: string[],
    context: SelectionClassifierContext,
): Promise<{ judged: JudgedPrompt[]; error?: string }> {
    if (questions.length === 0) return { judged: [] }

    const batch = questions.slice(0, MAX_BATCH)
    const fallback = (): JudgedPrompt[] =>
        batch.map((text) => ({ text, judgement: normaliseJudgement(null) }))

    try {
        const client = getGeminiClient()
        const response = await client.models.generateContent({
            model: MODEL,
            contents: [
                { role: "user", parts: [{ text: buildJudgementPrompt(batch, context) }] },
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
            },
        })

        const parsed = JSON.parse(response.text || "{}") as {
            judgements?: Array<Record<string, unknown>>
        }
        const rows = Array.isArray(parsed.judgements) ? parsed.judgements : []

        const byIndex = new Map<number, SelectionJudgement>()
        for (const row of rows) {
            const index = Number(row.index)
            if (!Number.isInteger(index) || index < 0 || index >= batch.length) continue
            byIndex.set(index, normaliseJudgement(row))
        }

        return {
            judged: batch.map((text, index) => ({
                text,
                // A question the model skipped keeps the fail-closed default
                // rather than inheriting a neighbour's verdict.
                judgement: byIndex.get(index) ?? normaliseJudgement(null),
            })),
        }
    } catch (error) {
        console.error("[Selection classifier] Judgement call failed:", error)
        return {
            judged: fallback(),
            error: error instanceof Error ? error.message : "judgement failed",
        }
    }
}
