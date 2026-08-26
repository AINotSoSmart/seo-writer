import type { PromptIntentKey } from "./prompt-config.ts"

/**
 * There is no incumbent share any more. `MAX_INCUMBENT_PROMPT_SHARE = 0.15`
 * used to allow six of forty questions to name a rival; that quota is gone and
 * the number is zero, enforced as a rejection in `buildBuyerPrompts`.
 *
 * WHY. We hold verified facts about the customer's product — a capability
 * contract with evidence refs behind every claim. We hold **nothing** about a
 * rival's feature set. So a generated question like "is kinpict.com good for
 * making group portraits from individual headshots?" asserts a capability we
 * have never checked. When the assertion is wrong the engine answers a false
 * premise, and the question is spent.
 *
 * These questions are durable — confirmed once, then re-run every cycle — so a
 * false premise is not a bad sample, it is a permanently wrong row in a
 * subscription the customer pays for monthly.
 *
 * It also contradicted the rule directly above it in the instruction: naming
 * the subject was forbidden because "naming it hands over the answer". Naming a
 * rival hands over the same answer, guarantees that rival appears, and then
 * `adjustedBrandRank` has to discount the whole result as prompt-induced. The
 * measurement was paying for questions it would later refuse to count.
 */
export const NAMED_BRAND_PROMPTS_ALLOWED = 0 as const

const TOKEN_STOPWORDS = new Set([
    "a",
    "am",
    "an",
    "and",
    "are",
    "as",
    "be",
    "but",
    "do",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "my",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "what",
    "with",
])

function contentTokens(value: string): Set<string> {
    return new Set(
        value
            .normalize("NFKC")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, " ")
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 3 && !TOKEN_STOPWORDS.has(token)),
    )
}

/**
 * Rejects paraphrases which ask the same buyer need across overlapping topics.
 *
 * Four shared content words plus 35% containment catches the live pairs
 * ("build topical authority ... SaaS blog" and "best way ... cluster
 * strategy") without treating every question beginning "what is the best
 * way" as the same question.
 */
export function promptsAreNearDuplicates(left: string, right: string): boolean {
    const leftTokens = contentTokens(left)
    const rightTokens = contentTokens(right)
    if (leftTokens.size === 0 || rightTokens.size === 0) return false

    const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length
    const smaller = Math.min(leftTokens.size, rightTokens.size)
    return shared >= 4 && shared / smaller >= 0.35
}

/** Extract stable brand needles from names, domains, or URLs. */
export function incumbentNeedles(values: string[]): string[] {
    const needles = new Set<string>()
    for (const value of values) {
        const raw = value.trim().toLowerCase()
        if (!raw) continue
        needles.add(raw.replace(/[^a-z0-9]/g, ""))
        try {
            const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
            const host = url.hostname.replace(/^www\./, "")
            needles.add(host.replace(/[^a-z0-9]/g, ""))
            const label = host.split(".")[0]
            if (label.length >= 4) needles.add(label.replace(/[^a-z0-9]/g, ""))
        } catch {
            // A plain product name is still a useful needle.
        }
    }
    return [...needles].filter((needle) => needle.length >= 4)
}

export function mentionsIncumbent(text: string, needles: string[]): boolean {
    const flattened = text.toLowerCase().replace(/[^a-z0-9]/g, "")
    return needles.some((needle) => flattened.includes(needle))
}

/** Durable monthly questions must not silently turn into last year's wording. */
export function containsCalendarYear(text: string): boolean {
    return /\b(?:19|20|21)\d{2}\b/.test(text)
}

/**
 * `inferPromptIntent` USED TO LIVE HERE. It is deleted, not moved.
 *
 * It read a finished question with regexes and guessed which of five intents it
 * was. Its `recommendation` branch matched essentially any question containing
 * "what/which ... tool", and its fallback was `recommendation` too, so a
 * measured set of 31 distinct questions came back with 24 labelled
 * `recommendation` — a label with no information in it, printed on the customer's
 * dashboard as though there were.
 *
 * It was introduced because a model had once collapsed a whole batch to one
 * label. The answer to a model labelling badly is not a regex labelling worse;
 * it is to ask the model that wrote the question, which holds the brand context
 * and already returns `selectionClass` and `scenario` in the same object. See
 * `prompt-template.ts` for the field and `prompt-builder.ts` for the fallback
 * when it returns something unusable.
 */
