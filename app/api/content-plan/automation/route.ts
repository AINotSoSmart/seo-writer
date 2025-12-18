import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { ContentPlanItem } from "@/lib/schemas/content-plan"

/**
 * POST /api/content-plan/automation
 * Activate automation for the user's content plan
 * Body: { action: 'gradual' | 'skip' | 'reschedule' }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const action = body.action || "gradual" // Default to gradual catch-up

        // Get the user's content plan with plan_data
        const { data: plan, error: fetchError } = await supabase
            .from("content_plans")
            .select("id, automation_status, plan_data")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        if (fetchError || !plan) {
            return NextResponse.json({ error: "No content plan found" }, { status: 404 })
        }

        const today = new Date().toISOString().split('T')[0]
        let updatedPlanData = plan.plan_data as ContentPlanItem[]

        // Handle the user's chosen action for missed articles
        if (action === "skip") {
            // Mark all missed articles as "skipped"
            updatedPlanData = updatedPlanData.map(item => {
                if (item.scheduled_date < today && item.status === "pending") {
                    return { ...item, status: "skipped" as const }
                }
                return item
            })
        } else if (action === "reschedule") {
            // Shift all pending dates forward starting from today
            const pendingItems = updatedPlanData
                .filter(item => item.status === "pending")
                .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))

            let dateOffset = 0
            const rescheduledIds = new Map<string, string>()

            for (const item of pendingItems) {
                const newDate = new Date()
                newDate.setDate(newDate.getDate() + dateOffset)
                rescheduledIds.set(item.id, newDate.toISOString().split('T')[0])
                dateOffset++
            }

            updatedPlanData = updatedPlanData.map(item => {
                const newDate = rescheduledIds.get(item.id)
                if (newDate) {
                    return { ...item, scheduled_date: newDate }
                }
                return item
            })
        }
        // For 'gradual' mode, no plan_data changes needed - scheduler handles rate limiting

        // Activate automation with the chosen catch_up_mode
        const { error: updateError } = await supabase
            .from("content_plans")
            .update({
                automation_status: "active",
                catch_up_mode: action,
                plan_data: updatedPlanData,
                updated_at: new Date().toISOString()
            })
            .eq("id", plan.id)

        if (updateError) {
            console.error("Failed to activate automation:", updateError)
            return NextResponse.json({ error: "Failed to activate automation" }, { status: 500 })
        }

        const messages: Record<string, string> = {
            gradual: "Automation activated! Missed articles will be processed 1 per hour.",
            skip: "Automation activated! Missed articles have been skipped.",
            reschedule: "Automation activated! All pending articles have been rescheduled starting today."
        }

        return NextResponse.json({
            success: true,
            automation_status: "active",
            catch_up_mode: action,
            message: messages[action] || messages.gradual
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
 * Get current automation status and missed article count
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get the user's content plan with plan_data
        const { data: plan, error: fetchError } = await supabase
            .from("content_plans")
            .select("id, automation_status, catch_up_mode, plan_data")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

        if (fetchError || !plan) {
            return NextResponse.json({ automation_status: null, missedCount: 0 })
        }

        // Calculate missed articles (scheduled before today, still pending)
        const today = new Date().toISOString().split('T')[0]
        const planData = plan.plan_data as ContentPlanItem[]
        const missedCount = planData.filter(
            item => item.scheduled_date < today && item.status === "pending"
        ).length

        return NextResponse.json({
            automation_status: plan.automation_status || "paused",
            catch_up_mode: plan.catch_up_mode || "gradual",
            missedCount
        })
    } catch (e: any) {
        console.error("Automation GET error:", e)
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
    }
}
