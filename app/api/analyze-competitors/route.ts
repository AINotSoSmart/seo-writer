import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { jsonrepair } from "jsonrepair"

export const maxDuration = 300 // 5 minute timeout

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { url, brandContext } = await req.json()

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 })
        }

        // Extract domain to exclude from results
        let domain: string
        try {
            domain = new URL(url).hostname.replace("www.", "")
        } catch {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
        }

        // Search for competitors using Tavily
        const apiKey = process.env.TAVILY_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: "Tavily API key not configured" }, { status: 500 })
        }

        console.log("Starting competitor analysis for:", domain)
        console.log("Brand context:", brandContext)

        const tvly = tavily({ apiKey })
        const client = getGeminiClient()

        // STEP 1: Use AI to extract ALL product features and generate queries for each
        // This ensures multi-feature products get comprehensive coverage
        const categoryPrompt = `
Given this brand description, extract ALL distinct product features and generate search queries.

Brand Context: ${brandContext || "A software business"}

CRITICAL: Many products have MULTIPLE features (e.g., a photo tool might do restoration, animation, AND portrait generation).
You MUST identify ALL distinct features, not just the primary one.

Return a JSON object with:
1. category: The overall product category
2. distinctFeatures: Array of ALL distinct features/products this brand offers (e.g., ["photo restoration", "photo animation", "family portrait generation", "hug video creation"])
3. searchQueries: Array of 6-9 search queries covering ALL features. Generate 2-3 queries per distinct feature.
   Example for a multi-feature product:
   - "best AI photo restoration tools"
   - "AI photo animation software"
   - "family portrait generator AI"
   - "nostalgic hug video maker"

Be exhaustive. Miss nothing.
`

        const categoryResponse = await client.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: categoryPrompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        category: { type: "STRING" },
                        distinctFeatures: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        },
                        searchQueries: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        }
                    },
                    required: ["category", "distinctFeatures", "searchQueries"]
                }
            }
        })

        let categoryData: any = {}
        try {
            const rawText = categoryResponse.text || "{}"
            categoryData = JSON.parse(rawText)
        } catch (e) {
            console.warn("JSON parse failed, trying repair:", e)
            try {
                const rawText = categoryResponse.text || "{}"
                categoryData = JSON.parse(jsonrepair(rawText))
            } catch (e2) {
                console.error("Critical JSON parse failure:", e2)
                categoryData = {}
            }
        }

        const searchQueries = categoryData.searchQueries || [`best ${categoryData.category || "software"} tools 2024`]
        const distinctFeatures = categoryData.distinctFeatures || []

        console.log("Detected features:", distinctFeatures)
        console.log("Generated search queries:", searchQueries)

        // STEP 2: Execute multiple queries to cover ALL features
        // Cost: ~$0.003 per query, executing 3 queries = ~$0.009 total (very cheap)
        let allResults: any[] = []

        for (const query of searchQueries.slice(0, 3)) { // Execute top 3 queries for broader coverage
            try {
                const searchResponse = await tvly.search(query, {
                    searchDepth: "advanced",
                    includeRawContent: "markdown",
                    maxResults: 5,
                })
                allResults.push(...(searchResponse.results || []))
            } catch (e) {
                console.error("Search failed for query:", query, e)
            }
        }

        // STEP 3: Dedupe and filter out own domain
        const seenUrls = new Set<string>()
        const competitorResults = allResults
            .filter((r: any) => {
                if (!r.url || r.url.includes(domain) || seenUrls.has(r.url)) return false
                seenUrls.add(r.url)
                return true
            })
            .slice(0, 5) // Top 5 unique competitor pages

        if (competitorResults.length === 0) {
            return NextResponse.json({
                competitors: [],
                seeds: []
            })
        }

        // STEP 4: Extract keywords from competitor content using Gemini

        const combinedContent = competitorResults.map((r: any) => `
---
URL: ${r.url}
Title: ${r.title || 'No Title'}
Content:
${r.rawContent || r.content || ''}
---
`).join("\n").slice(0, 30000)

        const extractPrompt = `
Analyze this competitor content and extract valuable SEO data for a brand.

Brand Context: ${brandContext || "A SaaS business"}

Competitor Content:
${combinedContent}

Extract the following as JSON:
1. headings: Main headings and subheadings from the content (array of strings)
2. keywords: Important keywords and phrases, 2-3 words each (array of strings, max 30)
3. topics: Blog topic ideas that could compete with this content (array of strings, max 20)

Focus on actionable, specific topics relevant to the brand context. Be specific, not generic.
`

        const response = await client.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: extractPrompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        headings: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        },
                        keywords: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        },
                        topics: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        }
                    },
                    required: ["headings", "keywords", "topics"]
                }
            }
        })

        const text = response.text || "{}"
        let extracted: any = {}
        try {
            extracted = JSON.parse(text)
        } catch (e) {
            console.warn("Extraction JSON parse failed, trying repair:", e)
            try {
                extracted = JSON.parse(jsonrepair(text))
            } catch (e2) {
                console.error("Critical extraction JSON parse failure")
                extracted = {}
            }
        }

        // Build competitors data
        const competitors = competitorResults.map((r: any) => ({
            url: r.url,
            title: r.title || "",
            headings: extracted.headings?.slice(0, 10) || [],
            keywords: extracted.keywords?.slice(0, 10) || [],
        }))

        // Combine topics and keywords as seeds
        const seeds = [
            ...(extracted.topics || []),
            ...(extracted.keywords?.slice(0, 10) || [])
        ].filter((s, i, arr) => arr.indexOf(s) === i) // Dedupe

        return NextResponse.json({
            competitors,
            seeds: seeds.slice(0, 30),
        })
    } catch (error: any) {
        console.error("Competitor analysis error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to analyze competitors" },
            { status: 500 }
        )
    }
}
