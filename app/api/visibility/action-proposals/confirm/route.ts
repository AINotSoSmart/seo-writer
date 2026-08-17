/* eslint-disable @typescript-eslint/no-explicit-any -- grouped confirmation RPC types follow the unapplied forward migration. */
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    let body: { proposalSetId?: string; proposalIds?: string[] }
    try {
        body = (await req.json()) as typeof body
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (!body.proposalSetId || !Array.isArray(body.proposalIds)) {
        return NextResponse.json(
            { error: "proposalSetId and proposalIds are required" },
            { status: 400 },
        )
    }
    if (body.proposalIds.length > 8 || new Set(body.proposalIds).size !== body.proposalIds.length) {
        return NextResponse.json(
            { error: "Choose no more than eight unique actions." },
            { status: 400 },
        )
    }

    const { data, error } = await (supabase as any).rpc("confirm_action_proposals", {
        p_proposal_set_id: body.proposalSetId,
        p_proposal_ids: body.proposalIds,
    })
    if (error) {
        console.error("[confirm-action-proposals] Confirmation failed:", error)
        return NextResponse.json(
            {
                error:
                    "The grouped work could not be confirmed. Nothing entered production; refresh the page and try again.",
            },
            { status: 409 },
        )
    }
    return NextResponse.json(data)
}
