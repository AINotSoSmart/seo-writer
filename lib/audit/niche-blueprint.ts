import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { BrandDetails } from "@/lib/schemas/brand"
import { NicheBlueprint, NichePillar } from "./types"
import { GeminiBlueprintOutputSchema } from "@/lib/schemas/audit"

/**
 * Generates the Niche Topical Map — what topics/questions a brand MUST cover
 * to be considered an authority in their niche.
 * 
 * Uses gemini-3.1-flash-lite for high-quality strategic output.
 * 
 * Output: 5-7 pillars with 6-10 required topics each (~40-60 total topics)
 */
export async function generateNicheBlueprint(
    brandData: BrandDetails
): Promise<NicheBlueprint> {
    const client = getGeminiClient()

    const category = brandData.product_identity?.literally || brandData.category || "SaaS Software"
    const audience = brandData.audience?.primary || "business professionals"
    const features = brandData.core_features?.join(", ") || "Not specified"
    const enemy = Array.isArray(brandData.enemy) ? brandData.enemy.join(", ") : (brandData.enemy || "Not specified")

    const prompt = `
## YOUR ROLE
You are a topical authority strategist. Your job is to define the COMPLETE TOPICAL MAP that a brand must cover to be recognized as THE authority in their niche — by both humans and AI systems.

## BRAND CONTEXT
- **Product:** ${brandData.product_name}
- **What it is:** ${category}
- **Category:** ${brandData.category || category}
- **Primary Audience:** ${audience}
- **Core Features:** ${features}
- **The Enemy (problem they solve):** ${enemy}
- **Mission:** ${brandData.mission || "Not specified"}

## YOUR TASK
Generate a NICHE TOPICAL MAP with 5-7 authority pillars. Each pillar contains 6-10 questions/topics that a true niche authority MUST answer.

### PILLAR CATEGORIES TO CONSIDER:

1. **Core Concepts** (weight: 9-10)
   - Fundamental questions people ask when discovering this space
   - "What is X?", "How does X work?", "Is X safe/legit?"
   - These are the FOUNDATION — without these, nothing else matters

2. **Use Cases & Applications** (weight: 7-8)
   - Specific scenarios where the product/category applies
   - "X for [specific audience]", "How to use X for [goal]"
   - Shows breadth of knowledge

3. **How-To & Tutorials** (weight: 7-8)
   - Step-by-step guides for common tasks
   - "How to [achieve goal] with X", "Step-by-step guide to Y"
   - Demonstrates practical expertise

4. **Comparisons & Alternatives** (weight: 6-7)
   - Product vs product, approach vs approach
   - "X vs Y", "Best alternatives to Z", "Free vs paid X"
   - Signals market awareness

5. **Troubleshooting & Edge Cases** (weight: 5-6)
   - Problems people encounter, edge cases, limitations
   - "Why is my X not working?", "Can I use X for [unusual case]?"
   - Demonstrates deep expertise

6. **Trust & Authority** (weight: 8-9)
   - Content that builds credibility: studies, data, expert analysis
   - "Is X accurate?", "X statistics and benchmarks", "Privacy/security of X"
   - Essential for AI citation

7. **Buying Decisions** (weight: 6-7)
   - Content for users ready to choose
   - "Best X for [need]", "X pricing guide", "What to look for in X"
   - Conversion-focused authority

### TOPIC FORMAT RULES (CRITICAL):

Topics MUST be phrased as **real user questions or search queries**:
- ✅ "Is AI-generated art copyright free?"
- ✅ "How to make professional headshots at home"
- ✅ "Best free AI headshot generator 2026"
- ✅ "Plausible vs Google Analytics for GDPR compliance"

Topics must NEVER be marketing speak or article titles:
- ❌ "The Future of AI Headshots" (vague marketing)
- ❌ "Understanding Privacy in Analytics" (abstract)
- ❌ "Beyond Photos: The Smart Way to Get Professional Images" (clickbait)
- ❌ "Navigating the Complex World of..." (filler)

### IMPORTANCE CLASSIFICATION:
- **critical**: Must-have for basic authority. Without this, you're not even in the conversation.
- **important**: Significantly strengthens authority. Competitors likely cover this.
- **supporting**: Nice to have. Deepens expertise but not essential for baseline authority.

### DISTRIBUTE IMPORTANCE:
- ~30% of topics should be "critical"
- ~40% should be "important"  
- ~30% should be "supporting"

### OUTPUT FORMAT:
Return a JSON object with:
- niche_name: A clean, descriptive name for the niche (NOT the product name)
- pillars: Array of 5-7 pillars, each with name, description, weight (1-10), and required_topics array

Generate 40-60 total topics across all pillars. Be comprehensive but avoid topic overlap between pillars.
`

    try {
        const response = await client.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: GeminiBlueprintOutputSchema,
                thinkingConfig: { thinkingBudget: 4096 }
            }
        })

        const text = response.text || "{}"
        const parsed = JSON.parse(text.replace(/```json|```/g, ""))

        // Validate and normalize
        const pillars: NichePillar[] = (parsed.pillars || []).map((p: any) => ({
            name: p.name || "Unknown Pillar",
            description: p.description || "",
            weight: Math.min(10, Math.max(1, p.weight || 5)),
            required_topics: (p.required_topics || []).map((t: any) => ({
                question: t.question || "",
                intent: ["informational", "commercial", "navigational"].includes(t.intent)
                    ? t.intent
                    : "informational",
                importance: ["critical", "important", "supporting"].includes(t.importance)
                    ? t.importance
                    : "important"
            })).filter((t: any) => t.question.length > 0)
        })).filter((p: NichePillar) => p.required_topics.length > 0)

        const totalTopics = pillars.reduce((sum, p) => sum + p.required_topics.length, 0)

        const blueprint: NicheBlueprint = {
            niche_name: parsed.niche_name || brandData.category || "Unknown Niche",
            pillars,
            total_required_topics: totalTopics
        }

        console.log(`[Niche Blueprint] Generated: "${blueprint.niche_name}" with ${pillars.length} pillars, ${totalTopics} topics`)
        return blueprint

    } catch (error) {
        console.error("[Niche Blueprint] Failed to generate:", error)
        throw new Error(`Niche blueprint generation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
}
