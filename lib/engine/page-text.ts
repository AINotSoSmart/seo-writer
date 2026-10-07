import "server-only"

import * as cheerio from "cheerio"
import { tavily } from "@tavily/core"

/** Longest page text kept per page. Enough for any article; bounds the prompts. */
export const MAX_PAGE_TEXT_CHARS = 40_000

export function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim()
}

/**
 * Readable text of an HTML page or a WordPress post body. Navigation, footer,
 * sidebars and scripts are removed for full pages; a post body has none, so it
 * passes through unchanged apart from tags.
 */
export function htmlToText(html: string): { title: string; text: string } {
    const $ = cheerio.load(html || "")
    $("script, style, noscript, svg, nav, footer, header, aside, form, iframe, [role='navigation'], [role='contentinfo'], [aria-hidden='true']").remove()
    const title = normalizeWhitespace($("h1").first().text() || $("title").first().text() || "")
    const root = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $.root()
    // Keep block boundaries as line breaks so quotes do not run across headings.
    root.find("h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre, div").each((_, el) => {
        $(el).append("\n")
    })
    const text = root
        .text()
        .split("\n")
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean)
        .join("\n")
        .slice(0, MAX_PAGE_TEXT_CHARS)
    return { title, text }
}

/** Plain fetch of a public page. Free; null when blocked or empty. */
export async function fetchPageText(url: string): Promise<{ title: string; text: string } | null> {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; FlipAEO-Engine/1.0)",
                Accept: "text/html,application/xhtml+xml",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(15_000),
        })
        if (!response.ok) return null
        const contentType = response.headers.get("content-type") || ""
        if (!contentType.includes("html")) return null
        const html = (await response.text()).slice(0, 2_000_000)
        const parsed = htmlToText(html)
        return parsed.text.length >= 200 ? parsed : null
    } catch {
        return null
    }
}

/**
 * Tavily extract for pages a plain fetch cannot read (client-rendered pages,
 * bot protection). Costs Tavily credits, so it is the fallback, not the default.
 */
export async function tavilyExtractTexts(urls: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey || urls.length === 0) return out
    const client = tavily({ apiKey })
    for (let i = 0; i < urls.length; i += 20) {
        try {
            const response = (await client.extract(urls.slice(i, i + 20), {
                extractDepth: "basic",
                format: "markdown",
            })) as { results?: Array<{ url?: string; rawContent?: string }> }
            for (const result of response.results ?? []) {
                if (result.url && result.rawContent) {
                    out.set(result.url, result.rawContent.slice(0, MAX_PAGE_TEXT_CHARS))
                }
            }
        } catch (error) {
            console.warn("[engine] Tavily extract failed:", error instanceof Error ? error.message : error)
        }
    }
    return out
}

/** Free fetch first, Tavily for whatever that could not read. */
export async function readPages(
    urls: string[],
    concurrency = 6,
): Promise<Map<string, { title: string; text: string; via: "html" | "tavily" }>> {
    const out = new Map<string, { title: string; text: string; via: "html" | "tavily" }>()
    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency)
        const settled = await Promise.all(batch.map((url) => fetchPageText(url)))
        batch.forEach((url, index) => {
            const page = settled[index]
            if (page) out.set(url, { ...page, via: "html" })
        })
    }
    const missing = urls.filter((url) => !out.has(url))
    const extracted = await tavilyExtractTexts(missing)
    for (const [url, text] of extracted) {
        if (text.length >= 200) out.set(url, { title: "", text, via: "tavily" })
    }
    return out
}
