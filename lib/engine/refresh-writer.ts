/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import "server-only"

import { createHash } from "node:crypto"

import { applySegmentEdits, contentIndices, splitSegments, type SegmentEdit } from "./blocks"
import { generateJson } from "./gemini-json"
import { getWordPressItem } from "./inventory"
import type { MissingItem } from "./judge"
import { htmlToText } from "./page-text"
import { loadWordPressConnection } from "./settings"

export interface RefreshChange {
    position: number
    operation: "insert_after" | "replace"
    html: string
    reason: string
    /** What was there before, for a replace. */
    replaced: string | null
    sources: Array<{ url: string; quote: string; item: string }>
}

export interface RefreshOutput {
    wordpressType: "post" | "page"
    wordpressId: number
    link: string
    title: string
    modifiedGmt: string | null
    fetchedAt: string
    sourceHash: string
    originalContent: string
    updatedContent: string
    changes: RefreshChange[]
}

const ALLOWED_TAGS = /^(h2|h3|h4|p|ul|ol|li|table|thead|tbody|tr|th|td|strong|em|a|code|br)$/i

/** Removes anything outside the small HTML vocabulary a section needs. */
export function sanitizeSectionHtml(html: string): string {
    return String(html || "")
        .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, "")
        .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, name: string, attributes: string) => {
            if (!ALLOWED_TAGS.test(name)) return ""
            if (name.toLowerCase() === "a") {
                const href = attributes.match(/href\s*=\s*"([^"]*)"/i)?.[1]
                if (tag.startsWith("</")) return "</a>"
                return href && /^https?:\/\//.test(href) ? `<a href="${href}">` : "<a>"
            }
            return tag.startsWith("</") ? `</${name.toLowerCase()}>` : `<${name.toLowerCase()}>`
        })
        .trim()
}

const REFRESH_SCHEMA = {
    type: "OBJECT",
    properties: {
        changes: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    position: { type: "INTEGER" },
                    operation: { type: "STRING", enum: ["insert_after", "replace"] },
                    html: { type: "STRING" },
                    reason: { type: "STRING" },
                    itemIds: { type: "ARRAY", items: { type: "STRING" } },
                },
                required: ["position", "operation", "html", "reason", "itemIds"],
            },
        },
    },
    required: ["changes"],
}

/**
 * Writes the refresh for one existing WordPress post or page.
 *
 * Starts from the post as WordPress holds it (never the public HTML), proposes
 * the smallest changes that add the verified missing items, and applies them
 * to the original body without touching anything else. Nothing is written to
 * WordPress: the result is stored for the owner to review and publish.
 */
export async function writeRefresh(input: {
    admin: any
    connectionId: string
    wordpressType: "post" | "page"
    wordpressId: number
    questions: string[]
    missingItems: MissingItem[]
    brand: { name: string; identity: string; facts: string[] }
}): Promise<RefreshOutput> {
    const connection = await loadWordPressConnection(input.admin, input.connectionId)
    if (!connection) throw new Error("The tool's WordPress connection is missing.")
    if (input.missingItems.length === 0) throw new Error("Nothing verified is missing from this page, so there is nothing to change.")

    const item = await getWordPressItem(connection, input.wordpressType, input.wordpressId)
    if (!item.rawContent.trim()) throw new Error("WordPress returned an empty body for this post.")

    const segments = splitSegments(item.rawContent)
    const positions = contentIndices(segments)
    const outline = positions
        .map((segmentIndex, position) => {
            const segment = segments[segmentIndex]
            const text = htmlToText(segment.raw).text.replace(/\n/g, " ")
            const label = segment.name ?? (/<h[1-6]/i.test(segment.raw) ? "heading" : "html")
            return `[${position}] (${label}) ${text ? text.slice(0, 300) : "(no text: media or layout)"}`
        })
        .join("\n")

    const prompt = `You are updating an existing article on ${input.brand.name}'s blog so it fully answers these buyer questions:
${input.questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

The pages AI answer engines cited for these questions contain the points below, which this article lacks. Each has an id, the source page and the exact passage.
${input.missingItems.map((missing) => `- ${missing.id}: ${missing.item} (why: ${missing.why}) — source ${missing.sourceUrl}: "${missing.sourceQuote}"`).join("\n")}

About ${input.brand.name}: ${input.brand.identity}
${input.brand.facts.length ? `Known facts about ${input.brand.name}:\n${input.brand.facts.map((fact) => `- ${fact}`).join("\n")}` : ""}

The article "${item.title}", as numbered blocks:
${outline}

Write the smallest set of changes that adds the missing points:
- "insert_after": a new section (an <h2> or <h3> plus paragraphs/lists) placed after block [position], where it fits the article's flow.
- "replace": rewrite block [position] only when that exact block is outdated or wrong about a missing point. Never replace headings, images or layout blocks.
- Every change must list the missing item ids it covers. Do not add anything that no missing item supports.
- State facts in your own words, accurately; keep numbers and names exactly as in the source passages.
- Do not claim anything about ${input.brand.name} beyond the facts given above.
- No filler, no generic advice, no conclusions or summaries, no keyword stuffing.
- HTML only: h2, h3, p, ul, ol, li, table, strong, em, a.
- Match the article's existing tone.`

    const raw = await generateJson<{
        changes?: Array<{ position?: number; operation?: string; html?: string; reason?: string; itemIds?: unknown }>
    }>(prompt, REFRESH_SCHEMA, { temperature: 0.3 })

    const itemsById = new Map(input.missingItems.map((missing) => [missing.id, missing]))
    const changes: RefreshChange[] = []
    const edits: SegmentEdit[] = []
    const usedReplace = new Set<number>()
    for (const change of raw.changes ?? []) {
        const position = Number(change.position)
        if (!Number.isInteger(position) || position < 0 || position >= positions.length) continue
        const operation = change.operation === "replace" ? "replace" : change.operation === "insert_after" ? "insert_after" : null
        if (!operation) continue
        const segment = segments[positions[position]]
        if (operation === "replace") {
            // Only plain text blocks may be rewritten; anything else is kept.
            const plain = !segment.name || ["paragraph", "list"].includes(segment.name)
            if (!plain || /<(img|figure|iframe|video)\b/i.test(segment.raw) || usedReplace.has(position)) continue
            usedReplace.add(position)
        }
        const sources = (Array.isArray(change.itemIds) ? change.itemIds : [])
            .map((id) => itemsById.get(String(id)))
            .filter((missing): missing is MissingItem => Boolean(missing))
        if (sources.length === 0) continue
        const html = sanitizeSectionHtml(change.html ?? "")
        if (htmlToText(html).text.length < 40) continue
        edits.push({ position, operation, html })
        changes.push({
            position,
            operation,
            html,
            reason: (change.reason ?? "").trim(),
            replaced: operation === "replace" ? segment.raw : null,
            sources: sources.map((missing) => ({ url: missing.sourceUrl, quote: missing.sourceQuote, item: missing.item })),
        })
    }

    if (changes.length === 0) {
        throw new Error("The writer proposed no change backed by a cited source, so no refresh was produced.")
    }

    const updatedContent = applySegmentEdits(item.rawContent, edits)
    return {
        wordpressType: input.wordpressType,
        wordpressId: input.wordpressId,
        link: item.link,
        title: item.title,
        modifiedGmt: item.modifiedGmt,
        fetchedAt: new Date().toISOString(),
        sourceHash: createHash("sha256").update(item.rawContent).digest("hex"),
        originalContent: item.rawContent,
        updatedContent,
        changes: changes.sort((a, b) => a.position - b.position),
    }
}
