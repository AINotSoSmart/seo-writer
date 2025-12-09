import { z } from "zod"

// Content Plan Item - single blog post in the 30-day plan
export const ContentPlanItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    main_keyword: z.string(),
    supporting_keywords: z.array(z.string()),
    intent: z.enum(["informational", "comparison", "tutorial", "commercial"]),
    cluster: z.string().optional(),
    scheduled_date: z.string(), // ISO date string
    status: z.enum(["pending", "writing", "published"]).default("pending"),
    // GSC enhancement fields (populated only when GSC connected)
    opportunity_score: z.number().optional(),
    badge: z.enum(["high_impact", "quick_win", "low_ctr", "new_opportunity"]).optional(),
    gsc_impressions: z.number().optional(),
    gsc_clicks: z.number().optional(),
    gsc_position: z.number().optional(),
    gsc_ctr: z.number().optional(),
})

export type ContentPlanItem = z.infer<typeof ContentPlanItemSchema>

// Full Content Plan
export const ContentPlanSchema = z.object({
    id: z.string().optional(),
    user_id: z.string(),
    brand_id: z.string().optional(),
    plan_data: z.array(ContentPlanItemSchema),
    competitor_seeds: z.array(z.string()).optional(),
    gsc_enhanced: z.boolean().default(false),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
})

export type ContentPlan = z.infer<typeof ContentPlanSchema>

// Competitor Data from Tavily analysis
export const CompetitorDataSchema = z.object({
    url: z.string(),
    title: z.string(),
    headings: z.array(z.string()),
    keywords: z.array(z.string()),
})

export type CompetitorData = z.infer<typeof CompetitorDataSchema>

// GSC Query Data (temporary, not stored)
export const GSCQuerySchema = z.object({
    query: z.string(),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    position: z.number(),
})

export type GSCQuery = z.infer<typeof GSCQuerySchema>

// GSC Page Data (temporary, not stored)
export const GSCPageSchema = z.object({
    page: z.string(),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    position: z.number(),
})

export type GSCPage = z.infer<typeof GSCPageSchema>

// GSC Connection stored in database
export const GSCConnectionSchema = z.object({
    id: z.string().optional(),
    user_id: z.string(),
    site_url: z.string(),
    access_token: z.string(),
    refresh_token: z.string(),
    expires_at: z.string(),
})

export type GSCConnection = z.infer<typeof GSCConnectionSchema>

// GSC Insights (computed from raw data, this is what we store)
export const GSCInsightsSchema = z.object({
    top_opportunities: z.array(z.object({
        query: z.string(),
        impressions: z.number(),
        position: z.number(),
        ctr: z.number(),
        opportunity_score: z.number(),
        badge: z.enum(["high_impact", "quick_win", "low_ctr", "new_opportunity"]),
    })),
    pages_on_page_two: z.array(z.object({
        page: z.string(),
        position: z.number(),
        impressions: z.number(),
    })),
    low_ctr_pages: z.array(z.object({
        page: z.string(),
        ctr: z.number(),
        impressions: z.number(),
    })),
})

export type GSCInsights = z.infer<typeof GSCInsightsSchema>
