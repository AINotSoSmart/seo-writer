import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { refreshGSCToken } from "@/actions/gsc"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { jsonrepair } from "jsonrepair"

interface GSCQueryRow {
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
}

interface ProcessedQuery {
    query: string
    impressions: number
    clicks: number
    ctr: number
    position: number
    intent: "informational" | "commercial" | "transactional"
    opportunity_score: number
    word_count: number
    expected_ctr: number // For low CTR detection
}

interface KeywordCluster {
    primary_keyword: string
    supporting_keywords: string[]
    intent: "informational" | "commercial" | "transactional"
    opportunity_score: number
    impressions: number
    position: number
    ctr: number
    expected_ctr: number
    category: "quick_win" | "high_potential" | "strategic" | "new_opportunity"
}

// Expected CTR curve by position (industry standard)
const EXPECTED_CTR: Record<number, number> = {
    1: 0.30, 2: 0.20, 3: 0.12, 4: 0.08, 5: 0.06,
    6: 0.04, 7: 0.03, 8: 0.03, 9: 0.03, 10: 0.03,
}

function getExpectedCTR(position: number): number {
    if (position <= 10) return EXPECTED_CTR[Math.round(position)] || 0.03
    if (position <= 20) return 0.01
    return 0.005
}

// Step 1: Filter garbage queries
function filterGarbageQueries(queries: GSCQueryRow[], brandName?: string): GSCQueryRow[] {
    return queries.filter(q => {
        const query = q.keys[0].toLowerCase()
        const wordCount = query.split(/\s+/).length

        // Filter out:
        // - Brand queries (if brand name provided)
        if (brandName && query.includes(brandName.toLowerCase())) return false
        // - Very low impressions (not meaningful)
        if (q.impressions < 20) return false
        // - Position > 50 (not relevant)
        if (q.position > 50) return false
        // - Low CTR + bad position
        if (q.ctr < 0.001 && q.position > 20) return false
        // - Too generic (< 2 words)
        if (wordCount < 2) return false

        return true
    })
}

// Step 2: Tag query intent (per blueprint)
function tagIntent(query: string): "informational" | "commercial" | "transactional" {
    const q = query.toLowerCase()

    // Transactional patterns (tool/software/app - user wants to DO something)
    if (q.includes("tool") || q.includes("software") || q.includes("app") ||
        q.includes("generator") || q.includes("maker") || q.includes("creator") ||
        q.includes("download") || q.includes("login") || q.includes("sign up")) {
        return "transactional"
    }

    // Commercial patterns (best/top/vs/review - user is comparing)
    if (q.includes("best") || q.includes("top") || q.includes("vs") ||
        q.includes("review") || q.includes("alternative") || q.includes("pricing") ||
        q.includes("compare") || q.includes("cheap") || q.includes("free")) {
        return "commercial"
    }

    // Informational patterns (how/what/why/guide/tutorial - user wants to LEARN)
    // This is the default for queries that don't match above
    return "informational"
}

// Step 3: Compute opportunity score
function computeOpportunityScore(
    impressions: number,
    position: number,
    ctr: number,
    wordCount: number,
    maxImpressions: number
): number {
    // Normalize impressions (0-1)
    const impressionsNormalized = maxImpressions > 0 ? impressions / maxImpressions : 0

    // Position inverse (lower position = higher score)
    const positionInverse = Math.max(0, (50 - position) / 50)

    // CTR gap (expected - actual)
    const expectedCtr = getExpectedCTR(position)
    const ctrGap = Math.max(0, expectedCtr - ctr)

    // Query depth score (longer = more specific = better)
    let queryDepthScore = 0.3
    if (wordCount >= 3) queryDepthScore = 0.5
    if (wordCount >= 4) queryDepthScore = 0.7
    if (wordCount >= 5) queryDepthScore = 1.0

    // Final weighted score
    const score = (
        (impressionsNormalized * 0.4) +
        (positionInverse * 0.3) +
        (ctrGap * 0.2) +
        (queryDepthScore * 0.1)
    )

    return Math.round(score * 100)
}

// Step 4: Deduplicate similar queries using n-gram similarity
function calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/))
    const wordsB = new Set(b.toLowerCase().split(/\s+/))

    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
    const union = new Set([...wordsA, ...wordsB])

    return intersection.size / union.size // Jaccard similarity
}

function clusterQueries(queries: ProcessedQuery[], maxImpressions: number): KeywordCluster[] {
    const clusters: KeywordCluster[] = []
    const used = new Set<string>()

    // Sort by opportunity score descending
    const sorted = [...queries].sort((a, b) => b.opportunity_score - a.opportunity_score)

    // Calculate meaningful thresholds based on actual data
    const highImpressionsThreshold = maxImpressions * 0.1 // Top 10% of impressions
    const mediumImpressionsThreshold = maxImpressions * 0.05 // Top 5%

    for (const query of sorted) {
        if (used.has(query.query)) continue

        // Find similar queries (Jaccard similarity > 40%)
        const similar = sorted.filter(q =>
            !used.has(q.query) &&
            q.query !== query.query &&
            calculateSimilarity(query.query, q.query) > 0.4
        )

        // Mark all as used
        used.add(query.query)
        similar.forEach(s => used.add(s.query))

        // Determine category based on blueprint criteria:
        // Quick Win: Position 7-20 + High impressions + Low CTR (below expected)
        // High Potential: High impressions + Position 20-40
        // Strategic: High opportunity score (cluster builders)
        // New Opportunity: Everything else (emerging queries)

        let category: KeywordCluster["category"] = "new_opportunity"
        const isLowCTR = query.ctr < query.expected_ctr * 0.5 // CTR is less than half of expected
        const hasHighImpressions = query.impressions >= mediumImpressionsThreshold

        if (query.position >= 7 && query.position <= 20 && hasHighImpressions && isLowCTR) {
            // Quick Win: Easy to jump to page 1 with better title/meta
            category = "quick_win"
        } else if (query.impressions >= highImpressionsThreshold && query.position > 20 && query.position <= 40) {
            // High Potential: Mid-term SEO value
            category = "high_potential"
        } else if (query.opportunity_score >= 50 && query.impressions >= mediumImpressionsThreshold) {
            // Strategic: Good score + decent impressions = cluster builder
            category = "strategic"
        }
        // else: new_opportunity (default)

        clusters.push({
            primary_keyword: query.query,
            supporting_keywords: similar.map(s => s.query),
            intent: query.intent,
            opportunity_score: query.opportunity_score,
            impressions: query.impressions,
            position: query.position,
            ctr: query.ctr,
            expected_ctr: query.expected_ctr,
            category,
        })
    }

    return clusters
}

// Master LLM prompt for 30-day plan generation
function generatePlanPrompt(
    clusters: KeywordCluster[],
    brandData: any,
    competitorSeeds: string[]
): string {
    return `You are an expert SEO strategist and content planning engine. You receive processed GSC keyword clusters for a website. Your goal is to generate a detailed 30-day content plan that maximizes search traffic, improves rankings, and aligns with the brand voice.

## Website Brand DNA
${brandData ? JSON.stringify(brandData, null, 2) : "No brand data available - use general best practices"}

## Competitor Topics & Focus Areas
${competitorSeeds?.length > 0 ? competitorSeeds.join(", ") : "No competitor data available"}

## GSC Keyword Clusters (Processed & Deduplicated)
${JSON.stringify(clusters, null, 2)}

---

## YOUR TASK:

### 1. Select the highest value 30 topics from the clusters above

Use this strategic breakdown:
- **10 Quick Wins**: position 7-20, high impressions, low CTR (easiest to rank page 1)
- **10 High Potential Topics**: high impressions, position 20-40 (mid-term SEO value)
- **5 Strategic Cluster Builders**: strengthen topical authority
- **5 New Opportunity Topics**: rising queries with future growth potential

### 2. For each topic, provide:
- **primary_keyword**: The main keyword to target
- **title**: A compelling, human-like article title (NO generic patterns like "X: Everything You Need to Know")
- **intent**: informational, commercial, or transactional
- **article_type**: guide, listicle, comparison, deep-dive, how-to, case-study, tool-review
- **supporting_keywords**: Array of related keywords to include
- **cluster**: Topic category/cluster name
- **opportunity_score**: Number from 0-100
- **badge**: quick_win, high_impact, low_ctr, or new_opportunity
- **reason**: 1 sentence explaining why this topic matters
- **impact**: Low, Medium, or High expected traffic impact

### 3. CRITICAL RULES:
- Titles MUST be compelling, unique, and human-like
- NEVER use lazy patterns like "X: Everything You Need to Know" or "Complete Guide to X"
- Create varied title formats: questions, how-tos, numbers, provocative statements
- DO NOT create separate articles for similar keywords (they should be combined!)
- Every topic must align with the brand voice if provided
- Be strategic, not superficial

### 4. Output Format (strict JSON array):
[
  {
    "primary_keyword": "string",
    "title": "string",
    "intent": "informational|commercial|transactional",
    "article_type": "guide|listicle|comparison|deep-dive|how-to|case-study|tool-review",
    "supporting_keywords": ["string"],
    "cluster": "string",
    "opportunity_score": number,
    "badge": "quick_win|high_impact|low_ctr|new_opportunity",
    "reason": "string",
    "impact": "Low|Medium|High"
  }
]

Return ONLY the JSON array. No explanations.`
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { brandData, competitorSeeds, brandName } = await req.json()

        // Get GSC connection
        const { data: connection } = await supabase
            .from("gsc_connections")
            .select("*")
            .eq("user_id", user.id)
            .single()

        if (!connection) {
            return NextResponse.json({ error: "GSC not connected" }, { status: 400 })
        }

        // Check if token is expired and refresh if needed
        let accessToken = connection.access_token
        const expiresAt = new Date(connection.expires_at)

        if (expiresAt < new Date()) {
            const refreshResult = await refreshGSCToken(connection.id)
            if (!refreshResult.success) {
                return NextResponse.json({ error: "Failed to refresh token" }, { status: 401 })
            }
            accessToken = refreshResult.accessToken
        }

        const siteUrl = connection.site_url
        if (!siteUrl) {
            return NextResponse.json({ error: "No site URL configured" }, { status: 400 })
        }

        // Calculate date range (last 30 days)
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 30)

        const dateRange = {
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
        }

        // Fetch top 100 queries (we'll filter down)
        console.log("=== GSC PLAN GENERATION: Fetching queries ===")
        const queriesResponse = await fetch(
            `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...dateRange,
                    dimensions: ["query"],
                    rowLimit: 100,
                }),
            }
        )

        if (!queriesResponse.ok) {
            console.error("GSC queries fetch failed:", await queriesResponse.text())
            return NextResponse.json({ error: "Failed to fetch GSC data" }, { status: 500 })
        }

        const queriesData = await queriesResponse.json()
        const rawQueries: GSCQueryRow[] = queriesData.rows || []

        console.log("Raw queries fetched:", rawQueries.length)

        // STEP 1: Filter garbage
        const filteredQueries = filterGarbageQueries(rawQueries, brandName)
        console.log("After filtering:", filteredQueries.length)

        if (filteredQueries.length === 0) {
            return NextResponse.json({ error: "No valid queries found after filtering. Your site may need more search data." }, { status: 400 })
        }

        // Find max impressions for normalization
        const maxImpressions = Math.max(...filteredQueries.map(q => q.impressions))

        // STEP 2 & 3: Tag intent and compute opportunity score
        const processedQueries: ProcessedQuery[] = filteredQueries.map(q => {
            const query = q.keys[0]
            const wordCount = query.split(/\s+/).length
            const expectedCtr = getExpectedCTR(q.position)
            return {
                query,
                impressions: q.impressions,
                clicks: q.clicks,
                ctr: q.ctr,
                position: q.position,
                intent: tagIntent(query),
                word_count: wordCount,
                expected_ctr: expectedCtr,
                opportunity_score: computeOpportunityScore(
                    q.impressions,
                    q.position,
                    q.ctr,
                    wordCount,
                    maxImpressions
                ),
            }
        })

        console.log("Processed queries:", processedQueries.length)
        console.log("Top 5:", processedQueries.slice(0, 5).map(q => ({ query: q.query, score: q.opportunity_score })))

        // STEP 4: Cluster similar queries
        const clusters = clusterQueries(processedQueries, maxImpressions)
        console.log("Clusters created:", clusters.length)
        console.log("Top 5 clusters:", clusters.slice(0, 5).map(c => ({
            primary: c.primary_keyword,
            supporting: c.supporting_keywords.length,
            category: c.category
        })))

        // STEP 5: Generate 30-day plan using LLM
        const genAI = getGeminiClient()
        const prompt = generatePlanPrompt(clusters, brandData, competitorSeeds)

        console.log("=== Calling Gemini 2.5 Pro for strategic plan ===")

        const response = await genAI.models.generateContent({
            model: "gemini-2.5-pro",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
            },
        })

        const responseText = response.text || ""
        console.log("LLM response length:", responseText.length)

        // Parse LLM response
        let planData: any[]
        try {
            const cleanedJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim()
            planData = JSON.parse(cleanedJson)
        } catch (e) {
            try {
                planData = JSON.parse(jsonrepair(responseText))
            } catch (e2) {
                console.error("Failed to parse LLM response:", responseText.slice(0, 500))
                return NextResponse.json({ error: "Failed to parse content plan from LLM" }, { status: 500 })
            }
        }

        // Transform to ContentPlanItem format with dates
        const today = new Date()
        const contentPlan = planData.slice(0, 30).map((item: any, index: number) => {
            const scheduledDate = new Date(today)
            scheduledDate.setDate(today.getDate() + index)

            return {
                id: `gsc-plan-${Date.now()}-${index}`,
                title: item.title,
                main_keyword: item.primary_keyword,
                supporting_keywords: item.supporting_keywords || [],
                article_type: item.article_type === "listicle" ? "commercial" :
                    item.article_type === "comparison" ? "commercial" :
                        item.article_type === "how-to" ? "howto" :
                            item.intent || "informational",
                intent: item.intent,
                cluster: item.cluster,
                scheduled_date: scheduledDate.toISOString().split("T")[0],
                status: "pending",
                // GSC data
                opportunity_score: item.opportunity_score,
                badge: item.badge,
                gsc_impressions: clusters.find(c => c.primary_keyword === item.primary_keyword)?.impressions || 0,
                gsc_position: clusters.find(c => c.primary_keyword === item.primary_keyword)?.position || 0,
                gsc_ctr: clusters.find(c => c.primary_keyword === item.primary_keyword)?.ctr || 0,
                // Extra strategic info
                reason: item.reason,
                impact: item.impact,
            }
        })

        console.log("=== GSC PLAN GENERATED ===")
        console.log("Total items:", contentPlan.length)
        console.log("Sample titles:", contentPlan.slice(0, 3).map((p: any) => p.title))

        return NextResponse.json({ plan: contentPlan })

    } catch (error: any) {
        console.error("GSC plan generation error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to generate content plan" },
            { status: 500 }
        )
    }
}
