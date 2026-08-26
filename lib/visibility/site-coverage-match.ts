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

/**
 * The blog root the founder confirmed at checkout, e.g. "https://x.com/blog/".
 *
 * `publication_url_pattern` is where this product publishes, agreed during
 * payment, so it is a fact rather than an inference — which is why it beats
 * `classifyInventoryPage`'s path regex for deciding what may be refreshed.
 */
export function blogRootFromPublicationPattern(
    pattern: string | null | undefined,
): string | null {
    if (!pattern) return null
    const withoutSlug = pattern.split("{slug}")[0]
    try {
        return new URL(withoutSlug).href.replace(/\/+$/, "") + "/"
    } catch {
        return null
    }
}

/**
 * WHICH PAGES MAY BE REFRESHED AT ALL.
 *
 * Only articles. A measured gap is answered by writing an article, and if an
 * article already covers it, that article is refreshed — a landing page never
 * is. The planner used to match against every crawled page, so ten buyer
 * questions were routed to drawgle.com's HOMEPAGE and proposed as a "patch",
 * along with a gallery page and a hub whose whole job is linking out. Those are
 * the highest-matching pages on any site — a homepage mentions everything the
 * product does — and the least editable.
 *
 * That a brand's own domain was cited does not mean its home page is the
 * remedy. If no article covers the gap, the remedy is a new article.
 */
export function isRefreshTarget(page: InventoryPage, blogRoot: string | null): boolean {
    if (blogRoot && page.canonicalUrl.startsWith(blogRoot)) return true
    // No confirmed blog root yet — fall back to the path classifier, which is a
    // guess, but never treats a home page as an article.
    return !blogRoot && page.pageKind === "blog"
}

export function matchExistingPage(
    prompt: string,
    pages: InventoryPage[],
    blogRoot: string | null = null,
): { page: InventoryPage; confidence: number } | null {
    const query = meaningfulTokens(prompt)
    if (query.size < 2) return null
    const eligible = pages.filter((page) => isRefreshTarget(page, blogRoot))
    if (eligible.length === 0) return null
    const ranked = eligible
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
