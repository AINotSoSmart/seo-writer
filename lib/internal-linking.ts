import { createAdminClient } from "@/utils/supabase/admin"
import { getGeminiClient } from "@/utils/gemini/geminiClient"

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

        return title.trim()
    } catch {
        // If URL parsing fails, return a fallback or the input
        return url
    }
}

/**
 * Generates an embedding for a piece of text using Gemini.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const genAI = getGeminiClient()
        // Using the GA SDK @google/genai structure
        const result = await genAI.models.embedContent({
            model: "text-embedding-004",
            contents: [{ parts: [{ text }] }]
        })

        const embedding = (result as any).embeddings && (result as any).embeddings[0]

        if (!embedding || !embedding.values) {
            throw new Error("Failed to get embedding values from Gemini response")
        }

        return embedding.values
    } catch (error) {
        console.error("❌ Error generating embedding:", error)
        throw error
    }
}

/**
 * Searches for the top N relevant internal links for a given focus.
 */
export async function getRelevantInternalLinks(
    articleTitle: string,
    articleKeyword: string,
    userId: string,
    limit: number = 5
) {
    try {
        const supabase = createAdminClient() as any

        // Create a combined search string for context
        const searchString = `${articleTitle} ${articleKeyword}`
        const embedding = await generateEmbedding(searchString)

        // Call the RPC function we defined in the migration
        const { data, error } = await supabase.rpc('match_internal_links', {
            query_embedding: embedding,
            match_threshold: 0.3, // Minimum similarity
            match_count: limit,
            p_user_id: userId
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
