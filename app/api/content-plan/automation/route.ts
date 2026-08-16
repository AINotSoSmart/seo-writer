/* eslint-disable @typescript-eslint/no-explicit-any -- forward Phase 3 RPCs are absent from generated database types until migration. */
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
        .select("id, status, paused_at, plan_id")
        .eq("user_id", user.id)
        .in("status", ["active", "paused"])
    if (requestedProgramId) query = query.eq("id", requestedProgramId)

    const { data: program, error } = await query
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    if (error) return { error: "Unable to load the subscription.", status: 500 } as const
    if (!program) return { error: "No recurring program found.", status: 404 } as const
    return { supabase, program } as const
}

/** Resume future cycle production. Existing reports and drafts never disappear. */
export async function POST(request: NextRequest) {
    const result = await ownedProgram(request)
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    if (result.program.status !== "paused") {
        return NextResponse.json(
            { error: "Only a paused subscription can resume deliveries." },
            { status: 409 },
        )
    }

    const { error } = await (result.supabase as any).rpc("resume_program", {
        p_program_id: result.program.id,
    })
    if (error) return NextResponse.json({ error: "Unable to resume deliveries." }, { status: 500 })

    return NextResponse.json({ success: true, automation_status: "active" })
}

/** Pause future cycle production. Billing remains a separate subscription choice. */
export async function DELETE(request: NextRequest) {
    const result = await ownedProgram(request)
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    if (result.program.status !== "active") {
        return NextResponse.json(
            { error: "Only an active subscription can pause deliveries." },
            { status: 409 },
        )
    }

    const { error } = await (result.supabase as any).rpc("pause_program", {
        p_program_id: result.program.id,
    })
    if (error) return NextResponse.json({ error: "Unable to pause deliveries." }, { status: 500 })

    return NextResponse.json({ success: true, automation_status: "paused" })
}

export async function GET(request: NextRequest) {
    const result = await ownedProgram(request)
    if ("error" in result) {
        if (result.status === 404) {
            return NextResponse.json({ automation_status: null, waitingCycles: 0 })
        }
        return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { count } = await (result.supabase as any)
        .from("subscription_cycles")
        .select("id", { count: "exact", head: true })
        .eq("program_id", result.program.id)
        .in("state", ["pending", "measuring", "awaiting_input", "producing", "ready"])

    return NextResponse.json({
        programId: result.program.id,
        automation_status: result.program.status,
        waitingCycles: count || 0,
        pausedAt: result.program.paused_at,
        billingContinuesWhilePaused: true,
    })
}
