/**
 * Language consistency filter.
 *
 * A production audit for an English site produced these article pairs:
 *
 *   "Alte Fotos animieren"  ~  "O Animowaniu Starych Zdjęć"           (0.904)
 *   "Alte Fotos animieren"  ~  "As últimas novidades sobre como..."   (0.867)
 *
 * German, Polish and Portuguese, harvested from a competitor's localised
 * sitemap. Selling an English business a German article is obviously wrong, but
 * the niche filter cannot catch it: multilingual embeddings deliberately place
 * translations *close together*, so a German phrase about photo animation scores
 * high against an English niche centroid. Relevance and language are orthogonal,
 * so language needs its own gate.
 *
 * Detection is script-and-stopword based rather than a dependency:
 *
 *   1. Non-Latin scripts (Cyrillic, CJK, Arabic, Hebrew, Thai, Devanagari) are
 *      unambiguous and rejected outright.
 *   2. Latin-script languages are separated by diacritics and function words —
 *      "O Animowaniu Starych Zdjęć" carries Polish diacritics, "As últimas
 *      novidades sobre" carries Portuguese ones and the article "as".
 *
 * The test is deliberately conservative. English is the assumed target, and a
 * string is only rejected on positive evidence of another language — never
 * merely for lacking English markers, because plenty of real queries are short
 * noun phrases with no function words at all.
 */

/** Scripts that cannot be the target language of a Latin-script site */
const NON_LATIN_SCRIPT =
    /[Ѐ-ӿͰ-Ͽ一-鿿぀-ヿ가-힯֐-׿؀-ۿ฀-๿ऀ-ॿ]/

/**
 * Function words that are strong evidence of a specific non-English language.
 * Deliberately excludes words that also occur in English ("a", "no", "in",
 * "man", "son", "come", "die", "so", "as", "os").
 */
const FOREIGN_FUNCTION_WORDS: Record<string, string[]> = {
    german: ["und", "oder", "nicht", "mit", "für", "auf", "eine", "einen", "einem", "ist", "sind", "werden", "kann", "ihre", "sich", "auch", "wird", "durch", "über", "alte", "alten", "neue", "neuen", "fotos", "bilder", "ihren", "dein", "deine", "mehr", "sehr"],
    spanish: ["para", "como", "cómo", "más", "pero", "porque", "cuando", "cuándo", "qué", "dónde", "desde", "hasta", "todo", "esta", "este", "puede", "hacer", "tiene", "años", "mejor", "según", "antiguas", "antiguos", "fotos", "imágenes"],
    portuguese: ["não", "uma", "você", "mais", "quando", "muito", "novidades", "antigas", "antigos", "seus", "suas", "pelo", "pela", "isso", "após", "então", "últimas", "fotos", "imagens"],
    french: ["pour", "avec", "dans", "vous", "être", "plus", "cette", "sont", "leur", "aussi", "peut", "faire", "tout", "comment", "pourquoi", "depuis"],
    italian: ["per", "con", "una", "sono", "come", "anche", "questo", "questa", "della", "delle", "degli", "essere", "molto", "quando", "perché"],
    dutch: ["een", "het", "van", "voor", "niet", "met", "zijn", "worden", "maar", "ook", "kunnen", "hoe", "wat", "waarom"],
    polish: ["nie", "jest", "które", "przez", "aby", "oraz", "jak", "czy", "tego", "tym", "starych", "zdjęć", "animowaniu", "jeśli", "może"],
    turkish: ["için", "ile", "bir", "olarak", "daha", "nasıl", "veya", "gibi", "sonra"],
    indonesian: ["yang", "untuk", "dengan", "dari", "pada", "adalah", "tidak", "bisa", "cara"],
}

/**
 * Suffixes that are systematic markers of a language rather than examples of
 * it. "Alte Fotos animieren" carries no German function words at all, but
 * `-ieren` is an unambiguous German verb ending. Morphology generalises where
 * a word list only ever catches the case in front of you.
 */
const FOREIGN_SUFFIXES: Array<{ pattern: RegExp; language: string }> = [
    { pattern: /\w{3,}(ieren|ungen|ung|keit|heit|schaft|lich|isch)$/i, language: "german" },
    { pattern: /\w{3,}(ción|ciones|dades|mente|ándo|iendo)$/i, language: "spanish" },
    { pattern: /\w{3,}(ções|ção|dade|mento|ndo)$/i, language: "portuguese" },
    { pattern: /\w{3,}(ów|ach|ego|ymi|ość|anie|enie)$/i, language: "polish" },
    { pattern: /\w{3,}(eaux|ement|ité|aient)$/i, language: "french" },
    { pattern: /\w{3,}(zione|mente|ità)$/i, language: "italian" },
]

/** Diacritic ranges that rarely appear in English text */
const HEAVY_DIACRITICS = /[ąćęłńóśźżğışİÅåÆæØøÐðÞþŁñçõãêôûîàèìòùäöüßáéíúýčďěňřšťůž]/i

function words(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 1)
}

export interface LanguageVerdict {
    keep: boolean
    /** Which language was detected, when rejected */
    detected?: string
    reason?: string
}

/**
 * Decides whether a harvested string is in the target language.
 *
 * @param text          the harvested query
 * @param targetIsLatin whether the subject site uses a Latin script (default true)
 */
export function checkLanguage(text: string, targetIsLatin = true): LanguageVerdict {
    if (targetIsLatin && NON_LATIN_SCRIPT.test(text)) {
        return { keep: false, detected: "non-latin", reason: "non-Latin script" }
    }

    const tokens = words(text)
    if (tokens.length === 0) return { keep: true }

    // Positive evidence of a specific other language
    for (const [language, markers] of Object.entries(FOREIGN_FUNCTION_WORDS)) {
        const hits = tokens.filter((token) => markers.includes(token)).length
        if (hits >= 2 || (hits === 1 && tokens.length <= 5)) {
            return { keep: false, detected: language, reason: `${hits} ${language} function word(s)` }
        }
    }

    // Morphological evidence, which generalises beyond the word lists
    for (const { pattern, language } of FOREIGN_SUFFIXES) {
        const hit = tokens.find((token) => pattern.test(token))
        if (hit) {
            return { keep: false, detected: language, reason: `${language} suffix in "${hit}"` }
        }
    }

    // Diacritics are weaker evidence on their own — a single accented character
    // could be a loanword or a brand name. Two or more in a short string is not.
    const diacriticCount = (text.match(new RegExp(HEAVY_DIACRITICS, "gi")) || []).length
    if (diacriticCount >= 2) {
        return { keep: false, detected: "non-english", reason: `${diacriticCount} non-English diacritics` }
    }

    return { keep: true }
}

export interface LanguageFilterResult<T> {
    kept: T[]
    dropped: Array<{ query: string; source: string; detected: string }>
}

/**
 * Removes harvested rows that are not in the subject site's language.
 */
export function filterByLanguage<T extends { query: string; source: string }>(
    queries: T[]
): LanguageFilterResult<T> {
    const kept: T[] = []
    const dropped: LanguageFilterResult<T>["dropped"] = []

    for (const item of queries) {
        const verdict = checkLanguage(item.query)
        if (verdict.keep) {
            kept.push(item)
        } else {
            dropped.push({
                query: item.query,
                source: item.source,
                detected: verdict.detected || "unknown",
            })
        }
    }

    if (dropped.length > 0) {
        const byLanguage = dropped.reduce<Record<string, number>>((acc, item) => {
            acc[item.detected] = (acc[item.detected] || 0) + 1
            return acc
        }, {})
        console.log(
            `[LanguageFilter] Dropped ${dropped.length} non-target-language queries ` +
            `(${Object.entries(byLanguage).map(([lang, n]) => `${lang}=${n}`).join(", ")})`
        )
    }

    return { kept, dropped }
}
