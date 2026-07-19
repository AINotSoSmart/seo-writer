import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { BrandDetails } from "@/lib/schemas/brand"
import {
    NicheBlueprint,
    SiteCoverage,
    GapItem,
    CompetitorMatch,
    PillarSuggestion,
    TopicalAuditResult
} from "./types"
import { calculateAuthorityScore, generatePillarScores, projectScoreAfterPlan } from "./authority-scorer"

// ============================================================
// Gap Matrix — The "kill shot" that shows exactly what's missing
// ============================================================

/**
 * Generates the complete gap matrix comparing user vs competitors.
 * For each blueprint topic: who covers it, who doesn't, and why it matters.
 */
export function buildGapMatrix(
    blueprint: NicheBlueprint,
    userCoverage: SiteCoverage,
    competitorCoverages: SiteCoverage[]
): GapItem[] {
    const gaps: GapItem[] = []

    for (const pillar of blueprint.pillars) {
        for (const topic of pillar.required_topics) {
            // Check user coverage
            const userPillar = userCoverage.pillar_coverage.find(
                pc => pc.pillar_name === pillar.name
            )
            const userCovered = userPillar?.covered_topics.find(
                ct => ct.topic_question === topic.question
            )

            // Check which competitors cover this topic (with full proof data)
            const competitorsCovering: string[] = []
            const competitorMatches: CompetitorMatch[] = []
            for (const comp of competitorCoverages) {
                const compPillar = comp.pillar_coverage.find(
                    pc => pc.pillar_name === pillar.name
                )
                const compCovered = compPillar?.covered_topics.find(
                    ct => ct.topic_question === topic.question
                )
                if (compCovered) {
                    competitorsCovering.push(comp.site_name)
                    competitorMatches.push({
                        competitor_name: comp.site_name,
                        competitor_url: comp.site_url,
                        matched_page_url: compCovered.covered_by_url,
                        matched_page_title: compCovered.covered_by_title,
                        coverage_quality: compCovered.coverage_quality === "weak" ? "partial" : compCovered.coverage_quality,
                        similarity_score: compCovered.similarity_score
                    })
                }
            }

            gaps.push({
                topic: topic.question,
                pillar: pillar.name,
                importance: topic.importance,
                user_covered: !!userCovered,
                user_coverage_quality: userCovered?.coverage_quality,
                user_matched_url: userCovered?.covered_by_url,
                user_matched_title: userCovered?.covered_by_title,
                competitors_covering: competitorsCovering,
                competitor_matches: competitorMatches
            })
        }
    }

    // Sort: uncovered critical gaps with most competitor coverage first
    gaps.sort((a, b) => {
        // First: uncovered before covered
        if (!a.user_covered && b.user_covered) return -1
        if (a.user_covered && !b.user_covered) return 1

        // Then: by importance (critical > important > supporting)
        const importanceOrder = { critical: 0, important: 1, supporting: 2 }
        const impDiff = (importanceOrder[a.importance] || 2) - (importanceOrder[b.importance] || 2)
        if (impDiff !== 0) return impDiff

        // Then: by how many competitors cover it (more = more urgent)
        return b.competitors_covering.length - a.competitors_covering.length
    })

    return gaps
}

/**
 * Generates pillar page suggestions based on the gap analysis.
 * Uses Gemini for strategic recommendations on pillar page structure.
 */
export async function generatePillarSuggestions(
    blueprint: NicheBlueprint,
    gapMatrix: GapItem[],
    brandData: BrandDetails
): Promise<PillarSuggestion[]> {
    const client = getGeminiClient()

    // Identify which pillars have the most gaps
    const pillarGapCounts = new Map<string, { total: number; critical: number }>()
    for (const gap of gapMatrix) {
        if (!gap.user_covered) {
            const existing = pillarGapCounts.get(gap.pillar) || { total: 0, critical: 0 }
            existing.total++
            if (gap.importance === "critical") existing.critical++
            pillarGapCounts.set(gap.pillar, existing)
        }
    }

    // Get top pillars by gap severity
    const topPillars = Array.from(pillarGapCounts.entries())
        .sort((a, b) => (b[1].critical * 3 + b[1].total) - (a[1].critical * 3 + a[1].total))
        .slice(0, 5)
        .map(([name, counts]) => ({
            name,
            missing: counts.total,
            critical_missing: counts.critical,
            topics: gapMatrix
                .filter(g => g.pillar === name && !g.user_covered)
                .slice(0, 8)
                .map(g => g.topic)
        }))

    const prompt = `
## YOUR ROLE
You are a content architect helping a brand build topical authority through strategic pillar pages.

## BRAND CONTEXT
- **Product:** ${brandData.product_name}
- **Category:** ${brandData.category || brandData.product_identity?.literally || 'Software'}
- **Audience:** ${brandData.audience?.primary || 'business professionals'}

## TOP AUTHORITY GAPS (by pillar)
${topPillars.map(p => `
### ${p.name} (${p.missing} missing topics, ${p.critical_missing} critical)
Missing topics:
${p.topics.map(t => `- ${t}`).join('\n')}
`).join('\n')}

## YOUR TASK
Recommend 3-5 pillar pages that would serve as "hub pages" for the brand's authority.

Each pillar page should:
1. Be a comprehensive, evergreen resource (2000+ words, on the brand's website)
2. Target the pillar with the MOST missing topics
3. Answer the core questions that multiple blog articles will link back to
4. Have a clear, SEO-friendly structure with specific H2 sections

## RULES
- Titles should be clear and search-friendly (under 60 chars)
- Slugs should be lowercase, hyphenated, clean
- key_sections should be 4-6 H2 headings for the page
- articles_to_link: estimate how many of the 30 planned articles would naturally link to this page
- description: explain WHY this page matters for authority (1-2 sentences, builds trust with the user)

## OUTPUT (JSON array)
[
  {
    "pillar_name": "Core Concepts",
    "suggested_title": "What is Privacy-First Analytics",
    "suggested_slug": "/what-is-privacy-first-analytics",
    "description": "This page defines the core technology your audience searches for. Without it, AI systems have no foundational reference to cite you.",
    "key_sections": ["What It Is", "How It Works", "Why It Matters", "Common Misconceptions", "Getting Started"],
    "articles_to_link": 8
  }
]
`

    try {
        const response = await client.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY" as const,
                    items: {
                        type: "OBJECT" as const,
                        properties: {
                            pillar_name: { type: "STRING" as const },
                            suggested_title: { type: "STRING" as const },
                            suggested_slug: { type: "STRING" as const },
                            description: { type: "STRING" as const },
                            key_sections: { type: "ARRAY" as const, items: { type: "STRING" as const } },
                            articles_to_link: { type: "NUMBER" as const }
                        },
                        required: ["pillar_name", "suggested_title", "suggested_slug", "description", "key_sections", "articles_to_link"]
                    }
                }
            }
        })

        const text = response.text || "[]"
        const parsed = JSON.parse(text.replace(/```json|```/g, ""))

        const suggestions: PillarSuggestion[] = (parsed || []).map((item: any) => ({
            pillar_name: item.pillar_name || "Unknown",
            suggested_title: item.suggested_title || "",
            suggested_slug: item.suggested_slug || "",
            description: item.description || "",
            key_sections: item.key_sections || [],
            articles_to_link: item.articles_to_link || 0
        }))

        console.log(`[Gap Matrix] Generated ${suggestions.length} pillar page suggestions`)
        return suggestions

    } catch (error) {
        console.error("[Gap Matrix] Failed to generate pillar suggestions:", error)
        return []
    }
}

/**
 * Assembles the complete TopicalAuditResult from all component data.
 */
export function assembleAuditResult(
    blueprint: NicheBlueprint,
    userCoverage: SiteCoverage,
    competitorCoverages: SiteCoverage[],
    pillarSuggestions: PillarSuggestion[],
    durationMs: number
): TopicalAuditResult {
    const authorityScore = calculateAuthorityScore(userCoverage, blueprint)
    const pillarScores = generatePillarScores(userCoverage, competitorCoverages)
    const gapMatrix = buildGapMatrix(blueprint, userCoverage, competitorCoverages)
    const projectedScore = projectScoreAfterPlan(userCoverage, blueprint, 30)

    // Update the user coverage overall_score with the importance-weighted calculation
    userCoverage.overall_score = authorityScore

    return {
        niche_blueprint: blueprint,
        user_coverage: userCoverage,
        competitor_coverages: competitorCoverages,
        authority_score: authorityScore,
        pillar_scores: pillarScores,
        gap_matrix: gapMatrix,
        pillar_suggestions: pillarSuggestions,
        projected_score_after_plan: projectedScore,
        audit_meta: {
            competitors_scanned: competitorCoverages.length,
            topics_analyzed: blueprint.total_required_topics,
            user_pages_scanned: userCoverage.pages_analyzed,
            duration_ms: durationMs
        }
    }
}
