import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getGeminiClient } from "@/utils/gemini/geminiClient"

export const maxDuration = 300 // 5 minute timeout

/**
 * POST /api/admin/backfill-embeddings
 * 
 * Backfills topic_embedding for all articles that don't have one.
 * Also populates answer_coverage for completed articles.
 * 
 * This is an admin-only endpoint for one-time data migration.
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { mode = "topic_embedding" } = await req.json() as {
            mode?: "topic_embedding" | "answer_coverage" | "both"
        }

        const genAI = getGeminiClient()
        const results = {
            topic_embedding: { processed: 0, failed: 0, skipped: 0 },
            answer_coverage: { processed: 0, failed: 0, skipped: 0 }
        }

        // --- BACKFILL TOPIC EMBEDDINGS ---
        if (mode === "topic_embedding" || mode === "both") {
            console.log("[Backfill] Starting topic_embedding backfill...")

            // Fetch all articles without topic_embedding for this user
            const { data: articles, error } = await supabase
                .from("articles")
                .select("id, keyword, outline, status")
                .eq("user_id", user.id)
                .is("topic_embedding", null)

            if (error) {
                console.error("[Backfill] Failed to fetch articles:", error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            console.log(`[Backfill] Found ${articles?.length || 0} articles without topic_embedding`)

            for (const article of (articles || [])) {
                try {
                    // Build topic signal: Title + Keyword (same as generate-blog.ts)
                    // Title is stored inside outline JSONB, not as a direct column
                    const outline = article.outline as { title?: string } | null
                    const topicSignal = outline?.title
                        ? `${outline.title} : ${article.keyword}`
                        : article.keyword

                    if (!topicSignal) {
                        results.topic_embedding.skipped++
                        continue
                    }

                    // Generate embedding
                    const result = await genAI.models.embedContent({
                        model: "text-embedding-004",
                        contents: [{ role: "user", parts: [{ text: topicSignal }] }]
                    })

                    const embedding = result.embeddings?.[0]?.values || []

                    if (!embedding || embedding.length === 0) {
                        results.topic_embedding.skipped++
                        continue
                    }

                    // Update article
                    const { error: updateError } = await supabase
                        .from("articles")
                        .update({ topic_embedding: embedding } as any)
                        .eq("id", article.id)

                    if (updateError) {
                        console.error(`[Backfill] Failed to update article ${article.id}:`, updateError)
                        results.topic_embedding.failed++
                    } else {
                        console.log(`[Backfill] ✅ Saved embedding for: ${article.keyword}`)
                        results.topic_embedding.processed++
                    }

                    // Small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 100))

                } catch (e) {
                    console.error(`[Backfill] Error processing article ${article.id}:`, e)
                    results.topic_embedding.failed++
                }
            }
        }

        // --- BACKFILL ANSWER COVERAGE ---
        if (mode === "answer_coverage" || mode === "both") {
            console.log("[Backfill] Starting answer_coverage backfill...")

            // For answer_coverage, we need to import the analyzer dynamically
            // to avoid circular dependencies
            const { analyzeArticleCoverage } = await import("@/lib/coverage/analyzer")

            // Fetch all completed articles for this user
            const { data: completedArticles, error } = await supabase
                .from("articles")
                .select("id, keyword, raw_content, brand_id, status")
                .eq("user_id", user.id)
                .eq("status", "completed")

            if (error) {
                console.error("[Backfill] Failed to fetch completed articles:", error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            console.log(`[Backfill] Found ${completedArticles?.length || 0} completed articles`)

            for (const article of (completedArticles || [])) {
                try {
                    if (!article.raw_content || !article.keyword) {
                        results.answer_coverage.skipped++
                        continue
                    }

                    // Derive cluster from keyword
                    const cluster = article.keyword.split(" ").slice(0, 2).join(" ")

                    await analyzeArticleCoverage(
                        article.id,
                        article.raw_content,
                        article.keyword,
                        cluster,
                        user.id,
                        article.brand_id
                    )

                    console.log(`[Backfill] ✅ Analyzed coverage for: ${article.keyword}`)
                    results.answer_coverage.processed++

                    // Delay to avoid rate limits (LLM call per article)
                    await new Promise(resolve => setTimeout(resolve, 500))

                } catch (e) {
                    console.error(`[Backfill] Error analyzing article ${article.id}:`, e)
                    results.answer_coverage.failed++
                }
            }
        }

        console.log("[Backfill] Complete!", results)

        return NextResponse.json({
            success: true,
            message: "Backfill complete",
            results
        })

    } catch (error: any) {
        console.error("[Backfill] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
