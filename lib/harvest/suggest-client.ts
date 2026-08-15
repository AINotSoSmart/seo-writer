/**
 * Shared Google Suggest client.
 *
 * Both the harvester and the demand filter hit the same undocumented endpoint,
 * roughly 300 times per audit between them. It has no SLA and can rate-limit an
 * egress IP without warning — and because `source_url` for every autocomplete
 * row *is* a Suggest request URL, losing this endpoint means losing provenance,
 * which aborts the whole audit.
 *
 * At current volume (~200 requests/day at 20 customers) throttling is not a
 * live concern. This exists so that it never becomes a sudden one:
 *
 *   - retry with exponential backoff and jitter
 *   - explicit 429 / 5xx handling that waits rather than giving up
 *   - a process-level cache, since a single audit re-requests the same prefixes
 *     across the two modules and re-audits repeat them entirely
 *
 * The cache also cuts real request volume by roughly a third at no cost.
 */

const AUTOCOMPLETE_URL = "https://suggestqueries.google.com/complete/search"

/** Suggest results are stable for days; an hour is conservative. */
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 5000

const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 400

export interface SuggestResult {
    /** The exact request URL — this is the provenance record for a harvested row */
    requestUrl: string
    prefix: string
    suggestions: string[]
    /**
     * False only when the request genuinely failed. A successful response with
     * an empty array is a real result meaning "no demand", and must never be
     * conflated with an error.
     */
    ok: boolean
    error?: string
    /** True when served from cache — useful for cost accounting */
    cached?: boolean
}

interface CacheEntry {
    at: number
    suggestions: string[]
}

const cache = new Map<string, CacheEntry>()

function pruneCache() {
    if (cache.size <= CACHE_MAX_ENTRIES) return
    // Oldest-first eviction; Map preserves insertion order
    const excess = cache.size - CACHE_MAX_ENTRIES
    let removed = 0
    for (const key of cache.keys()) {
        cache.delete(key)
        if (++removed >= excess) break
    }
}

export function buildSuggestUrl(
    prefix: string,
    options: { countryCode?: string; language?: string } = {}
): string {
    const params = new URLSearchParams({
        client: "chrome",
        q: prefix,
        hl: options.language || "en",
    })
    if (options.countryCode) params.set("gl", options.countryCode)
    return `${AUTOCOMPLETE_URL}?${params.toString()}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetches suggestions for a prefix, with caching and backoff.
 *
 * Never throws. Callers distinguish "no demand" (`ok: true`, empty array) from
 * "could not tell" (`ok: false`), and that distinction drives whether a query is
 * dropped or kept.
 */
export async function fetchSuggest(
    prefix: string,
    options: { countryCode?: string; language?: string } = {}
): Promise<SuggestResult> {
    const requestUrl = buildSuggestUrl(prefix, options)

    const cached = cache.get(requestUrl)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return { requestUrl, prefix, suggestions: cached.suggestions, ok: true, cached: true }
    }

    let lastError = "unknown"

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(requestUrl, {
                signal: AbortSignal.timeout(8000),
                headers: { Accept: "application/json" },
            })

            // Throttled or transient upstream failure — worth waiting for
            if (response.status === 429 || response.status >= 500) {
                lastError = `HTTP ${response.status}`
                if (attempt < MAX_ATTEMPTS) {
                    const retryAfter = Number(response.headers.get("retry-after")) * 1000
                    const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1)
                    const jitter = Math.random() * BASE_BACKOFF_MS
                    await sleep(Math.max(retryAfter || 0, backoff + jitter))
                    continue
                }
                return { requestUrl, prefix, suggestions: [], ok: false, error: lastError }
            }

            // Any other non-OK status is a hard answer, not worth retrying
            if (!response.ok) {
                return { requestUrl, prefix, suggestions: [], ok: false, error: `HTTP ${response.status}` }
            }

            const data = await response.json()
            // Shape: ["prefix", ["suggestion", ...], ...]
            if (!Array.isArray(data) || !Array.isArray(data[1])) {
                return { requestUrl, prefix, suggestions: [], ok: false, error: "malformed response" }
            }

            const suggestions: string[] = data[1]
            cache.set(requestUrl, { at: Date.now(), suggestions })
            pruneCache()

            return { requestUrl, prefix, suggestions, ok: true }
        } catch (error: any) {
            lastError = error?.name === "TimeoutError" ? "timeout" : error?.message || "fetch failed"
            if (attempt < MAX_ATTEMPTS) {
                await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.random() * BASE_BACKOFF_MS)
                continue
            }
        }
    }

    return { requestUrl, prefix, suggestions: [], ok: false, error: lastError }
}

/** Diagnostics for the verifier */
export function suggestCacheStats() {
    return { entries: cache.size, ttlMs: CACHE_TTL_MS }
}
