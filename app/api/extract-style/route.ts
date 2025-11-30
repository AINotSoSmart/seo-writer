import { NextRequest, NextResponse } from "next/server"
import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { StyleDNASchema } from "@/lib/schemas/style"

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
      Analyze the following text and extract its writing style into a JSON object.
      
      Text Sample:
      "${content.slice(0, 15000).replace(/"/g, '\\"')}"

      Return ONLY a valid JSON object matching this schema exactly:
      {
        "tone": "string",
        "sentence_structure": {
          "avg_length": "short" | "medium" | "long" | "varied",
          "complexity": "simple" | "academic" | "technical",
          "use_of_questions": boolean
        },
        "formatting": {
          "use_bullet_points": "frequent" | "rare" | "never",
          "header_style": "declarative" | "clickbaity" | "question-based",
          "bold_key_phrases": boolean
        },
        "vocabulary": {
          "level": "Grade 8" | "Grade 12" | "PhD",
          "jargon_usage": "heavy" | "minimal" | "explained",
          "forbidden_words": ["word1", "word2"]
        },
        "narrative_rules": ["rule1", "rule2"]
      }
    `

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash", // Fast and capable for extraction
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    })

    const text = response.text || ""
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim()
    
    let parsed
    try {
      parsed = JSON.parse(cleanJson)
    } catch (e) {
      console.error("JSON Parse Error", text)
      throw new Error("Failed to parse Gemini response")
    }

    // Validate against schema to ensure type safety
    const validated = StyleDNASchema.parse(parsed)

    return NextResponse.json(validated)

  } catch (e: any) {
    console.error("Extract Style Error:", e)
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 })
  }
}
