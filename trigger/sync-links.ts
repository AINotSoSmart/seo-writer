import { task } from "@trigger.dev/sdk/v3"
const sitemaps = require('sitemaps')
import { createAdminClient } from "@/utils/supabase/admin"
import { extractTitleFromUrl, generateEmbedding } from "@/lib/internal-linking"

export const syncInternalLinks = task({
    id: "sync-internal-links",
    run: async (payload: { userId: string; sitemapUrl: string }) => {
        const { userId, sitemapUrl } = payload
        console.log(`📡 Starting sitemap sync for user ${userId} from ${sitemapUrl}`)

        const supabase = createAdminClient() as any

        try {
            // 1. Fetch URLs from sitemap
            console.log(`🔍 Fetching sitemaps from: ${sitemapUrl}`)
            const result = await sitemaps.fetch(sitemapUrl)
            const urls = Object.keys(result.sites)
            console.log(`✅ Found ${urls.length} URLs.`)

            if (urls.length === 0) {
                return { success: false, message: "No URLs found in sitemap" }
            }

            // 2. Clear existing links for this user (optional, but keep it clean)
            // Or only upsert new ones. For now, let's clear to avoid duplicates.
            await supabase
                .from("internal_links")
                .delete()
                .eq("user_id", userId)

            // 3. Process URLs in batches to avoid rate limits
            const BATCH_SIZE = 10
            let syncedCount = 0

            for (let i = 0; i < urls.length; i += BATCH_SIZE) {
                const batch = urls.slice(i, i + BATCH_SIZE)
                console.log(`⚙️ Processing batch ${i / BATCH_SIZE + 1}...`)

                const inserts = await Promise.all(batch.map(async (url) => {
                    const title = extractTitleFromUrl(url)

                    try {
                        const embedding = await generateEmbedding(title)
                        return {
                            user_id: userId,
                            url,
                            title,
                            embedding
                        }
                    } catch (e) {
                        console.error(`❌ Failed embedding for ${url}:`, e)
                        return null
                    }
                }))

                const validInserts = inserts.filter(item => item !== null)

                if (validInserts.length > 0) {
                    const { error } = await supabase
                        .from("internal_links")
                        .insert(validInserts)

                    if (error) {
                        console.error("❌ DB Insert error:", error)
                    } else {
                        syncedCount += validInserts.length
                    }
                }
            }

            console.log(`🎉 Successfully synced ${syncedCount} internal links for user ${userId}`)
            return { success: true, syncedCount }

        } catch (error: any) {
            console.error("❌ Sync failed:", error)
            return { success: false, error: error.message }
        }
    }
})
