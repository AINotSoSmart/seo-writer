import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { ContentPlanItem } from "@/lib/schemas/content-plan"

// GET: Fetch user's content plan
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { data: plan, error } = await supabase
            .from("content_plans")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        if (error && error.code !== "PGSQL_NO_ROWS_RETURNED") {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // --- STATUS RECONCILIATION LOGIC ---
        if (plan && plan.plan_data) {
            // 1. Fetch all articles for this user to check actual status
            const { data: articles } = await supabase
                .from("articles")
                .select("keyword, status, slug")
                .eq("user_id", user.id)

            if (articles && articles.length > 0) {
                // 2. Create a lookup map: normalized keyword -> article status
                const articleMap = new Map<string, string>()
                articles.forEach((a: any) => {
                    if (a.keyword) {
                        articleMap.set(a.keyword.trim().toLowerCase(), a.status)
                    }
                })

                let hasChanges = false
                const updatedPlanData = (plan.plan_data as ContentPlanItem[]).map((item) => {
                    const normalizedKey = item.main_keyword.trim().toLowerCase()
                    const articleStatus = articleMap.get(normalizedKey)

                    if (articleStatus) {
                        // Map article status to plan status
                        let newStatus: "pending" | "writing" | "published" | "skipped" = item.status

                        if (articleStatus === "completed" || articleStatus === "published") {
                            newStatus = "published"
                        } else if (["processing", "researching", "outlining", "writing", "polishing", "queued"].includes(articleStatus)) {
                            newStatus = "writing"
                        } else if (articleStatus === "failed") {
                            // Optional: Reset to pending if failed, or keep as writing to show retry? 
                            // Let's keep as pending to allow retry.
                            newStatus = "pending"
                        }

                        if (newStatus !== item.status) {
                            hasChanges = true
                            return { ...item, status: newStatus }
                        }
                    }
                    return item
                })

                // 3. If changes found, update the plan in DB (self-healing)
                if (hasChanges) {
                    await supabase
                        .from("content_plans")
                        .update({
                            plan_data: updatedPlanData,
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", plan.id)

                    // Return the updated data immediately
                    return NextResponse.json({ ...plan, plan_data: updatedPlanData })
                }
            }
        }

        return NextResponse.json(plan || null)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Create new content plan
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { planData, brandId, competitorSeeds, gscEnhanced } = await req.json()

        if (!planData || !Array.isArray(planData)) {
            return NextResponse.json({ error: "Plan data is required" }, { status: 400 })
        }

        // Delete existing plan if any
        await supabase
            .from("content_plans")
            .delete()
            .eq("user_id", user.id)

        // Create new plan
        const { data, error } = await supabase
            .from("content_plans")
            .insert({
                user_id: user.id,
                brand_id: brandId || null,
                plan_data: planData,
                competitor_seeds: competitorSeeds || [],
                gsc_enhanced: gscEnhanced || false,
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT: Update existing content plan (for GSC enhancement)
export async function PUT(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { planId, planData, gscEnhanced } = await req.json()

        if (!planId) {
            return NextResponse.json({ error: "Plan ID required" }, { status: 400 })
        }

        // Update existing plan
        const { data, error } = await supabase
            .from("content_plans")
            .update({
                plan_data: planData,
                gsc_enhanced: gscEnhanced || false,
                updated_at: new Date().toISOString(),
            })
            .eq("id", planId)
            .eq("user_id", user.id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH: Update plan item status
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { planId, itemId, updates } = await req.json()

        if (!planId || !itemId) {
            return NextResponse.json({ error: "Plan ID and Item ID required" }, { status: 400 })
        }

        // Fetch current plan
        const { data: plan, error: fetchError } = await supabase
            .from("content_plans")
            .select("plan_data")
            .eq("id", planId)
            .eq("user_id", user.id)
            .single()

        if (fetchError || !plan) {
            return NextResponse.json({ error: "Plan not found" }, { status: 404 })
        }

        // Update specific item
        const planData = plan.plan_data as ContentPlanItem[]
        const updatedPlan = planData.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
        )

        // Save updated plan
        const { error } = await supabase
            .from("content_plans")
            .update({
                plan_data: updatedPlan,
                updated_at: new Date().toISOString(),
            })
            .eq("id", planId)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

