import { createHash } from "node:crypto"
import * as cheerio from "cheerio"

export interface ContentSection {
    id: string
    heading: string
    level: number // 0 = intro/preamble, 1 = H1, 2 = H2, 3 = H3, 4 = H4
    text: string
    rawHtml: string
    sourceRef?: string
}

export interface ContentDocument {
    url: string
    title: string
    sourceType: "wordpress" | "html" | "manual"
    sourceHash: string
    rawContent: string
    sections: ContentSection[]
    metadata?: Record<string, unknown>
}

/**
 * Slugifies text into a deterministic, URL-friendly section anchor ID.
 */
export function slugifySectionId(text: string, index: number): string {
    const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48)
    return slug || `sec-${index}`
}

/**
 * Normalizes an arbitrary HTML page or article body into a structured ContentDocument.
 * Strips non-content chrome (nav, footer, sidebars, cookie banners, scripts)
 * and groups body elements by heading boundaries.
 */
export function parseHtmlToContentDocument(
    url: string,
    rawHtml: string,
    sourceType: "wordpress" | "html" | "manual" = "html",
    metadata?: Record<string, unknown>,
): ContentDocument {
    const sourceHash = createHash("sha256").update(rawHtml || "").digest("hex")
    const $ = cheerio.load(rawHtml || "")

    // 1. Strip non-content chrome and repetitive layout elements
    $(
        "script, style, noscript, nav, footer, header.site-header, header[role='banner'], " +
        "aside, .sidebar, .site-sidebar, .widget-area, .comments, #comments, " +
        ".cookie-banner, [id*='cookie'], [class*='cookie'], .ad, .ads, .advertisement, " +
        "[role='navigation'], [role='complementary']"
    ).remove()

    // 2. Determine title
    let title = $("h1").first().text().trim()
    if (!title) {
        title = $("meta[property='og:title']").attr("content") || ""
    }
    if (!title) {
        title = $("title").first().text().trim()
    }
    title = title.replace(/\s+/g, " ").trim() || "Untitled Document"

    // 3. Locate the primary article container
    let $container = $("article").first()
    if ($container.length === 0) $container = $("main").first()
    if ($container.length === 0) $container = $(".entry-content").first()
    if ($container.length === 0) $container = $(".post-content").first()
    if ($container.length === 0) $container = $(".content-area").first()
    if ($container.length === 0) $container = $("body")

    const sections: ContentSection[] = []
    const seenIds = new Set<string>()

    let currentSection: ContentSection = {
        id: "intro",
        heading: "Introduction",
        level: 0,
        text: "",
        rawHtml: "",
    }

    const headingTags = new Set(["h1", "h2", "h3", "h4"])

    // Walk all descendant or direct elements inside container
    $container.find("h1, h2, h3, h4, p, ul, ol, table, blockquote, pre").each((index, el) => {
        const $el = $(el)
        const tagName = String($el.prop("tagName") || "").toLowerCase()

        if (headingTags.has(tagName)) {
            // If the current section has collected content or a real heading, push it
            if (currentSection.text.trim() || currentSection.level > 0) {
                sections.push({ ...currentSection, text: currentSection.text.trim(), rawHtml: currentSection.rawHtml.trim() })
            }

            const headingText = $el.text().replace(/\s+/g, " ").trim()
            let sectionId = slugifySectionId(headingText, index)
            if (seenIds.has(sectionId)) {
                sectionId = `${sectionId}-${index}`
            }
            seenIds.add(sectionId)

            const level = Number.parseInt(tagName.charAt(1), 10) || 2
            currentSection = {
                id: sectionId,
                heading: headingText,
                level,
                text: "",
                rawHtml: $.html(el),
            }
        } else {
            // Append paragraph, list, table, etc. to active section
            const elText = $el.text().replace(/\s+/g, " ").trim()
            if (elText) {
                currentSection.text += (currentSection.text ? "\n\n" : "") + elText
            }
            currentSection.rawHtml += (currentSection.rawHtml ? "\n" : "") + $.html(el)
        }
    })

    if (currentSection.text.trim() || currentSection.level > 0) {
        sections.push({ ...currentSection, text: currentSection.text.trim(), rawHtml: currentSection.rawHtml.trim() })
    }

    return {
        url,
        title,
        sourceType,
        sourceHash,
        rawContent: rawHtml,
        sections,
        metadata,
    }
}

/**
 * Recombines sections back into a complete HTML document body.
 */
export function serializeContentDocumentToHtml(doc: ContentDocument): string {
    return doc.sections.map((sec) => sec.rawHtml).filter(Boolean).join("\n\n")
}
