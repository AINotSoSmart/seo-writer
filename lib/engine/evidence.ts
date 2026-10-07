/**
 * Checks that make a model's claim about a page checkable. Pure.
 *
 * A model asked "does this page answer the question?" can say yes about a page
 * that does not. So every such claim must come with passages copied from the
 * page, and a claim survives only when each passage is really there.
 */

/** Shortest passage accepted as evidence; anything shorter matches by accident. */
export const MIN_QUOTE_CHARS = 25

export function normalizeForQuote(value: string): string {
    return String(value || "")
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

/** True when the passage appears in the page text (ignoring case, punctuation and markup). */
export function quoteIsInText(quote: string, text: string): boolean {
    const needle = normalizeForQuote(quote)
    if (needle.length < MIN_QUOTE_CHARS) return false
    return normalizeForQuote(text).includes(needle)
}

export function verifiedQuotes(quotes: unknown, text: string): string[] {
    if (!Array.isArray(quotes)) return []
    return quotes
        .filter((quote): quote is string => typeof quote === "string")
        .filter((quote) => quoteIsInText(quote, text))
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (!a?.length || a.length !== b?.length) return 0
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0
}

/**
 * The pages most similar to any of the queries. Recall only: this decides what
 * the judge reads, never what counts as covered, so it has no threshold to tune.
 */
export function nearestPages<T extends { id: string; embedding: number[] | null }>(
    queryEmbeddings: number[][],
    pages: T[],
    k: number,
): Array<{ page: T; similarity: number }> {
    return pages
        .filter((page) => page.embedding && page.embedding.length > 0)
        .map((page) => ({
            page,
            similarity: Math.max(...queryEmbeddings.map((query) => cosineSimilarity(query, page.embedding!))),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, k)
}
