import { createAdminClient } from "@/utils/supabase/admin"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { generateEmbedding } from "@/lib/gemini-embedding"

/**
 * Extracts a readable title from a URL slug.
 * Example: "/blog/how-to-fix-photos" -> "How To Fix Photos"
 */
export function extractTitleFromUrl(url: string): string {
    try {
        const urlObj = new URL(url)
        const path = urlObj.pathname

        // Split by / and filter out empty segments
        const segments = path.split('/').filter(Boolean)
        if (segments.length === 0) return "Home"

        // Get the last significant segment
        let lastSegment = segments[segments.length - 1]

        // Remove file extensions if any (.html, .php, etc)
        lastSegment = lastSegment.split('.')[0]

        // Replace hyphens and underscores with spaces
        let title = lastSegment.replace(/[-_]/g, ' ')

        // Title Case
        title = title.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        })

        // Remove control characters just in case
        // eslint-disable-next-line no-control-regex
        return title.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim()
    } catch {
        // If URL parsing fails, return a fallback or the input
        return url
    }
}

// Re-export for backward compatibility
export { generateEmbedding } from "@/lib/gemini-embedding"

/**
 * Searches for the top N relevant internal links for a given focus.
 */
export async function getRelevantInternalLinks(
    articleTitle: string,
    articleKeyword: string,
    userId: string,
    brandId?: string,
    limit: number = 5
) {
    try {
        const supabase = createAdminClient() as any

        // Create a combined search string for context
        const searchString = `${articleTitle} ${articleKeyword}`
        const embedding = await generateEmbedding(searchString, "SEMANTIC_SIMILARITY")

        // Call the RPC function we defined in the migration
        const { data, error } = await supabase.rpc('match_internal_links', {
            query_embedding: embedding,
            match_threshold: 0.3, // Minimum similarity
            match_count: limit,
            p_user_id: userId,
            p_brand_id: brandId || null
        })

        if (error) {
            console.error("❌ Error fetching internal links from DB:", error)
            return []
        }

        return data || []
    } catch (error) {
        console.error("❌ Critical error in getRelevantInternalLinks:", error)
        return [] // Return empty to prevent crashing the whole generation
    }
}

/**
 * Check if a topic matches any existing sitemap URL using vector similarity.
 * Uses a strict threshold (0.90) to only flag obvious duplicates.
 */
export async function checkSitemapDuplication(
    topic: string,
    userId: string,
    brandId?: string | null
): Promise<{ isDuplicate: boolean; similarUrl: string | null }> {
    try {
        const supabase = createAdminClient() as any
        const embedding = await generateEmbedding(topic, "SEMANTIC_SIMILARITY")

        const { data, error } = await supabase.rpc('match_internal_links', {
            query_embedding: embedding,
            match_threshold: 0.90, // Strict threshold for deduplication
            match_count: 1,
            p_user_id: userId,
            p_brand_id: brandId || null
        })

        if (error) {
            console.error("❌ Error checking sitemap duplication:", error)
            return { isDuplicate: false, similarUrl: null }
        }

        if (data && data.length > 0) {
            return {
                isDuplicate: true,
                similarUrl: data[0].url
            }
        }

        return { isDuplicate: false, similarUrl: null }

    } catch (error) {
        console.error("❌ Error in checkSitemapDuplication:", error)
        return { isDuplicate: false, similarUrl: null }
    }
}
