/**
 * GET /api/visibility/answers?promptId=… — the stored answers for one prompt.
 *
 * Loaded on demand rather than shipped with the report. A 40-prompt run holds
 * 80 full answers; inlining them would make the dashboard's first paint carry
 * several hundred KB of markdown that most readers never open.
 */

import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function GET(req: NextRequest) {
    const promptId = req.nextUrl.searchParams.get("promptId")
    if (!promptId) {
        return NextResponse.json({ error: "promptId is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const { data: answers } = await admin
        .from("ai_probe_results")
        .select(
            "engine, surface, model, answer_text, citations, mention_count, mention_position, mentioned_entity_count, competitor_mentions, search_queries, observed_at",
        )
        .eq("prompt_id", promptId)
        .eq("user_id", user.id)
        .order("engine", { ascending: true })

    return NextResponse.json({ answers: answers || [] })
}
