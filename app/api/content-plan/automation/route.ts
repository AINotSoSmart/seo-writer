import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

/**
 * POST /api/content-plan/automation
 * Activate automation for the user's content plan
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get the user's content plan
        const { data: plan, error: fetchError } = await supabase
            .from("content_plans")
            .select("id, automation_status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        if (fetchError || !plan) {
            return NextResponse.json({ error: "No content plan found" }, { status: 404 })
        }

        // Activate automation
        const { error: updateError } = await supabase
            .from("content_plans")
            .update({ automation_status: "active" })
            .eq("id", plan.id)

        if (updateError) {
            console.error("Failed to activate automation:", updateError)
            return NextResponse.json({ error: "Failed to activate automation" }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            automation_status: "active",
            message: "Automation activated! The Watchman will handle your content schedule."
        })
    } catch (e: any) {
        console.error("Automation POST error:", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}

/**
 * DELETE /api/content-plan/automation
 * Pause automation for the user's content plan
 */
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get the user's content plan
        const { data: plan, error: fetchError } = await supabase
            .from("content_plans")
            .select("id, automation_status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        if (fetchError || !plan) {
            return NextResponse.json({ error: "No content plan found" }, { status: 404 })
        }

        // Pause automation
        const { error: updateError } = await supabase
            .from("content_plans")
            .update({ automation_status: "paused" })
            .eq("id", plan.id)

        if (updateError) {
            console.error("Failed to pause automation:", updateError)
            return NextResponse.json({ error: "Failed to pause automation" }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            automation_status: "paused",
            message: "Automation paused. You can reactivate anytime."
        })
    } catch (e: any) {
        console.error("Automation DELETE error:", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}

/**
 * GET /api/content-plan/automation
 * Get current automation status
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get the user's content plan
        const { data: plan, error: fetchError } = await supabase
            .from("content_plans")
            .select("id, automation_status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        if (fetchError || !plan) {
            return NextResponse.json({ automation_status: null })
        }

        return NextResponse.json({
            automation_status: plan.automation_status || "paused"
        })
    } catch (e: any) {
        console.error("Automation GET error:", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}
