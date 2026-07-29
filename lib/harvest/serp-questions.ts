/**
 * SERP question harvester.
 *
 * NOTE ON NAMING: this does not scrape Google's "People Also Ask" box — Tavily
 * exposes no such endpoint, and claiming otherwise would be exactly the kind of
 * unfalsifiable data this rewrite exists to remove.
 *
 * What it actually does: pulls the top-ranking pages for each seed and extracts
 * the question-shaped headings those pages already answer. Every question comes
 * back with the URL it was read from, so any claim built on it can be verified
 * by opening that page. In practice this is a stronger signal than the PAA box,
 * because these are the questions pages currently ranking chose to answer.
 */

import { tavily } from "@tavily/core"
import { buildTavilySearchOptions, TavilySearchPrefs } from "@/lib/tavily-search"
import { stripUiArtifacts } from "./page-document"
import {
    HarvestedQuery,
    HarvestOutput,
    normalizeQuery,
    isPlausibleQuery,
    dedupeQueries,
    buildSourceReport,
    containsExcludedBrand,
    brandTokensFromUrls,
} from "./types"

/** Interrogatives that make a heading a question even without a "?" */
const QUESTION_STARTERS = [
    "how", "what", "why", "when", "where", "who", "which",
    "can", "do", "does", "did", "is", "are", "was", "were",
    "should", "will", "would", "could", "must",
]

const MAX_RESULTS_PER_SEED = 10
const MAX_QUESTIONS_PER_PAGE = 15

/**
 * True if a heading reads as a user question.
 */
function isQuestionShaped(text: string): boolean {
    const t = text.trim().toLowerCase()
    if (t.endsWith("?")) return true

    const firstWord = t.split(/\s+/)[0]?.replace(/[^a-z]/g, "") || ""
    return QUESTION_STARTERS.includes(firstWord)
}

/**
 * Extracts question-shaped headings from a page's markdown content.
 * Looks at markdown headings and bold standalone lines, which is how FAQ
 * blocks survive Tavily's HTML-to-markdown conversion.
 */
function extractQuestions(markdown: string): string[] {
    if (!markdown) return []

    const found: string[] = []

    for (const rawLine of markdown.split("\n")) {
        const line = rawLine.trim()
        if (!line) continue

        let candidate: string | null = null

        // Markdown headings: ## How do I restore old photos?
        const heading = line.match(/^#{2,4}\s+(.+)$/)
        if (heading) {
            candidate = heading[1]
        }

        // Standalone bold lines, common in FAQ sections: **Is it safe?**
        const bold = line.match(/^\*\*(.+?)\*\*:?$/)
        if (bold) {
            candidate = bold[1]
        }

        if (!candidate) continue

        // Strip residual markdown/anchor syntax
        const cleaned = candidate
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/[*_`#]/g, "")
            .trim()

        const deUi = stripUiArtifacts(cleaned)

        if (!isQuestionShaped(deUi)) continue
        if (!isPlausibleQuery(deUi)) continue

        found.push(deUi)
        if (found.length >= MAX_QUESTIONS_PER_PAGE) break
    }

    return found
}

/**
 * Harvests real questions from the pages currently ranking for each seed.
 *
 * @param seeds        short category phrases to search
 * @param searchPrefs  country/topic preferences from the brand
 * @param maxSeeds     cap on seeds processed, to bound Tavily spend
 */
export async function harvestSerpQuestions(
    seeds: string[],
    searchPrefs?: TavilySearchPrefs,
    maxSeeds: number = 6,
    excludeBrands: string[] = []
): Promise<HarvestOutput> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
        const message = "TAVILY_API_KEY not configured"
        console.error(`[Harvest:SERP] ${message}`)
        // attempted=1/failed=1 so this registers as a hard failure rather than
        // an empty-but-healthy source.
        return { queries: [], report: buildSourceReport("paa", 1, 1, 0, [message]) }
    }

    const tvly = tavily({ apiKey })
    const collected: HarvestedQuery[] = []
    const errors: string[] = []
    const seedsToProcess = seeds.slice(0, maxSeeds)
    let failed = 0

    for (const seed of seedsToProcess) {
        try {
            const { modifiedQuery, options } = buildTavilySearchOptions(seed, searchPrefs, {
                searchDepth: "advanced",
                includeRawContent: "markdown",
                maxResults: MAX_RESULTS_PER_SEED,
            })

            const response = await tvly.search(modifiedQuery, options)
            const results = response.results || []

            for (const result of results) {
                const markdown: string = result.rawContent || result.content || ""
                const questions = extractQuestions(markdown)

                // A page's own brand name, so "Can I use Media.io's AI family
                // portraits...?" is rejected without needing Media.io on any
                // list. Every harvested page supplies its own exclusion.
                const sourceBrand = brandTokensFromUrls([result.url])

                for (const question of questions) {
                    // A rival's own support FAQ is observed but useless as a topic
                    if (containsExcludedBrand(question, excludeBrands)) continue
                    if (containsExcludedBrand(question, sourceBrand)) continue

                    collected.push({
                        query: question,
                        query_norm: normalizeQuery(question),
                        source: "paa",
                        // The page we actually read this question from
                        source_url: result.url,
                        source_seed: seed,
                        observed_value: question,
                        observed_at: new Date().toISOString(),
                    })
                }
            }

            console.log(
                `[Harvest:SERP] "${seed}": ${results.length} pages -> ${collected.length} questions so far`
            )
        } catch (error: any) {
            failed++
            const message = error?.message || String(error)
            errors.push(`${seed}: ${message}`)
            console.error(`[Harvest:SERP] Failed for seed "${seed}":`, message)
        }
    }

    const unique = dedupeQueries(collected)
    const report = buildSourceReport("paa", seedsToProcess.length, failed, unique.length, errors)

    if (report.hardFailure) {
        // Loud, because the previous run silently produced zero SERP questions
        // from a bad API key and still reported overall success.
        console.error(
            `[Harvest:SERP] HARD FAILURE — all ${seedsToProcess.length} searches failed. ` +
            `First error: ${errors[0] || "unknown"}`
        )
    } else {
        console.log(`[Harvest:SERP] Final: ${unique.length} unique questions`)
    }

    return { queries: unique, report }
}
