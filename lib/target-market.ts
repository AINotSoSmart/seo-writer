/**
 * The market a brand is **measured** in.
 *
 * ## Why this module exists
 *
 * Answer engines are local. Cloro's payload carries a `country` and
 * `buildCloroPayload` defaults it to `"US"`, so before this existed **every
 * probe measured the United States** regardless of who the customer was: the
 * field was plumbed from the Trigger payload all the way to the request body,
 * and nothing ever set it. A customer in Berlin was shown American answers with
 * nothing on the report saying so.
 *
 * ## This is NOT `search_country`, and the two must not be merged
 *
 * `search_country` (plus `search_topic`) is a **Tavily** preference — a
 * lowercase country *name* like `"australia"` — and it controls research: which
 * sources competitor discovery finds, and which sources the writer cites when
 * it drafts an article.
 *
 * `target_region` controls **measurement**: which country's ChatGPT and Google
 * AI Mode answers we ask for.
 *
 * They usually agree and they are still two different questions. A German
 * company selling into the United States wants US answers measured; whether it
 * also wants US-only research when writing is a separate call, and
 * `search_country` keeps its "Global" option because for search that is a
 * genuinely valid answer. Deriving one from the other looks tidy and quietly
 * changes what every future article cites — so this module offers
 * `tavilyCountryForRegion` as a *suggestion* helper and never applies it behind
 * the customer's back.
 *
 * There is no "Global" for an answer engine, though: ChatGPT answers from
 * somewhere whether or not we choose, and declining to choose silently selects
 * the United States. So `target_region` is always a real country.
 */

export const DEFAULT_REGION = "US"
export const DEFAULT_LANGUAGE = "en"

export interface TargetMarket {
    /** ISO-3166 alpha-2, uppercase. What Cloro is sent. */
    code: string
    label: string
    /**
     * The Tavily `search_country` string, or "" to search globally. Tavily
     * supports far fewer countries than the answer engines do; a market with no
     * Tavily equivalent still probes correctly and simply researches globally.
     */
    tavily: string
}

export const TARGET_MARKETS: TargetMarket[] = [
    { code: "US", label: "United States", tavily: "united states" },
    { code: "GB", label: "United Kingdom", tavily: "united kingdom" },
    { code: "CA", label: "Canada", tavily: "canada" },
    { code: "AU", label: "Australia", tavily: "australia" },
    { code: "NZ", label: "New Zealand", tavily: "new zealand" },
    { code: "IE", label: "Ireland", tavily: "ireland" },
    { code: "IN", label: "India", tavily: "india" },
    { code: "SG", label: "Singapore", tavily: "singapore" },
    { code: "AE", label: "United Arab Emirates", tavily: "united arab emirates" },
    { code: "ZA", label: "South Africa", tavily: "south africa" },
    { code: "DE", label: "Germany", tavily: "germany" },
    { code: "FR", label: "France", tavily: "france" },
    { code: "NL", label: "Netherlands", tavily: "netherlands" },
    { code: "ES", label: "Spain", tavily: "spain" },
    { code: "IT", label: "Italy", tavily: "italy" },
    { code: "SE", label: "Sweden", tavily: "sweden" },
    { code: "CH", label: "Switzerland", tavily: "switzerland" },
    { code: "PL", label: "Poland", tavily: "poland" },
    { code: "BR", label: "Brazil", tavily: "brazil" },
    { code: "MX", label: "Mexico", tavily: "mexico" },
    { code: "JP", label: "Japan", tavily: "japan" },
    { code: "KR", label: "South Korea", tavily: "south korea" },
    { code: "ID", label: "Indonesia", tavily: "indonesia" },
    { code: "MY", label: "Malaysia", tavily: "malaysia" },
    { code: "PH", label: "Philippines", tavily: "philippines" },
    { code: "TH", label: "Thailand", tavily: "thailand" },
    { code: "NG", label: "Nigeria", tavily: "nigeria" },
    { code: "PK", label: "Pakistan", tavily: "pakistan" },
]

export interface TargetLanguage {
    /** ISO-639-1. */
    code: string
    label: string
    /** Written into the prompt-builder instruction, so it must read naturally. */
    name: string
}

/**
 * Space-delimited scripts only, and that is a real constraint rather than a
 * shortlist.
 *
 * `isPlausiblePrompt` rejects anything under four "words", splitting on
 * whitespace. Japanese and Chinese do not put spaces between words, so every
 * generated prompt would count as one word and be discarded — the run would
 * report that the model produced nothing usable, when the validator was the
 * thing that was wrong. Adding those languages means making prompt validation
 * script-aware first.
 */
export const TARGET_LANGUAGES: TargetLanguage[] = [
    { code: "en", label: "English", name: "English" },
    { code: "es", label: "Español", name: "Spanish" },
    { code: "de", label: "Deutsch", name: "German" },
    { code: "fr", label: "Français", name: "French" },
    { code: "pt", label: "Português", name: "Portuguese" },
    { code: "it", label: "Italiano", name: "Italian" },
    { code: "nl", label: "Nederlands", name: "Dutch" },
    { code: "sv", label: "Svenska", name: "Swedish" },
    { code: "pl", label: "Polski", name: "Polish" },
    { code: "id", label: "Bahasa Indonesia", name: "Indonesian" },
    // Korean and Hindi are space-delimited, so they validate correctly.
    { code: "ko", label: "한국어", name: "Korean" },
    { code: "hi", label: "हिन्दी", name: "Hindi" },
]

/** Normalises anything stored on a brand into a market we can actually send. */
export function resolveRegion(value: unknown): string {
    const code = typeof value === "string" ? value.trim().toUpperCase() : ""
    return TARGET_MARKETS.some((market) => market.code === code) ? code : DEFAULT_REGION
}

export function resolveLanguage(value: unknown): string {
    const code = typeof value === "string" ? value.trim().toLowerCase() : ""
    return TARGET_LANGUAGES.some((language) => language.code === code)
        ? code
        : DEFAULT_LANGUAGE
}

/** The English name of a language, for a model instruction. */
export function languageName(code: string): string {
    return (
        TARGET_LANGUAGES.find((language) => language.code === resolveLanguage(code))?.name ??
        "English"
    )
}

export function marketLabel(code: string): string {
    return (
        TARGET_MARKETS.find((market) => market.code === resolveRegion(code))?.label ??
        "United States"
    )
}

/**
 * The Tavily `search_country` string for a market. "" means search globally.
 *
 * A **suggestion** for the separate research setting, never an automatic write.
 * Research locale and measurement locale are different questions — see the
 * module header.
 */
export function tavilyCountryForRegion(code: string): string {
    return TARGET_MARKETS.find((market) => market.code === resolveRegion(code))?.tavily ?? ""
}

/**
 * A first guess at the market from the site's own domain.
 *
 * Deterministic and free — no model, no request. A ccTLD is a strong signal and
 * a wrong guess costs one dropdown change, which is a far better default than
 * silently assuming the United States. Generic TLDs return null so the caller
 * keeps its own default rather than inventing a market.
 */
const CC_TLD_REGIONS: Record<string, string> = {
    uk: "GB",
    au: "AU",
    nz: "NZ",
    ie: "IE",
    in: "IN",
    sg: "SG",
    ae: "AE",
    za: "ZA",
    de: "DE",
    fr: "FR",
    nl: "NL",
    es: "ES",
    it: "IT",
    se: "SE",
    ch: "CH",
    pl: "PL",
    br: "BR",
    mx: "MX",
    jp: "JP",
    kr: "KR",
    id: "ID",
    my: "MY",
    ph: "PH",
    th: "TH",
    ng: "NG",
    pk: "PK",
    ca: "CA",
    us: "US",
}

/**
 * Fills a freshly analyzed brand's market fields, guessing from its domain.
 *
 * Applied once, when brand analysis returns, so the founder sees a sensible
 * answer already selected rather than a form asking a question they may not
 * realise matters. A ccTLD guess is deterministic and free; anything generic
 * keeps the existing value or falls back to the default.
 */
export function applyMarketDefaults<
    T extends { target_region?: string; target_language?: string },
>(brand: T, hostname: string): T {
    const guessed = regionFromHostname(hostname)
    const region = brand.target_region?.trim()
        ? resolveRegion(brand.target_region)
        : (guessed ?? DEFAULT_REGION)

    // `search_country` is deliberately untouched. It is the research locale, a
    // different question with a valid "Global" answer, and silently rewriting
    // it here would change which sources every future article cites.
    return {
        ...brand,
        target_region: region,
        target_language: resolveLanguage(brand.target_language),
    }
}

export function regionFromHostname(hostname: string): string | null {
    const host = hostname.trim().toLowerCase().replace(/^www\./, "")
    if (!host.includes(".")) return null
    const parts = host.split(".")
    // `.co.uk` and friends: the country is the last label, and the one before it
    // is a second-level generic. A bare `.uk` works the same way.
    const tld = parts[parts.length - 1]
    const region = CC_TLD_REGIONS[tld]
    return region ?? null
}
