/**
 * Parses one AI engine answer into brand-visibility facts.
 *
 * Ported from Ansvisor (`server/src/lib/response-parser.js`), MIT licensed,
 * Copyright (c) 2026 Empler AI Inc. Behaviour is preserved deliberately: this
 * is the one part of the upstream project worth inheriting verbatim, because
 * it is pure, dependency-free, and already carries the fixes for the two bugs
 * that a naive implementation always ships (substring domain matching, and
 * counting a brand's own name twice when it appears inside a citation URL).
 *
 * Everything this module returns is an observation, not a judgement. Whether
 * an absence is worth writing about is decided in `gap-mapper.ts`.
 */

/** One URL an engine cited in support of its answer. */
export interface AnswerCitation {
    url: string
    title: string
}

/** The raw result of asking one engine one prompt. */
export interface EngineAnswer {
    text: string
    citations: AnswerCitation[]
}

/** The subject of the audit: the customer's brand and the hosts it owns. */
export interface ProbeSubject {
    brandName: string
    domains: string[]
}

export interface ProbeCompetitor {
    id: string
    name: string
    domain: string | null
}

export interface CompetitorMention {
    competitorId: string
    name: string
    domain: string
    mentionCount: number
    citationCount: number
    /** 1-based rank of this competitor's first mention, null when unmentioned. */
    mentionPosition: number | null
}

export interface ParsedAnswer {
    /** Times the brand is named in the answer prose (URLs stripped first). */
    mentionCount: number
    /** Citations pointing at a host the brand owns. */
    citationCount: number
    /** Total citations in the answer, brand-owned or not. */
    totalCitations: number
    /**
     * 1-based rank of the brand's first mention among every tracked entity.
     * `null` means the brand is absent from the answer entirely — which is the
     * single fact this whole pivot rests on, so it is kept distinct from 0.
     */
    mentionPosition: number | null
    /** How many tracked entities the answer named. 0 means "computed, none". */
    mentionedEntityCount: number
    competitorMentions: CompetitorMention[]
}

/**
 * Strips markdown link targets and bare URLs, leaving only prose.
 *
 * Without this, a brand cited as `[Acme](https://acme.com)` is counted twice —
 * once as the link label and once inside the href — and a brand that is only
 * ever cited, never recommended, scores as though the engine named it.
 */
function stripUrls(text: string): string {
    return text
        .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
        .replace(/https?:\/\/[^\s)>\]]+/g, "")
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function countOccurrences(text: string, term: string): number {
    if (!term) return 0
    const matches = text.match(new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"))
    return matches ? matches.length : 0
}

function firstOccurrenceIndex(text: string, term: string): number {
    if (!term) return -1
    const match = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").exec(text)
    return match ? match.index : -1
}

/**
 * Registrable hostname of a URL: "https://www.Foo.com/bar" -> "foo.com".
 *
 * Returns null rather than guessing. An unparseable citation must never be
 * silently attributed to the brand.
 */
export function extractHostname(rawUrl: string): string | null {
    if (!rawUrl) return null
    try {
        const host = new URL(String(rawUrl).trim()).hostname.toLowerCase()
        return host.replace(/^www\./, "") || null
    } catch {
        const match = String(rawUrl).match(/^(?:https?:\/\/)?(?:www\.)?([^/\s?#]+)/i)
        return match ? match[1].toLowerCase() : null
    }
}

/**
 * Counts citations pointing at a host the brand owns — exact host or subdomain.
 *
 * Upstream's note is worth keeping: a substring check (`url.includes(domain)`)
 * also matches the brand's domain inside *another* site's path or query string,
 * so `https://competitor.com/compare?vs=acme.com` counted as the brand being
 * cited. It is not. It is the brand being compared away.
 */
export function countOwnDomainCitations(
    citations: AnswerCitation[],
    brandDomains: string[],
): number {
    const owned = (brandDomains || [])
        .map((domain) => extractHostname(domain) ?? String(domain ?? "").trim().toLowerCase())
        .filter(Boolean)
    if (owned.length === 0) return 0

    let count = 0
    for (const citation of citations || []) {
        const host = extractHostname(citation?.url || "")
        if (host && owned.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
            count++
        }
    }
    return count
}

/** Times the brand is named in the answer prose, by name or by domain. */
export function countBrandMentions(text: string, subject: ProbeSubject): number {
    const clean = stripUrls(text)
    let count = countOccurrences(clean, subject.brandName)
    for (const domain of subject.domains) {
        count += countOccurrences(clean, domain)
    }
    return count
}

/**
 * Where each tracked entity lands in the answer's mention order.
 *
 * Deterministic: earliest word-boundary occurrence in the URL-stripped text.
 * An entity's rank is 1 + the number of other tracked entities named before it,
 * so rank 1 means "the engine named this one first" — the position that
 * actually decides whether a buyer ever sees the rest of the list.
 */
export function computeMentionPosition(
    text: string,
    subject: ProbeSubject,
    competitors: ProbeCompetitor[] = [],
): {
    mentionPosition: number | null
    mentionedEntityCount: number
    competitorPositions: Map<string, number>
} {
    const clean = stripUrls(text)

    const entityFirstIndex = (names: string[]): number => {
        let best = -1
        for (const name of names) {
            const index = firstOccurrenceIndex(clean, name)
            if (index >= 0 && (best === -1 || index < best)) best = index
        }
        return best
    }

    const brandIndex = entityFirstIndex([subject.brandName, ...(subject.domains || [])])
    const mentioned = (competitors || [])
        .map((competitor) => ({
            id: competitor.id,
            index: entityFirstIndex([
                competitor.name,
                ...(competitor.domain ? [competitor.domain] : []),
            ]),
        }))
        .filter((competitor) => competitor.index >= 0)

    const indexes = [
        ...mentioned.map((competitor) => competitor.index),
        ...(brandIndex >= 0 ? [brandIndex] : []),
    ]
    const rankOf = (index: number) => indexes.filter((other) => other < index).length + 1

    return {
        mentionPosition: brandIndex >= 0 ? rankOf(brandIndex) : null,
        mentionedEntityCount: indexes.length,
        competitorPositions: new Map(
            mentioned.map((competitor) => [competitor.id, rankOf(competitor.index)]),
        ),
    }
}

/**
 * Turns one engine answer into the facts the gap stage reads.
 *
 * Note what is deliberately absent: sentiment. Upstream spends an extra model
 * call per answer classifying tone, which feeds 15 of its 100 visibility
 * points. We do not sell tone, we sell presence — and a second model call per
 * prompt per engine is the difference between a probe that costs cents and one
 * that costs dollars.
 */
export function parseAnswer(
    answer: EngineAnswer,
    subject: ProbeSubject,
    competitors: ProbeCompetitor[] = [],
): ParsedAnswer {
    const { text, citations } = answer
    const clean = stripUrls(text)

    let mentionCount = countOccurrences(clean, subject.brandName)
    for (const domain of subject.domains) {
        mentionCount += countOccurrences(clean, domain)
    }

    const citationCount = countOwnDomainCitations(citations, subject.domains)

    const { mentionPosition, mentionedEntityCount, competitorPositions } =
        computeMentionPosition(text, subject, competitors)

    const competitorMentions: CompetitorMention[] = competitors.map((competitor) => {
        let count = countOccurrences(clean, competitor.name)
        if (competitor.domain) count += countOccurrences(clean, competitor.domain)

        const competitorCitations = competitor.domain
            ? countOwnDomainCitations(citations, [competitor.domain])
            : 0

        return {
            competitorId: competitor.id,
            name: competitor.name,
            domain: competitor.domain || "",
            mentionCount: count,
            citationCount: competitorCitations,
            mentionPosition: competitorPositions.get(competitor.id) ?? null,
        }
    })

    return {
        mentionCount,
        citationCount,
        totalCitations: citations.length,
        mentionPosition,
        mentionedEntityCount,
        competitorMentions,
    }
}

/**
 * Share of answers in which the brand appeared at all, 0-100.
 *
 * This is deliberately a plain proportion of a countable event, not upstream's
 * weighted 0-100 composite of mentions, citations, ratio and sentiment. The
 * composite is unfalsifiable in the way that matters: a customer cannot check
 * it, and a movement in it cannot be attributed to anything. "Named in 9 of 42
 * answers" can be checked by opening 42 stored answers and counting.
 *
 * Prominence is reported separately (see `meanMentionPosition`) rather than
 * blended in, so neither number can hide behind the other.
 */
export function presenceRate(parsed: ParsedAnswer[]): number {
    if (parsed.length === 0) return 0
    const present = parsed.filter((answer) => answer.mentionCount > 0).length
    return Math.round((present / parsed.length) * 1000) / 10
}

/** Mean first-mention rank across the answers that named the brand at all. */
export function meanMentionPosition(parsed: ParsedAnswer[]): number | null {
    const ranked = parsed
        .map((answer) => answer.mentionPosition)
        .filter((position): position is number => position !== null)
    if (ranked.length === 0) return null
    const total = ranked.reduce((sum, position) => sum + position, 0)
    return Math.round((total / ranked.length) * 10) / 10
}
