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

/**
 * The buyer situations worth testing, and why each is here.
 *
 * `weight` is how many prompts of that intent each family gets. Commercial
 * intents are weighted up because they are the ones where an engine answers
 * with a list of named products — an informational prompt that returns an
 * explanation mentions nobody, and an absence there means very little.
 */
export const PROMPT_INTENTS = [
    {
        key: "recommendation",
        weight: 3,
        brief: "asks the assistant to recommend a tool or provider for a specific job",
        articleType: "commercial" as const,
    },
    {
        key: "alternatives",
        weight: 2,
        brief: "asks for alternatives or options in this category, without naming any brand",
        articleType: "commercial" as const,
    },
    {
        key: "comparison",
        weight: 2,
        brief: "asks how to choose between options, or what to look for when choosing",
        articleType: "commercial" as const,
    },
    {
        key: "problem",
        weight: 2,
        brief: "describes the underlying problem in the buyer's own words and asks how to solve it",
        articleType: "informational" as const,
    },
    {
        key: "howto",
        weight: 1,
        brief: "asks how to actually carry out the job",
        articleType: "howto" as const,
    },
] as const

export type PromptIntentKey = (typeof PROMPT_INTENTS)[number]["key"]

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

/** Prompts per family, before dedup. Sum of intent weights = 10. */
export const PROMPTS_PER_FAMILY = PROMPT_INTENTS.reduce(
    (total, intent) => total + intent.weight,
    0,
)

/** Hard ceiling on one probe run, protecting spend and wall-clock. */
export const MAX_PROMPTS_PER_RUN = 60

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
    const words = trimmed.split(/\s+/)
    if (words.length < 4 || words.length > 30) return false
    if (/https?:\/\/|[<>{}]/.test(trimmed)) return false
    const letters = (trimmed.match(/[a-z]/gi) || []).length
    return letters / trimmed.length >= 0.6
}

/**
 * True when the prompt names the subject brand or a tracked competitor.
 *
 * Such a prompt is not a discovery question. "Is Acme good for X" measures
 * whether the engine has an opinion about Acme, which is a different product
 * than the one being built here: we are asking whether a buyer who has never
 * heard of Acme is told about it.
 */
function namesTrackedEntity(text: string, entityTokens: string[]): boolean {
    const flattened = text.toLowerCase().replace(/[^a-z0-9]/g, "")
    return entityTokens.some((token) => {
        const needle = token.toLowerCase().replace(/[^a-z0-9]/g, "")
        return needle.length >= 4 && flattened.includes(needle)
    })
}

function buildFamilyPrompt(
    family: AuditScopeFamily,
    subjectType: string,
): string {
    const operations = family.capabilityContract.operations
        .slice(0, 4)
        .map((operation) => `- ${operation.customerJob}: ${operation.action}`)
        .join("\n")

    const intents = PROMPT_INTENTS.map(
        (intent) => `- ${intent.key} (${intent.weight} prompts): ${intent.brief}`,
    ).join("\n")

    return `You write the questions real buyers type into AI assistants like ChatGPT when they are trying to solve a problem — before they know which products exist.

BUSINESS AREA (confirmed by the customer, do not widen or reinterpret it)
Name: ${family.name}
What it covers: ${family.description}
Customer's own words for it: ${family.seedKeywords.join(", ")}
Delivered as: ${subjectType}
Jobs this area actually performs:
${operations || "- (no operations recorded)"}

WRITE ${PROMPTS_PER_FAMILY} PROMPTS, distributed exactly like this:
${intents}

RULES
- Write what a buyer types, not what a marketer would search. Full questions or requests, not keyword fragments.
- Never name any brand, product, or company — including the customer's. These prompts test who the assistant names on its own.
- Stay strictly inside the business area above. A prompt about an adjacent problem is worse than no prompt.
- Each prompt must stand alone with no prior context.
- Vary the buyer's situation and constraints; do not write ${PROMPTS_PER_FAMILY} rewordings of one question.
- Write in the same language as the customer's own words above.`
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
        /** Brand tokens to reject: the subject and every tracked competitor. */
        entityTokens: string[]
        maxPrompts?: number
    },
): Promise<PromptBuildResult> {
    const client = getGeminiClient()
    const cap = options.maxPrompts ?? MAX_PROMPTS_PER_RUN
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
                            parts: [{ text: buildFamilyPrompt(family, options.subjectType) }],
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
                    .filter(
                        (row) =>
                            isPlausiblePrompt(row.text) &&
                            validIntents.has(row.intent) &&
                            !namesTrackedEntity(row.text, options.entityTokens),
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
