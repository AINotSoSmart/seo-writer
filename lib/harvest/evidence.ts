/**
 * Second-stage evidence verification.
 *
 * WHY THIS EXISTS: embedding similarity cannot decide coverage on its own.
 * Calibration on two sites proved it — against pixreunion.com, none of the
 * three candidate scorers separated hand-labelled positives from negatives:
 *
 *   similarity only      gap -0.031
 *   margin only          gap -0.069
 *   similarity + margin  gap -0.064
 *
 * All negative, meaning the populations overlap. No threshold fixes that,
 * because the failure is not calibration. A photo-restoration page embeds close
 * to "animate old photos with ai" whether or not it contains one word about
 * animation, and close to "restore old photos in photoshop" whether or not it
 * mentions Photoshop.
 *
 * So retrieval is treated as recall, and this stage supplies precision: does the
 * matched page actually contain the terms that make this query *this* query?
 *
 * Which terms are "defining" is decided per site by document frequency rather
 * than by a word list. On a restoration site, "photo" and "old" appear on
 * nearly every page and discriminate nothing; "animate", "photoshop" and
 * "merge" appear rarely and carry the intent. That makes the test
 * self-calibrating across niches.
 */

import { PageDocument } from "./page-document"

/** Words that never carry intent */
const STOPWORDS = new Set([
    "a", "an", "the", "of", "to", "in", "on", "for", "and", "or", "is", "are",
    "do", "does", "did", "can", "how", "what", "why", "when", "where", "who",
    "my", "your", "our", "it", "this", "that", "with", "from", "at", "by",
    "be", "will", "would", "should", "could", "have", "has", "had", "you",
    "i", "we", "they", "them", "best", "top", "get", "make", "use", "using",
])

/**
 * A term appearing on more than this share of a site's pages is treated as
 * background vocabulary rather than intent.
 */
export const GENERIC_TERM_DF_RATIO = 0.5

/** How many of a query's defining terms must be present on the page */
export const REQUIRED_EVIDENCE_RATIO = 0.6

/**
 * Times the rarest defining term must appear before the page counts as
 * discussing it rather than name-dropping it.
 *
 * Both surviving false positives across two calibration sets were the same
 * shape: "restore old photos in photoshop" and "old photo restoration photoshop
 * tutorial pdf" matched pages that mention Photoshop exactly once, in passing
 * ("no Photoshop skills needed"). A single mention is not coverage.
 */
export const MIN_RAREST_TERM_OCCURRENCES = 2

/** Defining terms considered per query, highest-IDF first */
const MAX_DEFINING_TERMS = 3

/**
 * Crude suffix stripping so "animate" matches "animation" and "animated".
 * A real stemmer is overkill here — the check is a presence test, not ranking.
 */
export function stem(word: string): string {
    let w = word.toLowerCase().replace(/[^a-z0-9]/g, "")
    for (const suffix of ["ations", "ation", "ings", "ing", "ers", "er", "ies", "ied", "es", "ed", "s"]) {
        if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
            w = w.slice(0, -suffix.length)
            break
        }
    }
    return w
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/**
 * Counts, for each stem, how many of the site's pages contain it.
 */
export function buildDocumentFrequency(pages: PageDocument[]): Map<string, number> {
    const df = new Map<string, number>()

    for (const page of pages) {
        const seen = new Set(
            tokenize(`${page.title} ${page.description} ${page.h1} ${page.h2s.join(" ")} ${page.bodyText}`)
                .map(stem)
        )
        for (const term of seen) {
            df.set(term, (df.get(term) || 0) + 1)
        }
    }

    return df
}

/**
 * Picks the terms that distinguish this query from the site's general subject.
 *
 * Returns [] when every term is background vocabulary — the query is purely
 * about what the site is already about, so there is nothing extra to verify and
 * the semantic match stands on its own.
 */
export function definingTerms(
    query: string,
    df: Map<string, number>,
    pageCount: number
): string[] {
    if (pageCount === 0) return []

    const stems = Array.from(new Set(tokenize(query).map(stem)))

    const scored = stems
        .map((term) => ({ term, ratio: (df.get(term) || 0) / pageCount }))
        // A term on most pages says nothing about this query specifically
        .filter((t) => t.ratio <= GENERIC_TERM_DF_RATIO)
        // Rarest first — those carry the most intent
        .sort((a, b) => a.ratio - b.ratio)

    return scored.slice(0, MAX_DEFINING_TERMS).map((t) => t.term)
}

/**
 * Longest allowed length difference between two stems that still count as the
 * same word.
 *
 * An unbounded prefix test is far too permissive in both directions:
 * "photoshop".startsWith("photo") is true, so a page merely containing the word
 * "photo" was credited with covering "restore old photos in photoshop". Bounding
 * the difference keeps genuine morphology ("animate" / "anim" from "animation",
 * 3 chars apart) while rejecting distinct words that happen to share a prefix
 * ("photoshop" / "photo", 4 apart).
 */
const MAX_STEM_LENGTH_DELTA = 3

function isMorphologicalVariant(term: string, candidate: string): boolean {
    if (Math.abs(term.length - candidate.length) > MAX_STEM_LENGTH_DELTA) return false
    const shorter = term.length <= candidate.length ? term : candidate
    const longer = term.length <= candidate.length ? candidate : term
    // Require a substantial shared root, not a two-letter coincidence
    return shorter.length >= 4 && longer.startsWith(shorter)
}

export interface EvidenceCheck {
    /** No defining terms to test — semantic match is accepted as-is */
    vacuous: boolean
    pass: boolean
    required: string[]
    found: string[]
    missing: string[]
}

/**
 * Verifies the matched page actually contains the query's defining terms.
 *
 * Matches on stem prefix so morphological variants count: a page saying
 * "animation" satisfies the term "animat".
 */
export function checkEvidence(page: PageDocument, terms: string[]): EvidenceCheck {
    if (terms.length === 0) {
        return { vacuous: true, pass: true, required: [], found: [], missing: [] }
    }

    const haystack = [
        page.title, page.description, page.h1, page.h2s.join(" "), page.bodyText,
    ].join(" ").toLowerCase()

    // Counts, not just presence — a term used once is not a topic covered
    const stemCounts = new Map<string, number>()
    for (const token of tokenize(haystack)) {
        const s = stem(token)
        stemCounts.set(s, (stemCounts.get(s) || 0) + 1)
    }
    const haystackStems = Array.from(stemCounts.keys())

    const occurrencesOf = (term: string): number => {
        let total = stemCounts.get(term) || 0
        for (const s of haystackStems) {
            if (s !== term && isMorphologicalVariant(term, s)) total += stemCounts.get(s) || 0
        }
        return total
    }

    const found: string[] = []
    const missing: string[] = []

    for (const term of terms) {
        if (occurrencesOf(term) > 0) found.push(term)
        else missing.push(term)
    }

    // `terms` arrives sorted rarest-first, so terms[0] is the most defining one
    const rarestOccurrences = occurrencesOf(terms[0])
    const rarestDiscussed = rarestOccurrences >= MIN_RAREST_TERM_OCCURRENCES

    return {
        vacuous: false,
        pass: found.length / terms.length >= REQUIRED_EVIDENCE_RATIO && rarestDiscussed,
        required: terms,
        found,
        missing,
    }
}
