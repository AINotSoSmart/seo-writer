/**
 * Query fan-out: the sub-queries an answer engine actually ran on the buyer's
 * behalf, aggregated across a run.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS, AND THE ONE THING IT MUST NEVER BE CALLED
 *
 * When someone asks ChatGPT "what's the best tool for turning a sketch into a
 * working app screen?", the engine does not search for that sentence. It
 * decomposes it into its own searches. Cloro exposes those, and we already
 * request and store them (`ai_probe_results.search_queries`).
 *
 * That makes this the only demand-side signal in the product that is *observed
 * on the AI surface itself*. Everything else about demand — Google
 * autocomplete in the harvest, and the search-volume vendors — describes what
 * people type into Google, which is the proxy this whole pivot exists to stop
 * relying on.
 *
 * **It is not volume, and it must never be rendered as volume.** A sub-query
 * appearing in 12 of 42 prompts means the engine kept converging on that
 * framing across the questions *we* chose to ask. It says nothing about how
 * many humans searched it. Ansvisor's `est_ai_volume` — Google Ads volume for
 * five LLM-guessed head terms, multiplied by a hardcoded 0.15 — is what
 * happens when a team wants a volume column badly enough to manufacture one.
 * The count here is honest precisely because it is small and literal.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COVERAGE IS UNEVEN AND THAT HAS TO BE VISIBLE
 *
 * Cloro's own note, carried over from upstream's scraper: Perplexity and
 * Copilot populate the fan-out; **ChatGPT surfaces the key but returns it
 * empty in practice**. Since `chatgpt-web` is half our default pair, a run can
 * legitimately produce little or no fan-out.
 *
 * So the aggregate reports, per engine, whether it contributed anything. A
 * silent empty section would read as "the engines did no searching", which is
 * false and is exactly the broken-source-looks-like-absence failure this
 * codebase keeps having to relearn.
 */

// Relative with explicit `.ts` extensions, matching `harvest/absorption.ts` and
// for the same reason: this module must load under plain node so the contract
// suite can assert its behaviour rather than grep its source. `AiEngine` is a
// type-only import and is erased, so nothing here pulls in `engines.ts` at
// runtime — which is also why this file carries no display names. Labelling is
// the UI's job; this is a counter.
import { normalizeQuery } from "../harvest/types.ts"
import type { AiEngine } from "./engines.ts"

/** One sub-query the engines were observed running, rolled up over a run. */
export interface FanOutQuery {
    /** The most frequently observed raw form. */
    query: string
    /** Normalised form used to group variants. */
    queryNorm: string
    /** How many distinct buyer prompts caused this sub-query to be run. */
    prompts: number
    /** How many individual answers ran it (>= prompts when engines agree). */
    occurrences: number
    /** Engines observed running it. */
    engines: AiEngine[]
    /**
     * Of the answers that ran this sub-query, how many named the brand.
     *
     * The actionable column: a framing the engines keep reaching for and never
     * find you in is a category you are missing from at the retrieval step,
     * before the answer is even written.
     */
    answersNaming: number
}

export interface FanOutEngineCoverage {
    engine: AiEngine
    /** Answers read from this engine. */
    answers: number
    /** Answers that exposed at least one sub-query. */
    answersWithFanOut: number
}

export interface FanOutSummary {
    /** Distinct sub-queries observed, most-triggered first. */
    queries: FanOutQuery[]
    /** Total sub-query observations across the run. */
    totalObservations: number
    /** Per-engine coverage, so an empty engine is visible rather than implied. */
    coverage: FanOutEngineCoverage[]
    /**
     * True when at least one engine ran but exposed nothing. The UI says which
     * engine, rather than letting the reader infer no searching happened.
     */
    hasSilentEngine: boolean
}

/** One answer's contribution: which engine, whether it named the brand, and what it searched. */
export interface FanOutInput {
    engine: AiEngine
    namedBrand: boolean
    searchQueries: string[]
}

/**
 * Mechanical sanitation only.
 *
 * Sub-queries are the engine's own strings, so there is no judgement to make
 * about their words — only about whether a string is usable as a row. The
 * bounds are deliberately loose: an engine writing an odd query is data, not
 * noise.
 */
function isUsableSubQuery(raw: string): boolean {
    const query = raw.trim()
    if (query.length < 3 || query.length > 200) return false
    // Engines occasionally echo a URL or a bare token as a "search".
    if (/^https?:\/\//i.test(query)) return false
    const letters = (query.match(/[a-z]/gi) || []).length
    return letters >= 2
}

/**
 * Aggregates fan-out across one run.
 *
 * `perPrompt` is a list of prompts, each carrying its answers. Counting
 * distinct *prompts* rather than raw occurrences is what makes the number
 * meaningful: two engines running the same sub-query for one question is
 * agreement about that question, not two units of demand.
 */
export function summariseFanOut(
    perPrompt: Array<{ promptId: string; answers: FanOutInput[] }>,
): FanOutSummary {
    const byNorm = new Map<
        string,
        {
            forms: Map<string, number>
            promptIds: Set<string>
            occurrences: number
            engines: Set<AiEngine>
            answersNaming: number
        }
    >()

    const coverage = new Map<AiEngine, FanOutEngineCoverage>()
    let totalObservations = 0

    for (const prompt of perPrompt) {
        for (const answer of prompt.answers) {
            const engineCoverage = coverage.get(answer.engine) ?? {
                engine: answer.engine,
                answers: 0,
                answersWithFanOut: 0,
            }
            engineCoverage.answers++

            const usable = (answer.searchQueries || []).filter(isUsableSubQuery)
            if (usable.length > 0) engineCoverage.answersWithFanOut++
            coverage.set(answer.engine, engineCoverage)

            // Within one answer the same sub-query can repeat; count it once per
            // answer so a chatty engine cannot inflate its own signal.
            const seenInAnswer = new Set<string>()

            for (const raw of usable) {
                const queryNorm = normalizeQuery(raw)
                if (!queryNorm || seenInAnswer.has(queryNorm)) continue
                seenInAnswer.add(queryNorm)
                totalObservations++

                const entry = byNorm.get(queryNorm) ?? {
                    forms: new Map<string, number>(),
                    promptIds: new Set<string>(),
                    occurrences: 0,
                    engines: new Set<AiEngine>(),
                    answersNaming: 0,
                }
                const trimmed = raw.trim()
                entry.forms.set(trimmed, (entry.forms.get(trimmed) ?? 0) + 1)
                entry.promptIds.add(prompt.promptId)
                entry.occurrences++
                entry.engines.add(answer.engine)
                if (answer.namedBrand) entry.answersNaming++
                byNorm.set(queryNorm, entry)
            }
        }
    }

    const queries: FanOutQuery[] = [...byNorm.entries()]
        .map(([queryNorm, entry]) => {
            // Most frequently observed raw form wins; ties break alphabetically
            // so the same data always renders the same way.
            const query = [...entry.forms.entries()].sort(
                (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
            )[0][0]
            return {
                query,
                queryNorm,
                prompts: entry.promptIds.size,
                occurrences: entry.occurrences,
                engines: [...entry.engines].sort(),
                answersNaming: entry.answersNaming,
            }
        })
        .sort(
            (a, b) =>
                b.prompts - a.prompts ||
                a.answersNaming - b.answersNaming ||
                b.occurrences - a.occurrences,
        )

    const coverageRows = [...coverage.values()].sort((a, b) =>
        a.engine.localeCompare(b.engine),
    )

    return {
        queries,
        totalObservations,
        coverage: coverageRows,
        hasSilentEngine: coverageRows.some(
            (row) => row.answers > 0 && row.answersWithFanOut === 0,
        ),
    }
}

/**
 * Sub-queries the engines kept running and never found the brand in.
 *
 * The most directly useful slice: a framing an engine reaches for repeatedly
 * while never producing an answer that names you is a retrieval-level absence,
 * upstream of anything the answer text shows.
 */
export function blindSpots(summary: FanOutSummary, minPrompts = 2): FanOutQuery[] {
    return summary.queries.filter(
        (query) => query.answersNaming === 0 && query.prompts >= minPrompts,
    )
}
