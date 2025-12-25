import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { syncInternalLinks } from "@/trigger/sync-links"
import { fetchSitemapUrls, extractTitlesFromUrls } from "@/lib/sitemap"

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { sitemapUrl, brandId, contextOnly } = await req.json()
        if (!sitemapUrl) return NextResponse.json({ error: "Sitemap URL is required" }, { status: 400 })

        // If contextOnly, just return the titles without triggering the sync
        if (contextOnly) {
            try {
                // Extract base URL from sitemap URL
                const baseUrl = sitemapUrl.replace(/\/sitemap\.xml$/, '')
                const urls = await fetchSitemapUrls(baseUrl)
                const titles = extractTitlesFromUrls(urls)
                return NextResponse.json({ success: true, titles, count: titles.length })
            } catch (e: any) {
                return NextResponse.json({ success: false, titles: [], error: e.message })
            }
        }

        // Full sync requires brandId
        if (!brandId) return NextResponse.json({ error: "Brand ID is required for full sync" }, { status: 400 })

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
