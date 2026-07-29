/**
 * Page document extraction.
 *
 * The old scanner embedded a page's `<title>` and nothing else, which meant a
 * 3,000-word article covering eight subtopics was represented by ~60 characters.
 * That is the single biggest reason coverage detection was unreliable.
 *
 * This reads enough of the body to capture the section structure, and builds a
 * composite document string that actually describes what the page covers.
 */

import { cleanPageTitle } from "@/lib/audit/site-scanner"
import { extractTitleFromUrl } from "@/lib/internal-linking"

export interface PageDocument {
    url: string
    title: string
    description: string
    h1: string
    h2s: string[]
    /** Composite string that gets embedded */
    documentText: string
    /**
     * Lowercased visible body copy, for lexical evidence checks.
     *
     * Semantic similarity alone cannot tell whether a page addresses a query's
     * specific intent — a restoration page scores high against "animate old
     * photos with ai" whether or not it says anything about animation. The
     * coverage stage searches this text for the query's defining terms.
     */
    bodyText: string
    /** Where the title came from — useful for diagnosing bad scans */
    titleSource: "html_title" | "og_title" | "h1" | "url_slug"
}

/**
 * Read budget per page.
 *
 * 120KB was too small: pixreunion.com ships ~750KB of HTML (mostly inline
 * framework payload), so the fetch was cut off before `</main>`, the content
 * region never matched, and body copy containing the query's defining terms was
 * simply absent. That produced a false "gap" for a query the page does answer.
 */
const MAX_BYTES = 400_000
const MAX_H2S = 8
const FETCH_TIMEOUT_MS = 8000

/**
 * Interface-control words that accordions, tabs and disclosure widgets inject
 * into heading text. "Will the AI keep our faces accurate... expand collapse"
 * reached a content plan as a keyword on the 2026-07-29 run.
 */
const UI_ARTIFACT_PATTERN =
    /\b(expand|collapse|show more|show less|read more|toggle|open|close|previous|next|play|pause|menu|skip to content)\b/gi

/** Strips tags, UI control words, and normalizes whitespace */
function stripTags(html: string): string {
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * Removes trailing/leading interface-control words left behind by widget markup.
 * Only applied at the edges of a heading, so a genuine phrase like "how to
 * collapse layers" survives.
 */
export function stripUiArtifacts(text: string): string {
    let out = text
    // Repeatedly trim control words from either end
    for (let i = 0; i < 4; i++) {
        const before = out
        out = out
            .replace(new RegExp(`^(?:${UI_ARTIFACT_PATTERN.source})[\\s:·|-]*`, "i"), "")
            .replace(new RegExp(`[\\s:·|-]*(?:${UI_ARTIFACT_PATTERN.source})$`, "i"), "")
            .replace(/[\s.…]+$/, "")
            .trim()
        if (out === before) break
    }
    return out
}

/**
 * Extracts visible body copy for lexical evidence checks.
 *
 * Site chrome is removed first, and this matters more than it sounds. On an
 * 11-page site whose navigation lists every product, every tool name appears on
 * every page — so document frequency reads 100% for all of them, every term is
 * classed as background vocabulary, and the evidence check ends up with nothing
 * to verify. Stripping nav/header/footer/aside restores the signal that makes a
 * term discriminative.
 *
 * When a <main> or <article> element exists it is preferred outright, since that
 * is the author telling us where the content is.
 */
function extractBodyText(html: string): string {
    let working = html
        .replace(/<(script|style|noscript|svg|head|template)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")

    // Prefer an explicit content region if the page declares one
    const main =
        working.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
        working.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
        // Closing tag may be past the read budget on very large pages — take
        // everything after the opening tag rather than discarding the region.
        working.match(/<main[^>]*>([\s\S]*)$/i) ||
        working.match(/<article[^>]*>([\s\S]*)$/i)

    if (main?.[1] && main[1].length > 500) {
        working = main[1]
    } else {
        // Otherwise drop the regions that repeat across every page
        working = working.replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
        // Common class/id conventions for the same regions
        working = working.replace(
            /<(div|section|ul)[^>]*(?:class|id)=["'][^"']*(?:navbar|nav-|menu|sidebar|site-header|site-footer|footer)[^"']*["'][\s\S]{0,4000}?<\/\1>/gi,
            " "
        )
    }

    return working
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim()
        .slice(0, 12000)
}

function matchFirst(html: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
        const m = html.match(pattern)
        if (m?.[1]?.trim()) return m[1].trim()
    }
    return null
}

/**
 * Fetches a page and extracts its structural signals.
 * Always resolves — a failed fetch degrades to the URL slug rather than throwing,
 * because one dead page must not abort a site scan.
 */
export async function extractPageDocument(url: string): Promise<PageDocument> {
    let html = ""

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; FlipAEO Bot/1.0)",
                Accept: "text/html",
            },
            redirect: "follow",
        })
        clearTimeout(timeout)

        if (res.ok && res.body) {
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let bytesRead = 0

            while (bytesRead < MAX_BYTES) {
                const { done, value } = await reader.read()
                if (done) break
                html += decoder.decode(value, { stream: true })
                bytesRead += value.length
            }
            reader.cancel()
        }
    } catch {
        // Fall through to slug-only document
    }

    if (!html) {
        const fallbackTitle = extractTitleFromUrl(url)
        return {
            url,
            title: fallbackTitle,
            description: "",
            h1: "",
            h2s: [],
            documentText: fallbackTitle,
            bodyText: "",
            titleSource: "url_slug",
        }
    }

    // --- Title, with the same fallback chain as the original scanner ---
    let titleSource: PageDocument["titleSource"] = "html_title"

    let rawTitle = matchFirst(html, [/<title[^>]*>([\s\S]*?)<\/title>/i])

    if (!rawTitle) {
        rawTitle = matchFirst(html, [
            /<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i,
            /<meta[^>]*content=["'](.*?)["'][^>]*property=["']og:title["']/i,
        ])
        if (rawTitle) titleSource = "og_title"
    }

    const h1Raw = matchFirst(html, [/<h1[^>]*>([\s\S]*?)<\/h1>/i])
    const h1 = h1Raw ? cleanPageTitle(stripTags(h1Raw)) : ""

    if (!rawTitle && h1) {
        rawTitle = h1
        titleSource = "h1"
    }

    let title = rawTitle ? cleanPageTitle(stripTags(rawTitle)) : ""
    if (title.length <= 3) {
        title = extractTitleFromUrl(url)
        titleSource = "url_slug"
    }

    // --- Meta description ---
    const descRaw = matchFirst(html, [
        /<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i,
        /<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i,
        /<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i,
    ])
    const description = descRaw ? cleanPageTitle(stripTags(descRaw)) : ""

    // --- Section headings: the signal that was missing entirely ---
    const h2s: string[] = []
    const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
    let h2Match: RegExpExecArray | null

    while ((h2Match = h2Pattern.exec(html)) !== null && h2s.length < MAX_H2S) {
        const heading = stripUiArtifacts(stripTags(h2Match[1]))
        // Skip nav/footer boilerplate that tends to sit in h2s
        if (heading.length < 4 || heading.length > 140) continue
        h2s.push(heading)
    }

    const documentText = [title, description, h1 !== title ? h1 : "", ...h2s]
        .filter(Boolean)
        .join(". ")
        .slice(0, 2000)

    return {
        url,
        title,
        description,
        h1,
        h2s,
        documentText,
        bodyText: extractBodyText(html),
        titleSource,
    }
}

/**
 * Extracts documents for many URLs with bounded concurrency.
 * Failures are dropped rather than propagated.
 */
export async function batchExtractDocuments(
    urls: string[],
    concurrency: number = 8
): Promise<PageDocument[]> {
    const results: PageDocument[] = []

    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency)
        const settled = await Promise.allSettled(batch.map((u) => extractPageDocument(u)))

        for (const result of settled) {
            if (result.status === "fulfilled") results.push(result.value)
        }
    }

    const slugOnly = results.filter((r) => r.titleSource === "url_slug").length
    const withH2s = results.filter((r) => r.h2s.length > 0).length

    console.log(
        `[PageDocument] Extracted ${results.length}/${urls.length} pages ` +
        `(${withH2s} with H2 structure, ${slugOnly} slug-only fallbacks)`
    )

    return results
}
