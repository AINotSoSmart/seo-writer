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

        const { sitemapUrl, brandId } = await req.json()
        if (!sitemapUrl || !brandId) return NextResponse.json({ error: "Sitemap URL and Brand ID are required" }, { status: 400 })

        // Trigger the sync task
        const handle = await syncInternalLinks.trigger({
            userId: user.id,
            sitemapUrl,
            brandId
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
