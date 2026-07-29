/**
 * Google Autocomplete harvester.
 *
 * Autocomplete only returns strings people actually type, which makes it the
 * cheapest source of guaranteed-real queries. We expand each seed against the
 * alphabet and a set of question prefixes, then optionally expand the best
 * results one more level.
 *
 * PROVENANCE: every row stores the exact Suggest request URL it came from.
 * Paste that URL into a browser and the response is the JSON array containing
 * the harvested string. The first version of this file set `source_url: null`
 * on the grounds that "autocomplete has no source page", which made 86% of
 * harvested gaps unverifiable — the request URL *is* the source.
 *
 * This deliberately does NOT reuse `expandKeyword()` from lib/plans/keyword-validator:
 * that helper truncates to 5 suggestions via `validateKeyword`, which throws away
 * half the harvest. We want the full response.
 */

import {
    HarvestedQuery,
    HarvestOptions,
    HarvestOutput,
    normalizeQuery,
    isPlausibleQuery,
    dedupeQueries,
    mapWithConcurrency,
    buildSourceReport,
} from "./types"
import { fetchSuggest, type SuggestResult } from "./suggest-client"

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("")

/** Prefixes that surface intent rather than just alphabetical continuations */
const QUESTION_PREFIXES = ["how to", "what is", "why", "best", "is", "vs", "for"]

/** Concurrent requests against Google. Higher than this starts getting throttled. */
const CONCURRENCY = 6

/** Cap on level-2 expansions — this is where the request count explodes */
const LEVEL_TWO_LIMIT = 20

/**
 * Suggest requests go through the shared client in ./suggest-client, which adds
 * retry, backoff, 429 handling, and a process cache. Provenance is unchanged:
 * `requestUrl` on the result is still the exact URL that produced the string.
 */
type SuggestResponse = SuggestResult

async function fetchSuggestions(
    prefix: string,
    options: HarvestOptions
): Promise<SuggestResponse> {
    return fetchSuggest(prefix, options)
}

/**
 * Builds the level-1 prefix set for a seed:
 * the bare seed, seed + each letter, and each question prefix + seed.
 */
function buildPrefixes(seed: string): string[] {
    const prefixes = [seed]

    for (const letter of ALPHABET) {
        prefixes.push(`${seed} ${letter}`)
    }

    for (const q of QUESTION_PREFIXES) {
        prefixes.push(`${q} ${seed}`)
    }

    return prefixes
}

/** Converts a raw suggestion into a provenance-carrying pool row */
function toHarvestedQuery(suggestion: string, response: SuggestResponse): HarvestedQuery {
    return {
        query: suggestion,
        query_norm: normalizeQuery(suggestion),
        source: "autocomplete",
        // The Suggest request that returned this string — re-runnable evidence
        source_url: response.requestUrl,
        source_seed: response.prefix,
        observed_value: suggestion,
        observed_at: new Date().toISOString(),
    }
}

/**
 * Harvests real search queries from Google Autocomplete for the given seeds.
 *
 * @param seeds       2-6 short noun phrases describing the brand's category
 * @param options     country/language targeting
 * @param deepExpand  run a second expansion pass over the best level-1 results
 */
export async function harvestAutocomplete(
    seeds: string[],
    options: HarvestOptions = {},
    deepExpand: boolean = true
): Promise<HarvestOutput> {
    if (seeds.length === 0) {
        console.warn("[Harvest:Autocomplete] No seeds provided")
        return {
            queries: [],
            report: buildSourceReport("autocomplete", 0, 0, 0, ["No seeds provided"]),
        }
    }

    const collected: HarvestedQuery[] = []
    const errors: string[] = []
    let attempted = 0
    let failed = 0

    const absorb = (responses: (SuggestResponse | null)[]) => {
        for (const response of responses) {
            attempted++
            if (!response || !response.ok) {
                failed++
                if (response?.error) errors.push(`${response.prefix}: ${response.error}`)
                continue
            }
            for (const suggestion of response.suggestions) {
                if (!isPlausibleQuery(suggestion)) continue
                collected.push(toHarvestedQuery(suggestion, response))
            }
        }
    }

    // --- Level 1: seed x alphabet x question prefixes ---
    const levelOnePrefixes = seeds.flatMap(buildPrefixes)

    console.log(
        `[Harvest:Autocomplete] Level 1: ${levelOnePrefixes.length} prefixes from ${seeds.length} seeds`
    )

    absorb(
        await mapWithConcurrency(levelOnePrefixes, CONCURRENCY, (prefix) =>
            fetchSuggestions(prefix, options)
        )
    )

    let queries = dedupeQueries(collected)
    console.log(
        `[Harvest:Autocomplete] Level 1: ${queries.length} unique queries ` +
        `(${failed}/${attempted} requests failed)`
    )

    if (deepExpand && queries.length > 0) {
        // --- Level 2: expand the longest level-1 results ---
        // Longer queries are more specific, so expanding them surfaces long-tail
        // intent rather than more variations of the head term.
        const expansionTargets = [...queries]
            .sort((a, b) => b.query.length - a.query.length)
            .slice(0, LEVEL_TWO_LIMIT)
            .map((q) => q.query)

        console.log(`[Harvest:Autocomplete] Level 2: expanding ${expansionTargets.length} queries`)

        absorb(
            await mapWithConcurrency(expansionTargets, CONCURRENCY, (target) =>
                fetchSuggestions(target, options)
            )
        )

        queries = dedupeQueries(collected)
    }

    console.log(`[Harvest:Autocomplete] Final: ${queries.length} unique queries`)

    return {
        queries,
        report: buildSourceReport("autocomplete", attempted, failed, queries.length, errors),
    }
}
