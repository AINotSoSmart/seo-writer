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
    isSameHost,
    mapWithConcurrency,
    sanitizeSourceContext,
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
 * Bounded parallelism across seeds. The previous sequential loop let each stuck
 * Tavily advanced+markdown call burn 60s, and twelve seeds × timeouts alone
 * could exhaust the audit's 900s Trigger budget before coverage even started.
 */
const SERP_CONCURRENCY = 3

/**
 * Per-seed wall-clock cap. Tavily's client default (~60s) is too long when a
 * seed is hung — fail that seed and keep the rest of the harvest moving.
 */
const SERP_SEED_TIMEOUT_MS = 25_000

/** True if a heading reads as a user question. */
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
type ExtractedQuestion = { question: string; context: string }

function cleanContextLine(value: string): string {
    return stripUiArtifacts(
        value
            .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/[*_`>#]/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
    )
}

function extractQuestions(markdown: string): ExtractedQuestion[] {
    if (!markdown) return []

    const found: ExtractedQuestion[] = []
    const lines = markdown.split("\n")

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const rawLine = lines[lineIndex]
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

        const answer: string[] = []
        for (let next = lineIndex + 1; next < lines.length; next++) {
            const rawAnswerLine = lines[next].trim()
            if (/^#{1,6}\s+/.test(rawAnswerLine) || /^\*\*.+?\*\*:?$/.test(rawAnswerLine)) break
            const cleanedAnswer = cleanContextLine(rawAnswerLine)
            if (!cleanedAnswer) continue
            answer.push(cleanedAnswer)
            if (answer.join(" ").length >= 620) break
        }
        const context = sanitizeSourceContext([deUi, answer.join(" ")]
            .filter(Boolean)
            .join(" — ")
            .slice(0, 700))
        found.push({ question: deUi, context })
        if (found.length >= MAX_QUESTIONS_PER_PAGE) break
    }

    return found
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Request timed out after ${Math.round(ms / 1000)} seconds (${label})`))
        }, ms)
        promise.then(
            (value) => {
                clearTimeout(timer)
                resolve(value)
            },
            (error) => {
                clearTimeout(timer)
                reject(error)
            },
        )
    })
}

type SeedHarvestResult = {
    seed: string
    queries: HarvestedQuery[]
    error: string | null
}

/**
 * Harvests real questions from the pages currently ranking for each seed.
 *
 * @param seeds        short category phrases to search
 * @param searchPrefs  country/topic preferences from the brand
 * @param maxSeeds     cap on seeds processed, to bound Tavily spend
 * @param subjectUrl   the audited site; its own pages are never a gap source
 */
export async function harvestSerpQuestions(
    seeds: string[],
    searchPrefs?: TavilySearchPrefs,
    maxSeeds: number = 6,
    excludeBrands: string[] = [],
    subjectUrl?: string,
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
    const seedsToProcess = seeds.slice(0, maxSeeds)

    const seedResults = await mapWithConcurrency(
        seedsToProcess,
        SERP_CONCURRENCY,
        async (seed): Promise<SeedHarvestResult> => {
            try {
                const { modifiedQuery, options } = buildTavilySearchOptions(seed, searchPrefs, {
                    searchDepth: "advanced",
                    includeRawContent: "markdown",
                    maxResults: MAX_RESULTS_PER_SEED,
                })

                const response = await withTimeout(
                    tvly.search(modifiedQuery, options),
                    SERP_SEED_TIMEOUT_MS,
                    seed,
                )
                const results = response.results || []
                const collected: HarvestedQuery[] = []

                for (const result of results) {
                    // The audited site cannot be evidence of a gap in itself.
                    //
                    // `excludeBrands` already carries the subject, but it only
                    // ever tested the QUESTION TEXT for a brand token — so a
                    // generic FAQ line lifted off the customer's own page
                    // ("Can I include my dog, cat, or another pet in the family
                    // portrait?") contains no brand word, passes, and is sold
                    // back to them as a gap they should pay to fill. Four items
                    // in a real BringBack plan were their own product-page FAQ.
                    //
                    // Nothing is lost by skipping the host: the subject's pages
                    // were never a demand signal. Autocomplete is. A question
                    // that is genuinely searched still arrives from there — and
                    // arrives corroborated.
                    if (isSameHost(result.url, subjectUrl)) continue

                    const markdown: string = result.rawContent || result.content || ""
                    const questions = extractQuestions(markdown)

                    // A page's own brand name, so "Can I use Media.io's AI family
                    // portraits...?" is rejected without needing Media.io on any
                    // list. Every harvested page supplies its own exclusion.
                    const sourceBrand = brandTokensFromUrls([result.url])

                    for (const extracted of questions) {
                        const question = extracted.question
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
                            source_context: extracted.context,
                            observed_at: new Date().toISOString(),
                        })
                    }
                }

                console.log(
                    `[Harvest:SERP] "${seed}": ${results.length} pages -> ${collected.length} questions`,
                )
                return { seed, queries: collected, error: null }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error)
                console.error(`[Harvest:SERP] Failed for seed "${seed}":`, message)
                return { seed, queries: [], error: `${seed}: ${message}` }
            }
        },
    )

    const collected: HarvestedQuery[] = []
    const errors: string[] = []
    let failed = 0

    for (const result of seedResults) {
        if (!result) {
            // mapWithConcurrency only nulls on unexpected throw; treat as failed.
            failed++
            errors.push("unknown: seed worker returned null")
            continue
        }
        if (result.error) {
            failed++
            errors.push(result.error)
            continue
        }
        collected.push(...result.queries)
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
