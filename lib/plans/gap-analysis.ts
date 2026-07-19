import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { SERPIntelligence, aggregateCoveredTopics, aggregateAnsweredQuestions, aggregateMissingAngles } from "./serp-intelligence"
import { BrandDetails } from "@/lib/schemas/brand"

export interface GapAnalysis {
    saturatedTopics: string[]      // Heavy coverage, hard to compete
    partialTopics: string[]        // Some coverage, room for better content
    blueOceanTopics: string[]      // No/low coverage, opportunity!
    competitorWeaknesses: string[] // Topics where competitors are weak
    prioritizedOpportunities: {
        topic: string
        reason: string
        priority: "high" | "medium" | "low"
    }[]
}

/**
 * Performs gap analysis by comparing SERP coverage against brand opportunities.
 * Identifies saturated areas to avoid and blue ocean opportunities to target.
 */
export async function performGapAnalysis(
    serpData: SERPIntelligence[],
    brandData: BrandDetails,
    existingCoverage: string[] = []
): Promise<GapAnalysis> {
    const genAI = getGeminiClient()

    // Aggregate data from SERP intelligence
    const coveredTopics = aggregateCoveredTopics(serpData)
    const answeredQuestions = aggregateAnsweredQuestions(serpData)
    const missingAngles = aggregateMissingAngles(serpData)


    const prompt = `
You are a strategic SEO analyst performing a gap analysis.

## BRAND CONTEXT
Product: ${brandData.product_name}
What it does: ${brandData.product_identity?.literally || brandData.category || 'Software'}
Audience: ${brandData.audience?.primary || 'business professionals'}
Core features: ${brandData.core_features?.join(", ") || "Not specified"}

## COMPETITOR COVERAGE (What's Already Ranking)

Topics covered by competitors:
${coveredTopics.slice(0, 30).join(", ")}

Questions already answered:
${answeredQuestions.slice(0, 30).join("\n")}

## IDENTIFIED GAPS (Missing Angles)
${missingAngles.join("\n")}

## EXISTING CONTENT (Already Published by User)
${existingCoverage.slice(0, 20).join("\n") || "None"}

## YOUR TASK

Analyze the competitive landscape and identify:

1. **SATURATED TOPICS** (8+ competitors cover these well)
   - These are hard to rank for
   - Only target if you can do 10x better

2. **PARTIAL TOPICS** (4-7 competitors cover these)
   - Competitive but possible
   - Need strong unique angle

3. **BLUE OCEAN TOPICS** (0-3 competitors cover, high relevance to brand)
   - PRIORITIZE these
   - Easy wins with strategic value

4. **COMPETITOR WEAKNESSES** (Topics covered poorly)
   - Surface-level coverage only
   - Opportunity to be the definitive resource

5. **PRIORITIZED OPPORTUNITIES** (Top 10 topics to target)
   - Combine blue ocean + weaknesses + relevance
   - Each with reason and priority level

OUTPUT (JSON):
{
    "saturatedTopics": ["topic1", "topic2"],
    "partialTopics": ["topic3", "topic4"],
    "blueOceanTopics": ["topic5", "topic6"],
    "competitorWeaknesses": ["topic7", "topic8"],
    "prioritizedOpportunities": [
        { "topic": "topic", "reason": "Why this is an opportunity", "priority": "high" }
    ]
}
`

    try {
        const response = await genAI.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        })

        const text = response.text || "{}"
        const parsed = JSON.parse(text.replace(/```json|```/g, ""))


        return {
            saturatedTopics: parsed.saturatedTopics || [],
            partialTopics: parsed.partialTopics || [],
            blueOceanTopics: parsed.blueOceanTopics || [],
            competitorWeaknesses: parsed.competitorWeaknesses || [],
            prioritizedOpportunities: parsed.prioritizedOpportunities || []
        }
    } catch (error) {
        console.error("[Gap Analysis] LLM analysis failed:", error)
        return {
            saturatedTopics: [],
            partialTopics: [],
            blueOceanTopics: missingAngles, // Fallback: treat missing angles as blue ocean
            competitorWeaknesses: [],
            prioritizedOpportunities: []
        }
    }
}

/**
 * Filters out topics that the user has already published.
 */
export function filterExistingCoverage(
    opportunities: string[],
    existingCoverage: string[]
): string[] {
    const existingLower = new Set(existingCoverage.map(c => c.toLowerCase()))

    return opportunities.filter(topic => {
        const topicLower = topic.toLowerCase()
        // Check if any existing coverage matches this topic
        return !Array.from(existingLower).some(existing =>
            topicLower.includes(existing) || existing.includes(topicLower)
        )
    })
}

/**
 * Scores a topic based on gap analysis data.
 */
export function getTopicOpportunityScore(
    topic: string,
    gapAnalysis: GapAnalysis
): number {
    let score = 50 // Base score

    if (gapAnalysis.blueOceanTopics.some(t => topic.toLowerCase().includes(t.toLowerCase()))) {
        score += 30 // Blue ocean bonus
    }

    if (gapAnalysis.competitorWeaknesses.some(t => topic.toLowerCase().includes(t.toLowerCase()))) {
        score += 20 // Weakness bonus
    }

    if (gapAnalysis.saturatedTopics.some(t => topic.toLowerCase().includes(t.toLowerCase()))) {
        score -= 30 // Saturation penalty
    }

    const prioritized = gapAnalysis.prioritizedOpportunities.find(
        p => topic.toLowerCase().includes(p.topic.toLowerCase())
    )
    if (prioritized) {
        score += prioritized.priority === "high" ? 20 : prioritized.priority === "medium" ? 10 : 5
    }

    return Math.max(0, Math.min(100, score))
}
