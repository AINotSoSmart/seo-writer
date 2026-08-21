/**
 * Builds the buyer prompts a probe run asks the answer engines.
 *
 * This is the stage where the pivot's evidence claim is either earned or lost.
 * A prompt that no buyer would type produces an absence nobody should care
 * about, and a customer who reads "you are invisible for 26 prompts" and
 * recognises none of them has correctly concluded the report is noise.
 *
 * Two rules, both inherited from the harvest pipeline rather than invented here:
 *
 * 1. **Every prompt belongs to exactly one confirmed scope family.** The model
 *    may phrase a prompt; it may never introduce a business area the customer
 *    did not confirm. This is the same constraint `scope-classifier.ts` puts on
 *    harvested queries, applied one stage earlier — here the model generates
 *    rather than assigns, so the constraint is enforced by construction: each
 *    call is scoped to one family and the family id is attached by code, not
 *    chosen by the model.
 *
 * 2. **Intent is a label, not a quota.** The model labels the situation after
 *    writing each question; code uses that label for downstream article type.
 *    Comparability comes from persisting and re-running the same confirmed
 *    questions, not from regenerating a fixed sentence mix every cycle.
 */

import { normalizeQuery } from "@/lib/harvest/types"
import { DEFAULT_LANGUAGE } from "@/lib/target-market"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import {
    DEFAULT_PROMPTS_PER_RUN,
    PROMPT_INTENTS,
    PROMPTS_PER_FAMILY,
    type PromptIntentKey,
} from "./prompt-config"
import {
    BUYER_PROMPT_RESPONSE_SCHEMA,
    buildFamilyPrompt,
    type BuyerPromptFamily,
    type PromptBrandContext,
} from "./prompt-template"
import { judgeSelectionPrompts } from "./selection-classifier"
import {
    acceptsSelectionPrompt,
    selectionRejections,
    NATURALNESS_FLOOR,
} from "./selection-judgement"
import { UNKNOWN_SELECTION_CLASS, type SelectionClass } from "./selection-class"
import {
    containsCalendarYear,
    incumbentNeedles,
    inferPromptIntent,
    mentionsIncumbent,
    promptsAreNearDuplicates,
} from "./prompt-selection"

// Re-exported so existing importers keep one obvious entry point; the values
// themselves live in the import-free config module so they stay assertable.
export {
    DEFAULT_PROMPTS_PER_RUN,
    MAX_PROMPTS_PER_RUN,
    PROMPT_INTENTS,
    PROMPTS_PER_FAMILY,
    type PromptIntentKey,
} from "./prompt-config"

export interface BuyerPrompt {
    /** Durable subscription identity. Present once the confirmed set is saved. */
    trackedPromptId?: string
    text: string
    textNorm: string
    scopeFamilyId: string
    intent: PromptIntentKey
    articleType: "commercial" | "informational" | "howto"
    /**
     * How strongly this question forces an assistant to choose between
     * products. Orthogonal to `intent`, which decides `articleType` for the
     * writer. See lib/visibility/selection-class.ts.
     */
    selectionClass: SelectionClass
    /** The confirmed seed this prompt was built around — its provenance. */
    sourceSeed: string
}

export interface PromptBuildReport {
    callsAttempted: number
    callsSucceeded: number
    familiesCovered: number
    /**
     * Candidates discarded for naming a tracked rival. Reported rather than
     * swallowed: the instruction forbids naming anything, so a non-zero count
     * here is evidence the generation prompt is drifting, and a large one means
     * the run nearly ran out of usable questions.
     */
    rivalNamedRejected: number
    /**
     * Candidates discarded because an assistant would answer them without
     * naming any product. A high number is the generator drifting back toward
     * tutorials; a number equal to the candidate count means the run produced
     * nothing measurable and the caller must not pretend otherwise.
     */
    weakSelectionRejected: number
    /** Why they were discarded, most common first. Diagnosis, not decoration. */
    selectionRejectionReasons: Record<string, number>
    errors: string[]
}

export interface PromptBuildResult {
    prompts: BuyerPrompt[]
    report: PromptBuildReport
}

const MAX_ATTEMPTS_PER_FAMILY = 2
const RETRY_BASE_DELAY_MS = 1200

/**
 * A prompt must read like something a person typed into a chat box.
 *
 * Mechanical sanitation only — no opinion about words or industries, matching
 * `isPlausibleQuery`. The one semantic rule is the brand ban below, which is
 * evidential rather than a word list: a prompt naming the customer's own brand
 * cannot measure discovery, because the engine was told the answer.
 */
function isPlausiblePrompt(text: string): boolean {
    const trimmed = text.trim()
    if (trimmed.length < 15 || trimmed.length > 200) return false
    // Word count assumes a space-delimited script. `TARGET_LANGUAGES` is
    // restricted to those for exactly this reason — a Japanese prompt is one
    // "word" here and would be rejected as gibberish, which would look like the
    // model failing rather than the validator being wrong.
    const words = trimmed.split(/\s+/)
    if (words.length < 4 || words.length > 30) return false
    if (/https?:\/\/|[<>{}]/.test(trimmed)) return false
    // Any Unicode letter, not `[a-z]`. The ASCII version silently failed every
    // prompt written in a language with accents or a non-Latin script, which
    // meant offering a language and then producing nothing in it.
    const letters = (trimmed.match(/\p{L}/gu) || []).length
    return letters / trimmed.length >= 0.6
}

/**
 * True when the prompt names the customer's own brand or domain.
 *
 * That prompt is not a discovery question. "Is Acme good for X" measures
 * whether the engine has an opinion about Acme; we are asking whether a buyer
 * who has never heard of Acme gets told about it.
 *
 * **Competitors are deliberately NOT banned here.** They were, and it was the
 * single biggest cause of prompts no human would type: the most natural way a
 * buyer asks for a tool is against one they already use — "Figma is overkill
 * for this, what else…" — and forbidding every rival name left the model with
 * nothing but abstract category questions to write. Comparative framing is also
 * what makes an answer engine list challengers rather than recite the same
 * three market leaders.
 */
function namesSubject(text: string, subjectTokens: string[]): boolean {
    const flattened = text.toLowerCase().replace(/[^a-z0-9]/g, "")
    return subjectTokens.some((token) => {
        const needle = token.toLowerCase().replace(/[^a-z0-9]/g, "")
        return needle.length >= 4 && flattened.includes(needle)
    })
}

/**
 * Generates buyer prompts for every confirmed family.
 *
 * One model call per family — scoping each call to a single family is what
 * makes ownership structural rather than something the model is asked to
 * respect. A family whose call fails contributes nothing and is reported; it is
 * never backfilled from another family's prompts, because that would silently
 * measure the wrong area and attribute the result to this one.
 */
export async function buildBuyerPrompts(
    families: BuyerPromptFamily[],
    options: {
        subjectType: string
        /**
         * ISO-639-1. The language buyers ask in — and therefore the language the
         * answer engines are asked in. An English question measures the English
         * answer, which is the wrong measurement for a brand selling in Spain.
         */
        language?: string
        /** Only the customer's own brand and domains. */
        subjectTokens: string[]
        /** What the product is and who buys it. */
        context?: Omit<PromptBrandContext, "subjectType">
        /**
         * Known rival names and domains — a **rejection list, never context**.
         *
         * These are not shown to the model. They exist so that a question which
         * names a rival anyway can be discarded before it is ever confirmed. We
         * have verified facts about the customer's product and none about a
         * rival's, so a question asserting what a rival does is an unverifiable
         * premise baked into a durable, monthly-rerun measurement.
         */
        rivalBrands?: string[]
        maxPrompts?: number
        /** Existing prompts retained while one family is regenerated. */
        questionsToAvoid?: string[]
    },
): Promise<PromptBuildResult> {
    const client = getGeminiClient()
    const cap = options.maxPrompts ?? DEFAULT_PROMPTS_PER_RUN
    const errors: string[] = []
    let callsAttempted = 0
    let callsSucceeded = 0
    const rivalTokens = incumbentNeedles(options.rivalBrands || [])
    let weakSelectionRejected = 0
    const selectionRejectionReasons: Record<string, number> = {}
    const externalQuestions = (options.questionsToAvoid || [])
        .map((question) => question.trim())
        .filter(Boolean)
    const desiredPerFamily = Math.min(
        PROMPTS_PER_FAMILY,
        Math.ceil(cap / Math.max(1, families.length)),
    )

    const byFamily = new Map<string, BuyerPrompt[]>()

    for (const family of families) {
        const accepted: BuyerPrompt[] = []
        const priorQuestions = [
            ...externalQuestions,
            ...[...byFamily.values()].flat().map((prompt) => prompt.text),
        ]

        for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_FAMILY; attempt++) {
            callsAttempted++
            if (attempt > 1) {
                const delay =
                    RETRY_BASE_DELAY_MS * 2 ** (attempt - 2) + Math.random() * RETRY_BASE_DELAY_MS
                await new Promise((resolve) => setTimeout(resolve, delay))
            }

            try {
                const response = await client.models.generateContent({
                    model: "gemini-3.1-flash-lite",
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: buildFamilyPrompt(
                                        family,
                                        {
                                            ...(options.context || {}),
                                            subjectType: options.subjectType,
                                        },
                                        options.language ?? DEFAULT_LANGUAGE,
                                        [
                                            ...priorQuestions,
                                            ...accepted.map((prompt) => prompt.text),
                                        ],
                                    ),
                                },
                            ],
                        },
                    ],
                    config: {
                        temperature: 0.4,
                        responseMimeType: "application/json",
                        responseSchema: BUYER_PROMPT_RESPONSE_SCHEMA,
                    },
                })

                const parsed = JSON.parse(response.text || "{}")
                const rows: Array<{ text?: unknown; intent?: unknown }> = Array.isArray(
                    parsed.prompts,
                )
                    ? parsed.prompts
                    : []

                const validIntents = new Set<string>(PROMPT_INTENTS.map((intent) => intent.key))
                const candidates = rows
                    .map((row) => ({
                        text: String(row.text ?? "").trim(),
                        intent: String(row.intent ?? "").trim() as PromptIntentKey,
                    }))
                    // These three checks decide whether a row is valid at all.
                    // Diversity and rival share are handled later as batch
                    // selection constraints; they do not ban a speaking style.
                    .filter(
                        (row) =>
                            isPlausiblePrompt(row.text) &&
                            validIntents.has(row.intent) &&
                            !namesSubject(row.text, options.subjectTokens) &&
                            !containsCalendarYear(row.text),
                    )
                    .map((row) => {
                        const resolvedIntent = inferPromptIntent(row.text, row.intent)
                        const intent = PROMPT_INTENTS.find(
                            (candidate) => candidate.key === resolvedIntent,
                        )!
                        return {
                            text: row.text,
                            textNorm: normalizeQuery(row.text),
                            scopeFamilyId: family.id,
                            intent: resolvedIntent,
                            articleType: intent.articleType,
                            // Provisional. The classifier below decides the real
                            // one; the model's own label is never trusted,
                            // because the model that wrote a tutorial is the
                            // same model being asked whether it wrote one.
                            selectionClass: UNKNOWN_SELECTION_CLASS,
                            sourceSeed: family.seedKeywords[0] ?? family.name,
                        }
                    })

                for (const candidate of candidates) {
                    const existing = [...priorQuestions, ...accepted.map((prompt) => prompt.text)]
                    if (
                        existing.some((question) =>
                            promptsAreNearDuplicates(question, candidate.text),
                        )
                    ) {
                        continue
                    }
                    accepted.push(candidate)
                }

                if (candidates.length > 0) {
                    callsSucceeded++
                }
                if (accepted.length >= desiredPerFamily) break
                if (candidates.length === 0) {
                    errors.push(`${family.name}: model returned no usable prompts`)
                }
            } catch (error) {
                errors.push(
                    `${family.name}: ${error instanceof Error ? error.message : String(error)}`,
                )
            }
        }

        /**
         * THE GATE. Nothing reaches a customer unjudged.
         *
         * Every check above this line is mechanical — length, duplicates, brand
         * names, calendar years. None of them can tell a tutorial from a
         * selection question, which is why 32 of 40 tutorials shipped. This is
         * the only semantic filter in the pipeline.
         *
         * One call per family, after its candidates are collected, rather than
         * one per attempt or one per question.
         */
        if (accepted.length > 0) {
            const { judged, error } = await judgeSelectionPrompts(
                accepted.map((prompt) => prompt.text),
                {
                    subjectType: options.subjectType,
                    category: options.context?.category,
                    coreFeatures: options.context?.coreFeatures,
                },
            )
            if (error) errors.push(`${family.name}: selection judgement failed — ${error}`)

            const judgementByText = new Map(
                judged.map((row) => [row.text, row.judgement]),
            )
            const survivors: BuyerPrompt[] = []
            for (const candidate of accepted) {
                const judgement = judgementByText.get(candidate.text)
                if (!judgement || !acceptsSelectionPrompt(judgement, NATURALNESS_FLOOR)) {
                    weakSelectionRejected++
                    for (const reason of judgement
                        ? selectionRejections(judgement)
                        : ["unjudged"]) {
                        selectionRejectionReasons[reason] =
                            (selectionRejectionReasons[reason] ?? 0) + 1
                    }
                    continue
                }
                survivors.push({ ...candidate, selectionClass: judgement.selectionClass })
            }

            // Reported, never padded. A family that yields four selection
            // questions contributes four; topping it back up to forty with the
            // tutorials just rejected would restore the exact defect.
            if (survivors.length === 0) {
                errors.push(
                    `${family.name}: every candidate was answerable without naming a product`,
                )
            }
            if (survivors.length > 0) byFamily.set(family.id, survivors)
        }
    }

    // Round-robin across families up to the cap, so a family that produced 10
    // prompts cannot crowd out one that produced 4. Same fairness rule the
    // harvest applies at `roundRobinCap`; a probe that spends its whole budget
    // on one confirmed area measures that area, not the business.
    //
    // Rival-naming questions are REJECTED here, not rationed. There used to be a
    // 15% allowance; see NAMED_BRAND_PROMPTS_ALLOWED for why it is zero. The
    // instruction already forbids naming anything, so this is the backstop for
    // when the model does it anyway — which it will, because a rival's name is
    // often the most natural phrasing of a comparison.

    const seen = new Set<string>()
    const prompts: BuyerPrompt[] = []
    const cursors = new Map<string, number>()
    let rivalNamedRejected = 0
    let exhausted = false

    while (prompts.length < cap && !exhausted) {
        exhausted = true
        for (const family of families) {
            const pool = byFamily.get(family.id)
            if (!pool) continue
            const cursor = cursors.get(family.id) ?? 0
            if (cursor >= pool.length) continue
            exhausted = false
            cursors.set(family.id, cursor + 1)

            const candidate = pool[cursor]
            if (seen.has(candidate.textNorm)) continue
            if (mentionsIncumbent(candidate.text, rivalTokens)) {
                // Counted, not silently dropped: a family that keeps producing
                // these is a signal about the generation prompt, and a run that
                // rejects most of its candidates should be visible.
                rivalNamedRejected++
                continue
            }
            seen.add(candidate.textNorm)
            prompts.push(candidate)
            if (prompts.length >= cap) break
        }
    }

    return {
        prompts,
        report: {
            callsAttempted,
            callsSucceeded,
            familiesCovered: byFamily.size,
            rivalNamedRejected,
            weakSelectionRejected,
            selectionRejectionReasons,
            errors: errors.slice(0, 5),
        },
    }
}
