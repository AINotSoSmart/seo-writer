import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { BrandDetails } from "@/lib/schemas/brand"
import { checkTopicDuplication } from "@/lib/topic-memory"
import { getCoverageContext, summarizeCoverage } from "@/lib/coverage/analyzer"

export const maxDuration = 300 // 5 minute timeout

// Strategic Article Category Distribution (30 = 12 + 8 + 6 + 4)
const ARTICLE_CATEGORIES = {
    "Core Answers": {
        count: 12,
        description: "Foundation articles that establish topical authority",
        intentRoles: ["Core Answer", "Definition"],
        articleType: "informational" as const,
        prompt: "Answer fundamental 'What is X?' and 'How does X work?' questions"
    },
    "Supporting Articles": {
        count: 8,
        description: "Deepen existing coverage with specific problems and tutorials",
        intentRoles: ["Problem-Specific", "How-To"],
        articleType: "howto" as const,
        prompt: "Create step-by-step guides and solve specific user problems"
    },
    "Conversion Pages": {
        count: 6,
        description: "Commercial intent - comparisons and buying decisions",
        intentRoles: ["Comparison", "Decision"],
        articleType: "commercial" as const,
        prompt: "Help users choose between options and make buying decisions"
    },
    "Authority Plays": {
        count: 4,
        description: "Edge cases, deep expertise, and emotional stories",
        intentRoles: ["Authority/Edge", "Emotional/Story"],
        articleType: "informational" as const,
        prompt: "Establish expert positioning with edge cases and compelling stories"
    }
} as const

type ArticleCategoryKey = keyof typeof ARTICLE_CATEGORIES

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { seeds, brandData, brandId, existingContent } = await req.json() as {
            seeds: string[],
            brandData: BrandDetails,
            brandId?: string,
            existingContent?: string[] // Parent questions from sitemap
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
        const { stronglyAnswered, partiallyAnswered } = summarizeCoverage(coverageData)

        // Combine database coverage with sitemap-provided existing content
        const allCoveredQuestions = [
            ...stronglyAnswered,
            ...(existingContent || [])
        ]

        console.log(`[Content Plan] Total covered questions: ${allCoveredQuestions.length}`)

        // Build coverage clusters: SATURATED / PARTIAL / EMPTY
        const coverageSection = allCoveredQuestions.length > 0
            ? `
## COVERAGE STATE (CRITICAL - READ CAREFULLY)

The following parent questions are ALREADY COVERED on the user's site.
DO NOT create articles that simply re-answer these questions.

**SATURATED (DO NOT TARGET DIRECTLY):**
${allCoveredQuestions.slice(0, 20).map(q => `- "${q}"`).join('\n')}
${allCoveredQuestions.length > 20 ? `\n... and ${allCoveredQuestions.length - 20} more covered questions` : ''}

**YOUR STRATEGY:**
- For saturated topics: Only create EXPANSION articles (edge cases, comparisons, specific problems)
- For new topics: Create Core Answers FIRST
- DO NOT duplicate existing coverage

**EXPANSION RULES (For saturated topics):**
a) Expand the perimeter (new sub-question)
b) Support internally (linking-focused article)
c) Attack a comparison (X vs Y)
d) Address edge cases (why X fails)
`
            : ""

        // --- STEP 2: BUILD STRATEGIC PROMPT ---
        const categorySection = Object.entries(ARTICLE_CATEGORIES).map(([category, config]) => {
            return `### ${category} (${config.count} articles)
Purpose: ${config.description}
Intent Roles: ${config.intentRoles.join(", ")}
Focus: ${config.prompt}`
        }).join('\n\n')

        const prompt = `
You are an elite SEO strategist building a STRATEGIC content plan. [Current Date: ${currentDate}]

## BRAND CONTEXT
- Product: ${brandData.product_name}
- What it is: ${brandData.product_identity.literally}
- Target Audience: ${brandData.audience.primary}
- Unique Value: ${brandData.uvp.join(", ")}
- Voice/Style: ${brandData.style_dna || "Professional and informative"}

## SEED KEYWORDS & TOPICS
${seeds.join("\n")}

${coverageSection}

---

## THE 4 STRATEGIC CATEGORIES (30 = 12 + 8 + 6 + 4)

This is NOT a random list of keywords. This is a CONTENT ARCHITECTURE.

${categorySection}

---

## ANTI-CANNIBALIZATION RULES (CRITICAL)

Each article must answer a DIFFERENT parent question. Examples of SAME parent question (BAD):
- "How to restore old photos" = "What is AI photo restoration" = "Does AI enhancement work"
These all answer: "Can AI restore my photos?"

Examples of DIFFERENT parent questions (GOOD):
- "Can AI restore my photos?" (Core Answer)
- "How much does restoration cost?" (Core Answer - DIFFERENT)
- "AI vs professional restoration?" (Conversion)
- "Why some photos can't be restored?" (Authority)

---

## TITLE RULES

1. Create curiosity - make the brain itch
2. Use numbers when possible
3. Attack a pain point
4. Keep under 60 characters
5. BANNED: "ultimate guide", "comprehensive", "definitive", "everything you need"
6. Speak like a human

---

## YOUR TASK

Generate EXACTLY 30 articles distributed as follows:
- Core Answers: 12 articles (EMPTY parent questions only)
- Supporting Articles: 8 articles (expand coverage with how-tos)
- Conversion Pages: 6 articles (comparisons, decisions)
- Authority Plays: 4 articles (edge cases, stories)

For each article provide:
1. title: Compelling blog post title
2. main_keyword: Primary target keyword (2-4 words)
3. supporting_keywords: 2-3 related keywords (array)
4. article_type: "informational" | "commercial" | "howto"
5. cluster: Topic cluster for organization
6. intent_role: The specific intent ("Core Answer", "Problem-Specific", "Comparison", "Decision", "Emotional/Story", "Authority/Edge")
7. article_category: One of "Core Answers", "Supporting Articles", "Conversion Pages", "Authority Plays"
8. parent_question: The ONE fundamental user question this article answers

## CRITICAL: Each article's parent_question must be UNIQUE across the plan.
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
                                    intent_role: { type: "STRING" },
                                    article_category: { type: "STRING" },
                                    parent_question: { type: "STRING" }
                                },
                                required: ["title", "main_keyword", "supporting_keywords", "article_type", "cluster", "intent_role", "article_category", "parent_question"]
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

        // Track distribution
        const categoryDistribution: Record<string, number> = {
            "Core Answers": 0,
            "Supporting Articles": 0,
            "Conversion Pages": 0,
            "Authority Plays": 0
        }
        const seenParentQuestions = new Set<string>()

        for (const post of posts) {
            // Skip if parent question already seen in this plan
            const normalizedPQ = (post.parent_question || "").toLowerCase().trim()
            if (seenParentQuestions.has(normalizedPQ)) {
                console.log(`[Content Plan] Skipped duplicate parent question: ${post.parent_question}`)
                continue
            }

            // Check duplication against existing articles
            const topicSignal = `${post.title || ""} : ${post.main_keyword || ""}`
            const { isDuplicate } = await checkTopicDuplication(topicSignal, user.id, brandId)

            if (!isDuplicate) {
                validPosts.push(post)
                seenParentQuestions.add(normalizedPQ)

                // Track distribution
                const category = post.article_category || "Core Answers"
                if (category in categoryDistribution) {
                    categoryDistribution[category]++
                }
            } else {
                console.log(`[Content Plan] Skipped duplicate topic: ${post.title}`)
            }

            if (validPosts.length >= 30) break
        }

        // Ensure minimum 30 posts - fallback if dedup too aggressive
        if (validPosts.length < 20 && posts.length >= 30) {
            console.warn("[Content Plan] Deduplication too aggressive, using additional posts")
            for (const post of posts) {
                if (validPosts.length >= 30) break
                if (!validPosts.includes(post)) {
                    validPosts.push(post)
                    const category = post.article_category || "Core Answers"
                    if (category in categoryDistribution) {
                        categoryDistribution[category]++
                    }
                }
            }
        }

        console.log(`[Content Plan] Category Distribution:`, categoryDistribution)

        // Add IDs, dates, and categories to each post
        const planItems: ContentPlanItem[] = validPosts.map((post: any, index: number) => {
            const scheduledDate = new Date(today)
            scheduledDate.setDate(today.getDate() + index)

            // Validate article_type
            const validTypes = ["informational", "commercial", "howto"]
            const articleType = validTypes.includes(post.article_type) ? post.article_type : "informational"

            // Validate article_category
            const validCategories = ["Core Answers", "Supporting Articles", "Conversion Pages", "Authority Plays"]
            const articleCategory = validCategories.includes(post.article_category)
                ? post.article_category
                : "Core Answers"

            return {
                id: `plan-${Date.now()}-${index}`,
                title: post.title || `Post ${index + 1}`,
                main_keyword: post.main_keyword || "",
                supporting_keywords: post.supporting_keywords || [],
                article_type: articleType as "informational" | "commercial" | "howto",
                cluster: post.cluster || "General",
                scheduled_date: scheduledDate.toISOString().split("T")[0],
                status: "pending" as const,
                intent_role: post.intent_role || "Core Answer",
                article_category: articleCategory as "Core Answers" | "Supporting Articles" | "Conversion Pages" | "Authority Plays"
            }
        })

        return NextResponse.json({ plan: planItems, categoryDistribution })
    } catch (error: any) {
        console.error("Content plan generation error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to generate content plan" },
            { status: 500 }
        )
    }
}
