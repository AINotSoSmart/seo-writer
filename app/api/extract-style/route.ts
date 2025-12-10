import { NextRequest, NextResponse } from "next/server"
import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 })
    }

    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })

    // Attempt to use extract if available, otherwise search
    let content = ""
    try {
      // @ts-ignore - extract might not be typed in all versions
      const extractResult = await tvly.extract([url])
      if (extractResult.results && extractResult.results.length > 0) {
        const res = extractResult.results[0] as any
        content = res.rawContent || res.content
      }
    } catch (e) {
      console.log("Tavily extract failed or not found, falling back to search", e)
    }

    if (!content) {
      // Fallback to search
      const searchResult = await tvly.search(url, {
        include_text: true,
        search_depth: "advanced",
        max_results: 1
      })
      if (searchResult.results && searchResult.results.length > 0) {
        content = searchResult.results[0].content
      }
    }

    if (!content || content.length < 50) {
      return NextResponse.json({ error: "Could not extract content from URL" }, { status: 400 })
    }

    const client = getGeminiClient()
    const prompt = `
      You are an expert writing style analyst. Analyze the following text and extract its writing style into a comprehensive paragraph that can guide future content creation.
      
      IMPORTANT: Your output should be a SINGLE PARAGRAPH (not JSON) that describes how to write in this style.
      
      Analyze and include:
      - Perspective: Does the author use "I", "We", or third-person? How do they refer to themselves?
      - Tone: Professional, casual, formal, playful, authoritative, friendly?
      - Sentence style: Short and punchy? Long and detailed? Varied rhythm?
      - Formality level: Academic, corporate, conversational?
      - Specific patterns: Do they use questions? Bullet points? Data/statistics?
      - Words/phrases to avoid: Any patterns they seem to avoid?
      - Unique quirks: Any distinctive writing patterns?
      
      Text Sample:
      "${content.slice(0, 15000).replace(/"/g, '\\"')}"

      Output ONLY a paragraph (200-400 words) describing the writing style. Do NOT output JSON.
      
      Example output format:
      "Write in a conversational yet authoritative tone. Use first-person plural ('we', 'our') when referring to the brand, and address the reader as 'you'. Keep sentences varied—mix short punchy statements with longer explanatory ones. Ask rhetorical questions to engage readers. Avoid corporate jargon like 'synergy', 'leverage', or 'paradigm'. Be direct and specific; prefer '3x faster' over 'much faster'. Use active voice. Include specific examples and data when possible. End sections with actionable takeaways."
    `

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    })

    const text = (response.text || "").trim()

    // Clean up any quotes around the paragraph if present
    let styleDna = text
    if (styleDna.startsWith('"') && styleDna.endsWith('"')) {
      styleDna = styleDna.slice(1, -1)
    }

    // Return as a simple object with the style_dna string
    return NextResponse.json({ style_dna: styleDna })

  } catch (e: any) {
    console.error("Extract Style Error:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}
