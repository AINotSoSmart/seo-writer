import "server-only"

import { verifiedQuotes, quoteIsInText } from "./evidence"
import { generateJson } from "./gemini-json"

/** A page of ours the judge may read. */
export interface OwnPage {
    id: string
    url: string
    kind: string
    title: string
    text: string
}

/** A page an engine cited for these questions. */
export interface CitedPage {
    id: string
    url: string
    text: string
}

export interface MissingItem {
    id: string
    item: string
    why: string
    sourceUrl: string
    sourceQuote: string
}

export interface CoverageVerdict {
    /** Our page that answers the questions, proven by verified quotes; null if none. */
    coveringPageId: string | null
    coveringQuotes: string[]
    /** Pages the judge claimed answered but whose quotes failed verification. */
    rejectedClaims: Array<{ pageId: string; reason: string }>
    /** Verified points from cited pages that our page (or a new one) must cover. */
    missingItems: MissingItem[]
    /** Items the judge proposed whose source quote was not found. */
    droppedItems: number
}

const OWN_PAGE_CHARS = 7_000
const CITED_PAGE_CHARS = 5_000

const COVERAGE_SCHEMA = {
    type: "OBJECT",
    properties: {
        candidates: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    pageId: { type: "STRING" },
                    answersQuestions: { type: "BOOLEAN" },
                    quotes: { type: "ARRAY", items: { type: "STRING" } },
                },
                required: ["pageId", "answersQuestions", "quotes"],
            },
        },
        coveringPageId: { type: "STRING", nullable: true },
        missingItems: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    item: { type: "STRING" },
                    why: { type: "STRING" },
                    sourcePageId: { type: "STRING" },
                    sourceQuote: { type: "STRING" },
                },
                required: ["item", "why", "sourcePageId", "sourceQuote"],
            },
        },
    },
    required: ["candidates", "missingItems"],
}

export function buildCoveragePrompt(input: {
    brandName: string
    brandIdentity: string
    questions: string[]
    ownPages: OwnPage[]
    citedPages: CitedPage[]
}): string {
    const own = input.ownPages
        .map((page) => `### OUR PAGE ${page.id} (${page.kind}) ${page.url}\nTitle: ${page.title}\n${page.text.slice(0, OWN_PAGE_CHARS)}`)
        .join("\n\n")
    const cited = input.citedPages
        .map((page) => `### CITED PAGE ${page.id} ${page.url}\n${page.text.slice(0, CITED_PAGE_CHARS)}`)
        .join("\n\n")
    return `You are an SEO analyst checking why AI answer engines did not mention ${input.brandName} (${input.brandIdentity}) for these buyer questions:
${input.questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

The engines answered these questions using the CITED PAGES below. You also have the closest pages from ${input.brandName}'s own site (OUR PAGES).

Task 1. For every OUR PAGE, decide whether it directly answers these questions (not merely the same topic). If it does, copy 1-3 exact passages from that page that show it, word for word. If you cannot copy a passage that proves it, answer false.

Task 2. coveringPageId: the id of the single OUR PAGE that best answers the questions, or null if none does.

Task 3. missingItems: concrete, material points the CITED PAGES use to answer these questions that ${coveringPageIdHint()}. Each item needs the CITED PAGE id it came from and an exact passage copied from that page. Only facts, steps, comparisons, criteria, data or formats a buyer needs; no style advice, no generic SEO tips. If nothing material is missing, return an empty list. Never invent an item that is not in a cited page.

Rules: copy passages exactly as written. Do not paraphrase quotes. Do not use outside knowledge.

${own || "(no pages of ours were close)"}

${cited || "(no cited pages could be read)"}`
}

function coveringPageIdHint(): string {
    return "the covering page does not already contain (if no page covers the questions: the points any new page answering them must include)"
}

/**
 * Does any of our pages answer these questions, and what do the cited pages
 * have that we lack? Every yes and every missing item is checked against the
 * page text; whatever cannot be found there is discarded.
 */
export async function judgeCoverage(input: {
    brandName: string
    brandIdentity: string
    questions: string[]
    ownPages: OwnPage[]
    citedPages: CitedPage[]
}): Promise<CoverageVerdict> {
    const raw = await generateJson<{
        candidates?: Array<{ pageId?: string; answersQuestions?: boolean; quotes?: unknown }>
        coveringPageId?: string | null
        missingItems?: Array<{ item?: string; why?: string; sourcePageId?: string; sourceQuote?: string }>
    }>(buildCoveragePrompt(input), COVERAGE_SCHEMA)

    const ownById = new Map(input.ownPages.map((page) => [page.id, page]))
    const proven = new Map<string, string[]>()
    const rejectedClaims: CoverageVerdict["rejectedClaims"] = []
    for (const candidate of raw.candidates ?? []) {
        const page = candidate.pageId ? ownById.get(candidate.pageId) : undefined
        if (!page || !candidate.answersQuestions) continue
        const quotes = verifiedQuotes(candidate.quotes, page.text)
        if (quotes.length > 0) proven.set(page.id, quotes)
        else rejectedClaims.push({ pageId: page.id, reason: "No quoted passage was found in the page." })
    }

    // The judge's pick must itself be proven; otherwise take a proven page, if any.
    let coveringPageId: string | null = null
    if (raw.coveringPageId && proven.has(raw.coveringPageId)) coveringPageId = raw.coveringPageId
    else if (proven.size > 0) coveringPageId = [...proven.keys()][0]

    const citedById = new Map(input.citedPages.map((page) => [page.id, page]))
    const missingItems: MissingItem[] = []
    let droppedItems = 0
    for (const item of raw.missingItems ?? []) {
        const source = item.sourcePageId ? citedById.get(item.sourcePageId) : undefined
        if (!source || !item.item || !item.sourceQuote || !quoteIsInText(item.sourceQuote, source.text)) {
            droppedItems++
            continue
        }
        missingItems.push({
            id: `m${missingItems.length + 1}`,
            item: item.item.trim(),
            why: (item.why ?? "").trim(),
            sourceUrl: source.url,
            sourceQuote: item.sourceQuote.trim(),
        })
    }

    return {
        coveringPageId,
        coveringQuotes: coveringPageId ? proven.get(coveringPageId) ?? [] : [],
        rejectedClaims,
        missingItems,
        droppedItems,
    }
}

const DUPLICATE_SCHEMA = {
    type: "OBJECT",
    properties: {
        duplicateOfId: { type: "STRING", nullable: true },
        overlapQuote: { type: "STRING" },
        reason: { type: "STRING" },
    },
    required: ["reason"],
}

export interface DuplicateVerdict {
    duplicateOfId: string | null
    overlapQuote: string | null
    reason: string
}

/**
 * The duplicate guard. Would this piece substantially repeat one of these
 * existing pages (same search intent, same answer)? A yes needs a passage from
 * that page showing the overlap, and the passage must be found in it.
 */
export async function judgeDuplicate(input: {
    brandName: string
    proposal: { title: string; questions: string[]; text?: string }
    existing: Array<{ id: string; url: string; title: string; text: string }>
}): Promise<DuplicateVerdict> {
    if (input.existing.length === 0) return { duplicateOfId: null, overlapQuote: null, reason: "Nothing similar exists." }
    const prompt = `You are the duplicate-content guard for ${input.brandName}'s site. Publishing two pages that answer the same search intent splits rankings and citations between them.

PROPOSED PIECE: "${input.proposal.title}"
It answers: ${input.proposal.questions.map((question) => `"${question}"`).join("; ")}
${input.proposal.text ? `Its draft:\n${input.proposal.text.slice(0, 6_000)}\n` : ""}
EXISTING PAGES:
${input.existing.map((page) => `### ${page.id} ${page.url}\nTitle: ${page.title}\n${page.text.slice(0, 4_000)}`).join("\n\n")}

Is the proposed piece a duplicate of one existing page, meaning that page already targets the same search intent and gives the same answer? Sharing a topic or keywords is NOT duplication. If it is a duplicate, return that page's id as duplicateOfId and copy, word for word, a passage from that page that shows the overlap. Otherwise return null. Explain in one sentence.`
    const raw = await generateJson<{ duplicateOfId?: string | null; overlapQuote?: string; reason?: string }>(
        prompt,
        DUPLICATE_SCHEMA,
        { temperature: 0 },
    )
    const page = input.existing.find((candidate) => candidate.id === raw.duplicateOfId)
    if (!page) return { duplicateOfId: null, overlapQuote: null, reason: raw.reason ?? "" }
    if (!raw.overlapQuote || !quoteIsInText(raw.overlapQuote, page.text)) {
        return {
            duplicateOfId: null,
            overlapQuote: null,
            reason: `Duplicate claim against ${page.url} discarded: its quoted overlap was not found on that page.`,
        }
    }
    return { duplicateOfId: page.id, overlapQuote: raw.overlapQuote, reason: raw.reason ?? "" }
}
