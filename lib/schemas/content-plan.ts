import { z } from "zod"

// Content Plan Item - single blog post in the 30-day plan
export const ContentPlanItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    main_keyword: z.string(),
    gsc_query: z.string().optional(), // Original GSC query this article is based on (for metrics tracking)
    supporting_keywords: z.array(z.string()),
    // article_type matches generate-blog.ts ArticleType
    article_type: z.enum(["informational", "commercial", "howto"]).default("informational"),
    // intent is for user display/categorization
    intent: z.enum(["informational", "comparison", "tutorial", "commercial", "transactional", "howto"]).optional(),
    cluster: z.string().optional(),
    scheduled_date: z.string(), // ISO date string
    status: z.enum(["pending", "writing", "published", "skipped"]).default("pending"),
    // Pre-created article ID for automation (Watchman pattern)
    article_id: z.string().optional(),
    // GSC enhancement fields (populated only when GSC connected)
    opportunity_score: z.number().optional(),
    badge: z.enum(["high_impact", "quick_win", "low_ctr", "new_opportunity"]).optional(),
    gsc_impressions: z.number().optional(),
    gsc_clicks: z.number().optional(),
    gsc_position: z.number().optional(),
    gsc_ctr: z.number().optional(),
    // Strategic planning fields (from LLM analysis)
    reason: z.string().optional(), // Why this topic matters
    user_instructions: z.string().optional(), // Editorial Brief / Custom Instructions
    impact: z.enum(["Low", "Medium", "High"]).optional(), // Expected traffic impact
    // Article Category for 12-8-6-4 strategic distribution
    article_category: z.enum([
        "Core Answers",        // 12 articles - establish authority on parent questions
        "Supporting Articles", // 8 articles - deepen existing coverage
        "Conversion Pages",    // 6 articles - comparisons, decisions
        "Authority Plays"      // 4 articles - edge cases, technical deep-dives
    ]).optional(),
    // Strategic Planner fields (new revamp)
    connected_to: z.array(z.string()).optional(), // Day numbers or article IDs this links to
    hook: z.string().optional(), // One-sentence value proposition
    phase: z.enum([
        "Foundation",   // Days 1-7: Establish authority
        "Use-Case",     // Days 8-14: Capture specific personas
        "Technical",    // Days 15-21: LLM optimization, "how it works"
        "Trust"         // Days 22-30: Overcome objections, build confidence
    ]).optional(),
    user_intent: z.enum([
        "Informational",
        "Transactional",
        "Commercial Investigation"
    ]).optional(),
})

export type ContentPlanItem = z.infer<typeof ContentPlanItemSchema>

// Automation status for the Watchman pattern
export const AutomationStatusSchema = z.enum(["paused", "active", "completed"]).default("paused")
export type AutomationStatus = z.infer<typeof AutomationStatusSchema>

// Catch-up mode for handling missed articles
export const CatchUpModeSchema = z.enum(["gradual", "skip", "reschedule"]).default("gradual")
export type CatchUpMode = z.infer<typeof CatchUpModeSchema>

// Full Content Plan
export const ContentPlanSchema = z.object({
    id: z.string().optional(),
    user_id: z.string(),
    brand_id: z.string().optional(),
    plan_data: z.array(ContentPlanItemSchema),
    competitor_seeds: z.array(z.string()).optional(),
    gsc_enhanced: z.boolean().default(false),
    // Strategic planner analysis (new)
    content_gap_analysis: z.string().optional(),
    // Automation control for Watchman pattern
    automation_status: AutomationStatusSchema,
    // How to handle missed articles when resuming
    catch_up_mode: CatchUpModeSchema,
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
