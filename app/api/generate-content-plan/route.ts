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
        const currentDate = `${today.toLocaleDateString('en-US', { month: 'long' })} ${today.getFullYear()}`

        const prompt = `
You are a content strategist creating a 30-day content plan for a brand. [Current Date: ${currentDate}]

BRAND CONTEXT:
- Product: ${brandData.product_name}
- What it is: ${brandData.product_identity.literally}
- Target Audience: ${brandData.audience.primary}
- Unique Value: ${brandData.uvp.join(", ")}
- Voice/Style: ${brandData.style_dna || "Professional and informative"}

SEED KEYWORDS & TOPICS FROM COMPETITOR RESEARCH:
${seeds.join("\n")}

Generate exactly 30 blog posts for a 30-day content calendar.

---

## MODERN TITLE RULES (CRITICAL - FOLLOW THESE):

1. **Create curiosity, not clickbait** - Make the brain itch. Example: "Why Most AI Blogs Die In 60 Days"
2. **Use numbers when possible** - Numbers catch the eye. Example: "7 Brutal Lessons I Learned Building SaaS Alone"
3. **Attack a pain point** - If reader feels pain, they click. Example: "Your SEO Traffic Is Dying Because You Still Do This"
4. **Add contrast (old vs new)** - Example: "Most People Still Do SEO Wrong. Here's The Fix"
5. **Keep title under 60 characters** - Short titles punch harder and rank better
6. **Remove weak words** - Avoid: very, really, extremely, maybe, possibly
7. **Promise a result** - Example: "How To 3x Your Blog Traffic Without Posting Daily"
8. **NO robotic words** - BANNED: "ultimate guide", "comprehensive", "definitive", "complete guide"
9. **Use ONE power word max** - brutal, hidden, secret, insane (too many = cringe guru)
10. **Speak like a human** - Conversational, not corporate. Example: "I Stopped Using ChatGPT For SEO And Something Crazy Happened"
11. **Add mini conflict** - A tiny fight makes it spicy. Example: "AI Writers Are Good But This One Problem Kills Them"
12. **Don't reveal the answer** - Make them curious enough to click

---

For each post provide:
1. title: A compelling blog post title FOLLOWING THE RULES ABOVE
2. main_keyword: The primary target keyword (2-4 words)
3. supporting_keywords: 2-3 related keywords (array)
4. article_type: One of "informational", "commercial", or "howto"
   - informational: Educational, deep dive, what/why content
   - commercial: Product comparison, reviews, best-of listicles
   - howto: Step-by-step tutorials, guides
5. cluster: Topic cluster/category for organization

Guidelines:
- Mix of types: informational (60%), howto (25%), commercial (15%)
- Keywords should be realistic search terms
- Group related posts into clusters
- Build topical authority progressively
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
                                    article_type: { type: "STRING" },
                                    cluster: { type: "STRING" }
                                },
                                required: ["title", "main_keyword", "supporting_keywords", "article_type", "cluster"]
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

            // Validate article_type
            const validTypes = ["informational", "commercial", "howto"]
            const articleType = validTypes.includes(post.article_type) ? post.article_type : "informational"

            return {
                id: `plan-${Date.now()}-${index}`,
                title: post.title || `Post ${index + 1}`,
                main_keyword: post.main_keyword || "",
                supporting_keywords: post.supporting_keywords || [],
                article_type: articleType as "informational" | "commercial" | "howto",
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
