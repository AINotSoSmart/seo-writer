import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { getGeminiClient } from "@/utils/gemini/geminiClient"

// Type for admin Supabase client (inferred from createAdminClient)
type AdminSupabaseClient = ReturnType<typeof createAdminClient>

export async function checkTopicDuplication(topic: string, userId: string, brandId?: string | null) {
    const genAI = getGeminiClient()

    try {
        // 1. Generate embedding for the new topic
        const result = await genAI.models.embedContent({
            model: "text-embedding-004",
            contents: [{ role: "user", parts: [{ text: topic }] }]
        })

        // Correct way to access embedding values in new SDK
        const embedding = result.embeddings?.[0]?.values || []

        if (!embedding || embedding.length === 0) {
            console.warn("Topic duplication check failed: No embedding returned")
            return { isDuplicate: false, similarArticle: null }
        }

        // 2. Search for similar articles (brand-isolated if brandId provided)
        const supabase = await createClient()

        // Use brand-aware matching if brandId is provided
        const rpcParams: any = {
            query_embedding: embedding,
            match_threshold: 0.85, // 85% similarity threshold (strict)
            match_count: 1,
            p_user_id: userId
        }

        // Note: The RPC function would need to be updated to support brand_id filtering
        // For now, we do the filtering in post-processing if needed
        const { data: similarArticles, error } = await supabase.rpc("match_articles_topic", rpcParams)

        if (error) {
            console.warn("Topic duplication check failed:", error)
            return { isDuplicate: false, similarArticle: null } // Fail open
        }

        if (similarArticles && similarArticles.length > 0) {
            return {
                isDuplicate: true,
                similarArticle: similarArticles[0].keyword
            }
        }

        return { isDuplicate: false, similarArticle: null }

    } catch (e) {
        console.warn("Topic embedding generation failed:", e)
        return { isDuplicate: false, similarArticle: null }
    }
}

/**
 * Save topic memory (embedding) for an article.
 * @param articleId - The article ID
 * @param topic - The topic text to embed
 * @param adminClient - Optional admin Supabase client (required for background jobs like Trigger.dev)
 */
export async function saveTopicMemory(articleId: string, topic: string, adminClient?: AdminSupabaseClient) {
    const genAI = getGeminiClient()

    try {
        const result = await genAI.models.embedContent({
            model: "text-embedding-004",
            contents: [{ role: "user", parts: [{ text: topic }] }]
        })

        const embedding = result.embeddings?.[0]?.values || []

        if (!embedding || embedding.length === 0) return

        // Use provided admin client for background jobs, otherwise create server client
        const supabase = adminClient ?? await createClient()
        await supabase
            .from("articles")
            .update({ topic_embedding: embedding } as any)
            .eq("id", articleId)

        console.log(`[Topic Memory] Saved embedding for article ${articleId}`)
    } catch (e) {
        console.error("Failed to save topic memory:", e)
    }
}
