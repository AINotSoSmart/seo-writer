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
 * Classifies the finished question instead of trusting a model label which may
 * collapse an entire batch to one value. This never changes the question; it
 * only selects the downstream article contract.
 */
export function inferPromptIntent(text: string, fallback: PromptIntentKey): PromptIntentKey {
    const value = text.toLowerCase()

    if (
        /\b(is|are) there (?:a|an|any)?\s*(tool|tools|software|platforms?|services?|apps?)\b/.test(
            value,
        ) ||
        /\b(what|which) (?:is the )?(?:best )?(tool|software|platform|service|app)\b/.test(
            value,
        ) ||
        /\bi need (?:a|an) (tool|software|platform|service|app)\b/.test(value) ||
        /\b(best|top|recommend(?:ed|ation)?)\b.{0,35}\b(tool|tools|software|platform|service|app|option|options)\b/.test(
            value,
        )
    ) {
        return "recommendation"
    }
    if (
        /\b(alternatives?|other than|replace|replacement|switch from|move away from|something else|something better|better way|what (?:else|should i use instead))\b/.test(
            value,
        ) ||
        /\b(?:i (?:use|am using)|[a-z0-9.]+ is)\b.{0,80}\bwhat should i use\b/.test(
            value,
        )
    ) {
        return "alternatives"
    }
    if (
        /\b(vs\.?|versus|compare|compared to|comparison|difference between|differ(?:s|ent)? from|better than)\b/.test(
            value,
        )
    ) {
        return "comparison"
    }
    if (
        /\b(why (?:is|isn'?t|are|aren'?t)|isn'?t|aren'?t|can'?t|cannot|not ranking|not showing|not appearing|invisible|rankings? (?:are )?flat|ignoring)\b/.test(
            value,
        ) ||
        /^\s*(?:my|i am|we are)\b.{0,60}\b(struggl|failing|wrong|problem)\b/.test(value) ||
        /\bi have\b.{0,80}\b(?:but )?no\b/.test(
            value,
        )
    ) {
        return "problem"
    }
    if (
        /\b(how do i|how can i|how to|can i|is there a way|what is the (?:best|fastest|most efficient|most effective) way|what's the best way|best practices?|techniques? for|strategies? for)\b/.test(
            value,
        )
    ) {
        return "howto"
    }

    return fallback
}
