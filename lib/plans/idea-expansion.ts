import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { BrandDetails } from "@/lib/schemas/brand"

/**
 * Phase A: Idea Universe Expansion
 * 
 * Generates 12-15 distinct problem domains that represent the broader
 * problem space the audience lives in — even if the product is NOT
 * the direct solution.
 * 
 * This is intentionally UNCONSTRAINED. No SEO, no counts, no JSON pressure.
 */
export async function expandIdeaUniverse(brandData: BrandDetails): Promise<string[]> {
    const client = getGeminiClient()

    const prompt = `You are NOT creating a content plan.

Your job is to expand the IDEA UNIVERSE for this product.

## PRODUCT CONTEXT
Product: ${brandData.product_name}
What it does: ${brandData.product_identity.literally}
Target audience: ${brandData.audience.primary}
Core problem solved: ${brandData.product_identity.emotionally}

## TASK
List the broader problems, life situations, goals, and contexts where this audience exists —
even if the product is NOT the direct solution.

Think in terms of:
- What happens in their life BEFORE they need this product?
- What happens AFTER they've used it successfully?
- Life moments and emotional drivers
- Adjacent goals and workflows
- Long-term outcomes they care about
- Situations before and after the product is needed

## RULES
- Do NOT output keywords
- Do NOT output article titles
- Do NOT think about SEO
- Do NOT limit yourself to the product features
- Each item must be conceptually distinct
- Short, clear phrases only (3-8 words each)

## OUTPUT
Return a simple list of 12-15 distinct problem domains.`

    try {
        const response = await client.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        domains: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        }
                    },
                    required: ["domains"]
                }
            }
        })

        const text = response.text || "{}"
        const result = JSON.parse(text)
        const domains = result.domains || []

        console.log("[Phase A] Generated idea universe:", domains.length, "domains")
        return domains.slice(0, 15) // Cap at 15
    } catch (error) {
        console.error("[Phase A] Idea expansion failed:", error)
        return [] // Graceful fallback - system continues without idea universe
    }
}

/**
 * Phase B: Competitor Validation
 * 
 * Scores each idea domain by how heavily competitors already cover it.
 * This does NOT generate new ideas — it only classifies existing ones.
 * 
 * Output: { "domain": "heavy" | "light" | "none" }
 */
export async function validateWithCompetitors(
    ideaUniverse: string[],
    competitorContent: string
): Promise<Record<string, "heavy" | "light" | "none">> {
    if (ideaUniverse.length === 0) {
        return {}
    }

    const client = getGeminiClient()

    const prompt = `You are NOT generating content ideas.

You are analyzing competitor coverage to validate an idea universe.

## IDEA UNIVERSE
${ideaUniverse.map((d, i) => `${i + 1}. ${d}`).join("\n")}

## COMPETITOR CONTENT (summarized)
${competitorContent.slice(0, 15000)}

## TASK
For each idea domain, determine how heavily competitors already cover it.

Classify each domain as ONE of:
- heavy: Well-covered, crowded, multiple competitors write about this
- light: Partially covered, some mention but not deep
- none: Largely ignored, untapped opportunity

## RULES
- Do NOT suggest new ideas
- Do NOT generate keywords
- Do NOT rewrite domain names
- Use the EXACT domain text as the key
- Base judgment only on competitor content presence

## OUTPUT
Return a JSON object with each domain as key and coverage level as value.`

    try {
        const response = await client.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        coverage: {
                            type: "OBJECT",
                            additionalProperties: { type: "STRING" }
                        }
                    },
                    required: ["coverage"]
                }
            }
        })

        const text = response.text || "{}"
        const result = JSON.parse(text)
        const coverage = result.coverage || {}

        // Validate and normalize the coverage map
        const validatedCoverage: Record<string, "heavy" | "light" | "none"> = {}
        for (const domain of ideaUniverse) {
            const level = coverage[domain] || "none"
            validatedCoverage[domain] = ["heavy", "light", "none"].includes(level)
                ? level as "heavy" | "light" | "none"
                : "none"
        }

        console.log("[Phase B] Validated coverage:", validatedCoverage)
        return validatedCoverage
    } catch (error) {
        console.error("[Phase B] Competitor validation failed:", error)
        // Fallback: treat all domains as "none" (opportunity)
        const fallback: Record<string, "heavy" | "light" | "none"> = {}
        for (const domain of ideaUniverse) {
            fallback[domain] = "none"
        }
        return fallback
    }
}

/**
 * Formats the idea universe with coverage for injection into the plan prompt.
 */
export function formatIdeaUniverseWithCoverage(
    ideaUniverse: string[],
    coverageMap: Record<string, "heavy" | "light" | "none">
): string {
    if (ideaUniverse.length === 0) {
        return ""
    }

    const formatted = ideaUniverse.map(domain => {
        const level = coverageMap[domain] || "none"
        const emoji = level === "heavy" ? "🔴" : level === "light" ? "🟡" : "🟢"
        return `${emoji} [${level.toUpperCase()}] ${domain}`
    })

    return formatted.join("\n")
}
