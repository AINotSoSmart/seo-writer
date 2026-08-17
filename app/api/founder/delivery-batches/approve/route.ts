/* eslint-disable @typescript-eslint/no-explicit-any -- founder delivery RPC types follow the unapplied forward migration. */
import { NextRequest, NextResponse } from "next/server"

import { isFounderUser } from "@/lib/founder"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user || !isFounderUser(user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    let body: { cycleId?: string }
    try {
        body = (await req.json()) as typeof body
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!body.cycleId) {
        return NextResponse.json({ error: "cycleId is required" }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const { data: cycle } = await admin
        .from("subscription_cycles")
        .select("id")
        .eq("id", body.cycleId)
        .eq("state", "ready")
        .maybeSingle()
    if (!cycle) {
        return NextResponse.json(
            { error: "Only a complete ready batch can be approved." },
            { status: 409 },
        )
    }

    const { data, error } = await admin.rpc("deliver_subscription_cycle", {
        p_cycle_id: cycle.id,
    })
    if (error || !data) {
        console.error("[founder-batch-approval] Delivery failed:", error)
        return NextResponse.json(
            { error: "The batch failed its final delivery checks and remains withheld." },
            { status: 409 },
        )
    }
    return NextResponse.json({ delivered: true })
}
