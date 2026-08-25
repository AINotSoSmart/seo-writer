import {
    actionabilityOf,
    classifyCitation,
    type Actionability,
    type PageShape,
    type SourceType,
} from "./citation-classifier"

export interface SourceReportInput {
    promptId: string
    engine: string
    namedBrand: boolean
    citations: unknown
}

export interface SourceReportHost {
    host: string
    sourceType: SourceType
    actionability: Actionability
    citationCount: number
    answerCount: number
    namingAnswerCount: number
    questionIds: string[]
    engines: string[]
}

export interface SourceReportPage {
    url: string
    title: string
    host: string
    pageShape: PageShape
    sourceType: SourceType
    actionability: Actionability
    citationCount: number
    answerCount: number
    namingAnswerCount: number
    questionIds: string[]
    engines: string[]
}

export interface SourceReport {
    totalCitations: number
    distinctSites: number
    topThreeShare: number
    actionCounts: Record<Actionability, number>
    hosts: SourceReportHost[]
    listPages: SourceReportPage[]
    reviewPages: SourceReportPage[]
}

interface SourceAccumulator {
    citationCount: number
    answerKeys: Set<string>
    namingAnswerKeys: Set<string>
    questionIds: Set<string>
    engines: Set<string>
    sourceTypes: Map<SourceType, number>
}

interface PageAccumulator extends SourceAccumulator {
    url: string
    title: string
    host: string
    pageShape: PageShape
}

function sourceAccumulator(): SourceAccumulator {
    return {
        citationCount: 0,
        answerKeys: new Set<string>(),
        namingAnswerKeys: new Set<string>(),
        questionIds: new Set<string>(),
        engines: new Set<string>(),
        sourceTypes: new Map<SourceType, number>(),
    }
}

function dominantSourceType(counts: Map<SourceType, number>): SourceType {
    return (
        [...counts.entries()].sort(
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0]?.[0] ?? "unclassified"
    )
}

function normalizeSourceUrl(rawUrl: string): string | null {
    try {
        const url = new URL(rawUrl)
        url.hash = ""
        if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "")
        return url.toString()
    } catch {
        return null
    }
}

function recordEvidence(
    entry: SourceAccumulator,
    input: SourceReportInput,
    answerKey: string,
    sourceType: SourceType,
) {
    entry.citationCount++
    entry.answerKeys.add(answerKey)
    if (input.namedBrand) entry.namingAnswerKeys.add(answerKey)
    entry.questionIds.add(input.promptId)
    entry.engines.add(input.engine)
    entry.sourceTypes.set(sourceType, (entry.sourceTypes.get(sourceType) ?? 0) + 1)
}

function toPage(entry: PageAccumulator): SourceReportPage {
    const sourceType = dominantSourceType(entry.sourceTypes)
    return {
        url: entry.url,
        title: entry.title,
        host: entry.host,
        pageShape: entry.pageShape,
        sourceType,
        actionability: actionabilityOf(sourceType),
        citationCount: entry.citationCount,
        answerCount: entry.answerKeys.size,
        namingAnswerCount: entry.namingAnswerKeys.size,
        questionIds: [...entry.questionIds],
        engines: [...entry.engines].sort(),
    }
}

/**
 * Builds the page-facing source model from the immutable answer rows.
 *
 * Citation occurrences, citing answers and questions are deliberately separate
 * measures. One answer can cite two pages on the same host, so using a citation
 * count as an answer count would overstate the evidence in both directories.
 */
export function buildSourceReport(
    rows: SourceReportInput[],
    context: { subjectDomains: string[]; competitorDomains: string[] },
): SourceReport {
    const hosts = new Map<string, SourceAccumulator>()
    const pages = new Map<string, PageAccumulator>()
    const actionCounts: Record<Actionability, number> = {
        publish: 0,
        earn: 0,
        none: 0,
        review: 0,
    }
    let totalCitations = 0

    for (const input of rows) {
        const answerKey = `${input.promptId}:${input.engine}`
        if (!Array.isArray(input.citations)) continue

        for (const rawCitation of input.citations) {
            const raw = rawCitation as { url?: unknown; title?: unknown }
            const url = normalizeSourceUrl(String(raw?.url ?? ""))
            if (!url) continue
            const title = String(raw?.title ?? "").trim()
            const classified = classifyCitation(url, context, title)
            if (!classified.host) continue

            totalCitations++
            actionCounts[classified.actionability]++

            const host = hosts.get(classified.host) ?? sourceAccumulator()
            recordEvidence(host, input, answerKey, classified.sourceType)
            hosts.set(classified.host, host)

            const page = pages.get(url) ?? {
                ...sourceAccumulator(),
                url,
                title,
                host: classified.host,
                pageShape: classified.pageShape,
            }
            if (!page.title && title) page.title = title
            recordEvidence(page, input, answerKey, classified.sourceType)
            pages.set(url, page)
        }
    }

    const hostRows = [...hosts.entries()]
        .map(([host, entry]): SourceReportHost => {
            const sourceType = dominantSourceType(entry.sourceTypes)
            return {
                host,
                sourceType,
                actionability: actionabilityOf(sourceType),
                citationCount: entry.citationCount,
                answerCount: entry.answerKeys.size,
                namingAnswerCount: entry.namingAnswerKeys.size,
                questionIds: [...entry.questionIds],
                engines: [...entry.engines].sort(),
            }
        })
        .sort((a, b) => b.citationCount - a.citationCount || a.host.localeCompare(b.host))

    const pageRows = [...pages.values()].map(toPage)
    const byInfluence = (a: SourceReportPage, b: SourceReportPage) =>
        b.citationCount - a.citationCount ||
        a.namingAnswerCount - b.namingAnswerCount ||
        a.host.localeCompare(b.host)

    const topThreeCitations = hostRows
        .slice(0, 3)
        .reduce((sum, host) => sum + host.citationCount, 0)

    return {
        totalCitations,
        distinctSites: hostRows.length,
        topThreeShare:
            totalCitations > 0 ? Math.round((topThreeCitations / totalCitations) * 100) : 0,
        actionCounts,
        hosts: hostRows,
        listPages: pageRows
            .filter((page) => ["listicle", "comparison", "review"].includes(page.pageShape))
            .sort(byInfluence),
        reviewPages: pageRows
            .filter((page) => page.actionability === "review")
            .sort(byInfluence),
    }
}
