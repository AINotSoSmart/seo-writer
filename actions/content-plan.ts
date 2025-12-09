"use server"

import { createClient } from "@/utils/supabase/server"
import { ContentPlanItem, ContentPlan } from "@/lib/schemas/content-plan"

export async function saveContentPlan(
    planData: ContentPlanItem[],
    brandId?: string,
    competitorSeeds?: string[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Check if user already has a plan, update if so
    const { data: existingPlan } = await supabase
        .from("content_plans")
        .select("id")
        .eq("user_id", user.id)
        .single()

    if (existingPlan) {
        // Update existing plan
        const { error } = await supabase
            .from("content_plans")
            .update({
                plan_data: planData,
                brand_id: brandId,
                competitor_seeds: competitorSeeds,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existingPlan.id)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, planId: existingPlan.id }
    }

    // Create new plan
    const { data, error } = await supabase
        .from("content_plans")
        .insert({
            user_id: user.id,
            brand_id: brandId,
            plan_data: planData,
            competitor_seeds: competitorSeeds,
        })
        .select()
        .single()

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, planId: data.id }
}

export async function getContentPlan(): Promise<ContentPlan | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data } = await supabase
        .from("content_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

    return data as ContentPlan | null
}

export async function updatePlanItemStatus(
    planId: string,
    itemId: string,
    status: "pending" | "writing" | "published"
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    // Fetch current plan
    const { data: plan, error: fetchError } = await supabase
        .from("content_plans")
        .select("plan_data")
        .eq("id", planId)
        .eq("user_id", user.id)
        .single()

    if (fetchError || !plan) {
        return { success: false, error: "Plan not found" }
    }

    // Update the specific item
    const planData = plan.plan_data as ContentPlanItem[]
    const updatedPlan = planData.map(item =>
        item.id === itemId ? { ...item, status } : item
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
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function enhancePlanWithGSC(
    planId: string,
    enhancedPlanData: ContentPlanItem[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const { error } = await supabase
        .from("content_plans")
        .update({
            plan_data: enhancedPlanData,
            gsc_enhanced: true,
            updated_at: new Date().toISOString(),
        })
        .eq("id", planId)
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function deleteContentPlan(planId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    const { error } = await supabase
        .from("content_plans")
        .delete()
        .eq("id", planId)
        .eq("user_id", user.id)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}
