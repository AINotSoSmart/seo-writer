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
 * 2. **The intent mix is deterministic.** Commercial intents (alternatives,
 *    best-of, comparison) are where AI answers actually name vendors, and they
 *    are the prompts worth losing. The mix is fixed in code so two runs of the
 *    same audit ask structurally comparable questions, and a shift in the
 *    results cannot be an artefact of the model having felt differently about
 *    what to ask.
 */

import { getGeminiClient } from "@/utils/gemini/geminiClient"
import type { AuditScopeFamily } from "@/lib/harvest/scope-classifier"
import { normalizeQuery } from "@/lib/harvest/types"
import { DEFAULT_LANGUAGE, languageName } from "@/lib/target-market"
import {
    DEFAULT_PROMPTS_PER_RUN,
    PROMPT_INTENTS,
    PROMPTS_PER_FAMILY,
    type PromptIntentKey,
} from "./prompt-config"

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
    /** Stable id assigned by the caller when persisted. */
    text: string
    textNorm: string
    scopeFamilyId: string
    intent: PromptIntentKey
    articleType: "commercial" | "informational" | "howto"
    /** The confirmed seed this prompt was built around — its provenance. */
    sourceSeed: string
}

export interface PromptBuildReport {
    callsAttempted: number
    callsSucceeded: number
    familiesCovered: number
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
 * What the model is told about the business. **Context, never form.**
 *
 * That distinction is the whole lesson of this file's history. `audience` and
 * `incumbents` were here before, and the questions came back written by "family
 * archivists" complaining that a named rival was too expensive — but the cause
 * was the sentence template they were plugged into (`"I'm [who I am] using
 * [current stack]"`) and a list captioned "you MAY name these", not the facts
 * themselves. Removing the facts as well cost the model everything it needed to
 * write from a real person's situation, and removed the alternatives-seeking
 * buyer from the measurement entirely.
 */
export interface PromptBrandContext {
    /** Plain description of the product — "browser tool that restores old photos". */
    subjectType: string
    /** The category the customer confirmed, in their words. */
    category?: string
    /** What it actually does, a few concrete capabilities. */
    coreFeatures?: string[]
    /** Who buys it. Background on whose situation to write from — never a label to quote. */
    audience?: string
    /**
     * Tools these buyers already use.
     *
     * Present so a couple of questions out of twenty can be the genuinely
     * comparative ones people really ask, and absent from the rest. The
     * measurement is protected either way: `summarisePrompt` excludes a
     * competitor named in a prompt from that prompt's rival counts, so asking
     * "alternatives to X" can never inflate X on the leaderboard.
     */
    incumbents?: string[]
}

/**
 * Asks for the questions a buyer would really type, and nothing about how.
 *
 * Everything prescriptive was removed from here in one pass, because the
 * prescription was the defect. This previously carried five named sentence
 * shapes with fill-in slots, a required count of each, a list of rival names,
 * banned openings, banned words and two worked examples — and it produced
 * questions from "family archivists" and "genealogists" complaining that a
 * named competitor was "too expensive". Dictating a form guarantees output with
 * that form. The founder got better questions out of a plain model call given
 * only the brand, its features and its category, which is the whole argument.
 *
 * What is left is context plus a goal. The three constraints that remain are
 * not style rules:
 *
 * - **one family per call** — ownership is structural, not requested
 * - **never name the customer's brand** — measurement validity; naming them
 *   hands the engine the answer to the question being asked
 * - **stay inside the confirmed area** — a prompt about an adjacent market
 *   measures a business the customer did not confirm
 */
function buildFamilyPrompt(
    family: AuditScopeFamily,
    context: PromptBrandContext,
    language: string,
): string {
    const features = (context.coreFeatures || []).filter(Boolean).slice(0, 8)
    const incumbents = (context.incumbents || []).filter(Boolean).slice(0, 6)
    const intents = PROMPT_INTENTS.map(
        (intent) => `- ${intent.key}: ${intent.label}`,
    ).join("\n")

    return `Below is a real product. Write the questions real people actually type into ChatGPT when they have the problem it solves — before they know this product, or any product, exists. The real users use messy, direct, functional language. Users search relative to dominant market leaders they already use.

THE PRODUCT
It is: ${context.subjectType}
${context.category ? `Category: ${context.category}\n` : ""}This part of it: ${family.name} — ${family.description}
The customer's own words for it: ${family.seedKeywords.join(", ")}
${features.length ? `What it does:\n${features.map((feature) => `- ${feature}`).join("\n")}\n` : ""}${context.audience ? `Who has this problem: ${context.audience}\n` : ""}${incumbents.length ? `Tools some of them already use: ${incumbents.join(", ")}\n` : ""}
Write ${PROMPTS_PER_FAMILY} questions someone would type about the problem this part solves.

Background, not instructions: the last two lines are there so you know whose situation to write from and what they might already have tried. People describe what they are working on, not what category of person they are — so do not have anyone announce themselves. And most of these questions should name no product at all; ask about a named tool only where that is genuinely how someone would put it, which is the exception rather than the rule.

Two rules, both about measurement rather than style:
- Never name this product or its website. These questions test whether an assistant recommends it unprompted, and naming it hands over the answer.
- Stay inside the part described above. A question about an adjacent problem measures a business this is not.

Label each question with the situation it comes from:
${intents}

Write them in ${languageName(language)}.`
}

const RESPONSE_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        prompts: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    text: { type: "STRING" as const },
                    intent: { type: "STRING" as const },
                },
                required: ["text", "intent"],
            },
        },
    },
    required: ["prompts"],
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
    families: AuditScopeFamily[],
    options: {
        subjectType: string
        /**
         * ISO-639-1. The language buyers ask in — and therefore the language the
         * answer engines are asked in. An English question measures the English
         * answer, which is the wrong measurement for a brand selling in Spain.
         */
        language?: string
        /**
         * Only the customer's own brand and domains. Competitors belong in
         * `context.incumbents`, where they are material rather than contraband.
         */
        subjectTokens: string[]
        /** What the product is, who buys it, and what they use today. */
        context?: Omit<PromptBrandContext, "subjectType">
        maxPrompts?: number
    },
): Promise<PromptBuildResult> {
    const client = getGeminiClient()
    const cap = options.maxPrompts ?? DEFAULT_PROMPTS_PER_RUN
    const errors: string[] = []
    let callsAttempted = 0
    let callsSucceeded = 0

    const byFamily = new Map<string, BuyerPrompt[]>()

    for (const family of families) {
        let accepted: BuyerPrompt[] = []

        for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_FAMILY; attempt++) {
            callsAttempted++
            if (attempt > 1) {
                const delay =
                    RETRY_BASE_DELAY_MS * 2 ** (attempt - 2) +
                    Math.random() * RETRY_BASE_DELAY_MS
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
                                    ),
                                },
                            ],
                        },
                    ],
                    config: {
                        temperature: 0.4,
                        responseMimeType: "application/json",
                        responseSchema: RESPONSE_SCHEMA,
                    },
                })

                const parsed = JSON.parse(response.text || "{}")
                const rows: Array<{ text?: unknown; intent?: unknown }> =
                    Array.isArray(parsed.prompts) ? parsed.prompts : []

                const validIntents = new Set<string>(
                    PROMPT_INTENTS.map((intent) => intent.key),
                )
                accepted = rows
                    .map((row) => ({
                        text: String(row.text ?? "").trim(),
                        intent: String(row.intent ?? "").trim() as PromptIntentKey,
                    }))
                    // Three checks, and deliberately no more. Everything that
                    // used to live here judged STYLE — first-person openers,
                    // rival names in the wrong shape — and a style filter can
                    // only delete, never improve. It shrank a set of ten to six
                    // and skewed what remained toward exactly the questions it
                    // was meant to balance. Generation is the place to fix
                    // generation.
                    .filter(
                        (row) =>
                            isPlausiblePrompt(row.text) &&
                            validIntents.has(row.intent) &&
                            !namesSubject(row.text, options.subjectTokens),
                    )
                    .map((row) => {
                        const intent = PROMPT_INTENTS.find(
                            (candidate) => candidate.key === row.intent,
                        )!
                        return {
                            text: row.text,
                            textNorm: normalizeQuery(row.text),
                            scopeFamilyId: family.id,
                            intent: row.intent,
                            articleType: intent.articleType,
                            sourceSeed: family.seedKeywords[0] ?? family.name,
                        }
                    })

                if (accepted.length > 0) {
                    callsSucceeded++
                    break
                }
                errors.push(`${family.name}: model returned no usable prompts`)
            } catch (error) {
                errors.push(
                    `${family.name}: ${error instanceof Error ? error.message : String(error)}`,
                )
            }
        }

        if (accepted.length > 0) byFamily.set(family.id, accepted)
    }

    // Round-robin across families up to the cap, so a family that produced 10
    // prompts cannot crowd out one that produced 4. Same fairness rule the
    // harvest applies at `roundRobinCap`; a probe that spends its whole budget
    // on one confirmed area measures that area, not the business.

    const seen = new Set<string>()
    const prompts: BuyerPrompt[] = []
    const cursors = new Map<string, number>()
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
            errors: errors.slice(0, 5),
        },
    }
}
