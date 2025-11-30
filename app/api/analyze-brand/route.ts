import { NextRequest, NextResponse } from "next/server"
import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"

export const maxDuration = 300 // 5 minute timeout

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 })
    }

    // 1. Crawl with Tavily SDK
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Tavily API key not configured" }, { status: 500 })
    }

    console.log("Starting Tavily crawl for:", url)
    
    const tvly = tavily({ apiKey })
    
    // Note: crawl returns a promise that resolves when the crawl is complete (sync mode implied by SDK types or it handles polling)
    // Based on docs, it returns TavilyCrawlResponse
    const crawlResponse = await tvly.crawl(url, {
      limit: 10,
      extractDepth: "advanced",
      format: "markdown",
      instructions: "Find the homepage, about page, features page, and pricing page to understand the brand."
    })

    // Aggregate content
    let combinedContent = ""
    // @ts-ignore - SDK types might be slightly off, checking results property
    const results = crawlResponse.results || crawlResponse.data
    
    if (results && Array.isArray(results)) {
      combinedContent = results.map((page: any) => `
---
URL: ${page.url}
Title: ${page.title || 'No Title'}
Content:
${page.rawContent || page.markdown || page.content || ''}
---
`).join("\n")
    } else {
       // Fallback dump
       combinedContent = JSON.stringify(crawlResponse).slice(0, 20000)
    }

    if (!combinedContent || combinedContent.length < 50) {
       return NextResponse.json({ error: "No content extracted from website" }, { status: 400 })
    }

    // 2. Analyze with Gemini
    const client = getGeminiClient()
    
    const prompt = `
      You are an expert brand strategist. Analyze the following website content and extract the brand identity.
      
      Target Website: ${url}
      
      Website Content Samples:
      ${combinedContent.slice(0, 50000)} -- Limit context to avoid overload
      
      Extract the brand details into the following JSON structure:
      1. Product Identity (Name, What it is literally, What it is emotionally, What it is NOT)
      2. Mission (The "Why")
      3. Audience (Primary, Psychology)
      4. Enemy (What they fight against)
      5. Voice & Tone (How they sound)
      6. Unique Value Proposition (How they win)
      7. Core Features (Framed as "Fixes")
      8. Pricing (Key plans, models, or costs - keep it simple)
      9. How it Works (Steps or process flow)
      
      Be specific, raw, and honest. Avoid marketing fluff. Use the brand's own language where possible.
    `

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "OBJECT",
            properties: {
                product_name: { type: "STRING" },
                product_identity: {
                    type: "OBJECT",
                    properties: {
                        literally: { type: "STRING" },
                        emotionally: { type: "STRING" },
                        not: { type: "STRING" }
                    },
                    required: ["literally", "emotionally", "not"]
                },
                mission: { type: "STRING" },
                audience: {
                    type: "OBJECT",
                    properties: {
                        primary: { type: "STRING" },
                        psychology: { type: "STRING" }
                    },
                    required: ["primary", "psychology"]
                },
                enemy: { 
                    type: "ARRAY",
                    items: { type: "STRING" }
                },
                voice_tone: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                },
                uvp: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                },
                core_features: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                },
                pricing: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                },
                how_it_works: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                }
            },
            required: ["product_name", "product_identity", "mission", "audience", "enemy", "voice_tone", "uvp", "core_features", "pricing", "how_it_works"]
        }
      }
    })

    // Fix: response.text is a getter in newer SDKs, not a method
    const text = response.text || ""
    const brandData = JSON.parse(text || "{}")

    return NextResponse.json(brandData)

  } catch (e: unknown) {
    console.error("Brand analysis error:", e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
