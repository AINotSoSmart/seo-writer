import { createClient } from "@/utils/supabase/server"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { BrandDetails } from "@/lib/schemas/brand"
import { checkTopicDuplication } from "@/lib/topic-memory"
import { getCoverageContext, summarizeCoverage } from "@/lib/coverage/analyzer"
import { formatIdeaUniverseWithCoverage } from "@/lib/plans/idea-expansion"
import { detectContentStage, getStrategyPrompt } from "@/lib/plans/strategy-detector"

// Strategic Article Category Distribution (30 = 12 + 8 + 6 + 4)
export const ARTICLE_CATEGORIES = {
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

interface GeneratePlanParams {
    userId: string
    brandId: string
    brandData: BrandDetails
    seeds: string[]
    ideaUniverse?: string[] // Phase A: Expanded problem domains
    ideaCoverageMap?: Record<string, "heavy" | "light" | "none"> // Phase B: Competitor coverage
    existingContent?: string[] // Parent questions from sitemap
}

interface GeneratePlanResult {
    plan: ContentPlanItem[]
    categoryDistribution: Record<string, number>
}

/**
 * Core logic for generating a 30-day strategic content plan.
 * Used by both the API route (onboarding) and the Scheduler (auto-refill).
 */
export async function generateContentPlan({
    userId,
    brandId,
    brandData,
    seeds,
    ideaUniverse = [],
    ideaCoverageMap = {},
    existingContent = []
}: GeneratePlanParams): Promise<GeneratePlanResult> {
    const today = new Date()
    const client = getGeminiClient()
    const currentDate = `${today.toLocaleDateString('en-US', { month: 'long' })} ${today.getFullYear()}`

    // --- STEP 1: FETCH EXISTING COVERAGE ---
    console.log("[Content Plan] Fetching existing coverage context...")
    const coverageData = await getCoverageContext(userId, brandId)
    const { stronglyAnswered } = summarizeCoverage(coverageData)

    // Combine database coverage with sitemap-provided existing content
    const allCoveredQuestions = [
        ...stronglyAnswered,
        ...existingContent
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

    // --- STEP 2: DETECT CONTENT STAGE (GSC-ONLY) ---
    console.log("[Content Plan] Detecting content stage...")
    const { stage, hasGSC } = await detectContentStage(userId)
    const strategySection = getStrategyPrompt(stage, hasGSC)
    console.log(`[Content Plan] Stage: ${stage}, GSC Connected: ${hasGSC}`)

    // --- STEP 3: BUILD STRATEGIC PROMPT ---
    const categorySection = Object.entries(ARTICLE_CATEGORIES).map(([category, config]) => {
        return `### ${category} (~${config.count} articles)
Purpose: ${config.description}
Intent Roles: ${config.intentRoles.join(", ")}
Focus: ${config.prompt}`
    }).join('\n\n')

    // Format idea universe with coverage if available
    const ideaUniverseSection = ideaUniverse.length > 0
        ? `
## IDEA UNIVERSE WITH COMPETITOR VALIDATION (READ FIRST - CRITICAL)

These represent the broader problem spaces the audience lives in.
Competitor coverage indicates saturation level:
- 🟢 [NONE] = Untapped opportunity, PRIORITIZE these
- 🟡 [LIGHT] = Partial coverage, good opportunity
- 🔴 [HEAVY] = Crowded, only for comparisons/edge cases

${formatIdeaUniverseWithCoverage(ideaUniverse, ideaCoverageMap)}

**RULES:**
- PRIORITIZE domains marked NONE or LIGHT
- AVOID creating core articles in HEAVY domains
- Heavy domains allowed ONLY for: comparisons, edge cases, contrarian angles, expansions
- Think BEYOND the product — what else does this audience care about?
`
        : ""

    const prompt = `
You are an elite SEO strategist building a STRATEGIC content plan. [Current Date: ${currentDate}]

${strategySection}

## BRAND CONTEXT
- Product: ${brandData.product_name}
- What it is: ${brandData.product_identity.literally}
- Core Features/Products: ${brandData.core_features?.join(", ") || "Not specified"}
- Target Audience: ${brandData.audience.primary}
- Unique Value: ${brandData.uvp.join(", ")}
- Voice/Style: ${brandData.style_dna || "Professional and informative"}

${ideaUniverseSection}

## FEATURE COVERAGE REQUIREMENT

${brandData.core_features && brandData.core_features.length > 1 ? `
This brand has MULTIPLE distinct features/products:
${brandData.core_features.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")}

Distribute articles across ALL features proportionally.
` : "Focus deeply on the core product offering."}

## SEED KEYWORDS (SECONDARY INPUT)
Use these ONLY to validate demand and phrasing.
Do NOT let them restrict idea selection — the IDEA UNIVERSE above is your primary creative source.

${seeds.join("\n")}

${coverageSection}

---

## THE 4 STRATEGIC CATEGORIES (TARGET DISTRIBUTION: ~12 + ~8 + ~6 + ~4 = 30)

Aim for this distribution, but prioritize QUALITY over exact counts:

${categorySection}

If you have strong ideas that don't fit the exact count, adjust slightly. Quality > rigid quotas.

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

## TITLE RULES (MODERN SEO - 2025)

Create titles that DOMINATE in modern AI-powered search:

1. Use SPECIFIC numbers: "7 Ways..." not "Ways..."
2. Include YEAR when relevant: "...in 2025"
3. Attack a PAIN POINT: "Why Your [X] Keeps Failing"
4. Use POWER WORDS: "Proven", "Exact", "Secret", "Without", "Actually"
5. Keep under 60 characters

FORMAT PATTERNS (use variety):
- How-To: "How to [X] Without [Pain Point]"
- List: "[Number] [Adjective] Ways to [Benefit]"
- Comparison: "[X] vs [Y]: Which [Benefit] Better?"
- Question: "Is [X] Worth It? (Real Data Inside)"
- Problem: "Why [Common Approach] Doesn't Work (And What Does)"
- Contrarian: "[X] is Dead—Here's What Actually Works"

BANNED PATTERNS (NEVER USE):
- "What is X? (Explained)" - Too generic, boring
- "Ultimate Guide to X" - Overused, ignored by searchers
- "Everything You Need to Know About X" - Vague, no hook
- "A Comprehensive Look at X" - Academic, not engaging
- "The Complete Guide to X" - Same as ultimate guide

---

## YOUR TASK

Generate EXACTLY 30 articles distributed as follows (NO EXCEPTIONS):
- Core Answers: 12 articles (EMPTY parent questions only)
- Supporting Articles: 8 articles (expand coverage with how-tos)
- Conversion Pages: 6 articles (comparisons, decisions)
- Authority Plays: 4 articles (edge cases, stories)

For each article provide:
1. title: Compelling blog post title (follow MODERN SEO rules above)
2. main_keyword: Primary target keyword (2-4 words)
3. supporting_keywords: 2-3 related keywords (array)
4. article_type: "informational" | "commercial" | "howto"
5. cluster: Topic cluster for organization
6. intent_role: The specific intent ("Core Answer", "Problem-Specific", "Comparison", "Decision", "Emotional/Story", "Authority/Edge")
7. article_category: One of "Core Answers", "Supporting Articles", "Conversion Pages", "Authority Plays"
8. parent_question: The ONE fundamental user question this article answers

## CRITICAL REQUIREMENTS:
1. Each article's parent_question must be UNIQUE across the plan.
2. If the brand has multiple features, articles must be distributed across ALL features.
3. You MUST generate EXACTLY 30 articles with the 12-8-6-4 distribution.
`

    const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
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
        const { isDuplicate } = await checkTopicDuplication(topicSignal, userId, brandId)

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

    // --- CATEGORY-AWARE TOP-UP LOOP ---
    // If we have fewer than 30 articles, make a second call with specific category requirements
    if (validPosts.length < 30 && validPosts.length >= 15) {
        const targetDistribution = {
            "Core Answers": 12,
            "Supporting Articles": 8,
            "Conversion Pages": 6,
            "Authority Plays": 4
        }

        const neededByCategory = {
            "Core Answers": Math.max(0, targetDistribution["Core Answers"] - categoryDistribution["Core Answers"]),
            "Supporting Articles": Math.max(0, targetDistribution["Supporting Articles"] - categoryDistribution["Supporting Articles"]),
            "Conversion Pages": Math.max(0, targetDistribution["Conversion Pages"] - categoryDistribution["Conversion Pages"]),
            "Authority Plays": Math.max(0, targetDistribution["Authority Plays"] - categoryDistribution["Authority Plays"])
        }

        const totalNeeded = 30 - validPosts.length

        console.log(`[Content Plan] Only ${validPosts.length} articles generated, requesting ${totalNeeded} more...`)
        console.log(`[Content Plan] Needed by category:`, neededByCategory)

        const existingTitles = validPosts.map(p => p.title).join('\n')

        const topUpPrompt = `
You must generate EXACTLY ${totalNeeded} more articles to complete a 30-day content plan.

## CATEGORY REQUIREMENTS (MANDATORY)
Generate articles in these specific categories:
${neededByCategory["Core Answers"] > 0 ? `- Core Answers: ${neededByCategory["Core Answers"]} more needed` : ''}
${neededByCategory["Supporting Articles"] > 0 ? `- Supporting Articles: ${neededByCategory["Supporting Articles"]} more needed` : ''}
${neededByCategory["Conversion Pages"] > 0 ? `- Conversion Pages: ${neededByCategory["Conversion Pages"]} more needed` : ''}
${neededByCategory["Authority Plays"] > 0 ? `- Authority Plays: ${neededByCategory["Authority Plays"]} more needed` : ''}

## BRAND CONTEXT
- Product: ${brandData.product_name}
- Features: ${brandData.core_features?.join(", ") || "Not specified"}
- Audience: ${brandData.audience.primary}

## EXISTING ARTICLES (DO NOT DUPLICATE)
${existingTitles}

## YOUR TASK
Generate EXACTLY ${totalNeeded} unique articles following the category requirements above.
Each article needs: title, main_keyword, supporting_keywords, article_type, cluster, intent_role, article_category, parent_question
`

        try {
            const topUpResponse = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: topUpPrompt }] }],
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
                                        supporting_keywords: { type: "ARRAY", items: { type: "STRING" } },
                                        article_type: { type: "STRING" },
                                        cluster: { type: "STRING" },
                                        intent_role: { type: "STRING" },
                                        article_category: { type: "STRING" },
                                        parent_question: { type: "STRING" }
                                    },
                                    required: ["title", "main_keyword", "article_type", "article_category"]
                                }
                            }
                        },
                        required: ["posts"]
                    }
                }
            })

            const topUpText = topUpResponse.text || "{}"
            const topUpResult = JSON.parse(topUpText)
            const additionalPosts = topUpResult.posts || []

            console.log(`[Content Plan] Top-up generated ${additionalPosts.length} additional articles`)

            for (const post of additionalPosts) {
                if (validPosts.length >= 30) break
                // Skip duplicates
                const isDupe = validPosts.some(p => p.title === post.title || p.main_keyword === post.main_keyword)
                if (!isDupe) {
                    validPosts.push(post)
                    const category = post.article_category || "Core Answers"
                    if (category in categoryDistribution) {
                        categoryDistribution[category]++
                    }
                }
            }

            console.log(`[Content Plan] After top-up: ${validPosts.length} total articles`)
        } catch (topUpError) {
            console.error("[Content Plan] Top-up failed:", topUpError)
        }
    }

    console.log(`[Content Plan] Final Category Distribution:`, categoryDistribution)

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

    return { plan: planItems, categoryDistribution }
}
