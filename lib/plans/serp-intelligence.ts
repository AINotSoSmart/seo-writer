import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { buildTavilySearchOptions, TavilySearchPrefs } from "@/lib/tavily-search"

export interface RankingPage {
    url: string
    title: string
    questionsAnswered: string[]
    topicsCovered: string[]
    competitorName: string | null
}

export interface SERPIntelligence {
    seed: string
    topPages: RankingPage[]
    coverageLevel: "saturated" | "partial" | "low"
    missingAngles: string[]
    totalResults: number
}

/**
 * Gathers SERP intelligence for seed keywords.
 * Analyzes top ranking pages to understand what questions they answer
 * and what topics they cover.
 */
export async function gatherSERPIntelligence(
    seeds: string[],
    maxSeeds: number = 5,
    searchPrefs?: TavilySearchPrefs
): Promise<SERPIntelligence[]> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
        console.error("[SERP Intelligence] Tavily API key not configured")
        return []
    }

    const tvly = tavily({ apiKey })
    const genAI = getGeminiClient()
    const results: SERPIntelligence[] = []

    // Process top seeds (limit to avoid cost overrun)
    const seedsToProcess = seeds.slice(0, maxSeeds)

    for (const seed of seedsToProcess) {
        try {
            // Fetch top results for this seed
            const { modifiedQuery, options } = buildTavilySearchOptions(seed, searchPrefs, {
                searchDepth: "advanced",
                includeRawContent: "markdown",
                maxResults: 10
            })
            const searchResponse = await tvly.search(modifiedQuery, options)

            const rawResults = searchResponse.results || []
            if (rawResults.length === 0) {
                continue
            }

            // Analyze the results with LLM
            const analysis = await analyzeSERPResults(rawResults, seed, genAI)
            results.push(analysis)

        } catch (error) {
            console.error(`[SERP Intelligence] Error analyzing "${seed}":`, error)
        }
    }

    return results
}

/**
 * Analyzes SERP results using LLM to extract questions, topics, and gaps.
 */
async function analyzeSERPResults(
    results: any[],
    seed: string,
    genAI: any
): Promise<SERPIntelligence> {
    // Prepare content for analysis
    const contentSummary = results.map((r, i) => `
### Result ${i + 1}: ${r.title || 'No Title'}
URL: ${r.url}
Snippet: ${r.content?.slice(0, 15000) || 'No content'}
`).join('\n')

    const prompt = `
You are an SEO intelligence analyst. Analyze these top 10 search results for "${seed}".

${contentSummary}

EXTRACT:
1. For each result, identify:
   - The competitor/brand name (if identifiable from URL/title)
   - 2-3 main questions this page answers
   - 2-3 topics this page covers

2. Overall assessment:
   - Coverage level: "saturated" (8+ similar results), "partial" (4-7), or "low" (<4)
   - Missing angles: What topics/questions are NOT covered but SHOULD be?

OUTPUT (JSON):
{
  "topPages": [
    {
      "url": "example.com",
      "title": "Page Title",
      "questionsAnswered": ["What is X?", "How does X work?"],
      "topicsCovered": ["X basics", "X benefits"],
      "competitorName": "ExampleBrand" or null
    }
  ],
  "coverageLevel": "saturated" | "partial" | "low",
  "missingAngles": ["Advanced X techniques", "X vs Y comparison"]
}
`

    try {
        const response = await genAI.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        })

        const text = response.text || "{}"
        const parsed = JSON.parse(text.replace(/```json|```/g, ""))

        return {
            seed,
            topPages: parsed.topPages || [],
            coverageLevel: parsed.coverageLevel || "partial",
            missingAngles: parsed.missingAngles || [],
            totalResults: results.length
        }
    } catch (error) {
        console.error(`[SERP Intelligence] LLM analysis failed for "${seed}":`, error)
        return {
            seed,
            topPages: [],
            coverageLevel: "partial",
            missingAngles: [],
            totalResults: results.length
        }
    }
}

/**
 * Extracts unique competitor names from SERP intelligence data.
 * Uses DOMAIN-BASED extraction (not LLM) to get real brand names.
 */
export function extractCompetitorBrands(serpData: SERPIntelligence[]): Array<{ name: string; url?: string }> {
    const brands = new Map<string, { name: string; url?: string }>()
    const seenDomains = new Set<string>()

    // Domains to skip (not competitors - content aggregators, social media, etc.)
    const SKIP_DOMAINS = new Set([
        // Social media
        'linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com',
        'youtube.com', 'pinterest.com', 'tiktok.com',
        // Developer/QA sites
        'stackoverflow.com', 'github.com', 'gitlab.com', 'bitbucket.org',
        // Reference sites
        'wikipedia.org', 'wikimedia.org', 'britannica.com',
        // Website builders
        'wordpress.org', 'wordpress.com', 'wix.com', 'squarespace.com',
        // Generic hosting
        'netlify.app', 'herokuapp.com', 'github.io',
    ])

    for (const serp of serpData) {
        for (const page of serp.topPages) {
            try {
                const urlObj = new URL(page.url)
                let domain = urlObj.hostname.replace('www.', '')

                // Skip if we've seen this domain or it's a content site
                if (seenDomains.has(domain)) continue
                if (SKIP_DOMAINS.has(domain)) continue

                // Check if any skip domain is a suffix (e.g., *.medium.com)
                const skipAsSuffix = Array.from(SKIP_DOMAINS).some(skip => domain.endsWith('.' + skip))
                if (skipAsSuffix) continue

                seenDomains.add(domain)

                // Extract brand name from domain - works for ANY industry
                // "plausible.io" → "Plausible"
                // "makeswift.com" → "Makeswift"  
                // "fancybaker.com" → "Fancybaker"
                const domainParts = domain.split('.')
                let baseName: string

                // Handle subdomains: "analytics.google.com" → use parent domain
                if (domainParts.length > 2) {
                    baseName = domainParts[domainParts.length - 2]
                } else {
                    baseName = domainParts[0]
                }

                // Skip generic subdomains
                if (['www', 'blog', 'docs', 'help', 'support', 'app', 'cdn', 'api'].includes(baseName)) {
                    continue
                }

                // Capitalize first letter
                const brandName = baseName.charAt(0).toUpperCase() + baseName.slice(1)

                // Skip if it's too short or looks like a generic word
                if (brandName.length < 3) continue
                const SKIP_WORDS = new Set(['The', 'How', 'What', 'Top', 'Best', 'Guide', 'Complete', 'Ultimate', 'Free', 'Online'])
                if (SKIP_WORDS.has(brandName)) continue

                brands.set(domain, {
                    name: brandName,
                    url: page.url
                })
            } catch {
                // Invalid URL, skip
            }
        }
    }

    return Array.from(brands.values()).slice(0, 10) // Return top 10 competitors
}

/**
 * Aggregates all topics covered across SERP results.
 */
export function aggregateCoveredTopics(serpData: SERPIntelligence[]): string[] {
    const topics = new Set<string>()

    for (const serp of serpData) {
        for (const page of serp.topPages) {
            page.topicsCovered.forEach(t => topics.add(t))
        }
    }

    return Array.from(topics)
}

/**
 * Aggregates all questions answered across SERP results.
 */
export function aggregateAnsweredQuestions(serpData: SERPIntelligence[]): string[] {
    const questions = new Set<string>()

    for (const serp of serpData) {
        for (const page of serp.topPages) {
            page.questionsAnswered.forEach(q => questions.add(q))
        }
    }

    return Array.from(questions)
}

/**
 * Aggregates all missing angles (blue ocean opportunities).
 */
export function aggregateMissingAngles(serpData: SERPIntelligence[]): string[] {
    const angles = new Set<string>()

    for (const serp of serpData) {
        serp.missingAngles.forEach(a => angles.add(a))
    }

    return Array.from(angles)
}
