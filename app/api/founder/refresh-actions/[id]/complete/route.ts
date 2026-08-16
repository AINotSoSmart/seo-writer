/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 7 RPCs are absent from generated database types until its migration is applied and types are regenerated. */
import * as cheerio from "cheerio"
import { marked } from "marked"
import { NextRequest, NextResponse } from "next/server"

import { isFounderUser } from "@/lib/founder"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export const runtime = "nodejs"

function sanitizeReviewedHtml(value: string): string {
    const $ = cheerio.load(value)
    $("script, style, iframe, object, embed, form").remove()
    $("*").each((_, element) => {
        const attributes = "attribs" in element ? element.attribs : {}
        for (const attribute of Object.keys(attributes || {})) {
            if (attribute.toLowerCase().startsWith("on")) {
                $(element).removeAttr(attribute)
            }
        }
        for (const attribute of ["href", "src"]) {
            const target = $(element).attr(attribute)?.trim() || ""
            if (/^(?:javascript|vbscript|data:text\/html):/i.test(target)) {
                $(element).removeAttr(attribute)
            }
        }
    })
    return $("body").html() || ""
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user || !isFounderUser(user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const markdown = typeof body.markdown === "string" ? body.markdown.trim() : ""
    if (markdown.length < 300 || markdown.length > 120_000) {
        return NextResponse.json(
            { error: "Paste a reviewed refresh draft between 300 and 120,000 characters." },
            { status: 400 },
        )
    }

    const rendered = await marked.parse(markdown, { gfm: true })
    const html = sanitizeReviewedHtml(rendered)
    const admin = createAdminClient() as any
    const { data: articleId, error } = await admin.rpc(
        "complete_founder_assisted_refresh",
        {
            p_cycle_action_id: id,
            p_markdown: markdown,
            p_html: html,
            p_actor_user_id: user.id,
        },
    )
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 409 })
    }

    const { data: action } = await admin
        .from("cycle_actions")
        .select("cycle_id")
        .eq("id", id)
        .maybeSingle()
    let released = false
    if (action?.cycle_id) {
        const { data } = await admin.rpc("release_subscription_cycle_if_ready", {
            p_cycle_id: action.cycle_id,
        })
        released = Boolean(data)
    }

    return NextResponse.json({ success: true, articleId, released })
}
