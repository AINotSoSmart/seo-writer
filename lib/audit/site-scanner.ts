import Sitemapper from "sitemapper"
import { extractTitleFromUrl } from "@/lib/internal-linking"
import { PageInfo } from "./types"

// ============================================================
// Site Scanner — sitemap discovery and page-metadata utilities.
//
// The blueprint-mapping functions that used to live here (scanSite,
// mapCoverageWithEmbeddings, generateBlueprintEmbeddings) are gone: they
// scored sites against an LLM-invented topic list and matched on page titles
// alone. Coverage now lives in lib/harvest/coverage.ts, which matches against
// the harvested query pool using full page documents.
// ============================================================

/**
 * Fetches all URLs from a site's sitemap.
 * Tries multiple sitemap paths including robots.txt discovery.
 * Unlike the plan generator's version, this does NOT filter to blog-only URLs.
 */
export async function fetchAllSitemapUrls(websiteUrl: string): Promise<string[]> {
    const baseUrl = websiteUrl.replace(/\/$/, '')
    const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']

    // Check robots.txt for sitemap location
    try {
        const robotsRes = await fetch(`${baseUrl}/robots.txt`, {
            signal: AbortSignal.timeout(8000)
        })
        if (robotsRes.ok) {
            const robotsTxt = await robotsRes.text()
            const sitemapMatch = robotsTxt.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i)
            if (sitemapMatch?.[1]) {
                const foundUrl = sitemapMatch[1].trim()
                try {
                    const parsed = new URL(foundUrl)
                    if (!sitemapPaths.includes(parsed.pathname) && !sitemapPaths.includes(foundUrl)) {
                        sitemapPaths.unshift(foundUrl)
                    }
                } catch { /* invalid URL, skip */ }
            }
        }
    } catch { /* robots.txt failed, continue */ }

    // Try each sitemap path
    for (const pathOrUrl of sitemapPaths) {
        const currentUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `${baseUrl}${pathOrUrl}`

        try {
            const sitemapper = new Sitemapper({
                url: currentUrl,
                timeout: 10000,
            })

            // Add a hard timeout wrapper because Sitemapper's internal recursion
            // ignores the timeout parameter for massive sitemap indexes
            const sitemapFetchPromise = sitemapper.fetch()
            const hardTimeoutPromise = new Promise<{ sites: string[] }>((_, reject) => {
                setTimeout(() => reject(new Error("Sitemapper hard timeout exceeded (15s)")), 15000)
            })

            const { sites } = await Promise.race([
                sitemapFetchPromise,
                hardTimeoutPromise
            ])

            if (sites && sites.length > 0) {
                const urls = Array.from(new Set(sites as string[]))
                console.log(`[Site Scanner] Found ${urls.length} URLs at ${currentUrl}`)
                return urls
            }
        } catch (e: any) {
            console.warn(`[Site Scanner] Failed ${currentUrl}: ${e.message}`)
        }
    }

    console.warn(`[Site Scanner] No sitemap found for ${baseUrl}`)
    return []
}

/**
 * Extracts the real page title from a URL by fetching the HTML head.
 * 
 * Fallback chain:
 * 1. <title> tag
 * 2. <meta property="og:title"> 
 * 3. <meta name="title">
 * 4. <h1> tag (first one)
 * 5. URL slug (extractTitleFromUrl — last resort)
 */
export async function extractPageTitle(url: string): Promise<PageInfo> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FlipAEO Bot/1.0)',
                'Accept': 'text/html',
            },
            redirect: 'follow'
        })

        clearTimeout(timeout)

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
        }

        // Only read first 16KB to get the head — no need to download entire page
        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

        let html = ""
        const decoder = new TextDecoder()
        let bytesRead = 0
        const MAX_BYTES = 16384 // 16KB is enough for <head>

        while (bytesRead < MAX_BYTES) {
            const { done, value } = await reader.read()
            if (done) break
            html += decoder.decode(value, { stream: true })
            bytesRead += value.length

            // If we've found </head> we can stop early
            if (html.includes('</head>') || html.includes('</HEAD>')) break
        }
        reader.cancel()

        // 1. <title> tag
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        if (titleMatch?.[1]?.trim()) {
            let title = titleMatch[1].trim()
            // Clean up common patterns: "Page Title | Brand Name" → "Page Title"
            title = cleanPageTitle(title)
            if (title.length > 3) {
                return { url, title, source: "html_title" }
            }
        }

        // 2. <meta property="og:title">
        const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i)
            || html.match(/<meta[^>]*content=["'](.*?)["'][^>]*property=["']og:title["']/i)
        if (ogMatch?.[1]?.trim()) {
            const title = cleanPageTitle(ogMatch[1].trim())
            if (title.length > 3) {
                return { url, title, source: "og_title" }
            }
        }

        // 3. <meta name="title">
        const metaMatch = html.match(/<meta[^>]*name=["']title["'][^>]*content=["'](.*?)["']/i)
            || html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']title["']/i)
        if (metaMatch?.[1]?.trim()) {
            const title = cleanPageTitle(metaMatch[1].trim())
            if (title.length > 3) {
                return { url, title, source: "meta_title" }
            }
        }

        // 4. <h1> tag (first one)
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
        if (h1Match?.[1]?.trim()) {
            // Strip any inner HTML tags first
            let rawH1 = h1Match[1].replace(/<[^>]+>/g, '').trim()
            // Then clean/sanitize (removes null bytes, decodes entities)
            const title = cleanPageTitle(rawH1)

            if (title.length > 3) {
                return { url, title, source: "h1" }
            }
        }

    } catch (e: any) {
        // Fetch failed (timeout, 403, network error) — fall through to URL slug
    }

    // 5. URL slug fallback
    return {
        url,
        title: extractTitleFromUrl(url),
        source: "url_slug"
    }
}

/**
 * Cleans a page title by removing common suffixes like "| Brand Name", "- Company"
 * AND sanitizes control characters (null bytes) that crash Postgres.
 */
export function cleanPageTitle(title: string): string {
    // 1. Remove control characters (null bytes, etc) - CRITICAL for Postgres
    // eslint-disable-next-line no-control-regex
    title = title.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")

    // 2. Decode HTML entities
    title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')

    // 3. Remove trailing " | Brand", " - Brand", " — Brand" patterns
    // Only remove if there's meaningful content before the separator
    const separators = [' | ', ' - ', ' — ', ' – ', ' : ']
    for (const sep of separators) {
        const idx = title.lastIndexOf(sep)
        if (idx > 10) { // Keep at least 10 chars of the title
            title = title.substring(0, idx).trim()
        }
    }

    return title.trim()
}

/**
 * Batch-extracts page titles with concurrency control.
 * Returns PageInfo[] for all URLs.
 */
export async function batchExtractTitles(
    urls: string[],
    concurrency: number = 10
): Promise<PageInfo[]> {
    const results: PageInfo[] = []

    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency)
        const batchResults = await Promise.allSettled(
            batch.map(url => extractPageTitle(url))
        )

        for (const result of batchResults) {
            if (result.status === "fulfilled") {
                results.push(result.value)
            }
        }
    }

    console.log(`[Site Scanner] Extracted ${results.length} titles from ${urls.length} URLs`)
    const sourceBreakdown = {
        html_title: results.filter(r => r.source === "html_title").length,
        og_title: results.filter(r => r.source === "og_title").length,
        meta_title: results.filter(r => r.source === "meta_title").length,
        h1: results.filter(r => r.source === "h1").length,
        url_slug: results.filter(r => r.source === "url_slug").length,
    }
    console.log(`[Site Scanner] Title sources:`, sourceBreakdown)

    return results
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dotProduct = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Filters a sitemap's URLs down to plausible content pages.
 *
 * Extracted from the deleted `scanSite()` so the harvest coverage scanner
 * reuses the same rules instead of scanning assets, admin paths, and taxonomy
 * archives.
 */
export function filterContentUrls(urls: string[]): string[] {
    return urls.filter(url => {
        const lower = url.toLowerCase()
        return !lower.match(/\.(jpg|jpeg|png|gif|svg|pdf|css|js|woff|woff2|ttf|ico|xml|json)$/)
            && !lower.includes('/wp-admin/')
            && !lower.includes('/wp-content/uploads/')
            && !lower.includes('/cdn-cgi/')
            && !lower.includes('/tag/')
            && !lower.includes('/category/')
            && !lower.includes('/author/')
            && !lower.includes('/page/')
    })
}

/** Titles too generic to carry any topical signal */
const GENERIC_TITLES = new Set([
    'home', 'about', 'contact', 'privacy policy', 'terms of service',
    'login', 'sign up', 'register', 'careers', 'jobs', 'team', 'sitemap'
])

/**
 * True when a page title carries enough signal to be worth matching against.
 */
export function hasMeaningfulTitle(title: string): boolean {
    return title.length > 5 && !GENERIC_TITLES.has(title.toLowerCase())
}
