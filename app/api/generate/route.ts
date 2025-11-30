import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const { keyword, voiceId, brandId, title } = await req.json()
    if (!keyword || !voiceId) {
      return NextResponse.json({ error: "Missing keyword or voiceId" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const supabaseServer = await createClient()
    const { data: userData } = await supabaseServer.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // We might want to store brandId in articles table later, for now just passing to task
    const { data: article, error } = await supabase
      .from("articles")
      .insert({ user_id: userId, keyword, voice_id: voiceId, status: "queued" })
      .select()
      .single()

    if (error || !article) {
      return NextResponse.json({ error: "Failed to create article" }, { status: 500 })
    }

    try {
      const handle = await tasks.trigger("generate-blog-post", {
        articleId: article.id,
        keyword,
        voiceId,
        brandId, // Pass brandId
        title, // Pass selected title
      })
      return NextResponse.json({ jobId: handle.id, articleId: article.id })
    } catch (err: unknown) {
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