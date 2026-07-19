
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { BrandDetails } from "@/lib/schemas/brand"
import { checkTopicDuplication } from "@/lib/topic-memory"
import { getCoverageContext, summarizeCoverage } from "@/lib/coverage/analyzer"
import { scheduleByCluster, consolidateClusters } from "@/lib/plans/cluster-scheduler"
import { TopicHierarchy } from "@/lib/plans/topic-hierarchy"
import { checkSitemapDuplication } from "@/lib/internal-linking"
import { validateArticleKeywords } from "@/lib/plans/keyword-validator"

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
        description: "Commercial comparisons based on UNIQUE TESTING or DATA (Proprietary Analysis)",
        intentRoles: ["Comparison", "Decision"],
        articleType: "commercial" as const,
        prompt: "Frame comparisons as 'We Tested', 'Cost Analysis', or 'Experiments', NOT generic 'Vs'"
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
    brandId: string | null
    brandData: BrandDetails
    seeds: string[]
    competitorBrands?: Array<{ name: string; url?: string }>
    gapAnalysis?: {
        blueOceanTopics?: string[]
        saturatedTopics?: string[]
        competitorWeaknesses?: string[]
    }
    topicHierarchy?: TopicHierarchy
    existingContent?: string[]
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
    competitorBrands = [],
    gapAnalysis = {},
    topicHierarchy,
    existingContent = []
}: GeneratePlanParams): Promise<GeneratePlanResult> {
    const today = new Date()
    const client = getGeminiClient()
    const currentDate = `${today.toLocaleDateString('en-US', { month: 'long' })} ${today.getFullYear()}`

    // --- STEP 1: FETCH EXISTING COVERAGE ---
    const coverageData = await getCoverageContext(userId, brandId)
    const { stronglyAnswered } = summarizeCoverage(coverageData)

    // Combine database coverage with valid answered questions
    // [MODIFIED] Removed existingContent (sitemap titles) from prompt context to rely on VECTOR deduplication instead
    const allCoveredQuestions = [
        ...stronglyAnswered
    ]

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
        return `### ${category} (~${config.count} articles)
Purpose: ${config.description}
Intent Roles: ${config.intentRoles.join(", ")}
Focus: ${config.prompt}`
    }).join('\n\n')

    // Format competitor brands section
    const competitorSection = competitorBrands.length > 0
        ? `
## COMPETITOR BRANDS (FOR VS-ARTICLES - USE EXACT NAMES)

These are REAL competitors identified from search results:
${competitorBrands.map(c => `- ${c.name}${c.url ? ` (${c.url})` : ''}`).join('\n')}

RULES:
- Use EXACT competitor names in comparison articles (e.g., "${brandData.product_name} vs ${competitorBrands[0]?.name || 'Competitor'}")
- DO NOT use placeholders like "[Generic Competitor Tool]"
- Create at least 2-3 comparison articles against these competitors, compititor vs compititor and brand ${brandData.product_name} vs compititor
`
        : ""

    // Format gap analysis section
    const gapSection = (gapAnalysis.blueOceanTopics?.length || gapAnalysis.competitorWeaknesses?.length)
        ? `
## GAP ANALYSIS (STRATEGIC INTELLIGENCE)

${gapAnalysis.blueOceanTopics?.length ? `**BLUE OCEAN OPPORTUNITIES (PRIORITIZE THESE):**
Topics with low/no competitor coverage - easy wins:
${gapAnalysis.blueOceanTopics.slice(0, 10).map(t => `- ${t}`).join('\n')}
` : ''}

${gapAnalysis.competitorWeaknesses?.length ? `**COMPETITOR WEAKNESSES (ATTACK THESE):**
Topics where competitors are weak - opportunity for better content:
${gapAnalysis.competitorWeaknesses.slice(0, 5).map(t => `- ${t}`).join('\n')}
` : ''}

${gapAnalysis.saturatedTopics?.length ? `**SATURATED TOPICS (AVOID OR DO 10X BETTER):**
Heavy competition - only target if you have unique angle:
${gapAnalysis.saturatedTopics.slice(0, 5).map(t => `- ${t}`).join('\n')}
` : ''}
` : ""

    // --- LAYER 1: SYSTEM PROMPT WITH AEO TITLE RULES ---
    const systemPrompt = `You are an AEO (Answer Engine Optimization) content strategist.
Your goal: Generate content that AI search engines (ChatGPT, Perplexity, Google AI) will CITE.

TITLE RULES (NON-NEGOTIABLE - VIOLATIONS WILL NOT BE CITED BY AI):
1. NEVER use generic fluff: "Everything You Need to Know", "Ultimate Guide", "Complete Guide"
2. NEVER use "[Keyword]: [Subtitle]" format - AI interprets this as spam
3. EVERY title MUST contain SPECIFIC VALUE: a number, cost, time, result, or personal experience
4. WRITE for AI citation: Titles should be quotable as direct answers
5. IMPLY authority through experience: "We Tested", "I Tried", "Based on [X] Users", "[Year] Data"

EXAMPLES OF AI-CITABLE TITLES:
✅ "I Tested 5 AI Headshot Tools—Here's Which One Looks Real"
✅ "AI Headshots Cost $29. Pro Photographers Cost $300. Here's the Difference"
✅ "Should You Use AI Headshots on LinkedIn? (Recruiter Survey)"

EXAMPLES THAT AI WILL NOT CITE:
❌ "AI Headshots: Everything You Need to Know"
❌ "The Ultimate Guide to AI Headshots"
❌ "What Are AI Headshots?"`

    const prompt = `
## TITLE QUALITY MANDATE (AEO/GEO - READ FIRST)

AI search engines (ChatGPT, Perplexity, Google AI Overviews) will ONLY cite content with high-quality titles.

### 🛑 BANNED TITLE PATTERNS (INSTANT DISQUALIFICATION):
- ❌ "[Keyword]: [Subtitle]" (e.g., "AI Photoshoot: A Complete Guide")
- ❌ "[Keyword] - [Subtitle]" (e.g., "AI Photoshoot - The Future of Photography")
- ❌ "The Ultimate Guide to [Keyword]"
- ❌ "Everything You Need to Know About [Keyword]"
- ❌ "Complete Guide to [Keyword]"
- ❌ "Unlocking the Power of [Keyword]"
- ❌ "X vs Y: Which is Better?" (generic comparison)
- ❌ "What is [Keyword]?" (Definition without value)
- ❌ "[Keyword] Price Guide" (generic pricing)

### ✅ AI-CITABLE TITLE PATTERNS (USE THESE):
1. **Experience-Based:** "I Tested 5 AI Headshot Tools—One Looks Fake"
2. **Cost Comparison:** "AI Headshots Cost $29. Pro Photographers Cost $300. Here's Why"
3. **Decision Question:** "Should I Use AI Headshots for LinkedIn? (Recruiter Survey)"
4. **Specific Outcome:** "Get Professional Headshots From Selfies in 10 Minutes"
5. **Problem-Solution:** "Why Your AI Photos Look Fake (And How to Fix It)"
6. **Data-Backed:** "We Analyzed 500 LinkedIn Profiles—Here's What Makes Photos Work"
7. **Honest Warning:** "When You Should NOT Use AI Headshots (And What to Do Instead)"
8. **Worth It Evaluation:** "Is a $30 AI Headshot Worth It vs a $300 Photographer?"
9. **Comparison with Testing:** "HeadshotPro vs Aragon: We Spent $100 Testing Both"
10. **For Specific Persona:** "AI Headshots for Realtors: Do Clients Actually Care?"

### TITLE QUALITY RULES:
- Every title MUST contain SPECIFIC VALUE (number, cost, time, or result)
- Titles should be quotable as direct answers
- 40-60 characters is optimal. Never exceed 70.
- Write titles that would work on Reddit or YouTube

---

You are an elite SEO strategist building a STRATEGIC content plan. [Current Date: ${currentDate}]

---

## STRATEGIC PRIORITY (THIS DEFINES YOUR MINDSET)

You are NOT here to explain product features.
You are here to CAPTURE MARKET DEMAND and EXPAND TOPICAL AUTHORITY.

Your job:
1. Enter conversations where the audience ALREADY exists
2. Answer questions the audience is ALREADY asking
3. Fill gaps that competitors have NOT covered

Brand features should ONLY appear when they naturally support existing demand.
Do NOT create articles just to explain features unless explicit demand exists.

THINK LIKE A STRATEGIST:
- What must exist on this site BEFORE other articles make sense?
- What questions MUST be answered for the audience to trust this brand?
- What will AI systems cite as the CANONICAL answer?

---

## DECISION-STAGE CONTENT (AI CITATION PRIORITY)

AI systems cite content that answers DECISION questions, not curiosity questions.

PRIORITIZE these question patterns:
- "Should I use X?" (Decision)
- "When should I NOT use X?" (Risk awareness)
- "What can go wrong with X?" (Objection handling)
- "X vs Y - which is better for Z?" (Comparison)
- "How much does X cost?" (Practical)
- "Is X worth it for [specific situation]?" (Contextual decision)

DEPRIORITIZE these patterns:
- "What is X?" (Only 1-2 if truly foundational)
- "Why X is cool/amazing" (Low citation value)
- "The future of X" (Speculative, not actionable)

---

${competitorSection}

${gapSection}

${coverageSection}

${topicHierarchy ? `
## THE BLUEPRINT: TOPIC HIERARCHY (MANDATORY)
Follow this hierarchy EXACTLY. For each topic provided, generate the necessary SEO metadata.

**TOPICS TO GENERATE:**
${topicHierarchy.nodes.map((n: any) => `- Topic: "${n.topic}" (Type: ${n.type}, Intent: ${n.intentRole}, Priority: ${n.priority})`).join('\n')}

**RULES:**
1. You MUST generate exactly one article for each Topic in the list above.
2. **TITLE FREEDOM:** The "Topic" string above is just the *subject*. You MUST rewrite it into a **High-CTR Title** using the "NATURAL LANGUAGE PROTOCOL" below.
   - Blueprint: "Best AI Family Portrait Generator"
   - Your Title: "Best AI Family Portrait Generator From Individual Photos Compared" (Better)
3. DO NOT invent new topics if the hierarchy has 30 topics.
3. The "cluster" for each article should group related topics logically (e.g., all topics about "Privacy" go into a "Privacy" cluster).
` : ''}

## SEED KEYWORDS (VALIDATION ONLY)
Use these to confirm demand exists, NOT to drive topic selection.
The GAP ANALYSIS above is your primary strategic source.

${seeds.join("\\n")}


## THE GROUNDING PRINCIPLE (MANDATORY)

You are strictly forbidden from inventing features, capabilities, or claims about this brand.
Every article topic and claim must be directly supported by the brand data provided.

1. **STRICT GROUNDING:** Do not assume the product has any feature, tool, or integration not explicitly mentioned in the "Core Features" or "What it is" sections.
2. **NO INVENTED STANDARDS:** Do not write about legal, technical, or industry standards (e.g. HIPAA, ISO, specialized certifications) unless the brand explicitly claims them.
3. **NO GUESSWORK:** If you aren't 100% sure the brand does something, don't include it in the plan.
4. **BRAND HONESTY:** It is better to have a shorter, more focused plan than one filled with "creative" guesses that are factually incorrect.

If an article title or keyword implies a capability the brand does not clearly have, the plan is invalid.


## FEATURE LIMIT (MANDATORY CONSTRAINT)

You may create AT MOST 4 feature-led articles in the entire 30-day plan.

A "feature-led article" is one where:
- The title mentions a user intent based feature name not a technical term
- The primary purpose is explaining how a specific feature works
- The topic wouldn't exist without this specific product

Examples of feature-led (COUNT TOWARD LIMIT):
- "What is AI Identity-Lock Protocol"
- "How Multi-Ratio Formatting Works"

Examples of market-led (DO NOT COUNT):
- "AI Headshots vs Professional Photography: Cost Breakdown"
- "Why Your LinkedIn Photo Isn't Getting Responses"

If you create more than 4 feature-led articles, the plan is INVALID.

---

## THE 4 STRATEGIC CATEGORIES (TARGET DISTRIBUTION: ~12 + ~8 + ~6 + ~4 = 30)

Aim for this distribution, but prioritize QUALITY over exact counts:

${categorySection}

If you have strong ideas that don't fit the exact count, adjust slightly. Quality > rigid quotas.

---

## ANTI-CANNIBALIZATION RULES (CRITICAL)

Each article must answer a DIFFERENT **intent cluster**. Similar wordings that address the SAME user concern = DUPLICATION.

**THE INTENT CLUSTER TEST:**
Before adding an article, ask: "What is the user's CORE CONCERN?"
- If two articles address the same core concern, they are duplicates—even if titles differ.

**COMMON DUPLICATION TRAPS (AVOID THESE):**

These are the SAME intent cluster → **PICK ONE, cover others as H2 sections:**
- "Is [Product] trustworthy?" = "Is [Product] legit?" = "Can I trust [Product]?" = "Is [Product] safe?"
- "How to get started with [Product]" = "Getting started guide" = "Beginner's tutorial" = "First steps"
- "Best settings for [Product]" = "Optimal configuration" = "How to set up [Product]"
- "[Product] vs [Competitor]" articles should NOT repeat with different framings of same comparison

**VALID DIFFERENT INTENT CLUSTERS:**
| Intent Cluster | What Makes It Unique |
|----------------|---------------------|
| "What is this?" | Foundational definition |
| "Is it worth it?" | Value/cost decision |
| "How do I use it?" | Usage tutorial |
| "Which one is best?" | Comparison/alternatives |
| "[Persona] specific" | Different audience = different article OK |
| "[Use case] specific" | Different context = different article OK |

**RULE:** You may have multiple persona-specific articles (e.g., "for marketers", "for developers", "for small business") because they are DIFFERENT audiences. But you may NOT have multiple trust/legitimacy articles with different framings.

---

## KEYWORD FORMAT RULES (CRITICAL — READ BEFORE GENERATING)

The main_keyword MUST be a query a real human would type into Google.

### ❌ KEYWORD-STUFFED (INSTANTLY REJECTED):
- "circadian rhythm smart home blinds" ← Nobody searches 5 jammed-together nouns
- "automated shades for light management" ← Corporate jargon
- "product strategic confusion assessment" ← Invented academic phrase
- "reduce handoff loss product engineering" ← Nobody types this

### ✅ NATURAL SEARCH QUERIES (WHAT REAL PEOPLE TYPE):
- "do smart blinds help you sleep" ← Natural question
- "best smart blinds for bedroom" ← Simple shopping query
- "smart blinds vs regular blinds" ← Clean comparison
- "how to fix product strategy" ← Real problem search

### THE RULES:
1. **Maximum 5 words** for main_keyword. 6+ words = keyword-stuffing.
2. Must sound like **natural speech** — read it aloud.
3. **Questions work great:** "how to...", "why does...", "is X worth it"
4. **Shopping queries work:** "best X for Y", "X vs Y", "X cost 2026"
5. **No jargon stacking:** Don't combine 3+ technical terms

## TITLE ≠ KEYWORD RULE (MANDATORY)

The title and main_keyword must NOT be the same string.
- **main_keyword** = what the user searches (short, plain, 2-5 words)
- **title** = a compelling headline that earns the click

❌ BAD: main_keyword: "smart window treatments for health" / title: "Smart Window Treatments for Health"
✅ GOOD: main_keyword: "smart blinds for sleep" / title: "I Replaced My Bedroom Blinds—Here's How My Sleep Changed"

---

## YOUR TASK

Generate EXACTLY 30 articles distributed as follows (NO EXCEPTIONS):

| Category | Count | REQUIRED article_type |
|----------|-------|-----------------------|
| Core Answers | 12 | informational |
| Supporting Articles | 8 | howto |
| Conversion Pages | 6 | commercial |
| Authority Plays | 4 | informational |

**ARTICLE TYPE RULES (MANDATORY - DO NOT IGNORE):**
- Core Answers → article_type MUST be "informational"
- Supporting Articles → article_type MUST be "howto" 
- Conversion Pages → article_type MUST be "commercial"
- Authority Plays → article_type MUST be "informational"

**EXPECTED FINAL DISTRIBUTION:**
- informational: 16 articles (Core + Authority)
- howto: 8 articles (Supporting)
- commercial: 6 articles (Conversion)

If your output has >16 informational articles, YOU HAVE FAILED. Check your work.

For each article provide:
1. title: Compelling blog post title (follow MODERN SEO rules above)
2. main_keyword: Primary target keyword (2-5 words, NATURAL SPEECH)
3. supporting_keywords: 2-3 related keywords (array, also natural queries)
4. article_type: "informational" | "commercial" | "howto" (MUST match category above)
5. cluster: Topic cluster for organization
6. intent_role: The specific intent ("Core Answer", "Problem-Specific", "Comparison", "Decision", "Emotional/Story", "Authority/Edge")
7. article_category: One of "Core Answers", "Supporting Articles", "Conversion Pages", "Authority Plays"
8. parent_question: The ONE fundamental user question this article answers
9. reason: A 1-sentence strategic rationale (WHY this content matters for THIS brand)
10. impact: "High" | "Medium" | "Low" (Strategic importance)
11. priority_score: 0-100 (Based on keyword relevance and business value)

## CRITICAL REQUIREMENTS:
1. Each article's parent_question must be UNIQUE across the plan.
2. If the brand has multiple features, articles must be distributed across ALL features.
3. You MUST generate EXACTLY 30 articles with the 12-8-6-4 distribution.
4. article_type MUST match the category (see table above).
5. ALL main_keywords MUST be 2-5 words (NEVER 6+) and sound like natural speech.
6. NO main_keyword may be the same as its title.
`

    const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "I understand. I will follow the AEO title rules strictly and ensure every title contains specific value and is quotable by AI systems. I will never use banned patterns like 'Everything You Need to Know' or 'Ultimate Guide'." }] },
            { role: "user", parts: [{ text: prompt }] }
        ],
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
                                parent_question: { type: "STRING" },
                                reason: { type: "STRING" },
                                impact: { type: "STRING" },
                                priority_score: { type: "NUMBER" }
                            },
                            required: ["title", "main_keyword", "supporting_keywords", "article_type", "cluster", "intent_role", "article_category", "parent_question", "reason", "impact", "priority_score"]
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
            continue
        }

        // Check duplication against existing articles (Topic Memory - Vector)
        const topicSignal = `${post.title || ""} : ${post.main_keyword || ""}`
        const { isDuplicate: isTopicDuplicate } = await checkTopicDuplication(topicSignal, userId, brandId)

        // Check duplication against Sitemap (Internal Links - Vector) [NEW]
        const { isDuplicate: isSitemapDuplicate } = await checkSitemapDuplication(topicSignal, userId, brandId)

        if (!isTopicDuplicate && !isSitemapDuplicate) {
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

    // --- ARTICLE TYPE DISTRIBUTION VALIDATION ---
    const typeDistribution: Record<string, number> = { informational: 0, commercial: 0, howto: 0 }
    for (const post of validPosts) {
        const type = post.article_type || "informational"
        if (type in typeDistribution) typeDistribution[type]++
    }
    const infoPercent = validPosts.length > 0 ? (typeDistribution.informational / validPosts.length) * 100 : 0
    if (infoPercent > 70) {
        console.warn(`[Content Plan] ⚠️ WARNING: ${infoPercent.toFixed(0)}% informational. LLM may have ignored article_type rules.`)
    }

    // --- DECISION PATTERN VALIDATION ---
    const decisionCount = validPosts.filter(p => /^(Should|Is|When)\b/i.test(p.title || "")).length
    if (decisionCount < 3) {
        console.warn(`[Content Plan] ⚠️ WARNING: Only ${decisionCount} decision-stage articles. Expected 3-4.`)
    }

    // --- COMPARISON DIFFERENTIATION VALIDATION ---
    const comparisonArticles = validPosts.filter(p => p.article_category === "Conversion Pages" || /\bvs\b/i.test(p.title || ""))
    const genericComparisons = comparisonArticles.filter(p => {
        const title = (p.title || "").toLowerCase()
        const hasDifferentiator = /(tested|experiment|test|review|analysis|spent|cost|results)/.test(title)
        return !hasDifferentiator
    })

    if (genericComparisons.length > 0) {
        console.warn(`[Content Plan] ⚠️ WARNING: Found ${genericComparisons.length} generic comparisons (Weak Differentiation).`)
        genericComparisons.forEach(p => console.warn(`   - Weak Title: ${p.title}`))
    }

    // --- LAYER 3: TITLE VIOLATION DETECTION & REGENERATION ---
    const TITLE_VIOLATIONS = [
        { pattern: /everything you need to know/i, reason: "Generic fluff" },
        { pattern: /ultimate guide/i, reason: "Overused pattern" },
        { pattern: /complete guide/i, reason: "Overused pattern" },
        { pattern: /:\s+[A-Z][a-z]+\s+[A-Z]/i, reason: "Keyword: Subtitle format" },
        { pattern: /which is (better|best)\??$/i, reason: "Generic comparison ending" },
        { pattern: /^what (is|are)\s+[^?]+\??\s*$/i, reason: "Definition without value" },
        { pattern: /price guide/i, reason: "Generic pricing" },
        { pattern: /unlocking the power/i, reason: "Marketing fluff" },
    ]

    const titleViolations = validPosts.filter(p => {
        const title = p.title || ""
        return TITLE_VIOLATIONS.some(v => v.pattern.test(title))
    })

    if (titleViolations.length > 0) {
        console.warn(`[Content Plan] ⚠️ TITLE VIOLATIONS DETECTED: ${titleViolations.length} titles need fixing`)
        titleViolations.forEach(p => {
            const violations = TITLE_VIOLATIONS.filter(v => v.pattern.test(p.title || ""))
            console.warn(`   - "${p.title}" → ${violations.map(v => v.reason).join(", ")}`)
        })

        // Targeted regeneration for invalid titles (max 1 retry)
        try {
            const fixPrompt = `You must fix these ${titleViolations.length} article titles. Each title violates AEO (Answer Engine Optimization) rules.

CURRENT VIOLATIONS:
${titleViolations.map((p, i) => `${i + 1}. "${p.title}" (Keyword: ${p.main_keyword}) - VIOLATION: ${TITLE_VIOLATIONS.filter(v => v.pattern.test(p.title || "")).map(v => v.reason).join(", ")}`).join("\n")}

RULES FOR FIXED TITLES:
- Must contain SPECIFIC VALUE (number, cost, time, or result)
- Must be quotable as a direct answer
- Must imply authority ("We Tested", "I Tried", "[Year] Data")
- 40-60 characters, max 70

Return ONLY a JSON object with format: { "titles": ["Fixed Title 1", "Fixed Title 2", ...] }
The order must match the violations list above.`

            const fixResponse = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: fixPrompt }] }],
                config: { responseMimeType: "application/json" }
            })

            const fixText = fixResponse.text || "{}"
            const fixResult = JSON.parse(fixText)

            if (fixResult.titles && Array.isArray(fixResult.titles)) {
                titleViolations.forEach((post, index) => {
                    if (fixResult.titles[index]) {
                        const oldTitle = post.title
                        post.title = fixResult.titles[index]
                    }
                })
            }
        } catch (fixError) {
            console.error("[Content Plan] Title regeneration failed:", fixError)
        }
    } else {
        console.log("[Content Plan] ✅ All titles pass AEO validation")
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
- Audience: ${brandData.audience?.primary || 'business professionals'}

## EXISTING ARTICLES (DO NOT DUPLICATE)
${existingTitles}

## YOUR TASK
Generate EXACTLY ${totalNeeded} unique articles following the category requirements above.
Each article needs: title, main_keyword, supporting_keywords, article_type, cluster, intent_role, article_category, parent_question, reason (1-sentence rationale), impact (High | Medium | Low), priority_score (0-100)
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
                                        parent_question: { type: "STRING" },
                                        reason: { type: "STRING" },
                                        impact: { type: "STRING" },
                                        priority_score: { type: "NUMBER" }
                                    },
                                    required: ["title", "main_keyword", "article_type", "article_category", "reason", "impact", "priority_score"]
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
        } catch (topUpError) {
            console.error("[Content Plan] Top-up failed:", topUpError)
        }
    }

    // Add metadata and IDs
    const rawItems = validPosts.map((post: any, index: number) => {
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
            intent_role: post.intent_role || "Core Answer",
            article_category: articleCategory as "Core Answers" | "Supporting Articles" | "Conversion Pages" | "Authority Plays",
            reason: post.reason || "Strategic foundational content to establish topical authority.",
            impact: post.impact || "Medium",
            opportunity_score: post.priority_score || 0
        }
    })

    // --- STEP 6: STRATEGIC SCHEDULING (NEW) ---
    // First, consolidate small clusters for better authority
    const consolidated = consolidateClusters(rawItems, 3, 8)

    // Then schedule by cluster
    let scheduledPlan = scheduleByCluster(consolidated, today)

    // === POST-GENERATION: VALIDATE KEYWORDS AGAINST GOOGLE AUTOCOMPLETE ===
    try {
        console.log(`[Content Plan] Validating ${scheduledPlan.length} keywords against Google Autocomplete...`)
        const validated = await validateArticleKeywords(scheduledPlan as any[], true) // autoReplace = true
        const replacedCount = validated.filter(v => v.original_keyword).length
        const invalidCount = validated.filter(v => !v.keyword_validated && !v.original_keyword).length

        console.log(`[Content Plan] Keyword validation: ${replacedCount} auto-replaced, ${invalidCount} still unvalidated`)

        // Update plan items with validated/replaced keywords
        scheduledPlan = validated.map(v => ({
            ...v,
            keyword_validated: undefined,
            original_keyword: undefined,
        })) as typeof scheduledPlan
    } catch (validationError) {
        console.warn('[Content Plan] Keyword validation failed (non-blocking):', validationError)
    }

    return { plan: scheduledPlan as ContentPlanItem[], categoryDistribution }
}
