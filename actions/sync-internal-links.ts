"use server"

import { createClient } from "@/utils/supabase/server"
import Sitemapper from 'sitemapper'
import { extractTitleFromUrl, generateEmbedding } from "@/lib/internal-linking"

/**
 * Synchronously syncs a sitemap to the internal_links table.
 * This is used during onboarding to ensure links are available before plan generation.
 * 
 * Unlike the Trigger.dev version, this runs synchronously and waits for completion.
 * 
 * Returns the titles for immediate use in plan generation.
 */
export async function syncSitemapToInternalLinksAction(
    websiteUrl: string,
    brandId: string
): Promise<{ success: boolean; titles: string[]; count: number; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, titles: [], count: 0, error: "Not authenticated" }
        }

        // Build sitemap URL
        const baseUrl = websiteUrl.replace(/\/$/, '')
        const sitemapUrl = `${baseUrl}/sitemap.xml`

        console.log(`[Sync Internal Links] Starting sync for ${sitemapUrl}`)

        // Fetch sitemap URLs
        const sitemapper = new Sitemapper({
            url: sitemapUrl,
            timeout: 15000,
        })

        const { sites } = await sitemapper.fetch()
        const sitemapUrls = Array.from(new Set(sites as string[]))

        console.log(`[Sync Internal Links] Found ${sitemapUrls.length} URLs`)

        if (sitemapUrls.length === 0) {
            return { success: true, titles: [], count: 0 }
        }

        // Get existing URLs to avoid duplicates
        const { data: existingRecords } = await supabase
            .from("internal_links")
            .select("url")
            .eq("user_id", user.id)
            .eq("brand_id", brandId)

        const existingUrls = new Set<string>(existingRecords?.map((r: any) => r.url) || [])
        const urlsToAdd = sitemapUrls.filter(url => !existingUrls.has(url))

        console.log(`[Sync Internal Links] ${urlsToAdd.length} new URLs to add`)

        // Extract titles for all URLs (for immediate return)
        const allTitles = sitemapUrls.map(url => extractTitleFromUrl(url))

        // Process new URLs in batches
        const BATCH_SIZE = 5 // Smaller batch for faster initial sync
        let syncedCount = 0

        for (let i = 0; i < urlsToAdd.length; i += BATCH_SIZE) {
            const batch = urlsToAdd.slice(i, i + BATCH_SIZE)

            const inserts = await Promise.all(batch.map(async (url) => {
                const title = extractTitleFromUrl(url)

                try {
                    const embedding = await generateEmbedding(title)
                    return {
                        user_id: user.id,
                        brand_id: brandId,
                        url,
                        title,
                        embedding
                    }
                } catch (e) {
                    console.error(`[Sync Internal Links] Failed embedding for ${url}:`, e)
                    // Still save without embedding - can be backfilled later
                    return {
                        user_id: user.id,
                        brand_id: brandId,
                        url,
                        title,
                        embedding: null
                    }
                }
            }))

            const validInserts = inserts.filter(item => item !== null)

            if (validInserts.length > 0) {
                const { error } = await supabase
                    .from("internal_links")
                    .insert(validInserts)

                if (error) {
                    console.error("[Sync Internal Links] DB Insert error:", error)
                } else {
                    syncedCount += validInserts.length
                }
            }
        }

        console.log(`[Sync Internal Links] Synced ${syncedCount} new links`)

        return {
            success: true,
            titles: allTitles,
            count: syncedCount
        }
    } catch (error: any) {
        console.error("[Sync Internal Links] Error:", error)
        return { success: false, titles: [], count: 0, error: error.message }
    }
}
