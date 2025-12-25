import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { ArticleType } from "@/lib/prompts/article-types"
import { hasCredits, deductCredits, addCredits } from "@/lib/credits"

export async function POST(req: NextRequest) {
  try {
    const {
      keyword,
      brandId,
      title,
      articleType = 'informational',
      supportingKeywords = [],
      cluster = '',
      planId,
      itemId
    } = await req.json()

    if (!keyword || !brandId) {
      return NextResponse.json({ error: "Missing keyword or brandId" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const supabaseServer = await createClient()
    const { data: userData } = await supabaseServer.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. Verify credits BEFORE creating article to prevent zombie records
    const { hasCredits: userHasCredits } = await hasCredits(userId, 1)
    if (!userHasCredits) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
    }

    // 2. Deduct 1 credit
    const { success: deductionSuccess, error: deductionError } = await deductCredits(userId, 1, `Article generation: ${keyword}`)
    if (!deductionSuccess) {
      console.error(`Failed to deduct credits for user ${userId}:`, deductionError)
      return NextResponse.json({ error: "Failed to process credits" }, { status: 500 })
    }

    // 3. Create article record
    const { data: article, error } = await supabase
      .from("articles")
      .insert({
        user_id: userId,
        keyword,
        brand_id: brandId,
        status: "queued",
        article_type: articleType
      })
      .select()
      .single()

    if (error || !article) {
      // Refund if article creation fails
      await addCredits(userId, 1, "Refund: Article creation failed")
      return NextResponse.json({ error: "Failed to create article record" }, { status: 500 })
    }

    // 4. Trigger generation task
    try {
      const handle = await tasks.trigger("generate-blog-post", {
        articleId: article.id,
        keyword,
        brandId,
        title,
        articleType: articleType as ArticleType,
        supportingKeywords,
        cluster,
        planId,
        itemId
      })
      return NextResponse.json({ jobId: handle.id, articleId: article.id })
    } catch (err: unknown) {
      // Refund if trigger fails
      console.error("Trigger failed, refunding credits...", err)
      await addCredits(userId, 1, "Refund: Task trigger failed")

      const msg = err instanceof Error ? err.message : String(err)
      await supabase
        .from("articles")
        .update({ status: "failed", error_message: msg, failed_at_phase: "trigger" })
        .eq("id", article.id)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}