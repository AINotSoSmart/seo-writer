import { task } from "@trigger.dev/sdk/v3"
import Sitemapper from 'sitemapper'
import { createAdminClient } from "@/utils/supabase/admin"
import { extractTitleFromUrl, generateEmbedding } from "@/lib/internal-linking"

export const syncInternalLinks = task({
    id: "sync-internal-links",
    run: async (payload: { userId: string; sitemapUrl: string; brandId: string }) => {
        const { userId, sitemapUrl, brandId } = payload
        console.log(`📡 Starting sitemap sync for user ${userId} | Brand: ${brandId} | Sitemap: ${sitemapUrl}`)

        const supabase = createAdminClient() as any
        const sitemapper = new Sitemapper({
            url: sitemapUrl,
            timeout: 15000, // 15 seconds
        })

        try {
            // 1. Fetch URLs from sitemap
            console.log(`🔍 Fetching sitemaps from: ${sitemapUrl}`)
            const { sites } = await sitemapper.fetch()
            const sitemapUrls = Array.from(new Set(sites as string[])) // Deduplicate URLs from sitemap
            console.log(`✅ Found ${sitemapUrls.length} URLs in sitemap.`)

            if (sitemapUrls.length === 0) {
                return { success: false, message: "No URLs found in sitemap" }
            }

            // 2. Fetch existing URLs from DB for this brand
            const { data: existingRecords, error: fetchError } = await supabase
                .from("internal_links")
                .select("url")
                .eq("user_id", userId)
                .eq("brand_id", brandId)

            if (fetchError) {
                console.error("❌ Error fetching existing links:", fetchError)
                throw fetchError
            }

            const existingUrls = new Set<string>(existingRecords?.map((r: any) => r.url as string) || [])
            console.log(`📊 DB currently has ${existingUrls.size} links for this brand.`)

            // 3. LEGACY CLEANUP: Delete any records for this user that have NULL brand_id.
            // This fixes the duplication issue where old records (pre-brand-isolation) 
            // were not being wiped by the brand-specific sync.
            console.log(`🧹 Cleaning up legacy NULL brand_id records for user ${userId}...`)
            const { error: cleanupError } = await supabase
                .from("internal_links")
                .delete()
                .eq("user_id", userId)
                .is("brand_id", null)

            if (cleanupError) {
                console.warn("⚠️ Legacy cleanup warning:", cleanupError)
            }

            // 4. Identify changes
            const urlsToDelete = Array.from(existingUrls).filter((url: string) => !sitemapUrls.includes(url))
            const urlsToAdd = sitemapUrls.filter(url => !existingUrls.has(url))

            console.log(`🔄 Incremental Update: ${urlsToAdd.length} to add, ${urlsToDelete.length} to remove.`)

            // 5. Remove old URLs
            if (urlsToDelete.length > 0) {
                await supabase
                    .from("internal_links")
                    .delete()
                    .eq("brand_id", brandId)
                    .in("url", urlsToDelete)
                console.log(`🗑️ Removed ${urlsToDelete.length} stale links.`)
            }

            // 6. Process NEW URLs in batches to avoid rate limits
            const BATCH_SIZE = 10
            let syncedCount = 0

            for (let i = 0; i < urlsToAdd.length; i += BATCH_SIZE) {
                const batch = urlsToAdd.slice(i, i + BATCH_SIZE)
                console.log(`⚙️ Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(urlsToAdd.length / BATCH_SIZE)}...`)

                const inserts = await Promise.all(batch.map(async (url) => {
                    const title = extractTitleFromUrl(url)

                    try {
                        const embedding = await generateEmbedding(title)
                        return {
                            user_id: userId,
                            brand_id: brandId,
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

            console.log(`🎉 Successfully updated internal links. Total new synced: ${syncedCount}`)
            return { success: true, added: syncedCount, removed: urlsToDelete.length }

        } catch (error: any) {
            console.error("❌ Sync failed:", error)
            return { success: false, error: error.message }
        }
    }
})
