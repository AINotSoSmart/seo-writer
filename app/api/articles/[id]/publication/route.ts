import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

function canonical(value: string): string {
    const url = new URL(value)
    if (url.protocol !== "https:") throw new Error("The public URL must use HTTPS.")
    url.hash = ""
    url.search = ""
    url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    return url.toString()
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    if (body.confirmed !== true || typeof body.publicationUrl !== "string") {
        return NextResponse.json(
            { error: "Confirm the final public URL before marking this article published." },
            { status: 400 },
        )
    }

    const { data: article } = await (supabase as any)
        .from("articles")
        .select("id, planned_article_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    if (!article?.planned_article_id) {
        return NextResponse.json(
            { error: "This article is not part of a delivered subscription batch." },
            { status: 404 },
        )
    }

    const { data: planned } = await (supabase as any)
        .from("planned_articles")
        .select("id, target_url, delivery_status")
        .eq("id", article.planned_article_id)
        .eq("user_id", user.id)
        .maybeSingle()
    if (!planned || planned.delivery_status !== "delivered") {
        return NextResponse.json(
            { error: "Only a delivered article can be marked published." },
            { status: 409 },
        )
    }

    let publicationUrl: string
    try {
        publicationUrl = canonical(body.publicationUrl)
        if (canonical(planned.target_url) !== publicationUrl) {
            return NextResponse.json(
                {
                    error: "The final URL does not match the frozen program URL.",
                    expectedUrl: planned.target_url,
                },
                { status: 409 },
            )
        }
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Invalid public URL." },
            { status: 400 },
        )
    }

    const publishedAt = new Date().toISOString()
    const admin = createAdminClient() as any
    const { error } = await admin
        .from("planned_articles")
        .update({
            publication_status: "published",
            publication_url: publicationUrl,
            published_at: publishedAt,
            updated_at: publishedAt,
        })
        .eq("id", planned.id)
        .eq("user_id", user.id)
    if (error) {
        return NextResponse.json({ error: "Unable to save publication." }, { status: 500 })
    }

    await admin
        .from("articles")
        .update({ published_at: publishedAt })
        .eq("id", article.id)
        .eq("user_id", user.id)

    return NextResponse.json({ success: true, publicationUrl, publishedAt })
}
