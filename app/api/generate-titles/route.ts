import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
import { jsonrepair } from "jsonrepair"
import { ArticleType } from "@/lib/prompts/article-types"
import { getTitlePrompt } from "@/lib/prompts/strategies"

const genAI = getGeminiClient()

const GENERATE_TITLES_PROMPT = (keyword: string, articleType: ArticleType, brandDetails: any = null) => `
You are an expert Copywriter and SEO Specialist.
Your goal is to generate 5 catchy, high-converting blog post titles for a specific keyword.

INPUT CONTEXT:
1. KEYWORD: "${keyword}"
2. ARTICLE TYPE: ${articleType.toUpperCase()}
${brandDetails ? `3. BRAND DETAILS: ${JSON.stringify(brandDetails)}` : ""}

CRITICAL RULES (Must Follow):
1. **NO COLONS OR SEMI-COLONS:** Titles must be a single, flowing sentence. (Bad: "Restoration: How to do it", Good: "How to restore your old photos easily")
2. **NO "AI SLOP":** Do not use clichés like "Unleash", "Unlock", "Elevate", "Mastering", "Ultimate Guide to", "Symphony", "Tapestry".
3. **NATURAL LANGUAGE:** Write like a human, not a marketing bot. Use conversational but authoritative language.

TYPE-SPECIFIC INSTRUCTIONS:
${getTitlePrompt(articleType, keyword)}

GLOBAL INSTRUCTIONS:
1. Generate 5 distinct title options.
2. Titles should incorporate the keyword naturally.
3. No emotional words or clichés.
4. Keep titles simple direct SEO style.
5. No storytelling tone, only informative titles.

OUTPUT REQUIREMENTS (Return strict JSON):
{
  "titles": string[]
}
`

export async function POST(req: NextRequest) {
    try {
        const { keyword, brandId, articleType = 'informational' } = await req.json()

        if (!keyword || !brandId) {
            return NextResponse.json({ error: "Missing keyword or brandId" }, { status: 400 })
        }

        const supabaseServer = await createClient()
        const { data: userData } = await supabaseServer.auth.getUser()
        const userId = userData?.user?.id

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Fetch Brand Details
        const { data: brandRec } = await supabaseServer
            .from("brand_details")
            .select("brand_data")
            .eq("id", brandId)
            .single()

        if (!brandRec) {
            return NextResponse.json({ error: "Brand not found" }, { status: 404 })
        }

        const brandDetails = BrandDetailsSchema.parse(brandRec.brand_data)

        const prompt = GENERATE_TITLES_PROMPT(keyword, articleType as ArticleType, brandDetails)

        const result = await genAI.models.generateContent({
            model: "gemini-2.0-flash-lite",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        })

        const responseText = result.text
        if (!responseText) {
            throw new Error("No response generated")
        }

        let json
        try {
            json = JSON.parse(responseText)
        } catch (e) {
            json = JSON.parse(jsonrepair(responseText))
        }

        return NextResponse.json({ titles: json.titles })

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("Title generation error:", e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
