/**
 * Shared types for the closed-pool harvest.
 *
 * The governing rule of this module: nothing enters the pool that was not
 * observed somewhere real. Every harvested query carries its provenance so the
 * audit can be verified by clicking through to the source.
 */

export type QuerySource =
    | "autocomplete"
    | "paa"
    | "competitor_sitemap"
    /**
     * A buyer prompt an answer engine was asked, where the subject was absent
     * from or outranked in the reply. Unlike the other three, this is not a
     * string someone was observed typing — it is a question we constructed from
     * the customer's confirmed scope and then measured the answer to. Its
     * provenance is the stored verbatim answer in `ai_probe_results`, not a
     * re-openable public URL. See `lib/visibility/gap-mapper.ts`.
     */
    | "ai_answer"

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
    /** Short surrounding source text that preserves what the observed phrase meant. */
    source_context: string
    /** ISO timestamp of observation */
    observed_at: string
}

export function sanitizeSourceContext(value: string, maxChars = 700): string {
    return value
        .replace(/<[^>]*>/g, " ")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxChars)
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
 * Rejects queries that name a brand we know is not the customer's.
 *
 * This is the deterministic half of the deliverability gate, and it is cheap:
 * a query killed here never costs a classification token. It only knows the
 * competitor domains actually crawled for this audit, so it catches
 * "…to Forever Studios" when foreverstudios.com is a listed competitor, and
 * misses "Using Adobe Firefly" when Adobe was merely mentioned on someone
 * else's page. The classifier's own rule covers that second case — evidence
 * where evidence exists, judgement only where it does not.
 *
 * Differs from containsExcludedBrand in two ways that matter: it returns *which*
 * brand matched so the rejection can say so, and it flattens non-alphanumerics
 * on both sides, so the domain token "foreverstudios" still matches its spaced
 * display form "Forever Studios".
 */
export function findThirdPartyBrand(
    query: string,
    competitorBrandTokens: string[],
): string | null {
    const flattened = query.toLowerCase().replace(/[^a-z0-9]/g, "")
    for (const token of competitorBrandTokens) {
        const needle = token.toLowerCase().replace(/[^a-z0-9]/g, "")
        // Short tokens ("ai", "hp") collide with ordinary words once spaces are
        // removed, so they are left to the model rather than guessed at here.
        if (needle.length >= 4 && flattened.includes(needle)) return token
    }
    return null
}

/**
 * Same registrable host, ignoring `www.` and subdomain depth.
 *
 * Lives here rather than beside its caller because this module is import-free
 * and therefore unit-testable; `serp-questions.ts` is alias-bound and can only
 * be asserted as text.
 *
 * Unparseable or absent input returns false. An unknown host must never be
 * treated as a match, or one bad URL would silently empty a harvest instead of
 * failing loudly.
 */
export function isSameHost(candidate: string, subject?: string): boolean {
    if (!subject) return false
    const host = (value: string): string | null => {
        try {
            return new URL(value.startsWith("http") ? value : `https://${value}`)
                .hostname.toLowerCase().replace(/^www\./, "")
        } catch {
            return null
        }
    }
    const a = host(candidate)
    const b = host(subject)
    if (!a || !b) return false
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
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

/**
 * Mechanical sanitation only. This deliberately makes no semantic judgement
 * about words, industries, calls to action, or features. Positive
 * confirmed-family assignment owns business relevance later in the pipeline.
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
