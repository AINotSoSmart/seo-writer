import { z } from "zod"

// --- Zod Schemas for Audit Data Validation ---

export const RequiredTopicSchema = z.object({
    question: z.string(),
    intent: z.enum(["informational", "commercial", "navigational"]),
    importance: z.enum(["critical", "important", "supporting"])
})

export const NichePillarSchema = z.object({
    name: z.string(),
    description: z.string(),
    weight: z.number().min(1).max(10),
    required_topics: z.array(RequiredTopicSchema)
})

export const NicheBlueprintSchema = z.object({
    niche_name: z.string(),
    pillars: z.array(NichePillarSchema),
    total_required_topics: z.number()
})

export const CoveredTopicSchema = z.object({
    topic_question: z.string(),
    covered_by_url: z.string(),
    covered_by_title: z.string(),
    coverage_quality: z.enum(["strong", "partial", "weak"]),
    similarity_score: z.number()
})

export const PillarCoverageSchema = z.object({
    pillar_name: z.string(),
    pillar_weight: z.number(),
    covered_topics: z.array(CoveredTopicSchema),
    missing_topics: z.array(RequiredTopicSchema),
    score: z.number()
})

export const SiteCoverageSchema = z.object({
    site_url: z.string(),
    site_name: z.string(),
    pages_analyzed: z.number(),
    pillar_coverage: z.array(PillarCoverageSchema),
    overall_score: z.number()
})

export const CompetitorMatchSchema = z.object({
    competitor_name: z.string(),
    competitor_url: z.string(),
    matched_page_url: z.string(),
    matched_page_title: z.string(),
    coverage_quality: z.enum(["strong", "partial"]),
    similarity_score: z.number()
})

export const GapItemSchema = z.object({
    topic: z.string(),
    pillar: z.string(),
    importance: z.enum(["critical", "important", "supporting"]),
    user_covered: z.boolean(),
    user_coverage_quality: z.enum(["strong", "partial", "weak"]).optional(),
    user_matched_url: z.string().optional(),
    user_matched_title: z.string().optional(),
    competitors_covering: z.array(z.string()),
    competitor_matches: z.array(CompetitorMatchSchema).default([])
})

export const PillarSuggestionSchema = z.object({
    pillar_name: z.string(),
    suggested_title: z.string(),
    suggested_slug: z.string(),
    description: z.string(),
    key_sections: z.array(z.string()),
    articles_to_link: z.number()
})

export const PillarScoreSchema = z.object({
    pillar: z.string(),
    user_score: z.number(),
    best_competitor_name: z.string(),
    best_competitor_score: z.number()
})

export const AuditMetaSchema = z.object({
    competitors_scanned: z.number(),
    topics_analyzed: z.number(),
    user_pages_scanned: z.number(),
    duration_ms: z.number()
})

export const TopicalAuditResultSchema = z.object({
    niche_blueprint: NicheBlueprintSchema,
    user_coverage: SiteCoverageSchema,
    competitor_coverages: z.array(SiteCoverageSchema),
    authority_score: z.number(),
    pillar_scores: z.array(PillarScoreSchema),
    gap_matrix: z.array(GapItemSchema),
    pillar_suggestions: z.array(PillarSuggestionSchema),
    projected_score_after_plan: z.number(),
    audit_meta: AuditMetaSchema
})

// --- Gemini output schema for niche blueprint generation ---

export const GeminiBlueprintOutputSchema = {
    type: "OBJECT" as const,
    properties: {
        niche_name: { type: "STRING" as const },
        pillars: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    name: { type: "STRING" as const },
                    description: { type: "STRING" as const },
                    weight: { type: "NUMBER" as const },
                    required_topics: {
                        type: "ARRAY" as const,
                        items: {
                            type: "OBJECT" as const,
                            properties: {
                                question: { type: "STRING" as const },
                                intent: { type: "STRING" as const },
                                importance: { type: "STRING" as const }
                            },
                            required: ["question", "intent", "importance"]
                        }
                    }
                },
                required: ["name", "description", "weight", "required_topics"]
            }
        }
    },
    required: ["niche_name", "pillars"]
}
