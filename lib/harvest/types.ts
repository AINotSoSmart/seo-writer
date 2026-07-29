/**
 * Shared types for the closed-pool harvest.
 *
 * The governing rule of this module: nothing enters the pool that was not
 * observed somewhere real. Every harvested query carries its provenance so the
 * audit can be verified by clicking through to the source.
 */

export type QuerySource = "autocomplete" | "paa" | "competitor_sitemap"

export interface HarvestedQuery {
    /** The query exactly as observed */
    query: string
    /** Normalized form used for deduplication */
    query_norm: string
    source: QuerySource
    /**
     * Where the query was observed, always populated.
     *
     * - `paa` / `competitor_sitemap`: the page URL whose visible text contains it.
     * - `autocomplete`: the exact Google Suggest request URL. Opening it returns
     *   the JSON array this string was read out of.
     *
     * A null here is a bug. The first run of this pipeline left autocomplete
     * rows null, which made 86% of gaps unverifiable and failed the provenance
     * test outright.
     */
    source_url: string | null
    /** The seed/prefix string that produced this query */
    source_seed: string | null
    /**
     * The raw string exactly as the source returned it, before normalization.
     * Autocomplete responses drift over time, so this is the evidence of what
     * was actually seen; `source_url` is how to go look again.
     */
    observed_value: string
    /** ISO timestamp of observation */
    observed_at: string
}

/**
 * Per-source outcome of a harvest run.
 *
 * Exists because the first run had a bad Tavily key: every SERP request failed,
 * the harvester swallowed each error, returned an empty array, and the pipeline
 * reported success with zero SERP questions. A source that produced nothing
 * because it was broken must never be indistinguishable from one that
 * legitimately found nothing.
 */
export interface SourceReport {
    source: QuerySource
    requestsAttempted: number
    requestsFailed: number
    queriesFound: number
    errors: string[]
    /** Every request failed — the source is broken, not empty */
    hardFailure: boolean
}

export interface HarvestOutput {
    queries: HarvestedQuery[]
    report: SourceReport
}

/**
 * Builds a SourceReport, deriving hardFailure from the request counts.
 */
export function buildSourceReport(
    source: QuerySource,
    attempted: number,
    failed: number,
    found: number,
    errors: string[]
): SourceReport {
    return {
        source,
        requestsAttempted: attempted,
        requestsFailed: failed,
        queriesFound: found,
        // Only a hard failure if we actually tried and everything broke
        hardFailure: attempted > 0 && failed === attempted,
        errors: errors.slice(0, 5),
    }
}

export interface HarvestOptions {
    /** ISO-3166 alpha-2 country code, e.g. "us", "au" */
    countryCode?: string
    /** Language code for autocomplete, defaults to "en" */
    language?: string
}

/**
 * Normalizes a query for deduplication: lowercase, collapse whitespace, strip
 * surrounding punctuation. Two queries with the same norm are the same query.
 */
export function normalizeQuery(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[""'']/g, "")
        .replace(/[?!.,;:]+$/g, "")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * Marketing furniture that appears on pages but is not a search query.
 *
 * These reached the pool on the 2026-07-29 run as real "content gaps":
 * "Ready to hire your AI teammate?", "Earn $ 2,970 /mo with recurring
 * commissions", "Blog | Machined", "How did it do?". All were genuinely
 * observed on a page — provenance was fine — but nobody searches them.
 */
const NON_QUERY_PATTERNS: RegExp[] = [
    // Calls to action
    /^(ready|want|need|looking|keen)\s+to\b/i,
    /^(do|would|are)\s+you\s+(want|need|have|looking)\b/i,
    /^(get|start|try|book|join|claim|grab|unlock|discover)\s+(your|our|the|a|free|started)\b/i,
    /^(sign|log)\s?(up|in)\b/i,
    // Offers and pricing furniture
    /[$£€]\s?[\d,]+/,
    /\b\d+%\s+(off|discount|commission)/i,
    /\b(recurring commissions?|affiliate program|money back guarantee)\b/i,
    // Section and listing labels rather than topics
    /^(blog|news|home|index|resources|articles|case studies)\s*[|\-–—:]/i,
    /^(table of contents|related (posts|articles)|share this|read more)\b/i,
    // Fragments referring to a subject stated elsewhere on the page
    /^(so,?\s+)?(how|what|why|when)\s+(did|does|is|was)\s+(it|this|that|they|he|she)\b/i,
    // Support FAQs belonging to a specific company. These are lifted verbatim
    // from competitor help pages — "Can I order prints directly through
    // PixReunion?", "How do I scan my photo to upload to Forever Studios?" —
    // and are not searchable topics for anyone else to write about.
    /^can\s+i\s+(order|buy|purchase|cancel|return|track|refund|upgrade|downgrade)\b/i,
    /^how\s+do\s+i\s+(upload|scan|send|submit|contact|cancel|access|log\s?in|sign\s?up|reset)\b/i,
    /\b(do|does)\s+(you|they)\s+(offer|provide|accept|support|ship|deliver)\b/i,
    /\b(our|your)\s+(service|platform|app|website|team|studio|software|pricing)\b/i,
    // First-person-plural is the site talking about itself. Nobody searches
    // "How You Can Use Our AI Family Picture Generator" or "What Our Users Say".
    /\b(our|ours|we|us)\b/i,
    /\b(upload|order|subscribe|sign\s?up)\s+(to|through|with|via)\s+[A-Z][A-Za-z]/,
]

/**
 * True when a query names a brand it should not — the user's own competitors,
 * or the brand being harvested for.
 *
 * A competitor's branded support question is genuinely observed on a real page
 * (so it passes provenance) but is worthless as a topic: nobody is going to
 * write "Can I order prints directly through PixReunion?" on their own site.
 */
export function containsExcludedBrand(query: string, brands: string[]): boolean {
    if (brands.length === 0) return false
    const haystack = query.toLowerCase()
    return brands.some((brand) => {
        const needle = brand.toLowerCase().trim()
        return needle.length >= 3 && haystack.includes(needle)
    })
}

/**
 * Derives brand tokens from URLs: "https://www.pixreunion.com/" -> "pixreunion".
 */
export function brandTokensFromUrls(urls: string[]): string[] {
    const tokens = new Set<string>()
    for (const url of urls) {
        try {
            const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname
            const base = host.replace(/^www\./, "").split(".")[0]
            if (base.length >= 3) tokens.add(base)
        } catch {
            /* not a URL, skip */
        }
    }
    return Array.from(tokens)
}

/** Words that carry no topical meaning on their own */
const CONTENTLESS_WORDS = new Set([
    "it", "this", "that", "they", "them", "he", "she", "we", "you", "i",
    "do", "did", "does", "is", "are", "was", "were", "be", "been",
    "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "so",
    "how", "what", "why", "when", "where", "who", "which", "your", "our",
])

/**
 * Rejects strings that are not plausible search queries.
 * Runs on everything before it reaches the pool.
 */
export function isPlausibleQuery(raw: string): boolean {
    const q = raw.trim()

    if (q.length < 6 || q.length > 120) return false

    const words = q.split(/\s+/)
    if (words.length < 2 || words.length > 14) return false

    // URLs, emails, file paths, and markup are sitemap-slug noise
    if (/https?:\/\/|@|\.(html?|php|aspx?|jpe?g|png|pdf)$|[<>{}]/i.test(q)) return false

    // Must be mostly letters — filters out IDs, hashes, and date slugs
    const letters = (q.match(/[a-z]/gi) || []).length
    if (letters / q.length < 0.6) return false

    if (NON_QUERY_PATTERNS.some((pattern) => pattern.test(q))) return false

    // Needs at least two words carrying subject matter, otherwise it is a
    // fragment pointing at something named elsewhere on the page.
    const contentWords = words.filter(
        (w) => !CONTENTLESS_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ""))
    )
    if (contentWords.length < 2) return false

    return true
}

/**
 * Deduplicates by normalized form, keeping the first occurrence.
 * Sources are checked in priority order by the caller, so "first wins" means
 * the highest-quality provenance survives.
 */
export function dedupeQueries(queries: HarvestedQuery[]): HarvestedQuery[] {
    const seen = new Set<string>()
    const out: HarvestedQuery[] = []

    for (const q of queries) {
        if (seen.has(q.query_norm)) continue
        seen.add(q.query_norm)
        out.push(q)
    }

    return out
}

/**
 * Caps a merged pool while preserving each source's share.
 *
 * A plain `.slice(0, cap)` after merging silently starves whichever source is
 * ordered last: a run capped at 80 with sources ordered [paa, competitor,
 * autocomplete] produced 33 + 47 + **0**, discarding all 131 autocomplete rows
 * and truncating competitors mid-list. The cap is a cost control, not a source
 * preference.
 */
export function capProportionally(
    queries: HarvestedQuery[],
    cap: number
): HarvestedQuery[] {
    if (queries.length <= cap) return queries

    const bySource = new Map<QuerySource, HarvestedQuery[]>()
    for (const q of queries) {
        const list = bySource.get(q.source) || []
        list.push(q)
        bySource.set(q.source, list)
    }

    const out: HarvestedQuery[] = []

    // Page-backed sources are taken whole before autocomplete gets a look in.
    // Strict proportional allocation gave a competitor's 11 harvested topics
    // only 3 slots out of 400 while autocomplete's raw volume took 89% of the
    // pool — but a topic a competitor actually published is stronger evidence
    // of demand than an autocomplete variant.
    const PAGE_BACKED: QuerySource[] = ["paa", "competitor_sitemap"]

    for (const source of PAGE_BACKED) {
        const list = bySource.get(source) || []
        const room = cap - out.length
        if (room <= 0) break
        out.push(...list.slice(0, room))
        bySource.set(source, list.slice(Math.min(room, list.length)))
    }

    // Autocomplete fills whatever remains
    const autocomplete = bySource.get("autocomplete") || []
    out.push(...autocomplete.slice(0, Math.max(0, cap - out.length)))

    return out.slice(0, cap)
}

/**
 * Runs an async mapper over items with bounded concurrency.
 * Failures resolve to null rather than rejecting the batch — a single throttled
 * autocomplete request must never abort a harvest.
 */
export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<(R | null)[]> {
    const results: (R | null)[] = new Array(items.length).fill(null)
    let cursor = 0

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++
            try {
                results[index] = await fn(items[index])
            } catch {
                results[index] = null
            }
        }
    })

    await Promise.all(workers)
    return results
}
