/* eslint-disable @typescript-eslint/no-explicit-any -- planned-output relations are not present in the checked-in generated database types. */
import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export async function PATCH(
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
    const { data: article } = await (supabase as any)
        .from("articles")
        .select("id, planned_article_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 })

    let frozenSlug: string | null = null
    if (article.planned_article_id) {
        const { data: planned } = await (supabase as any)
            .from("planned_articles")
            .select("delivery_status, slug")
            .eq("id", article.planned_article_id)
            .eq("user_id", user.id)
            .maybeSingle()
        if (!planned || planned.delivery_status !== "delivered") {
            return NextResponse.json(
                { error: "This draft is not part of a delivered batch." },
                { status: 409 },
            )
        }
        frozenSlug = planned.slug
    }

    const update: Record<string, unknown> = {}
    if (typeof body.rawContent === "string") {
        if (body.rawContent.length > 120_000) {
            return NextResponse.json({ error: "Draft is too large." }, { status: 400 })
        }
        update.raw_content = body.rawContent
    }
    if (typeof body.finalHtml === "string") {
        if (body.finalHtml.length > 500_000) {
            return NextResponse.json({ error: "Rendered draft is too large." }, { status: 400 })
        }
        update.final_html = body.finalHtml
    }
    if (body.outline && typeof body.outline === "object") update.outline = body.outline
    if (typeof body.metaDescription === "string") {
        update.meta_description = body.metaDescription.slice(0, 320)
    }
    if (typeof body.slug === "string") {
        const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
        if (frozenSlug && slug !== frozenSlug) {
            return NextResponse.json(
                { error: "The delivered batch URL is frozen; its slug cannot be changed." },
                { status: 409 },
            )
        }
        update.slug = slug
    }
    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "No supported draft fields were supplied." }, { status: 400 })
    }
    update.updated_at = new Date().toISOString()

    const admin = createAdminClient() as any
    const { error } = await admin
        .from("articles")
        .update(update)
        .eq("id", article.id)
        .eq("user_id", user.id)
    if (error) return NextResponse.json({ error: "Unable to save draft." }, { status: 500 })

    return NextResponse.json({ success: true })
}
