import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"

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

        // Extract domain for search query
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

        const tvly = tavily({ apiKey })

        // Search for competitors
        const searchQuery = `${domain} competitors similar websites alternatives`
        const searchResponse = await tvly.search(searchQuery, {
            searchDepth: "advanced",
            includeRawContent: "markdown",
            maxResults: 5,
        })

        // Filter out own domain and limit to top 3
        const competitorResults = (searchResponse.results || [])
            .filter((r: any) => !r.url?.includes(domain))
            .slice(0, 3)

        if (competitorResults.length === 0) {
            return NextResponse.json({
                competitors: [],
                seeds: []
            })
        }

        // Extract keywords from competitor content using Gemini
        const client = getGeminiClient()

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
        const extracted = JSON.parse(text)

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
