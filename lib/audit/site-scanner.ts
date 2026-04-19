import Sitemapper from "sitemapper"
import { generateEmbedding } from "@/lib/gemini-embedding"
import { extractTitleFromUrl } from "@/lib/internal-linking"
import { NicheBlueprint, SiteCoverage, PillarCoverage, CoveredTopic, PageInfo, TopicEmbedding } from "./types"

// ============================================================
// Site Scanner — Crawls a website and maps coverage to blueprint
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
function cleanPageTitle(title: string): string {
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
 * Generates embeddings for all blueprint topics.
 * These are cached and reused across user site + competitor scans.
 */
export async function generateBlueprintEmbeddings(
    blueprint: NicheBlueprint
): Promise<TopicEmbedding[]> {
    const topicEmbeddings: TopicEmbedding[] = []

    // Flatten all topics from all pillars
    const allTopics: { question: string; pillar_name: string; importance: "critical" | "important" | "supporting" }[] = []

    for (const pillar of blueprint.pillars) {
        for (const topic of pillar.required_topics) {
            allTopics.push({
                question: topic.question,
                pillar_name: pillar.name,
                importance: topic.importance
            })
        }
    }

    // Generate embeddings in batches of 5 (rate limit friendly)
    const BATCH_SIZE = 5
    for (let i = 0; i < allTopics.length; i += BATCH_SIZE) {
        const batch = allTopics.slice(i, i + BATCH_SIZE)
        const embeddings = await Promise.allSettled(
            batch.map(t => generateEmbedding(t.question))
        )

        for (let j = 0; j < batch.length; j++) {
            const embResult = embeddings[j]
            if (embResult.status === "fulfilled") {
                topicEmbeddings.push({
                    question: batch[j].question,
                    pillar_name: batch[j].pillar_name,
                    importance: batch[j].importance,
                    embedding: embResult.value
                })
            } else {
                console.warn(`[Site Scanner] Failed to embed topic: "${batch[j].question}"`)
            }
        }
    }

    console.log(`[Site Scanner] Generated ${topicEmbeddings.length}/${allTopics.length} blueprint embeddings`)
    return topicEmbeddings
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
 * Maps a site's pages to the niche blueprint using embedding similarity.
 * 
 * Thresholds:
 * - >= 0.78: strong coverage
 * - 0.60-0.78: partial coverage  
 * - < 0.60: not covered
 */
export async function mapCoverageWithEmbeddings(
    pages: PageInfo[],
    blueprintEmbeddings: TopicEmbedding[],
    siteUrl: string,
    siteName: string,
    blueprint: NicheBlueprint
): Promise<SiteCoverage> {
    // Generate embeddings for page titles
    const pageEmbeddings: { page: PageInfo; embedding: number[] }[] = []

    const BATCH_SIZE = 5
    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
        const batch = pages.slice(i, i + BATCH_SIZE)
        const embeddings = await Promise.allSettled(
            batch.map(p => generateEmbedding(p.title))
        )

        for (let j = 0; j < batch.length; j++) {
            const embResult = embeddings[j]
            if (embResult.status === "fulfilled") {
                pageEmbeddings.push({
                    page: batch[j],
                    embedding: embResult.value
                })
            }
        }
    }

    console.log(`[Site Scanner] Generated ${pageEmbeddings.length} page embeddings for ${siteName}`)

    // Build coverage map: for each blueprint topic, find the best-matching page
    const pillarCoverageMap = new Map<string, { covered: CoveredTopic[], missing: typeof blueprint.pillars[0]["required_topics"] }>()

    // Initialize for each pillar
    for (const pillar of blueprint.pillars) {
        pillarCoverageMap.set(pillar.name, { covered: [], missing: [] })
    }

    for (const topicEmb of blueprintEmbeddings) {
        let bestMatch: { page: PageInfo; similarity: number } | null = null

        for (const pageEmb of pageEmbeddings) {
            const sim = cosineSimilarity(topicEmb.embedding, pageEmb.embedding)
            if (!bestMatch || sim > bestMatch.similarity) {
                bestMatch = { page: pageEmb.page, similarity: sim }
            }
        }

        const pillarData = pillarCoverageMap.get(topicEmb.pillar_name)
        if (!pillarData) continue

        // Tightened thresholds: 0.82+ strong, 0.72+ partial
        if (bestMatch && bestMatch.similarity >= 0.72) {
            const quality = bestMatch.similarity >= 0.82 ? "strong" as const
                : "partial" as const
            pillarData.covered.push({
                topic_question: topicEmb.question,
                covered_by_url: bestMatch.page.url,
                covered_by_title: bestMatch.page.title,
                coverage_quality: quality,
                similarity_score: Math.round(bestMatch.similarity * 100) / 100
            })
            // Debug: log exactly what matched
            console.log(`[Coverage] ✓ ${quality.toUpperCase()} (${(bestMatch.similarity * 100).toFixed(1)}%) "${topicEmb.question}" → "${bestMatch.page.title}"`)
        } else {
            // Not covered — add to missing
            pillarData.missing.push({
                question: topicEmb.question,
                intent: "informational",
                importance: topicEmb.importance
            })
            // Debug: log what failed to match and why
            if (bestMatch) {
                console.log(`[Coverage] ✗ MISS (${(bestMatch.similarity * 100).toFixed(1)}%) "${topicEmb.question}" — best: "${bestMatch.page.title}"`)
            } else {
                console.log(`[Coverage] ✗ MISS (no pages) "${topicEmb.question}"`)
            }
        }
    }

    // Build pillar coverage scores
    const pillarCoverages: PillarCoverage[] = blueprint.pillars.map(pillar => {
        const data = pillarCoverageMap.get(pillar.name)!
        const totalTopics = pillar.required_topics.length
        if (totalTopics === 0) {
            return {
                pillar_name: pillar.name,
                pillar_weight: pillar.weight,
                covered_topics: [],
                missing_topics: [],
                score: 0
            }
        }

        // Weighted score: strong = 1.0, partial = 0.5
        const strongCount = data.covered.filter(c => c.coverage_quality === "strong").length
        const partialCount = data.covered.filter(c => c.coverage_quality === "partial").length
        const effectiveCoverage = strongCount + (partialCount * 0.5)
        const score = Math.round((effectiveCoverage / totalTopics) * 100)

        // Debug: log pillar breakdown
        console.log(`[Coverage] Pillar "${pillar.name}": ${strongCount} strong + ${partialCount} partial / ${totalTopics} topics = ${Math.min(100, score)}/100 (weight: ${pillar.weight})`)

        return {
            pillar_name: pillar.name,
            pillar_weight: pillar.weight,
            covered_topics: data.covered,
            missing_topics: data.missing,
            score: Math.min(100, score)
        }
    })

    // Calculate weighted overall score
    const totalWeight = pillarCoverages.reduce((sum, p) => sum + p.pillar_weight, 0)
    const weightedScore = totalWeight > 0
        ? pillarCoverages.reduce((sum, p) => sum + (p.score * p.pillar_weight), 0) / totalWeight
        : 0
    const overallScore = Math.round(weightedScore)

    console.log(`[Coverage] Overall score for ${siteName}: ${overallScore}/100 (${pillarCoverages.length} pillars, totalWeight: ${totalWeight})`)

    return {
        site_url: siteUrl,
        site_name: siteName,
        pages_analyzed: pages.length,
        pillar_coverage: pillarCoverages,
        overall_score: overallScore
    }
}

/**
 * Full site scan: fetch sitemap → extract titles → map to blueprint.
 * 
 * Requires pre-generated blueprint embeddings (from generateBlueprintEmbeddings).
 */
export async function scanSite(
    websiteUrl: string,
    siteName: string,
    blueprintEmbeddings: TopicEmbedding[],
    blueprint: NicheBlueprint
): Promise<SiteCoverage> {
    // 1. Fetch sitemap URLs
    const urls = await fetchAllSitemapUrls(websiteUrl)

    if (urls.length === 0) {
        console.warn(`[Site Scanner] No URLs found for ${websiteUrl}, returning empty coverage`)
        return {
            site_url: websiteUrl,
            site_name: siteName,
            pages_analyzed: 0,
            pillar_coverage: blueprint.pillars.map(p => ({
                pillar_name: p.name,
                pillar_weight: p.weight,
                covered_topics: [],
                missing_topics: p.required_topics,
                score: 0
            })),
            overall_score: 0
        }
    }

    // Filter out obvious non-content pages (assets, images, etc.)
    const contentUrls = urls.filter(url => {
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

    // Cap at 200 pages to keep costs/time reasonable
    const pagesToScan = contentUrls.slice(0, 200)
    console.log(`[Site Scanner] Scanning ${pagesToScan.length} content pages (filtered from ${urls.length} total) for ${siteName}`)

    // 2. Extract titles
    const pages = await batchExtractTitles(pagesToScan)

    // Filter out pages with very generic titles (like "Home", "About", "Contact")
    const meaningfulPages = pages.filter(p =>
        p.title.length > 5
        && !['home', 'about', 'contact', 'privacy policy', 'terms of service', 'login', 'sign up', 'register', 'careers', 'jobs', 'team', 'sitemap']
            .includes(p.title.toLowerCase())
    )

    // 3. Map to blueprint using embeddings
    return mapCoverageWithEmbeddings(
        meaningfulPages,
        blueprintEmbeddings,
        websiteUrl,
        siteName,
        blueprint
    )
}
