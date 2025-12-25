"use server"

import { createClient } from "@/utils/supabase/server"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { fetchSitemapUrls, extractTitlesFromUrls, extractParentQuestions, preseedCoverage } from "@/lib/sitemap"

/**
 * Syncs a website's sitemap content to answer_coverage table.
 * This ensures the content plan knows what content already exists.
 * Should be called BEFORE generating a content plan.
 */
export async function syncSitemapToCoverage(
    websiteUrl: string,
    brandId: string
): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, count: 0, error: "Not authenticated" }
        }

        console.log(`[Sitemap Sync] Starting for ${websiteUrl}`)

        // Step 1: Fetch sitemap URLs
        const urls = await fetchSitemapUrls(websiteUrl)
        if (urls.length === 0) {
            console.log("[Sitemap Sync] No URLs found in sitemap")
            return { success: true, count: 0 }
        }

        console.log(`[Sitemap Sync] Found ${urls.length} URLs`)

        // Step 2: Extract titles from URLs
        const titles = extractTitlesFromUrls(urls)
        if (titles.length === 0) {
            console.log("[Sitemap Sync] No valid titles extracted")
            return { success: true, count: 0 }
        }

        console.log(`[Sitemap Sync] Extracted ${titles.length} titles`)

        // Step 3: Use LLM to extract parent questions
        const genAI = getGeminiClient()
        const parentQuestions = await extractParentQuestions(titles, genAI)

        console.log(`[Sitemap Sync] Extracted ${parentQuestions.length} parent questions`)

        // Step 4: Save to answer_coverage table
        const savedCount = await preseedCoverage(parentQuestions, user.id, brandId, supabase)

        console.log(`[Sitemap Sync] Saved ${savedCount} entries to answer_coverage`)

        return { success: true, count: savedCount }
    } catch (error: any) {
        console.error("[Sitemap Sync] Error:", error)
        return { success: false, count: 0, error: error.message }
    }
}
