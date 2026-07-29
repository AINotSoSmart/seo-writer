import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

async function ownedProgram(request: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: "Unauthorized", status: 401 } as const

    const requestedProgramId =
        request.nextUrl.searchParams.get("programId") ||
        (await request.clone().json().catch(() => ({})))?.programId

    let query = (supabase as any)
        .from("programs")
        .select(
            "id, scope_status, status, paused_at, tier, clusters_per_month, cancellation_status",
        )
        .eq("user_id", user.id)
        .in("scope_status", ["active", "paused", "scope_delivered"])

    if (requestedProgramId) query = query.eq("id", requestedProgramId)

    const { data: program, error } = await query
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        return { error: "Unable to load the program.", status: 500 } as const
    }
    if (!program) return { error: "No finite program found.", status: 404 } as const

    return { supabase, program } as const
}

/**
 * Resume deliveries. The SQL function moves every unstarted cluster by the
 * exact pause duration so the frozen cadence cannot be compressed.
 */
export async function POST(request: NextRequest) {
    const result = await ownedProgram(request)
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    if (result.program.scope_status !== "paused") {
        return NextResponse.json(
            { error: "Only a paused program can resume deliveries." },
            { status: 409 },
        )
    }

    const { error } = await (result.supabase as any).rpc("resume_program", {
        p_program_id: result.program.id,
    })
    if (error) {
        console.error("[program/resume]", error)
        return NextResponse.json({ error: "Unable to resume deliveries." }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        automation_status: "active",
        scope_status: "active",
        message: "Deliveries resumed. The remaining cadence has been preserved.",
    })
}

/**
 * Pause deliveries only. Billing continues, and generation already in progress
 * may finish behind the cluster delivery gate.
 */
export async function DELETE(request: NextRequest) {
    const result = await ownedProgram(request)
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    if (result.program.scope_status !== "active") {
        return NextResponse.json(
            { error: "Only an active program can pause deliveries." },
            { status: 409 },
        )
    }

    const { error } = await (result.supabase as any).rpc("pause_program", {
        p_program_id: result.program.id,
    })
    if (error) {
        console.error("[program/pause]", error)
        return NextResponse.json({ error: "Unable to pause deliveries." }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        automation_status: "paused",
        scope_status: "paused",
        message: "Deliveries paused—billing continues.",
    })
}

export async function GET(request: NextRequest) {
    const result = await ownedProgram(request)
    if ("error" in result) {
        if (result.status === 404) {
            return NextResponse.json({
                automation_status: null,
                scope_status: null,
                missedCount: 0,
            })
        }
        return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const now = new Date().toISOString()
    const { count } = await (result.supabase as any)
        .from("program_clusters")
        .select("id", { count: "exact", head: true })
        .eq("program_id", result.program.id)
        .in("state", ["scheduled", "blocked"])
        .lt("scheduled_for", now)

    return NextResponse.json({
        programId: result.program.id,
        automation_status:
            result.program.scope_status === "paused" ? "paused" : "active",
        scope_status: result.program.scope_status,
        cancellation_status: result.program.cancellation_status,
        missedCount: count || 0,
        pausedAt: result.program.paused_at,
        billingContinuesWhilePaused: true,
    })
}
