import { tavily } from "@tavily/core"
import { BrandDetails } from "@/lib/schemas/brand"
import { buildTavilySearchOptions, TavilySearchPrefs } from "@/lib/tavily-search"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import {
    resolveAgainstCandidates,
    type CompetitorCandidate,
    type DiscoveredCompetitor,
} from "./competitor-resolve"
import { competitorDomain } from "@/lib/visibility/competitor-domain"

// ============================================================
// Competitor Scanner — Discovers competitor domains
//
// Scanning moved to lib/harvest/coverage.ts, which runs the same coverage
// computation for competitors as for the user's own site. Discovery stays here
// because it is real Tavily search plus an LLM filter over actual results.
// ============================================================

export type CompetitorDiscoveryTelemetry = (call: {
    source: "competitor_discovery_tavily" | "competitor_filter_gemini"
    succeeded: boolean
}) => void

/**
 * Only the fields discovery actually reads.
 *
 * Structural rather than the whole `BrandDetails`, so onboarding can call this
 * before a brand row exists without fabricating a mission statement and an
 * audience psychology to satisfy a type. A full `BrandDetails` still assigns.
 */
export type CompetitorDiscoveryBrand = {
    product_name: string
    product_identity?: Pick<
        NonNullable<BrandDetails["product_identity"]>,
        "literally"
    > &
        Partial<NonNullable<BrandDetails["product_identity"]>>
    category?: string
    brand_keywords?: string[]
    scope_families?: BrandDetails["scope_families"]
}

/**
 * The one competitor finder in this repo.
 *
 * Queries come from the founder's **confirmed scope family seed keywords** —
 * one search per product area — because that is the only place the business is
 * described in the words its buyers actually use. A category label cannot
 * substitute for them: "AI photo editing" finds PicWish and Fotor, while
 * "add deceased loved one to photo" finds the handful of businesses that
 * genuinely compete for that customer. The seeds are already confirmed by the
 * founder before this runs, so searching them is not a guess.
 *
 * Approach:
 * 1. One Tavily query per confirmed product area (falls back to brand keywords,
 *    then category, then "<product> competitors alternatives").
 * 2. Deduplicate by domain, drop self and known aggregators.
 * 3. Hand the real results to a model that filters listicles, generalists and
 *    side-feature pages, and picks the dedicated rivals.
 * 4. Resolve its answers back onto the domains it was shown — see
 *    `resolveAgainstCandidates`.
 *
 * @param subjectUrl The customer's own site, so it can be excluded by hostname
 *                   rather than by guessing from the brand name.
 */
export async function discoverCompetitors(
    brandData: CompetitorDiscoveryBrand,
    maxCompetitors: number = 5,
    searchPrefs?: TavilySearchPrefs,
    telemetry?: CompetitorDiscoveryTelemetry,
    subjectUrl?: string,
): Promise<DiscoveredCompetitor[]> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
        console.warn("[Competitor Scanner] No Tavily API key, skipping competitor discovery")
        telemetry?.({ source: "competitor_discovery_tavily", succeeded: false })
        return []
    }

    let geminiAttempted = false
    let geminiCompleted = false
    try {
        const tvly = tavily({ apiKey })
        const brandNameLower = brandData.product_name.toLowerCase()
        // Exact self-exclusion when the caller knows the site. The brand-name
        // heuristic below stays as a fallback, but it is only a substring guess:
        // it drops an innocent rival whose domain happens to contain the brand
        // name, and misses the customer's own site whenever the domain and the
        // product name differ.
        const subjectHost = competitorDomain(subjectUrl)

        // Build discovery from confirmed commercial areas. A flat keyword list
        // previously collapsed multi-offer businesses into one feature family.
        //
        // The sort is load-bearing, not cosmetic: only the top
        // `maxCompetitorDiscoveryQueries` areas are searched, so priority order
        // decides which of the founder's areas get to name a rival. A brand with
        // one area makes one search; a brand with ten still makes three.
        const queries: string[] = []
        const scopeFamilies = (brandData.scope_families || [])
            .filter((family) => family.enabled)
            .sort((a, b) => a.priority - b.priority)

        if (scopeFamilies.length > 0) {
            for (
                const family of scopeFamilies.slice(
                    0,
                    HARVEST_POLICY.maxCompetitorDiscoveryQueries,
                )
            ) {
                const primarySeed = family.seed_keywords[0]
                if (primarySeed) queries.push(primarySeed)
            }
        } else if (brandData.brand_keywords && brandData.brand_keywords.length > 0) {
            for (
                const keyword of brandData.brand_keywords.slice(
                    0,
                    HARVEST_POLICY.maxCompetitorDiscoveryQueries,
                )
            ) {
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
        const allResults: Array<CompetitorCandidate & { snippet: string }> = []
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
                telemetry?.({
                    source: "competitor_discovery_tavily",
                    succeeded: true,
                })

                for (const result of response.results || []) {
                    try {
                        const url = new URL(result.url)
                        const domain = url.hostname.replace('www.', '')
                        const domainBase = domain.split('.')[0].toLowerCase()

                        // Skip self, seen, and blocklisted
                        if (seenDomains.has(domain)) continue
                        if (subjectHost && domain === subjectHost) continue
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
                telemetry?.({
                    source: "competitor_discovery_tavily",
                    succeeded: false,
                })
                console.warn(`[Competitor Scanner] Query failed: "${query}"`, e)
            }
        }

        console.log(`[Competitor Scanner] Raw results from Tavily: ${allResults.length} unique domains`)
        console.log(`[Competitor Scanner] Candidates: ${allResults.map(r => r.domain).join(', ')}`)

        if (allResults.length === 0) return []

        // === LLM FILTER: Send all results to Gemini to identify actual competitors ===
        const { getGeminiClient } = await import("@/utils/gemini/geminiClient")
        const client = getGeminiClient()
        geminiAttempted = true

        const filterPrompt = `You are a strict competitor analyst. Your job is to identify DIRECT product competitors.

## THE BRAND WE ARE ANALYZING
- **Name:** ${brandData.product_name}
- **What it does:** ${brandData.product_identity?.literally || brandData.category || 'Software'}
- **Category:** ${brandData.category || "N/A"}
- **Confirmed product/service areas:** ${
            scopeFamilies.length
                ? scopeFamilies
                      .map(
                          (family) =>
                              `${family.name}: ${family.description}`,
                      )
                      .join(" | ")
                : "Not available"
        }

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

        const competitors = resolveAgainstCandidates(
            Array.isArray(parsed) ? parsed : [],
            allResults,
            subjectHost,
        ).slice(0, maxCompetitors)
        geminiCompleted = true
        telemetry?.({ source: "competitor_filter_gemini", succeeded: true })

        console.log(`[Competitor Scanner] LLM identified ${competitors.length} real competitors: ${competitors.map(c => `${c.name} (${c.url})`).join(', ')}`)
        return competitors

    } catch (error) {
        if (geminiAttempted && !geminiCompleted) {
            telemetry?.({
                source: "competitor_filter_gemini",
                succeeded: false,
            })
        }
        console.error("[Competitor Scanner] Discovery failed:", error)
        return []
    }
}

/**
 * Scans a single competitor site.
 * First tries sitemap → title extraction.
 * Falls back to Tavily search if sitemap is unavailable.
 */
