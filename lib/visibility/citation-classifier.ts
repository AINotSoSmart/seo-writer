/**
 * What kind of source is an answer engine leaning on, and what can be done
 * about it.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT ANSVISOR'S CLASSIFIER
 *
 * Upstream classifies citation domains against curated lists — `editorial`,
 * `forum`, `social`, `review`, `institutional`, `other`. The idea is right; the
 * implementation shows exactly how it decays. Their editorial list contains
 * `motortrend.com`, `caranddriver.com`, `jalopnik.com` and `hemmings.com`, and
 * their forum list contains `bimmerpost.com`, `rennlist.com` and
 * `teslamotorsclub.com` — the fingerprints of one automotive customer whose
 * report looked wrong, patched domain by domain. The next customer is in
 * fintech and starts from zero again.
 *
 * That is the same failure this repo already learned twice with content-quality
 * regex lists: each round catches the previous examples and misses the next.
 *
 * So the rules here are ordered by how well they age:
 *
 *   1. FACTS         — is this host the subject's, or a tracked competitor's?
 *                      Answered from the audit, not from a list. Never wrong.
 *   2. STRUCTURE     — `.edu`, `.gov`, and URL path shape (`/best-…`,
 *                      `/…-vs-…`, `/…-alternatives`). Derived from the URL
 *                      itself, so it works on a domain nobody has ever seen.
 *   3. CURATED LISTS — deliberately small, and only for categories where a
 *                      handful of hosts genuinely dominate every market
 *                      (Reddit, YouTube, G2).
 *   4. UNCLASSIFIED  — the honest default, reported as a first-class number.
 *
 * That last point is the one that keeps this useful. A breakdown where 60% of
 * citations land in "other" is decoration, and the reader has to be able to see
 * that. `unclassifiedShare` exists so the UI can say so out loud instead of
 * rendering a confident-looking chart over a coin flip.
 *
 * The `owned` / `earned` split is the axis that actually matters here, and it
 * is borrowed from upstream's own opportunity generator rather than its
 * classifier: a source you can publish to yourself is a different kind of work
 * from one you have to get mentioned on.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Where a cited page lives. */
export type SourceType =
    | "owned"
    | "competitor"
    | "review_marketplace"
    | "community"
    | "social_video"
    | "institutional"
    | "publisher"
    | "unclassified"

/**
 * What kind of page it is, from the URL's own shape.
 *
 * This is the signal that turns a citation into a content decision.
 * `listicle` and `comparison` pages are how an engine assembles a
 * recommendation, so a category dominated by them is a category won by being
 * *on the lists*, not by having better docs.
 */
export type PageShape = "listicle" | "comparison" | "review" | "docs" | "unshaped"

/** Can you publish this yourself, or must someone else publish it about you? */
export type Actionability = "publish" | "earn" | "none"

export interface ClassifiedCitation {
    url: string
    host: string
    sourceType: SourceType
    pageShape: PageShape
    actionability: Actionability
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
    owned: "Your own pages",
    competitor: "Competitor pages",
    review_marketplace: "Review sites & marketplaces",
    community: "Community & forums",
    social_video: "Social & video",
    institutional: "Institutional",
    publisher: "Publishers & press",
    unclassified: "Everything else",
}

/**
 * What to do about a source of this kind. Shown next to the count, because a
 * number with no next action is trivia.
 */
export const SOURCE_TYPE_ACTIONS: Record<SourceType, string> = {
    owned: "Already yours — deepen the pages the engines already trust.",
    competitor: "A rival's own page is being used as the reference. Answer the same question better.",
    review_marketplace: "Claim and complete the listing; these are cited constantly.",
    community: "Cannot be published into. Earned by being genuinely recommended.",
    social_video: "Earned. Usually the slowest to move.",
    institutional: "Rarely actionable — cite-worthy background, not a placement.",
    publisher: "Earned through coverage or a contributed piece.",
    unclassified: "Open a few and see what they are before drawing conclusions.",
}

export const PAGE_SHAPE_LABELS: Record<PageShape, string> = {
    listicle: "Best-of list",
    comparison: "Comparison",
    review: "Review",
    docs: "Documentation",
    unshaped: "Other page",
}

// ── Curated lists ───────────────────────────────────────────────────────────
// Deliberately short. Each entry must be a host that dominates its category in
// essentially every market — not one that appeared in one customer's report.
// If you find yourself adding a fourth car forum, the rule is wrong, not the
// list: add a structural signal instead, or let it stay unclassified.

const COMMUNITY_HOSTS = [
    "reddit.com",
    "quora.com",
    "stackoverflow.com",
    "stackexchange.com",
    "ycombinator.com",
    "discourse.org",
    "github.com",
]

const SOCIAL_VIDEO_HOSTS = [
    "youtube.com",
    "youtu.be",
    "linkedin.com",
    "x.com",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "medium.com",
    "substack.com",
]

const REVIEW_MARKETPLACE_HOSTS = [
    "g2.com",
    "capterra.com",
    "trustpilot.com",
    "getapp.com",
    "softwareadvice.com",
    "producthunt.com",
    "trustradius.com",
    "sourceforge.net",
    "alternativeto.net",
]

/**
 * Publishers. The shortest list here on purpose: "is this a publication" is
 * exactly the judgement that does not generalise, and an unclassified
 * publisher costs the reader nothing while a mislabelled one costs trust.
 */
const PUBLISHER_HOSTS = [
    "techcrunch.com",
    "theverge.com",
    "wired.com",
    "arstechnica.com",
    "forbes.com",
    "businessinsider.com",
    "bloomberg.com",
    "reuters.com",
    "nytimes.com",
    "wsj.com",
    "theguardian.com",
    "zdnet.com",
    "venturebeat.com",
]

/** Structural, not curated — these do not rot. */
const INSTITUTIONAL_TLD = /\.(edu|gov|mil)(\.[a-z]{2,3})?$/i
const INSTITUTIONAL_CC = /\.(ac|edu|gov)\.[a-z]{2}$/i

// ── URL-shape rules ─────────────────────────────────────────────────────────
// Read off the path, so they work on a host nobody has catalogued. These are
// evidential rather than semantic: `/best-crm-for-startups` is a claim the
// page's own author made about its shape.

const LISTICLE_PATH = /(^|[/-])(best|top|top-?\d+|\d+-best|leading|greatest)([/-]|$)/i
const COMPARISON_PATH = /(^|[/-])(vs|versus|compare|comparison|alternatives?|competitors?)([/-]|$)/i
const REVIEW_PATH = /(^|[/-])(review|reviews|hands-on|tested)([/-]|$)/i
const DOCS_PATH = /(^|[/-])(docs?|documentation|guide|reference|api|tutorial|help|support)([/-]|$)/i

export function extractHost(rawUrl: string): string | null {
    if (!rawUrl) return null
    try {
        const host = new URL(String(rawUrl).trim()).hostname.toLowerCase()
        return host.replace(/^www\./, "") || null
    } catch {
        const match = String(rawUrl).match(/^(?:https?:\/\/)?(?:www\.)?([^/\s?#]+)/i)
        return match ? match[1].toLowerCase() : null
    }
}

function matchesHost(host: string, list: string[]): boolean {
    return list.some((entry) => host === entry || host.endsWith(`.${entry}`))
}

function isSameOrSubdomain(host: string, domains: string[]): boolean {
    return domains.some((domain) => {
        const normalised = extractHost(domain) ?? domain.toLowerCase()
        return Boolean(normalised) && (host === normalised || host.endsWith(`.${normalised}`))
    })
}

/**
 * Shape of the page, from its path alone.
 *
 * Order matters: a page at `/best-crm-alternatives` is primarily a list, and
 * calling it a comparison would understate what it is doing. Docs are checked
 * last because `/guide` appears inside plenty of listicle paths.
 */
export function classifyPageShape(rawUrl: string): PageShape {
    let path = ""
    try {
        const url = new URL(rawUrl)
        path = `${url.pathname}${url.search}`
    } catch {
        path = rawUrl
    }
    if (!path || path === "/") return "unshaped"

    if (LISTICLE_PATH.test(path)) return "listicle"
    if (COMPARISON_PATH.test(path)) return "comparison"
    if (REVIEW_PATH.test(path)) return "review"
    if (DOCS_PATH.test(path)) return "docs"
    return "unshaped"
}

export interface ClassifyContext {
    /** Hosts the subject owns. A fact from the audit. */
    subjectDomains: string[]
    /** Hosts of tracked competitors. Also a fact from the audit. */
    competitorDomains: string[]
}

/**
 * Classifies one cited URL.
 *
 * Facts first, then structure, then the short lists, then honesty. A host that
 * matches nothing returns `unclassified` — never a guess, and never the
 * nearest-looking category.
 */
export function classifyCitation(
    rawUrl: string,
    context: ClassifyContext,
): ClassifiedCitation {
    const host = extractHost(rawUrl) ?? ""
    const pageShape = classifyPageShape(rawUrl)

    const sourceType: SourceType = (() => {
        if (!host) return "unclassified"

        // 1. Facts from the audit.
        if (isSameOrSubdomain(host, context.subjectDomains)) return "owned"
        if (isSameOrSubdomain(host, context.competitorDomains)) return "competitor"

        // 2. Structure.
        if (INSTITUTIONAL_TLD.test(host) || INSTITUTIONAL_CC.test(host)) {
            return "institutional"
        }

        // 3. Short curated lists.
        if (matchesHost(host, REVIEW_MARKETPLACE_HOSTS)) return "review_marketplace"
        if (matchesHost(host, COMMUNITY_HOSTS)) return "community"
        if (matchesHost(host, SOCIAL_VIDEO_HOSTS)) return "social_video"
        if (matchesHost(host, PUBLISHER_HOSTS)) return "publisher"

        // 4. Honest default.
        return "unclassified"
    })()

    return {
        url: rawUrl,
        host,
        sourceType,
        pageShape,
        actionability: actionabilityOf(sourceType),
    }
}

/**
 * Whether this is work you do or work you ask for.
 *
 * `owned` is the only "publish" case: it is the one surface you control. A
 * competitor's page is not earnable either — you answer the question yourself
 * on your own site — but it signals that the engines currently prefer their
 * explanation, which is a publishing job. Everything else needs someone else
 * to act.
 */
export function actionabilityOf(sourceType: SourceType): Actionability {
    switch (sourceType) {
        case "owned":
        case "competitor":
            return "publish"
        case "review_marketplace":
        case "community":
        case "social_video":
        case "publisher":
            return "earn"
        case "institutional":
        case "unclassified":
            return "none"
    }
}

export interface SourceTypeTally {
    sourceType: SourceType
    label: string
    action: string
    actionability: Actionability
    citations: number
    hosts: number
}

export interface CitationBreakdown {
    totalCitations: number
    byType: SourceTypeTally[]
    /**
     * Share of citations the classifier could not place, 0-100.
     *
     * Reported rather than buried. Above roughly a third, the breakdown is not
     * describing the category — it is describing the limits of the lists above,
     * and the dashboard says so.
     */
    unclassifiedShare: number
    publishShare: number
    earnShare: number
}

/** Aggregates classified citations into the shape the dashboard renders. */
export function summariseCitations(
    classified: ClassifiedCitation[],
): CitationBreakdown {
    const total = classified.length
    const tally = new Map<SourceType, { citations: number; hosts: Set<string> }>()

    for (const citation of classified) {
        const entry = tally.get(citation.sourceType) ?? {
            citations: 0,
            hosts: new Set<string>(),
        }
        entry.citations++
        if (citation.host) entry.hosts.add(citation.host)
        tally.set(citation.sourceType, entry)
    }

    const byType: SourceTypeTally[] = [...tally.entries()]
        .map(([sourceType, entry]) => ({
            sourceType,
            label: SOURCE_TYPE_LABELS[sourceType],
            action: SOURCE_TYPE_ACTIONS[sourceType],
            actionability: actionabilityOf(sourceType),
            citations: entry.citations,
            hosts: entry.hosts.size,
        }))
        .sort((a, b) => b.citations - a.citations)

    const share = (predicate: (tally: SourceTypeTally) => boolean) => {
        if (total === 0) return 0
        const count = byType
            .filter(predicate)
            .reduce((sum, entry) => sum + entry.citations, 0)
        return Math.round((count / total) * 1000) / 10
    }

    return {
        totalCitations: total,
        byType,
        unclassifiedShare: share((entry) => entry.sourceType === "unclassified"),
        publishShare: share((entry) => entry.actionability === "publish"),
        earnShare: share((entry) => entry.actionability === "earn"),
    }
}
