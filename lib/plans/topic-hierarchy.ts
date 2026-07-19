import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { BrandDetails } from "@/lib/schemas/brand"
import { GapAnalysis } from "./gap-analysis"

export type TopicType = "foundation" | "supporting" | "advanced" | "conversion"

export interface TopicNode {
    topic: string
    type: TopicType
    intentRole: string
    dependsOn: string[]      // Topics that must exist first
    priority: number         // 1 = highest priority
    reason: string           // Why this topic matters
}

export interface TopicHierarchy {
    nodes: TopicNode[]
    levels: {
        foundation: TopicNode[]
        supporting: TopicNode[]
        advanced: TopicNode[]
        conversion: TopicNode[]
    }
}

/**
 * Builds a topic hierarchy that orders content strategically.
 * Foundation topics unlock supporting topics, which unlock advanced topics, etc.
 */
export async function buildTopicHierarchy(
    gapAnalysis: GapAnalysis,
    brandData: BrandDetails,
    competitorBrands: string[] = []
): Promise<TopicHierarchy> {
    const genAI = getGeminiClient()


    const prompt = `
You are a content strategist building a TOPIC HIERARCHY for a 30-day content plan.

## BRAND CONTEXT
Product: ${brandData.product_name}
Category: ${brandData.product_identity?.literally || brandData.category || 'Software'}
Audience: ${brandData.audience?.primary || 'business professionals'}
Core Features: ${brandData.core_features?.join(", ") || "Not specified"}

## COMPETITOR BRANDS (for comparison articles)
${competitorBrands.slice(0, 5).join(", ") || "None identified"}

## GAP ANALYSIS RESULTS
Blue Ocean Opportunities (No/low competition):
${gapAnalysis.blueOceanTopics.slice(0, 10).join("\n")}

Competitor Weaknesses (Poor coverage):
${gapAnalysis.competitorWeaknesses.slice(0, 10).join("\n")}

Prioritized Topics:
${gapAnalysis.prioritizedOpportunities.slice(0, 10).map(p => `- ${p.topic} (${p.priority}): ${p.reason}`).join("\n")}

## YOUR TASK

Build a strategic topic hierarchy with 30 topics organized into 4 levels:

### LEVEL 1: FOUNDATION (12 topics)
- **Specific User Questions** ("Is X safe?", "Does X work for Y?")
- **NO Generic Definitions** ("What is X?" -> STOP using this)
- **NO "The Importance of..."**
- Intent: Core Answer, Definition

### LEVEL 2: SUPPORTING (8 topics)
- **"How to" Queries** ("How to do X with Y")
- **Troubleshooting** ("Why is my X blurry?")
- DEPENDS ON foundation topics existing
- Intent: How-To, Problem-Specific

### LEVEL 3: ADVANCED (4 topics)
- **Specific Edge Cases** ("Can I use AI headshots for passport?")
- **Deep Dives** ("How nano-texture engines work")
- DEPENDS ON supporting topics
- Intent: Authority/Edge, Emotional/Story

### LEVEL 4: CONVERSION (6 topics)
- Comparison articles (X vs Y)
- Decision-focused content
- DEPENDS ON foundation + authority
- Intent: Comparison, Decision

## RULES
1. **TOPIC FORMAT (CRITICAL):** Topics must be written as **RAW SEARCH QUERIES** or **USER QUESTIONS**.
   - ❌ BAD: "The Future of AI Headshots" (Marketing fluff)
   - ❌ BAD: "Understanding Privacy" (Abstract concept)
   - ❌ BAD: "Beyond Photos: Understanding Hyper-Realistic AI Image Creation" (Marketing fluff)
   - ✅ GOOD: "Is AI generated art copyright free?"
   - ✅ GOOD: "How to make professional headshots at home"
   - ✅ GOOD: "Best free AI headshot generator 2026"
   
2. NO "Marketing Speak" or Colons in topics (e.g. "AI Headshot Generators: The Smart Way to Get Professional Photos" -> FAIL).
3. Use REAL competitor names for comparison articles: ${competitorBrands.slice(0, 3).join(", ") || "Generic competitors"}
4. Prioritize BLUE OCEAN topics
5. NO placeholders like "[Generic Tool]"

OUTPUT (JSON):
{
    "nodes": [
        {
            "topic": "AI Family Portrait From Individual Photos Online Without Studio Shoot",
            "type": "foundation",
            "intentRole": "Core Answer",
            "dependsOn": [],
            "priority": 1,
            "reason": "Establishes topical authority"
        },
        {
            "topic": "Best AI Family Portrait Generator From Individual Photos Compared",
            "type": "conversion",
            "intentRole": "Comparison",
            "dependsOn": ["AI Family Portrait From Individual Photos Online Without Studio shoot"],
            "priority": 15,
            "reason": "Converts users researching alternatives"
        }
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
        const nodes: TopicNode[] = parsed.nodes || []

        // Organize into levels
        const levels = {
            foundation: nodes.filter(n => n.type === "foundation"),
            supporting: nodes.filter(n => n.type === "supporting"),
            advanced: nodes.filter(n => n.type === "advanced"),
            conversion: nodes.filter(n => n.type === "conversion")
        }


        return { nodes, levels }
    } catch (error) {
        console.error("[Topic Hierarchy] Failed to build hierarchy:", error)
        return {
            nodes: [],
            levels: { foundation: [], supporting: [], advanced: [], conversion: [] }
        }
    }
}

/**
 * Orders topics for scheduling based on dependencies.
 * Ensures foundation topics come before topics that depend on them.
 */
export function orderByDependencies(hierarchy: TopicHierarchy): TopicNode[] {
    const ordered: TopicNode[] = []
    const added = new Set<string>()

    // Add foundation first (no dependencies)
    for (const node of hierarchy.levels.foundation.sort((a, b) => a.priority - b.priority)) {
        ordered.push(node)
        added.add(node.topic.toLowerCase())
    }

    // Then supporting
    for (const node of hierarchy.levels.supporting.sort((a, b) => a.priority - b.priority)) {
        ordered.push(node)
        added.add(node.topic.toLowerCase())
    }

    // Then advanced
    for (const node of hierarchy.levels.advanced.sort((a, b) => a.priority - b.priority)) {
        ordered.push(node)
        added.add(node.topic.toLowerCase())
    }

    // Finally conversion
    for (const node of hierarchy.levels.conversion.sort((a, b) => a.priority - b.priority)) {
        ordered.push(node)
        added.add(node.topic.toLowerCase())
    }

    return ordered
}

/**
 * Maps a topic type to article category for plan generator compatibility.
 */
export function topicTypeToCategory(type: TopicType): string {
    const mapping: Record<TopicType, string> = {
        "foundation": "Core Answers",
        "supporting": "Supporting Articles",
        "advanced": "Authority Plays",
        "conversion": "Conversion Pages"
    }
    return mapping[type]
}
