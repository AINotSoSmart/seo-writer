import { tavily } from "@tavily/core"
import { BrandDetails } from "@/lib/schemas/brand"
import { NicheBlueprint, SiteCoverage, TopicEmbedding } from "./types"
import { fetchAllSitemapUrls, batchExtractTitles, mapCoverageWithEmbeddings } from "./site-scanner"
import { buildTavilySearchOptions, TavilySearchPrefs } from "@/lib/tavily-search"

// ============================================================
// Competitor Scanner — Discovers and scans competitor content
// ============================================================

interface DiscoveredCompetitor {
    name: string
    url: string
    domain: string
}

/**
 * Discovers ACTUAL product competitors via dual Tavily searches + LLM filtering.
 * 
 * Approach:
 * 1. Run 2 separate Tavily queries using `literally` and `category`
 * 2. Deduplicate results by domain
 * 3. Send all found URLs + titles to a cheap LLM to filter out blogs/review sites
 *    and identify actual competitor products/services
 */
export async function discoverCompetitors(
    brandData: BrandDetails,
    maxCompetitors: number = 5,
    searchPrefs?: TavilySearchPrefs
): Promise<DiscoveredCompetitor[]> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
        console.warn("[Competitor Scanner] No Tavily API key, skipping competitor discovery")
        return []
    }

    try {
        const tvly = tavily({ apiKey })
        const brandNameLower = brandData.product_name.toLowerCase()

        // Build search queries from brand keywords (set during brand DNA analysis)
        const queries: string[] = []

        if (brandData.brand_keywords && brandData.brand_keywords.length > 0) {
            // Use brand keywords — each one becomes a targeted search query
            for (const keyword of brandData.brand_keywords.slice(0, 3)) {
                queries.push(`${keyword}`)
            }
        } else if (brandData.category) {
            // Fallback: use category if no keywords (backwards compat)
            queries.push(`${brandData.category}`)
            queries.push(`${brandData.product_name} alternatives`)
        } else {
            queries.push(`${brandData.product_name} competitors alternatives`)
        }

        // Run all queries in parallel, collect all results
        const allResults: Array<{ url: string; title: string; domain: string; snippet: string }> = []
        const seenDomains = new Set<string>()

        // Blocklist: social, review, and aggregator sites
        const BLOCKLIST = new Set([
            'google', 'youtube', 'reddit', 'quora', 'wikipedia', 'medium',
            'twitter', 'linkedin', 'facebook', 'github', 'stackoverflow',
            'g2', 'capterra', 'trustpilot', 'producthunt', 'amazon',
            'ebay', 'pinterest', 'instagram', 'tiktok', 'yelp',
            'crunchbase', 'similarweb', 'alexa', 'archive'
        ])

        for (const query of queries) {
            console.log(`[Competitor Scanner] Tavily query: "${query}"`)
            try {
                const { modifiedQuery, options } = buildTavilySearchOptions(query, searchPrefs, {
                    maxResults: 20,
                    searchDepth: "basic"
                })
                const response = await tvly.search(modifiedQuery, options)

                for (const result of response.results || []) {
                    try {
                        const url = new URL(result.url)
                        const domain = url.hostname.replace('www.', '')
                        const domainBase = domain.split('.')[0].toLowerCase()

                        // Skip self, seen, and blocklisted
                        if (seenDomains.has(domain)) continue
                        if (brandNameLower.includes(domainBase) || domainBase.includes(brandNameLower.replace(/\s+/g, ''))) continue
                        if (BLOCKLIST.has(domainBase) || 
                            domain.endsWith('google.com') || 
                            domain.endsWith('apple.com')) continue

                        seenDomains.add(domain)
                        const snippet = (result.content || '').slice(0, 150).replace(/\n/g, ' ').trim()
                        allResults.push({
                            url: url.origin,
                            title: result.title || domain,
                            domain,
                            snippet
                        })
                    } catch { /* invalid URL */ }
                }
            } catch (e) {
                console.warn(`[Competitor Scanner] Query failed: "${query}"`, e)
            }
        }

        console.log(`[Competitor Scanner] Raw results from Tavily: ${allResults.length} unique domains`)
        console.log(`[Competitor Scanner] Candidates: ${allResults.map(r => r.domain).join(', ')}`)

        if (allResults.length === 0) return []

        // === LLM FILTER: Send all results to Gemini to identify actual competitors ===
        const { getGeminiClient } = await import("@/utils/gemini/geminiClient")
        const client = getGeminiClient()

        const filterPrompt = `You are a strict competitor analyst. Your job is to identify DIRECT product competitors.

## THE BRAND WE ARE ANALYZING
- **Name:** ${brandData.product_name}
- **What it does:** ${brandData.product_identity?.literally || brandData.category || 'Software'}
- **Category:** ${brandData.category || "N/A"}

## WEBSITES FOUND IN SEARCH RESULTS
${allResults.map((r, i) => `${i + 1}. [${r.domain}] "${r.title}" — ${r.url}\n   Description: ${r.snippet || 'No description available'}`).join('\n')}

## STRICT FILTERING RULES

For EACH website above, ask yourself: "What is this company's PRIMARY product?"

A website is a REAL COMPETITOR only if:
1. Their PRIMARY business/product is in the SAME category as ${brandData.product_name}
2. A customer shopping for ${brandData.category || brandData.product_identity?.literally || 'this type of product'} would realistically consider them as an alternative
3. The functionality matching ${brandData.product_name} is their CORE offering, not a side feature

You MUST REJECT:
- **Multi-tool platforms** where ${brandData.category || "this functionality"} is just one of 50+ features (e.g., Picsart, Canva, CapCut — these are generic editors, not dedicated ${brandData.category || "tools"} competitors)
- **Blogs or review sites** that write articles about the category (titles like "Top 10 best..." or "X Guide")
- **AI tool aggregators** that have a page for every AI feature but aren't specialized
- **Sites from unrelated industries** that happen to have one landing page about this topic
- News sites, forums, YouTube, social media

You MUST INCLUDE:
- **Dedicated products** whose primary value proposition directly compete with ${brandData.product_name}
- Products that a customer choosing between ${brandData.product_name} and them would agonize over

## EXAMPLES OF CORRECT REJECTION- for example ai photo restoration tool
- NoteGPT (note-taking tool) having an "/ai-photo-restoration" page → REJECT (not their primary product)
- Airbrush (generic image editor) having a "/photo-restoration" page → REJECT (restoration is a side feature)
- Picsart (social photo editing platform) → REJECT (too broad, not a dedicated competitor)

## OUTPUT
Return the brand name, URL, and a 1-sentence justification for each REAL competitor.
Be very selective. 3-5 truly relevant competitors is better than 10 loosely related ones.`

        const geminiResponse = await client.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: filterPrompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY" as const,
                    items: {
                        type: "OBJECT" as const,
                        properties: {
                            name: { type: "STRING" as const },
                            url: { type: "STRING" as const },
                            reason: { type: "STRING" as const }
                        },
                        required: ["name", "url"]
                    }
                }
            }
        })

        const text = geminiResponse.text || "[]"
        const parsed = JSON.parse(text.replace(/```json|```/g, ""))

        const competitors: DiscoveredCompetitor[] = (parsed || [])
            .slice(0, maxCompetitors)
            .map((item: any) => {
                let domain = ""
                try { domain = new URL(item.url).hostname.replace('www.', '') } catch { domain = item.url }
                return {
                    name: item.name || domain,
                    url: item.url,
                    domain
                }
            })

        console.log(`[Competitor Scanner] LLM identified ${competitors.length} real competitors: ${competitors.map(c => `${c.name} (${c.url})`).join(', ')}`)
        return competitors

    } catch (error) {
        console.error("[Competitor Scanner] Discovery failed:", error)
        return []
    }
}

/**
 * Scans a single competitor site.
 * First tries sitemap → title extraction.
 * Falls back to Tavily search if sitemap is unavailable.
 */
async function scanCompetitorSite(
    competitor: DiscoveredCompetitor,
    blueprintEmbeddings: TopicEmbedding[],
    blueprint: NicheBlueprint,
    searchPrefs?: TavilySearchPrefs
): Promise<SiteCoverage> {
    console.log(`[Competitor Scanner] Scanning ${competitor.name} (${competitor.url})...`)

    // Strategy 1: Try sitemap
    let urls = await fetchAllSitemapUrls(competitor.url)

    // Strategy 2: If sitemap fails, use Tavily to discover content pages
    if (urls.length === 0) {
        console.log(`[Competitor Scanner] No sitemap for ${competitor.name}, falling back to Tavily`)
        urls = await discoverContentViaTavily(competitor.domain, competitor.name, searchPrefs)
    }

    if (urls.length === 0) {
        console.warn(`[Competitor Scanner] No content found for ${competitor.name}`)
        return {
            site_url: competitor.url,
            site_name: competitor.name,
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

    // Filter non-content URLs
    const contentUrls = urls.filter(url => {
        const lower = url.toLowerCase()
        return !lower.match(/\.(jpg|jpeg|png|gif|svg|pdf|css|js|woff|woff2|ttf|ico|xml|json)$/)
            && !lower.includes('/wp-admin/')
            && !lower.includes('/tag/')
            && !lower.includes('/category/')
            && !lower.includes('/author/')
    })

    // Cap at 150 pages per competitor (less than user's 200)
    const pagesToScan = contentUrls.slice(0, 150)
    console.log(`[Competitor Scanner] ${competitor.name}: scanning ${pagesToScan.length} pages`)

    // Extract titles
    const pages = await batchExtractTitles(pagesToScan)
    const meaningfulPages = pages.filter(p =>
        p.title.length > 5
        && !['home', 'about', 'contact', 'privacy policy', 'terms of service', 'login', 'sign up', 'careers', 'jobs', 'team']
            .includes(p.title.toLowerCase())
    )

    // Map to blueprint using shared embeddings
    return mapCoverageWithEmbeddings(
        meaningfulPages,
        blueprintEmbeddings,
        competitor.url,
        competitor.name,
        blueprint
    )
}

/**
 * Fallback: use Tavily search to discover competitor content pages
 * when sitemap is not available.
 */
async function discoverContentViaTavily(
    domain: string,
    brandName: string,
    searchPrefs?: TavilySearchPrefs
): Promise<string[]> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) return []

    try {
        const tvly = tavily({ apiKey })

        // Search for blog/content pages on the competitor's site
        const { modifiedQuery, options } = buildTavilySearchOptions(`site:${domain} guide how to`, searchPrefs, {
            maxResults: 10,
            searchDepth: "basic"
        })
        const response = await tvly.search(modifiedQuery, options)

        const urls = (response.results || [])
            .map(r => r.url)
            .filter((url): url is string => !!url)

        console.log(`[Competitor Scanner] Tavily found ${urls.length} pages for ${brandName}`)
        return Array.from(new Set(urls))

    } catch (error) {
        console.error(`[Competitor Scanner] Tavily fallback failed for ${brandName}:`, error)
        return []
    }
}

/**
 * Scans all competitors in parallel (limited to 3 concurrent).
 */
export async function scanAllCompetitors(
    competitors: DiscoveredCompetitor[],
    blueprintEmbeddings: TopicEmbedding[],
    blueprint: NicheBlueprint,
    maxConcurrent: number = 2,
    searchPrefs?: TavilySearchPrefs
): Promise<SiteCoverage[]> {
    const results: SiteCoverage[] = []

    // Process in batches to avoid overwhelming APIs
    for (let i = 0; i < competitors.length; i += maxConcurrent) {
        const batch = competitors.slice(i, i + maxConcurrent)
        const batchResults = await Promise.allSettled(
            batch.map(comp => scanCompetitorSite(comp, blueprintEmbeddings, blueprint, searchPrefs))
        )

        for (const result of batchResults) {
            if (result.status === "fulfilled") {
                results.push(result.value)
            }
        }
    }

    // Sort by score descending (strongest competitor first)
    results.sort((a, b) => b.overall_score - a.overall_score)

    console.log(`[Competitor Scanner] Scanned ${results.length} competitors. Scores: ${results.map(r => `${r.site_name}: ${r.overall_score}`).join(', ')}`)
    return results
}
