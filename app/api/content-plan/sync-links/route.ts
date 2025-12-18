import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { syncInternalLinks } from "@/trigger/sync-links"

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { sitemapUrl } = await req.json()

        if (!sitemapUrl) {
            return NextResponse.json({ error: "Sitemap URL is required" }, { status: 400 })
        }

        // Trigger the task
        const handle = await syncInternalLinks.trigger({
            userId: user.id,
            sitemapUrl
        })

        return NextResponse.json({
            success: true,
            message: "Sync started",
            taskId: handle.id
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
