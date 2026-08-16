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
 * Interleaves a family's prompts so every buyer situation is represented early.
 *
 * The run cap is a hard budget — ten prompts across every confirmed area — so
 * only the first one or two from each family survive it. Taking them in the
 * order the model happened to emit meant the cap, not the design, chose which
 * buyer situations got measured. On a live run that produced four questions for
 * one family that were two "alternatives" and two "comparison", and not a single
 * problem-first question anywhere in the set.
 *
 * Ordering here is by the declared mix: one of each intent in `PROMPT_INTENTS`
 * order, then the next of each, and so on. Weight still decides how many of each
 * the model writes; this only decides who is at the front of the queue.
 */
function orderByIntentMix(prompts: BuyerPrompt[]): BuyerPrompt[] {
    const byIntent = new Map<string, BuyerPrompt[]>()
    for (const prompt of prompts) {
        const bucket = byIntent.get(prompt.intent)
        if (bucket) bucket.push(prompt)
        else byIntent.set(prompt.intent, [prompt])
    }

    const ordered: BuyerPrompt[] = []
    let round = 0
    while (ordered.length < prompts.length) {
        let placed = false
        for (const intent of PROMPT_INTENTS) {
            const bucket = byIntent.get(intent.key)
            const candidate = bucket?.[round]
            if (!candidate) continue
            ordered.push(candidate)
            placed = true
        }
        // Nothing left at this depth in any bucket — every prompt is placed.
        if (!placed) break
        round += 1
    }
    return ordered
}

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

/** Does this text name any of the tracked rivals? */
function namesAnyIncumbent(text: string, incumbents: string[]): boolean {
    const flattened = text.toLowerCase().replace(/[^a-z0-9]/g, "")
    return incumbents.some((name) => {
        const needle = name.toLowerCase().replace(/[^a-z0-9]/g, "")
        return needle.length >= 4 && flattened.includes(needle)
    })
}

/**
 * True when the prompt is written from a person's situation rather than as a
 * topic.
 *
 * A positive structural test, not a banned-words list — this repo has twice been
 * burned by blocklists that caught the previous examples and missed the next. It
 * asks for evidence that a human is speaking, which is a fact about the string.
 *
 * **This used to accept "or it names an incumbent" as sufficient, and that was a
 * bug with visible consequences.** Naming a rival is the cheapest way for a
 * model to look concrete, so every shape used one; and because the filter then
 * waved those through while holding the problem-first shapes to a real standard,
 * survival was biased toward exactly the prompts that named a tool. A live run
 * came back as ten variations of "X is too expensive, what else?" with the six
 * weights' worth of problem-first questions filtered out entirely. First person
 * is now required of every shape, and naming a rival buys nothing.
 */
function readsLikeAPerson(text: string): boolean {
    const lower = text.toLowerCase()
    // Word boundaries are load-bearing: without them "i" matches inside
    // "editable" and every candidate passes, making this test decorative.
    return (
        /\b(i|i'm|im|i've|ive|we|we're|were|my|our|us)\b/.test(lower) ||
        /\bwhat (are|is) (people|everyone|most|devs|developers|teams|founders)\b/.test(
            lower,
        )
    )
}

/** Everything about the business that makes a prompt sound like a person. */
export interface PromptBrandContext {
    /** Plain description of the product — "browser tool that generates app screens". */
    subjectType: string
    /** Who buys it, in the customer's own words. */
    audience?: string
    /** What it actually does, a few concrete capabilities. */
    coreFeatures?: string[]
    /**
     * Tools the buyer already uses or is trying to move off.
     *
     * These may be NAMED in a prompt, and that is the point. Comparative
     * framing — "X is too expensive for what I need, what else does Y?" — is
     * how buyers actually ask, and it is the phrasing that makes an engine list
     * challengers instead of reciting the same three market leaders. The
     * customer's OWN brand is still banned; see `namesSubject`.
     */
    incumbents?: string[]
}

function buildFamilyPrompt(
    family: AuditScopeFamily,
    context: PromptBrandContext,
    language: string,
): string {
    const operations = family.capabilityContract.operations
        .slice(0, 4)
        .map((operation) => `- ${operation.customerJob}: ${operation.action}`)
        .join("\n")

    const intents = PROMPT_INTENTS.map(
        (intent) => `- ${intent.key} (${intent.weight} prompts): ${intent.brief}`,
    ).join("\n")

    const incumbents = (context.incumbents || []).filter(Boolean).slice(0, 6)
    const features = (context.coreFeatures || []).filter(Boolean).slice(0, 6)

    return `You write the messages real people type into ChatGPT when they are stuck and want a tool recommendation. Not search queries. Not blog titles. Messages.

BUSINESS AREA (confirmed by the customer — do not widen or reinterpret it)
Name: ${family.name}
What it covers: ${family.description}
Customer's own words for it: ${family.seedKeywords.join(", ")}
Delivered as: ${context.subjectType}
Jobs this area actually performs:
${operations || "- (no operations recorded)"}
${features.length ? `What the product actually does:\n${features.map((feature) => `- ${feature}`).join("\n")}\n` : ""}${context.audience ? `Who buys it: ${context.audience}\n` : ""}${
        incumbents.length
            ? `Tools these buyers already use or are trying to replace (you MAY name these):\n${incumbents.map((name) => `- ${name}`).join("\n")}\n`
            : ""
    }
WRITE ${PROMPTS_PER_FAMILY} PROMPTS, in these shapes, this many of each:
${intents}

THE SHAPE OF A REAL PROMPT
  who I am / what I'm using  +  what is going wrong  +  what I want

Real, naming nothing (this is the common case):
       "I'm building an MVP and I've got a folder of app screenshots. Is there
        something that turns them into editable components so I don't redraw
        everything by hand?"
Real, naming an incumbent (only the two marked shapes):
       "Figma is overkill for what I'm doing — I just need to hand a developer
        clean screens. What are people using instead?"
Fake:  "What is the best tool to turn a static screenshot into an editable
        mobile UI design?"

The second one is a blog title with a question mark. It is not just unrealistic
— it produces a WORSE measurement, because a formal category question makes the
assistant fall back to the safest possible listicle of whichever legacy tools
have the most written about them.

RULES
- First person, always, every shape. Start from the buyer's situation: "I'm…", "I've got…", "I need…", "We're on…", or "What are people using…".
- Every prompt carries at least one concrete anchor: a stack or platform, a number, a file format, a deadline, the material they are working with, or a specific annoyance. A prompt with no anchor is not a real message.
- **Most buyers naming no tool.** Only the two shapes marked [NAME a tool] may mention one — those are the buyer who already has something and wants off it. The three marked [NAME NO TOOL AT ALL] are the buyer who has a problem and does not know what exists yet, which is the larger half of how people actually ask. For those, the anchor must come from their situation, never from a brand.
- Never name the customer's own product in any shape — these prompts test whether an assistant recommends it unprompted, and naming it gives away the answer.
- BANNED openings, because they are SEO artifacts rather than things people type: "What is the best…", "What are the best…", "Top tools for…", "How to [x] without [y]".
- BANNED words, because no one types them at a chatbot: streamlined, seamless, cutting-edge, robust, efficiently, leverage, solution that provides, developer-ready, best-in-class.
- Stay strictly inside the business area above. An adjacent problem is worse than no prompt.
- Each prompt stands alone with no prior context, and reads like one message — one or two sentences.
- Vary the situation. ${PROMPTS_PER_FAMILY} rewordings of one question measures one question.
- Write every prompt in ${languageName(language)}. Do not translate the business area above — quote its terms as the customer wrote them.`
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
                    .filter((row) => {
                        if (!isPlausiblePrompt(row.text)) return false
                        if (!validIntents.has(row.intent)) return false
                        if (namesSubject(row.text, options.subjectTokens)) return false
                        if (!readsLikeAPerson(row.text)) return false

                        // A rival name belongs only in the two shapes that are
                        // ABOUT having a rival. Everywhere else it is the model
                        // reaching for the cheapest concrete detail, and it
                        // turns a "buyer who does not know what exists" question
                        // into a switching question — collapsing the run onto
                        // one buyer situation out of five.
                        const shape = PROMPT_INTENTS.find(
                            (candidate) => candidate.key === row.intent,
                        )
                        if (
                            shape &&
                            !shape.namesIncumbent &&
                            namesAnyIncumbent(row.text, options.context?.incumbents || [])
                        ) {
                            return false
                        }
                        return true
                    })
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

        if (accepted.length > 0) byFamily.set(family.id, orderByIntentMix(accepted))
    }

    // Round-robin across families up to the cap, so a family that produced 10
    // prompts cannot crowd out one that produced 4. Same fairness rule the
    // harvest applies at `roundRobinCap`; a probe that spends its whole budget
    // on one confirmed area measures that area, not the business.
    //
    // Each family's pool is interleaved by intent first (see orderByIntentMix),
    // so the prompts that survive the cap span the designed mix of buyer
    // situations rather than whichever ones the model happened to write first.
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
