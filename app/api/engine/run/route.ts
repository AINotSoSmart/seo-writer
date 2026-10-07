/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import { NextRequest, NextResponse } from "next/server"

import { EngineStartError, startEngineWeek } from "@/lib/engine/measure"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export const maxDuration = 60

/** "Run now": this week's measurement for one tool, outside the Monday schedule. */
export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { brandId?: string }
    if (!body.brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 })

    try {
        const week = await startEngineWeek({
            admin: createAdminClient() as any,
            userId: user.id,
            brandId: body.brandId,
            source: "manual",
        })
        return NextResponse.json(week, { status: 202 })
    } catch (error) {
        if (error instanceof EngineStartError) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        console.error("[engine] run now failed:", error)
        return NextResponse.json({ error: "The run could not be started." }, { status: 500 })
    }
}
