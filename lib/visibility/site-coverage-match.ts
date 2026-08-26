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

/**
 * A non-article page that a losing question matched anyway.
 *
 * Reported rather than actioned. Ten measured questions matching a home page is
 * a positioning finding — that page is what the site says it is about, and
 * buyers asking those questions are not being sent to it — but it is not a
 * writing task, and turning it into one is how a delivery system ends up
 * proposing to patch someone's front door.
 */
export interface NonArticleMatch {
    canonicalUrl: string
    pageKind: InventoryPage["pageKind"]
    confidence: number
}

/**
 * The best non-article page for a prompt, when one exists.
 *
 * Deliberately separate from `matchExistingPage`: this can never produce an
 * action, so it cannot be confused for one at the call site.
 */
export function matchNonArticlePage(
    prompt: string,
    pages: InventoryPage[],
    blogRoot: string | null = null,
): NonArticleMatch | null {
    const ineligible = pages.filter((page) => !isRefreshTarget(page, blogRoot))
    const best = rankPages(prompt, ineligible)
    if (!best || !isSupported(best)) return null
    return {
        canonicalUrl: best.page.canonicalUrl,
        pageKind: best.page.pageKind,
        confidence: best.confidence,
    }
}

export function matchExistingPage(
    prompt: string,
    pages: InventoryPage[],
    blogRoot: string | null = null,
): { page: InventoryPage; confidence: number } | null {
    const eligible = pages.filter((page) => isRefreshTarget(page, blogRoot))
    const best = rankPages(prompt, eligible)
    if (!best || !isSupported(best)) return null
    return { page: best.page, confidence: best.confidence }
}

interface RankedPage {
    page: InventoryPage
    confidence: number
    titleShared: number
    bodyShared: number
}

function rankPages(prompt: string, pages: InventoryPage[]): RankedPage | null {
    const query = meaningfulTokens(prompt)
    if (query.size < 2 || pages.length === 0) return null
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
    return ranked[0] ?? null
}

/** The evidence bar a match must clear, shared by both matchers. */
function isSupported(best: RankedPage): boolean {
    return (
        (best.titleShared >= 2 && best.confidence >= 0.5) ||
        (best.titleShared >= 1 && best.bodyShared >= 4 && best.confidence >= 0.48)
    )
}
