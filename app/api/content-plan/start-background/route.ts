import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { tasks } from "@trigger.dev/sdk/v3"
import { generatePlanTask } from "@/trigger/generate-plan"
import { BrandDetails } from "@/lib/schemas/brand"

export const maxDuration = 30 // Quick response, actual work is in background

/**
 * POST: Start background plan generation
 * 
 * Called after user saves brand during onboarding.
 * Creates a pending plan and triggers Trigger.dev task.
 * Returns immediately so user can proceed to /content-plan.
 * 
 * Seeds are now optional - the background task will generate them from brand data if not provided.
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const {
            brandId,
            brandData,
            brandUrl
        } = await req.json() as {
            brandId: string
            brandData: BrandDetails
            brandUrl?: string
        }

        if (!brandId || !brandData) {
            return NextResponse.json({ error: "Brand ID and data required" }, { status: 400 })
        }

        // Onboarding has already run the closed-pool harvest. Reuse its
        // authoritative planned_articles instead of paying for the exact same
        // crawl and Tavily work a second time.
        const { data: harvestedRows, error: harvestReadError } = await (supabase as any)
            .from("planned_articles")
            .select("id, title, main_keyword, supporting_keywords, article_type, is_pillar, cluster_id, status, scheduled_date, audit_clusters(name)")
            .eq("user_id", user.id)
            .eq("brand_id", brandId)
            .in("status", ["pending", "scheduled"])

        if (harvestReadError) {
            return NextResponse.json({ error: harvestReadError.message }, { status: 500 })
        }

        const harvestedPlan = (harvestedRows || []).map((row: any) => ({
            id: row.id,
            title: row.title,
            main_keyword: row.main_keyword,
            supporting_keywords: row.supporting_keywords || [],
            article_type: row.article_type,
            cluster: row.audit_clusters?.name || "",
            delivery_model: "cluster",
            is_pillar: row.is_pillar,
            scheduled_date: row.scheduled_date || "",
            status: row.status === "scheduled" ? "pending" : row.status,
        }))

        // Delete any existing plans for this user
        await supabase
            .from("content_plans")
            .delete()
            .eq("user_id", user.id)

        // Existing harvest rows make this a cheap mirror. The Trigger task is
        // retained as a recovery path for legacy entry points without a harvest.
        const canReuseHarvest = harvestedPlan.length > 0

        const { data: plan, error: insertError } = await supabase
            .from("content_plans")
            .insert({
                user_id: user.id,
                brand_id: brandId,
                plan_data: canReuseHarvest ? harvestedPlan : [],
                competitor_seeds: [],
                gsc_enhanced: false,
                generation_status: canReuseHarvest ? "complete" : "pending",
                generation_phase: canReuseHarvest ? null : "sitemap"
            })
            .select()
            .single()

        if (insertError || !plan) {
            console.error("[Start Background Plan] Insert error:", insertError)
            return NextResponse.json({ error: insertError?.message || "Failed to create plan" }, { status: 500 })
        }

        if (canReuseHarvest) {
            return NextResponse.json({
                success: true,
                planId: plan.id,
                generation_status: "complete",
                reusedHarvest: true,
                articleCount: harvestedPlan.length,
            })
        }

        // Trigger background task - all intelligence gathering happens there
        try {
            const handle = await tasks.trigger<typeof generatePlanTask>(
                "generate-content-plan",
                {
                    planId: plan.id,
                    userId: user.id,
                    brandId,
                    brandData,
                    brandUrl // For sitemap sync in Trigger task
                }
            )


            return NextResponse.json({
                success: true,
                planId: plan.id,
                taskId: handle.id,
                generation_status: "pending"
            })
        } catch (triggerError: any) {
            console.error("[Start Background Plan] Trigger error:", triggerError)

            // Mark plan as failed if trigger fails
            await supabase
                .from("content_plans")
                .update({
                    generation_status: "failed",
                    generation_error: triggerError.message || "Failed to start generation"
                })
                .eq("id", plan.id)

            return NextResponse.json({
                error: "Failed to start plan generation",
                planId: plan.id
            }, { status: 500 })
        }

    } catch (error: any) {
        console.error("[Start Background Plan] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
