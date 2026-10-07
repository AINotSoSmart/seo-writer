/**
 * Byte-preserving editing of a WordPress post body. Pure.
 *
 * The previous refresh path parsed the page into a reduced copy (headings,
 * paragraphs, lists) and re-serialised the whole thing, silently dropping
 * images, embeds, buttons, shortcodes and every block comment. Here the body is
 * cut into top-level segments whose concatenation is the original text exactly;
 * an edit replaces or inserts whole segments and leaves every other byte alone.
 */

export interface Segment {
    /** `block`: a top-level Gutenberg block. `html`: a classic-editor chunk. `space`: whitespace between them. */
    kind: "block" | "html" | "space"
    raw: string
    /** Gutenberg block name, e.g. `core/paragraph`. */
    name?: string
}

const BLOCK_COMMENT = /<!--\s+(\/)?wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)(\s+\{[\s\S]*?\})?\s+(\/)?-->/g

export function isBlockContent(raw: string): boolean {
    return /<!--\s+wp:/.test(raw)
}

function pushText(segments: Segment[], text: string): void {
    if (!text) return
    // Leading/trailing whitespace stays its own segment so content segments
    // can be shown and replaced without their surrounding blank lines.
    const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!
    if (match[1]) segments.push({ kind: "space", raw: match[1] })
    if (match[2]) segments.push({ kind: "html", raw: match[2] })
    if (match[3]) segments.push({ kind: "space", raw: match[3] })
}

export function splitSegments(raw: string): Segment[] {
    const segments: Segment[] = []
    if (!isBlockContent(raw)) {
        // Classic editor: paragraphs are separated by blank lines (wpautop).
        const parts = raw.split(/(\n[ \t]*\n\s*)/)
        for (const part of parts) {
            if (!part) continue
            if (/^\s+$/.test(part)) segments.push({ kind: "space", raw: part })
            else pushText(segments, part)
        }
        return segments
    }

    let depth = 0
    let cursor = 0
    let blockStart = -1
    let blockName = ""
    BLOCK_COMMENT.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = BLOCK_COMMENT.exec(raw)) !== null) {
        const closing = Boolean(match[1])
        const selfClosing = Boolean(match[4])
        const start = match.index
        const end = start + match[0].length
        if (depth === 0 && !closing) {
            pushText(segments, raw.slice(cursor, start))
            if (selfClosing) {
                segments.push({ kind: "block", raw: raw.slice(start, end), name: match[2] })
                cursor = end
                continue
            }
            blockStart = start
            blockName = match[2]
            depth = 1
            continue
        }
        if (selfClosing) continue
        if (closing) {
            depth--
            if (depth === 0) {
                segments.push({ kind: "block", raw: raw.slice(blockStart, end), name: blockName })
                cursor = end
            }
        } else {
            depth++
        }
    }
    if (depth > 0) {
        // Unbalanced markup: keep the rest verbatim as one segment.
        segments.push({ kind: "html", raw: raw.slice(blockStart) })
        return segments
    }
    pushText(segments, raw.slice(cursor))
    return segments
}

export function joinSegments(segments: Segment[]): string {
    return segments.map((segment) => segment.raw).join("")
}

/** Indices (into `segments`) of the segments a reader would call content. */
export function contentIndices(segments: Segment[]): number[] {
    return segments
        .map((segment, index) => (segment.kind === "space" ? -1 : index))
        .filter((index) => index >= 0)
}

const ELEMENT = /<(h[2-6]|p|ul|ol|table|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi

function escapeJson(value: number): string {
    return JSON.stringify({ level: value })
}

/** Simple generated HTML → Gutenberg blocks, so a pasted refresh validates in the editor. */
export function htmlToBlocks(html: string): string {
    const blocks: string[] = []
    for (const match of html.matchAll(ELEMENT)) {
        const tag = match[1].toLowerCase()
        const element = match[0]
        if (tag.startsWith("h")) {
            const level = Number(tag.slice(1))
            const inner = element.replace(/^<h[2-6][^>]*>/i, "").replace(/<\/h[2-6]>$/i, "")
            const attributes = level === 2 ? "" : `${escapeJson(level)} `
            blocks.push(
                `<!-- wp:heading ${attributes}-->\n<${tag} class="wp-block-heading">${inner}</${tag}>\n<!-- /wp:heading -->`,
            )
        } else if (tag === "p") {
            blocks.push(`<!-- wp:paragraph -->\n${element}\n<!-- /wp:paragraph -->`)
        } else if (tag === "ul" || tag === "ol") {
            const items = [...element.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)].map(
                (item) => `<!-- wp:list-item -->\n${item[0]}\n<!-- /wp:list-item -->`,
            )
            const open = tag === "ol" ? `<!-- wp:list {"ordered":true} -->\n<ol class="wp-block-list">` : `<!-- wp:list -->\n<ul class="wp-block-list">`
            blocks.push(`${open}${items.join("")}</${tag}>\n<!-- /wp:list -->`)
        } else if (tag === "table") {
            blocks.push(`<!-- wp:table -->\n<figure class="wp-block-table">${element}</figure>\n<!-- /wp:table -->`)
        } else {
            blocks.push(`<!-- wp:html -->\n${element}\n<!-- /wp:html -->`)
        }
    }
    return blocks.join("\n\n")
}

export interface SegmentEdit {
    /** Index into `contentIndices(segments)`, i.e. the number the model was shown. */
    position: number
    operation: "insert_after" | "replace"
    html: string
}

/**
 * Applies edits by replacing or inserting whole segments. Untouched segments
 * are copied as they were. Positions refer to the original document, so edits
 * are applied from the last position backwards.
 */
export function applySegmentEdits(raw: string, edits: SegmentEdit[]): string {
    const segments = splitSegments(raw)
    const indices = contentIndices(segments)
    const blockMode = isBlockContent(raw)
    const ordered = [...edits].sort((a, b) => b.position - a.position)
    for (const edit of ordered) {
        const target = indices[edit.position]
        if (target === undefined) continue
        const content = blockMode ? htmlToBlocks(edit.html) : edit.html.trim()
        if (!content) continue
        const replacement: Segment = { kind: blockMode ? "block" : "html", raw: content }
        if (edit.operation === "replace") {
            segments.splice(target, 1, replacement)
        } else {
            segments.splice(target + 1, 0, { kind: "space", raw: "\n\n" }, replacement)
        }
    }
    return joinSegments(segments)
}
