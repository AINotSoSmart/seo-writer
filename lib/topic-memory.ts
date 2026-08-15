
import { createAdminClient } from "@/utils/supabase/admin"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { generateEmbedding } from "@/lib/gemini-embedding"

// Type for admin Supabase client (inferred from createAdminClient)
type AdminSupabaseClient = ReturnType<typeof createAdminClient>

export async function checkTopicDuplication(
    topic: string,
    userId: string,
    brandId?: string | null
) {
    const genAI = getGeminiClient()

    try {
        // 1. Generate embedding for the new topic
        const embedding = await generateEmbedding(topic)

        if (!embedding || embedding.length === 0) {
            console.warn("Topic duplication check failed: No embedding returned")
            return { isDuplicate: false, similarArticle: null }
        }

        // 2. Search for similar articles (brand-isolated)
        // Use admin client since this runs server-side (both API routes and scheduler)
        const supabase = createAdminClient()

        // Brand-aware matching: pass brandId to RPC for isolation
        const rpcParams: any = {
            query_embedding: embedding,
            match_threshold: 0.85, // 85% similarity threshold (strict)
            match_count: 1,
            p_user_id: userId,
            p_brand_id: brandId || null  // Brand isolation - only match within same brand
        }

        // Cast to any since match_articles_topic RPC isn't in generated types yet
        const { data: similarArticles, error } = await (supabase as any).rpc("match_articles_topic", rpcParams) as {
            data: Array<{ keyword: string; similarity: number }> | null;
            error: any;
        }

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
        const embedding = await generateEmbedding(topic)

        if (!embedding || embedding.length === 0) return

        // Use provided admin client for background jobs, or create one
        const supabase = adminClient ?? createAdminClient()
        await supabase
            .from("articles")
            .update({ topic_embedding: embedding } as any)
            .eq("id", articleId)
    } catch (e) {
        console.error("Failed to save topic memory:", e)
    }
}
