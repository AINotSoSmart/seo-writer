/**
 * Centralized Tavily search helper.
 *
 * Handles the "journal hack" – Tavily has no native journal/academic topic,
 * so we modify the query string to force academic-oriented results by
 * appending site-TLD + keyword qualifiers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchTopic = "general" | "news" | "finance" | "journal"

export interface TavilySearchPrefs {
    country?: string      // e.g. "australia"
    topic?: SearchTopic   // e.g. "journal"
}

// ---------------------------------------------------------------------------
// Country → TLD mapping (used by journal hack)
// ---------------------------------------------------------------------------

const COUNTRY_TLD: Record<string, string> = {
    australia: "au",
    "united states": "com",
    "united kingdom": "uk",
    canada: "ca",
    india: "in",
    germany: "de",
    france: "fr",
    japan: "jp",
    brazil: "br",
    netherlands: "nl",
    italy: "it",
    spain: "es",
    mexico: "mx",
    "south korea": "kr",
    singapore: "sg",
    "new zealand": "nz",
    ireland: "ie",
    sweden: "se",
    switzerland: "ch",
    "south africa": "za",
    china: "cn",
    indonesia: "id",
    philippines: "ph",
    malaysia: "my",
    thailand: "th",
    vietnam: "vn",
    poland: "pl",
    belgium: "be",
    austria: "at",
    norway: "no",
    denmark: "dk",
    finland: "fi",
    portugal: "pt",
    "czech republic": "cz",
    romania: "ro",
    "united arab emirates": "ae",
    "saudi arabia": "sa",
    israel: "il",
    turkey: "tr",
    argentina: "ar",
    colombia: "co",
    chile: "cl",
    egypt: "eg",
    nigeria: "ng",
    kenya: "ke",
    pakistan: "pk",
    bangladesh: "bd",
    ukraine: "ua",
    hungary: "hu",
    greece: "gr",
}

// Journal qualifier keywords appended to query
const JOURNAL_QUALIFIERS = `("journal" OR "research" OR "study" OR "whitepaper")`

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build modified query + Tavily options based on user search preferences.
 *
 * @param query       Original user search query
 * @param prefs       User's search preferences (country + topic)
 * @param baseOptions Any existing options to merge (searchDepth, maxResults, etc.)
 * @returns           { modifiedQuery, options } ready for tvly.search()
 */
export function buildTavilySearchOptions(
    query: string,
    prefs: TavilySearchPrefs | undefined,
    baseOptions: Record<string, any> = {}
): { modifiedQuery: string; options: Record<string, any> } {
    // No prefs or empty → return as-is
    if (!prefs || (!prefs.country && (!prefs.topic || prefs.topic === "general"))) {
        return { modifiedQuery: query, options: baseOptions }
    }

    const topic = prefs.topic || "general"
    const country = prefs.country?.toLowerCase().trim() || ""

    // ── Journal hack ──────────────────────────────────────────────────────
    if (topic === "journal") {
        let siteFilter = ""
        if (country) {
            const tld = COUNTRY_TLD[country] || country.slice(0, 2) // fallback: first 2 chars
            siteFilter = `site:.${tld} `
        }
        return {
            modifiedQuery: `${query} ${siteFilter}${JOURNAL_QUALIFIERS}`,
            options: {
                ...baseOptions,
                topic: "general", // Tavily doesn't support "journal" natively
            },
        }
    }

    // ── Standard topics (general / news / finance) ────────────────────────
    const options: Record<string, any> = { ...baseOptions }

    if (topic !== "general") {
        options.topic = topic
    }

    // Country filter only works when topic is "general" (Tavily limitation)
    if (country && (topic === "general" || !topic)) {
        options.country = country
    }

    return { modifiedQuery: query, options }
}

/**
 * Extract search preferences from brand data object.
 * Safely handles missing/undefined fields.
 */
export function extractSearchPrefs(brandData: any): TavilySearchPrefs {
    return {
        country: brandData?.search_country || "",
        topic: brandData?.search_topic || "general",
    }
}
