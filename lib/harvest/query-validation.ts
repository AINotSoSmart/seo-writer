/**
 * Search-demand validation for page-derived strings.
 *
 * WHY THIS EXISTS: reading headings and titles off real pages gives perfect
 * provenance but poor precision. Alongside genuine questions it picks up
 * navigation labels, testimonial headers, marketing fragments and service FAQs —
 * "Why Our Photo Repair Service", "What Creators Say About Animate Photo",
 * "When it comes to amazing videos, all you need is V...". Each of these was
 * genuinely observed on a page, so provenance cannot reject them.
 *
 * Two rounds of regex blocklists caught the previous round's examples and
 * missed the next, which is the signature of the wrong approach. The structural
 * test is evidential rather than lexical:
 *
 *     does Google Autocomplete suggest anything close to this string?
 *
 * If nobody types it, it is page furniture regardless of how it reads. This
 * reuses the harvest's own autocomplete client, so it costs one free request
 * per candidate and no API budget.
 *
 * Autocomplete-sourced rows skip this check — they came from autocomplete.
 */

import { HarvestedQuery, HarvestOptions, mapWithConcurrency, normalizeQuery } from "./types"
import { fetchSuggest } from "./suggest-client"

const CONCURRENCY = 6

/**
 * Share of the candidate's content words that must appear in a single
 * autocomplete suggestion for it to count as a real search.
 *
 * CALIBRATION STATUS: PROVISIONAL. 0.6 keeps long-tail questions whose wording
 * differs slightly from the suggestion while rejecting strings that share only
 * a topic word or two.
 */
export const DEMAND_OVERLAP_THRESHOLD = 0.6

/**
 * Longest query this test is valid for.
 *
 * Autocomplete's suggestion index is biased toward short head and mid-tail
 * strings; it rarely returns anything for an eight-word question. Applying the
 * test anyway does not measure demand, it measures the oracle's coverage — and
 * it cut legitimate long-tail questions wholesale on pixreunion.com ("Can I
 * include pets in my family portrait?", "What photo quality do I need for
 * uploads?", "Can I customize backgrounds in the AI family portraits?").
 *
 * Longer strings bypass this demand check and are left to the positive
 * confirmed-family classifier and the coverage evidence stage.
 */
export const MAX_WORDS_FOR_DEMAND_CHECK = 7

/** Words too common to count as evidence of a shared query */
const STOPWORDS = new Set([
    "a", "an", "the", "of", "to", "in", "on", "for", "and", "or", "is", "are",
    "do", "does", "did", "can", "how", "what", "why", "when", "where", "who",
    "my", "your", "our", "it", "this", "that", "with", "from", "at", "by",
])

function contentWords(text: string): string[] {
    return (normalizeQuery(text).match(/[\p{L}\p{N}]+/gu) || [])
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/**
 * Demand checks share the resilient client in ./suggest-client, so they inherit
 * retry, backoff, 429 handling, and the process cache. The cache matters here:
 * this stage and the harvester query overlapping prefixes within one audit, and
 * a re-audit repeats them entirely.
 *
 * `ok` is false only when the request itself failed. A successful response with
 * an empty array is real evidence of no demand and must not be conflated with a
 * network error — conflating them once let 72 checks resolve as "inconclusive"
 * and passed page furniture straight through.
 */
async function fetchSuggestions(
    query: string,
    options: HarvestOptions
): Promise<{ suggestions: string[]; ok: boolean }> {
    const result = await fetchSuggest(query, options)
    return { suggestions: result.suggestions, ok: result.ok }
}

/**
 * True when autocomplete offers something substantially overlapping the
 * candidate — evidence that people actually search it.
 */
function hasSearchDemand(candidate: string, suggestions: string[]): boolean {
    const candidateWords = contentWords(candidate)
    if (candidateWords.length === 0) return false

    for (const suggestion of suggestions) {
        const suggestionWords = new Set(contentWords(suggestion))
        const matched = candidateWords.filter((w) => suggestionWords.has(w)).length
        if (matched / candidateWords.length >= DEMAND_OVERLAP_THRESHOLD) return true
    }

    return false
}

/**
 * Which of these phrases does Google actually suggest?
 *
 * Used on the scope-confirmation screen. A product area whose search phrases
 * have no autocomplete demand is usually a mispositioning — "design handoff and
 * implementation" describes a mechanism nobody types, while "ai ui design
 * generator" is what its customers actually search. Reporting that before any
 * research money is spent is far cheaper than discovering it in the plan.
 *
 * Advisory, never a gate: it fails open on a request error, and the founder is
 * always free to keep a phrase we could not verify.
 */
export async function findSeedsWithoutDemand(
    seeds: string[],
    options: HarvestOptions = {},
): Promise<string[]> {
    const testable = seeds.filter(
        (seed) => seed.trim().split(/\s+/).length <= MAX_WORDS_FOR_DEMAND_CHECK,
    )
    const results = await Promise.all(
        testable.map(async (seed) => {
            try {
                const { suggestions, ok } = await fetchSuggestions(seed, options)
                if (!ok) return null
                return hasSearchDemand(seed, suggestions) ? null : seed
            } catch {
                return null
            }
        }),
    )
    return results.filter((seed): seed is string => seed !== null)
}

export interface DemandFilterResult {
    kept: HarvestedQuery[]
    dropped: Array<{ query: string; source: string }>
    requestsAttempted: number
    /** Requests that failed — those candidates are kept, not silently cut */
    checkFailures: number
}

/**
 * Drops page-derived strings that show no autocomplete demand.
 *
 * Fails open per candidate: a failed request keeps the row, because dropping
 * real queries on a network blip is worse than admitting a little furniture.
 */
export async function filterToSearchedQueries(
    queries: HarvestedQuery[],
    options: HarvestOptions = {}
): Promise<DemandFilterResult> {
    // Exempt: autocomplete rows (already proven searched) and long questions
    // (autocomplete is not a valid oracle for them)
    const testable = (q: HarvestedQuery) =>
        q.source !== "autocomplete" &&
        q.query.trim().split(/\s+/).length <= MAX_WORDS_FOR_DEMAND_CHECK

    const exempt = queries.filter((q) => !testable(q))
    const candidates = queries.filter(testable)

    if (candidates.length === 0) {
        return {
            kept: exempt,
            dropped: [],
            requestsAttempted: 0,
            checkFailures: 0,
        }
    }

    console.log(`[DemandFilter] Checking ${candidates.length} page-derived strings`)

    const results = await mapWithConcurrency(candidates, CONCURRENCY, async (q) => {
        const { suggestions, ok } = await fetchSuggestions(q.query, options)

        // Request failed: inconclusive, keep the row rather than cut it blind.
        if (!ok) return { q, searched: true, failed: true }

        // Request succeeded with nothing to offer: that is evidence of no
        // demand, not an error. Drop it.
        return { q, searched: hasSearchDemand(q.query, suggestions), failed: false }
    })

    const kept: HarvestedQuery[] = [...exempt]
    const dropped: DemandFilterResult["dropped"] = []
    let checkFailures = 0

    for (const result of results) {
        if (!result) {
            checkFailures++
            continue
        }
        if (result.failed) checkFailures++

        if (result.searched) {
            kept.push(result.q)
        } else {
            dropped.push({ query: result.q.query, source: result.q.source })
        }
    }

    console.log(
        `[DemandFilter] Kept ${kept.length} (${exempt.length} autocomplete-exempt), ` +
        `dropped ${dropped.length} with no search demand, ${checkFailures} checks inconclusive`
    )

    return {
        kept,
        dropped,
        requestsAttempted: candidates.length,
        checkFailures,
    }
}
