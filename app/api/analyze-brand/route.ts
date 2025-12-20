import { NextRequest, NextResponse } from "next/server"
import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { jsonrepair } from "jsonrepair"

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
      instructions: "Find the homepage, about page, features page, pricing page, and any blog posts to understand the brand data and its voice and writing style."
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
      You are an expert brand strategist and writing style analyst. Analyze the following website content and extract the brand identity AND comprehensive writing style.
      
      Target Website: ${url}
      
      Website Content Samples:
      ${combinedContent.slice(0, 50000)} -- Limit context to avoid overload
      
      Extract the brand details into the following JSON structure:
      1. Product Identity (Name, What it is literally, What it is emotionally, What it is NOT)
      2. Mission (The "Why")
      3. Audience (Primary, Psychology)
      4. Enemy (What they fight against)
      5. Unique Value Proposition (How they win)
      6. Core Features (Framed as "Fixes")
      7. Pricing (Key plans, models, or costs - keep it simple)
      8. How it Works (Steps or process flow)
      9. Style DNA (CRITICAL - This is the COMPLETE WRITING VOICE as a SINGLE PARAGRAPH)
      
      For the Style DNA paragraph, analyze the website's actual writing and create a comprehensive guide covering:
      - Perspective: Do they use "I", "We", "You", or third-person? How do they refer to themselves vs their product?
      - Tone: Professional, casual, formal, playful, authoritative, friendly, data-driven?
      - Sentence style: Short and punchy? Long and detailed? Varied rhythm?
      - Formality level: Academic, corporate, conversational?
      - Specific patterns: Do they use questions? Bullet points? Data/statistics? Analogies?
      - Words to avoid: Any jargon or corporate speak they seem to avoid?
      - Unique quirks: Any distinctive writing patterns or voice characteristics?
      
      Example style_dna output:
      "Write in a conversational yet authoritative tone. Use first-person plural ('we', 'our') when referring to the brand, and address the reader as 'you'. Keep sentences varied—mix short punchy statements with longer explanatory ones. Ask rhetorical questions to engage readers. Avoid corporate jargon like 'synergy', 'leverage', or 'paradigm'. Be direct and specific; prefer '3x faster' over 'much faster'. Use active voice. Include specific examples and data when possible. End sections with actionable takeaways."
      
      Be specific, raw, and honest. Avoid marketing fluff. Use the brand's own language where possible.
    `

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
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
            },
            style_dna: {
              type: "STRING",
              description: "Complete writing voice and style guide as a single paragraph covering perspective, tone, sentence style, formality, patterns, and words to avoid"
            }
          },
          required: ["product_name", "product_identity", "mission", "audience", "enemy", "uvp", "core_features", "pricing", "how_it_works", "style_dna"]
        }
      }
    })

    // Fix: response.text is a getter in newer SDKs, not a method
    const text = response.text || ""
    let brandData: any = {}
    try {
      brandData = JSON.parse(text || "{}")
    } catch (e) {
      console.warn("Brand analysis JSON parse failed, trying repair:", e)
      try {
        brandData = JSON.parse(jsonrepair(text || "{}"))
      } catch (e2) {
        console.error("Critical Brand Analysis JSON parse failure:", e2)
        throw new Error("Failed to parse brand analysis results")
      }
    }

    return NextResponse.json(brandData)

  } catch (e: unknown) {
    console.error("Brand analysis error:", e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
