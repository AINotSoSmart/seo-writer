import type { InventoryPage } from "./site-inventory"

const WORD = /[a-z0-9]+/g
const STOP = new Set([
    "a", "about", "an", "and", "are", "best", "can", "do", "does", "for",
    "from", "get", "how", "i", "in", "is", "it", "my", "of", "on", "or",
    "should", "the", "to", "use", "way", "what", "when", "which", "with",
])

export function meaningfulTokens(value: string): Set<string> {
    return new Set((value.toLowerCase().match(WORD) ?? []).filter((word) => !STOP.has(word)))
}

export function tokenIntersection(left: Set<string>, right: Set<string>): number {
    return [...left].filter((word) => right.has(word)).length
}

export function tokenJaccard(left: Set<string>, right: Set<string>): number {
    const shared = tokenIntersection(left, right)
    return shared / Math.max(1, new Set([...left, ...right]).size)
}

export function matchExistingPage(
    prompt: string,
    pages: InventoryPage[],
): { page: InventoryPage; confidence: number } | null {
    const query = meaningfulTokens(prompt)
    if (query.size < 2) return null
    const ranked = pages
        .map((page) => {
            const title = meaningfulTokens(
                `${page.title} ${new URL(page.canonicalUrl).pathname}`,
            )
            const body = meaningfulTokens(page.contentExcerpt ?? "")
            const titleShared = tokenIntersection(query, title)
            const bodyShared = tokenIntersection(query, body)
            const titleCoverage = titleShared / Math.max(1, Math.min(query.size, title.size))
            const bodyCoverage = bodyShared / query.size
            const confidence = Math.min(1, titleCoverage * 0.8 + bodyCoverage * 0.2)
            return { page, confidence, titleShared, bodyShared }
        })
        .sort((a, b) => b.confidence - a.confidence || b.titleShared - a.titleShared)
    const best = ranked[0]
    if (!best) return null

    const supported =
        (best.titleShared >= 2 && best.confidence >= 0.5) ||
        (best.titleShared >= 1 && best.bodyShared >= 4 && best.confidence >= 0.48)
    return supported ? { page: best.page, confidence: best.confidence } : null
}
