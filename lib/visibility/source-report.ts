export type SourceRelationship = "owned" | "competitor" | "external"
export type DeclaredPageKind = "best-of" | "comparison" | "review"

export interface SourceReportInput {
    promptId: string
    engine: string
    namedBrand: boolean
    losingQuestion: boolean
    citations: unknown
}

export interface SourceReportHost {
    host: string
    relationship: SourceRelationship
    citationCount: number
    answerCount: number
    namingAnswerCount: number
    questionIds: string[]
    losingQuestionIds: string[]
    engines: string[]
}

export interface SourceReportPage {
    url: string
    title: string
    host: string
    relationship: SourceRelationship
    declaredKind: DeclaredPageKind | null
    citationCount: number
    answerCount: number
    namingAnswerCount: number
    questionIds: string[]
    losingQuestionIds: string[]
    engines: string[]
}

export interface SourceReport {
    totalCitations: number
    distinctSites: number
    relationshipCounts: Record<SourceRelationship, number>
    hosts: SourceReportHost[]
    explicitlyShapedPages: SourceReportPage[]
}

interface EvidenceAccumulator {
    citationCount: number
    answerKeys: Set<string>
    namingAnswerKeys: Set<string>
    questionIds: Set<string>
    losingQuestionIds: Set<string>
    engines: Set<string>
}

interface PageAccumulator extends EvidenceAccumulator {
    url: string
    title: string
    host: string
    relationship: SourceRelationship
    declaredKind: DeclaredPageKind | null
}

function evidenceAccumulator(): EvidenceAccumulator {
    return {
        citationCount: 0,
        answerKeys: new Set<string>(),
        namingAnswerKeys: new Set<string>(),
        questionIds: new Set<string>(),
        losingQuestionIds: new Set<string>(),
        engines: new Set<string>(),
    }
}

function normalizeHost(value: string): string {
    try {
        return new URL(value.includes("://") ? value : `https://${value}`)
            .hostname.toLowerCase().replace(/^www\./, "")
    } catch {
        return value.toLowerCase().replace(/^www\./, "").replace(/\/$/, "")
    }
}

function relationshipOf(
    host: string,
    context: { subjectDomains: string[]; competitorDomains: string[] },
): SourceRelationship {
    const matches = (domains: string[]) =>
        domains.some((domain) => {
            const known = normalizeHost(domain)
            return host === known || host.endsWith(`.${known}`)
        })
    if (matches(context.subjectDomains)) return "owned"
    if (matches(context.competitorDomains)) return "competitor"
    return "external"
}

function normalizeSourceUrl(rawUrl: string): { url: string; host: string } | null {
    try {
        const url = new URL(rawUrl)
        url.hash = ""
        if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "")
        return {
            url: url.toString(),
            host: url.hostname.toLowerCase().replace(/^www\./, ""),
        }
    } catch {
        return null
    }
}

/**
 * A narrow statement about words already present in the stored citation title.
 * This does not fetch the page or infer a publisher/category taxonomy.
 */
function declaredPageKind(title: string): DeclaredPageKind | null {
    if (/\b(vs\.?|versus|comparison|alternatives?)\b/i.test(title)) return "comparison"
    if (/\breviews?\b/i.test(title)) return "review"
    if (/\b(?:\d+\s+(?:best|top)|(?:best|top)\s+\d+)\b/i.test(title)) return "best-of"
    return null
}

function recordEvidence(
    entry: EvidenceAccumulator,
    input: SourceReportInput,
    answerKey: string,
) {
    entry.citationCount++
    entry.answerKeys.add(answerKey)
    if (input.namedBrand) entry.namingAnswerKeys.add(answerKey)
    entry.questionIds.add(input.promptId)
    if (input.losingQuestion) entry.losingQuestionIds.add(input.promptId)
    entry.engines.add(input.engine)
}

function toPage(entry: PageAccumulator): SourceReportPage {
    return {
        url: entry.url,
        title: entry.title,
        host: entry.host,
        relationship: entry.relationship,
        declaredKind: entry.declaredKind,
        citationCount: entry.citationCount,
        answerCount: entry.answerKeys.size,
        namingAnswerCount: entry.namingAnswerKeys.size,
        questionIds: [...entry.questionIds],
        losingQuestionIds: [...entry.losingQuestionIds],
        engines: [...entry.engines].sort(),
    }
}

/**
 * Builds factual source evidence from immutable answer rows.
 *
 * The only grouping is ownership already confirmed by the customer/audit:
 * customer, tracked competitor, or external. Unknown external sites are not a
 * failure state and never receive a production or next-step classification.
 */
export function buildSourceReport(
    rows: SourceReportInput[],
    context: { subjectDomains: string[]; competitorDomains: string[] },
): SourceReport {
    const hosts = new Map<
        string,
        EvidenceAccumulator & { relationship: SourceRelationship }
    >()
    const pages = new Map<string, PageAccumulator>()
    const relationshipCounts: Record<SourceRelationship, number> = {
        owned: 0,
        competitor: 0,
        external: 0,
    }
    let totalCitations = 0

    for (const input of rows) {
        const answerKey = `${input.promptId}:${input.engine}`
        if (!Array.isArray(input.citations)) continue

        for (const rawCitation of input.citations) {
            const raw = rawCitation as { url?: unknown; title?: unknown }
            const normalized = normalizeSourceUrl(String(raw?.url ?? ""))
            if (!normalized) continue
            const title = String(raw?.title ?? "").trim()
            const relationship = relationshipOf(normalized.host, context)

            totalCitations++
            relationshipCounts[relationship]++

            const host = hosts.get(normalized.host) ?? {
                ...evidenceAccumulator(),
                relationship,
            }
            recordEvidence(host, input, answerKey)
            hosts.set(normalized.host, host)

            const page = pages.get(normalized.url) ?? {
                ...evidenceAccumulator(),
                url: normalized.url,
                title,
                host: normalized.host,
                relationship,
                declaredKind: declaredPageKind(title),
            }
            if (!page.title && title) {
                page.title = title
                page.declaredKind = declaredPageKind(title)
            }
            recordEvidence(page, input, answerKey)
            pages.set(normalized.url, page)
        }
    }

    const byEvidence = <T extends { losingQuestionIds: string[]; questionIds: string[]; citationCount: number; host: string }>(
        a: T,
        b: T,
    ) =>
        b.losingQuestionIds.length - a.losingQuestionIds.length ||
        b.questionIds.length - a.questionIds.length ||
        b.citationCount - a.citationCount ||
        a.host.localeCompare(b.host)

    const hostRows: SourceReportHost[] = [...hosts.entries()]
        .map(([host, entry]) => ({
            host,
            relationship: entry.relationship,
            citationCount: entry.citationCount,
            answerCount: entry.answerKeys.size,
            namingAnswerCount: entry.namingAnswerKeys.size,
            questionIds: [...entry.questionIds],
            losingQuestionIds: [...entry.losingQuestionIds],
            engines: [...entry.engines].sort(),
        }))
        .sort(byEvidence)

    return {
        totalCitations,
        distinctSites: hostRows.length,
        relationshipCounts,
        hosts: hostRows,
        explicitlyShapedPages: [...pages.values()]
            .map(toPage)
            .filter((page) => page.declaredKind !== null)
            .sort(byEvidence),
    }
}
