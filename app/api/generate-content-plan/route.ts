import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { BrandDetails } from "@/lib/schemas/brand"
import { checkTopicDuplication } from "@/lib/topic-memory"
import { getCoverageContext, summarizeCoverage, INTENT_ROLES } from "@/lib/coverage/analyzer"

export const maxDuration = 300 // 5 minute timeout

// Intent Role Definitions with Weights
const INTENT_ROLE_CONFIG = {
    "Core Answer": {
        weight: 6,  // ~20% of plan
        description: "What is X? How does X work? Basic explanatory content",
        examples: ["What is AI photo restoration", "How AI restores old photos"],
        articleType: "informational" as const
    },
    "Decision": {
        weight: 5,  // ~17% 
        description: "Should I use X? Is X worth it? Trust-building content",
        examples: ["Is AI restoration worth it in 2025", "AI vs professional restoration"],
        articleType: "commercial" as const
    },
    "Comparison": {
        weight: 6,  // ~20%
        description: "X vs Y, Best tools. Commercial intent winners",
        examples: ["BringBack vs MyHeritage", "Best photo restoration tools 2025"],
        articleType: "commercial" as const
    },
    "Problem-Specific": {
        weight: 7,  // ~23% - Highest for long-tail coverage
        description: "Fix [specific issue]. Expands coverage without overlap",
        examples: ["Fix water damaged photos", "Restore blurry old photos"],
        articleType: "howto" as const
    },
    "Emotional/Use-Case": {
        weight: 3,  // ~10% - Quality over quantity
        description: "Human connection, emotional stories. Great for backlinks & AEO",
        examples: ["Bringing grandparents photos back to life", "Restoring family history"],
        articleType: "informational" as const
    },
    "Authority/Edge": {
        weight: 3,  // ~10% 
        description: "Deep expertise, edge cases, why things fail",
        examples: ["Why some photos can't be restored", "Common restoration mistakes"],
        articleType: "informational" as const
    }
} as const

type IntentRoleKey = keyof typeof INTENT_ROLE_CONFIG

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { seeds, brandData, brandId } = await req.json() as {
            seeds: string[],
            brandData: BrandDetails,
            brandId?: string
        }

        if (!seeds || !Array.isArray(seeds) || seeds.length === 0) {
            return NextResponse.json({ error: "Seeds are required" }, { status: 400 })
        }

        if (!brandData) {
            return NextResponse.json({ error: "Brand data is required" }, { status: 400 })
        }

        const today = new Date()
        const client = getGeminiClient()
        const currentDate = `${today.toLocaleDateString('en-US', { month: 'long' })} ${today.getFullYear()}`

        // --- STEP 1: FETCH EXISTING COVERAGE ---
        console.log("[Content Plan] Fetching existing coverage context...")
        const coverageData = await getCoverageContext(user.id, brandId || null)
        const { stronglyAnswered, partiallyAnswered, totalCoverage } = summarizeCoverage(coverageData)

        console.log(`[Content Plan] Coverage context: ${totalCoverage} total, ${stronglyAnswered.length} strong, ${partiallyAnswered.length} partial`)

        // Build coverage constraint for prompt
        const coverageConstraint = stronglyAnswered.length > 0
            ? `
## ALREADY COVERED (DO NOT DUPLICATE UNLESS NEW ANGLE)
The following questions are ALREADY strongly answered by existing content.
Do NOT create articles that simply re-answer these. Only cover them if you bring:
- A NEW audience angle (e.g., "for photographers" vs "for families")
- A NEW comparison angle (e.g., adding a new tool comparison)
- A NEW intent angle (e.g., from "what is" to "how to")

Already Covered:
${stronglyAnswered.map(q => `- ${q}`).join('\n')}
`
            : ""

        // --- STEP 2: BUILD INTENT-ROLE-BASED PROMPT ---
        const intentRoleSection = Object.entries(INTENT_ROLE_CONFIG).map(([role, config]) => {
            return `### ${role} (Target: ~${config.weight} articles)
Description: ${config.description}
Examples: ${config.examples.join(", ")}
Article Type: ${config.articleType}`
        }).join('\n\n')

        const prompt = `
You are a strategic content planner creating a 30-day content plan. [Current Date: ${currentDate}]

## BRAND CONTEXT
- Product: ${brandData.product_name}
- What it is: ${brandData.product_identity.literally}
- Target Audience: ${brandData.audience.primary}
- Unique Value: ${brandData.uvp.join(", ")}
- Voice/Style: ${brandData.style_dna || "Professional and informative"}

## SEED KEYWORDS & TOPICS FROM COMPETITOR RESEARCH
${seeds.join("\n")}
${coverageConstraint}

---

## THE 6 INTENT ROLES (CRITICAL - FOLLOW THE WEIGHTS)

You MUST distribute articles across these 6 intent roles. This ensures strategic diversity and avoids content cannibalization.

${intentRoleSection}

---

## MODERN TITLE RULES (FOLLOW THESE)

1. **Create curiosity, not clickbait** - Make the brain itch
2. **Use numbers when possible** - Numbers catch the eye
3. **Attack a pain point** - If reader feels pain, they click
4. **Keep title under 60 characters** - Short titles punch harder
5. **NO robotic words** - BANNED: "ultimate guide", "comprehensive", "definitive"
6. **Speak like a human** - Conversational, not corporate

---

## YOUR TASK

Generate exactly 30 blog posts distributed across the 6 Intent Roles based on their weights.

For each post provide:
1. title: A compelling blog post title
2. main_keyword: The primary target keyword (2-4 words)
3. supporting_keywords: 2-3 highly related keywords (array)
4. article_type: One of "informational", "commercial", or "howto"
5. cluster: Topic cluster/category for organization
6. intent_role: One of the 6 intent roles defined above

## DISTRIBUTION REQUIREMENT
- Core Answer: ~6 articles
- Decision: ~5 articles
- Comparison: ~6 articles
- Problem-Specific: ~7 articles
- Emotional/Use-Case: ~3 articles
- Authority/Edge: ~3 articles

Total = 30 articles

DO NOT create 30 articles that all answer the same core question with slight rephrasing. Each article must serve a DISTINCT strategic purpose.
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
                                    cluster: { type: "STRING" },
                                    intent_role: { type: "STRING" }
                                },
                                required: ["title", "main_keyword", "supporting_keywords", "article_type", "cluster", "intent_role"]
                            }
                        }
                    },
                    required: ["posts"]
                }
            }
        })

        const text = response.text || "{}"
        const result = JSON.parse(text)

        // Process posts and check for duplicates
        const validPosts: any[] = []
        const posts = result.posts || []

        // Track intent role distribution
        const roleDistribution: Record<string, number> = {}

        for (const post of posts) {
            // Check duplication using Title + Keyword for stronger semantic match
            const topicSignal = `${post.title || ""} : ${post.main_keyword || ""}`
            const { isDuplicate } = await checkTopicDuplication(topicSignal, user.id)

            if (!isDuplicate) {
                validPosts.push(post)
                // Track distribution
                const role = post.intent_role || "Unknown"
                roleDistribution[role] = (roleDistribution[role] || 0) + 1
            } else {
                console.log(`[Content Plan] Skipped duplicate topic: ${post.title}`)
            }

            if (validPosts.length >= 30) break
        }

        console.log(`[Content Plan] Intent Role Distribution:`, roleDistribution)

        // Add IDs and dates to each post
        const planItems: ContentPlanItem[] = validPosts.map((post: any, index: number) => {
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
                intent_role: post.intent_role || "Core Answer"
            }
        })

        return NextResponse.json({ plan: planItems, roleDistribution })
    } catch (error: any) {
        console.error("Content plan generation error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to generate content plan" },
            { status: 500 }
        )
    }
}
