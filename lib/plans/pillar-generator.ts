import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { BrandDetails } from "@/lib/schemas/brand"

/**
 * Pillar Page Recommendation Schema
 * These are foundational website pages (not blog articles) that establish domain authority.
 */
export interface PillarRecommendation {
    id: string
    title: string              // e.g., "What is AI Headshot Generation"
    description: string        // 1-2 line explanation of why this matters
    suggested_slug: string     // e.g., "/what-is-ai-headshots"
    created_url?: string       // User-submitted URL when they create the page
    created_at?: string        // When user marked as created
}

/**
 * Generate 3-5 pillar page recommendations for a brand.
 * These are foundational "source of truth" pages that define the brand's authority.
 * 
 * Called ONCE during first plan generation, then persists at brand level.
 */
export async function generatePillarRecommendations(
    brandData: BrandDetails
): Promise<PillarRecommendation[]> {
    const client = getGeminiClient()

    const prompt = `
## Your Role
You are a content strategist helping a brand establish domain authority through foundational website pages.

## Brand Context
- **Product:** ${brandData.product_name}
- **What it is:** ${brandData.product_identity?.literally || brandData.category || 'Software'}
- **Category:** ${brandData.category || 'SaaS Software'}
- **Primary Audience:** ${brandData.audience?.primary || 'business professionals'}
- **Core Problem Solved:** ${Array.isArray(brandData.uvp) ? brandData.uvp[0] : brandData.uvp}

## Your Task
Recommend 3-5 **pillar pages** the brand should create on their website.

### What are Pillar Pages?
- Foundational, evergreen pages (NOT blog articles)
- Define the brand's position and authority in their space
- Examples: "What is X", "Complete Guide to Y", "How X Works"
- These pages become linking hubs for all future content

### Requirements
1. Each pillar should target a high-value, category-defining topic
2. Focus on educational/informational content, not promotional
3. Titles should be clear and search-friendly (under 60 chars)
4. Each should have a clear, concise description of WHY it matters, so that it builds trust among my users for why i am suggesitng these pages
5. Suggest SEO-friendly slugs (lowercase, hyphenated)

### DO NOT Recommend
- Product comparison pages (those are blog content)
- Pricing or feature pages (those are already standard)
- News or time-sensitive content
- Very niche topics (pillars should be broad)

## Output Format
Return a JSON array of 3-5 pillar recommendations:
\`\`\`json
[
  {
    "title": "What is AI Headshot Generation",
    "description": "Defines the core technology your audience is searching for. Establishes you as the authority on this topic.",
    "suggested_slug": "/what-is-ai-headshot-generation"
  }
]
\`\`\`
`

    try {
        const response = await client.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING" },
                            description: { type: "STRING" },
                            suggested_slug: { type: "STRING" }
                        },
                        required: ["title", "description", "suggested_slug"]
                    }
                }
            }
        })

        const text = response.text || "[]"
        const rawRecommendations = JSON.parse(text)

        // Transform to PillarRecommendation format with IDs
        const recommendations: PillarRecommendation[] = rawRecommendations.map(
            (item: any, index: number) => ({
                id: `pillar-${Date.now()}-${index}`,
                title: item.title || `Pillar ${index + 1}`,
                description: item.description || "",
                suggested_slug: item.suggested_slug || `/pillar-${index + 1}`,
                created_url: undefined,
                created_at: undefined
            })
        )

        console.log(`[Pillar Generator] Generated ${recommendations.length} pillar recommendations`)
        return recommendations

    } catch (error) {
        console.error("[Pillar Generator] Failed to generate recommendations:", error)
        throw error
    }
}
