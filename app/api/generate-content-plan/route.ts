import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { BrandDetails } from "@/lib/schemas/brand"

export const maxDuration = 300 // 5 minute timeout

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { seeds, brandData } = await req.json() as { seeds: string[], brandData: BrandDetails }

        if (!seeds || !Array.isArray(seeds) || seeds.length === 0) {
            return NextResponse.json({ error: "Seeds are required" }, { status: 400 })
        }

        if (!brandData) {
            return NextResponse.json({ error: "Brand data is required" }, { status: 400 })
        }

        const today = new Date()
        const client = getGeminiClient()

        const prompt = `
You are a content strategist creating a 30-day content plan for a brand.

BRAND CONTEXT:
- Product: ${brandData.product_name}
- What it is: ${brandData.product_identity.literally}
- Target Audience: ${brandData.audience.primary}
- Unique Value: ${brandData.uvp.join(", ")}
- Voice/Tone: ${brandData.voice_tone.join(", ")}

SEED KEYWORDS & TOPICS FROM COMPETITOR RESEARCH:
${seeds.join("\n")}

Generate exactly 30 blog posts for a 30-day content calendar.

For each post provide:
1. title: A compelling, SEO-optimized blog post title
2. main_keyword: The primary target keyword (2-4 words)
3. supporting_keywords: 2-3 related keywords (array)
4. intent: One of "informational", "comparison", "tutorial", or "commercial"
5. cluster: Topic cluster/category for organization

Guidelines:
- Mix of intent types: mostly informational (60%), some tutorials (25%), few commercial (15%)
- Titles should be specific and actionable
- Keywords should be realistic search terms
- Group related posts into clusters
- Build topical authority progressively
- Include competitive posts that target competitor keywords
- Create content gaps the brand should fill
`

        const response = await client.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        posts: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    title: { type: "STRING" },
                                    main_keyword: { type: "STRING" },
                                    supporting_keywords: {
                                        type: "ARRAY",
                                        items: { type: "STRING" }
                                    },
                                    intent: { type: "STRING" },
                                    cluster: { type: "STRING" }
                                },
                                required: ["title", "main_keyword", "supporting_keywords", "intent", "cluster"]
                            }
                        }
                    },
                    required: ["posts"]
                }
            }
        })

        const text = response.text || "{}"
        const result = JSON.parse(text)

        // Add IDs and dates to each post
        const planItems: ContentPlanItem[] = (result.posts || []).slice(0, 30).map((post: any, index: number) => {
            const scheduledDate = new Date(today)
            scheduledDate.setDate(today.getDate() + index)

            // Validate intent
            const validIntents = ["informational", "comparison", "tutorial", "commercial"]
            const intent = validIntents.includes(post.intent) ? post.intent : "informational"

            return {
                id: `plan-${Date.now()}-${index}`,
                title: post.title || `Post ${index + 1}`,
                main_keyword: post.main_keyword || "",
                supporting_keywords: post.supporting_keywords || [],
                intent: intent as "informational" | "comparison" | "tutorial" | "commercial",
                cluster: post.cluster || "General",
                scheduled_date: scheduledDate.toISOString().split("T")[0],
                status: "pending" as const,
            }
        })

        return NextResponse.json({ plan: planItems })
    } catch (error: any) {
        console.error("Content plan generation error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to generate content plan" },
            { status: 500 }
        )
    }
}
