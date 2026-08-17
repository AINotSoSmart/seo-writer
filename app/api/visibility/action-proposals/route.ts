/* eslint-disable @typescript-eslint/no-explicit-any -- proposal tables are unavailable until the forward migration is applied and types regenerated. */
import { NextRequest, NextResponse } from "next/server"

import { buildActionProposalsForRun } from "@/lib/visibility/action-proposal-planner"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

/** Retries page-aware planning without buying the 40 AI answers again. */
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    let body: { runId?: string }
    try {
        body = (await req.json()) as typeof body
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!body.runId) {
        return NextResponse.json({ error: "runId is required" }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const { data: run } = await admin
        .from("ai_probe_runs")
        .select("id")
        .eq("id", body.runId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .maybeSingle()
    if (!run) {
        return NextResponse.json(
            { error: "Completed measurement not found" },
            { status: 404 },
        )
    }

    try {
        const result = await buildActionProposalsForRun({
            supabase: admin,
            runId: run.id,
        })
        return NextResponse.json(result)
    } catch (error) {
        console.error("[action-proposals] Planning failed:", error)
        return NextResponse.json(
            {
                error:
                    "We could not finish checking the site against this measurement. The saved answers are safe; retry planning without rerunning them.",
            },
            { status: 500 },
        )
    }
}
