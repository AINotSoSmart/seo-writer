import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
import { jsonrepair } from "jsonrepair"
import { ArticleType } from "@/lib/prompts/article-types"
import { getTitlePrompt } from "@/lib/prompts/strategies"
import { getCurrentDateContext } from "@/lib/utils/date-context"

const genAI = getGeminiClient()

const GENERATE_TITLES_PROMPT = (keyword: string, articleType: ArticleType, brandDetails: any = null) => `
You are an expert SEO Copywriter.
Your goal is to generate 5 SEO-optimized, AI-search-ready blog post titles for a specific keyword.

INPUT CONTEXT:
1. KEYWORD: "${keyword}"
2. ARTICLE TYPE: ${articleType.toUpperCase()}
3. ${getCurrentDateContext()}
${brandDetails ? `4. BRAND: ${brandDetails.product_name}` : ""}

CRITICAL SEO RULES (MANDATORY - VIOLATING THESE = FAILURE):

1. **INCLUDE PRIMARY KEYWORD:** The exact keyword "${keyword}" (or close natural variant) MUST appear in the title.

2. **FRONT-LOAD KEYWORD:** Place the keyword as early as possible in the title.

3. **NO SPECIAL PUNCTUATION - BANNED CHARACTERS:**
   - ❌ Colons (:)
   - ❌ Semicolons (;)
   - ❌ Parentheses ()
   - ❌ Single quotes ('')
   - ❌ Em-dashes (—)
   - ✅ ONLY commas are allowed if grammatically natural

4. **SINGLE FLOWING SENTENCE:** Title must read as one smooth, natural sentence - NOT two parts split by punctuation.

5. **50-60 CHARACTERS MAX:** Keep titles concise for full SERP visibility.

6. **NO CLICKBAIT PATTERNS:**
   - ❌ "The X Nobody Talks About"
   - ❌ "Here's Why..."
   - ❌ "You Won't Believe..."
   - ❌ Questions that don't include the keyword

7. **WRITE LIKE A SEARCH RESULT:** Titles should match what users type into Google/AI search.

TYPE-SPECIFIC INSTRUCTIONS:
${getTitlePrompt(articleType, keyword)}

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
