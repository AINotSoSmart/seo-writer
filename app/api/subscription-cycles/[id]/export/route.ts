/* eslint-disable @typescript-eslint/no-explicit-any -- cycle-output relations are absent from the checked-in generated database types. */
import JSZip from "jszip"
import { NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

export const runtime = "nodejs"

function safeName(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-+|-+$)/g, "")
            .slice(0, 72) || "draft"
    )
}

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> },
) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const db = supabase as any
    const { data: cycle } = await db
        .from("subscription_cycles")
        .select("id, state, period_start, period_end")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 })
    if (cycle.state !== "delivered") {
        return NextResponse.json(
            { error: "The complete batch is not delivered yet." },
            { status: 409 },
        )
    }

    const { data: actions } = await db
        .from("cycle_actions")
        .select("id, rank, resolution_type, target_url, selection_reason")
        .eq("cycle_id", id)
        .eq("user_id", user.id)
        .order("rank", { ascending: true })
    const actionIds = (actions || []).map((row: any) => row.id)
    if (actionIds.length === 0) {
        return NextResponse.json(
            { error: "This report-only cycle has no draft batch to export." },
            { status: 409 },
        )
    }
    const { data: planned } = actionIds.length
        ? await db
              .from("planned_articles")
              .select("id, cycle_action_id, article_id, title, slug, target_url, delivery_status")
              .in("cycle_action_id", actionIds)
              .eq("user_id", user.id)
        : { data: [] }
    const articleIds = (planned || []).map((row: any) => row.article_id).filter(Boolean)
    const { data: articles } = articleIds.length
        ? await db
              .from("articles")
              .select("id, raw_content, final_html, meta_description")
              .in("id", articleIds)
              .eq("user_id", user.id)
        : { data: [] }

    if (
        (planned || []).length !== actionIds.length ||
        (articles || []).length !== actionIds.length ||
        (planned || []).some((row: any) => row.delivery_status !== "delivered")
    ) {
        return NextResponse.json(
            { error: "The delivered batch is incomplete and cannot be exported." },
            { status: 409 },
        )
    }

    const plannedByAction = new Map<string, any>(
        (planned || []).map((row: any) => [row.cycle_action_id, row]),
    )
    const articleById = new Map<string, any>(
        (articles || []).map((row: any) => [row.id, row]),
    )
    const manifest = (actions || []).map((action: any) => {
        const output = plannedByAction.get(action.id)
        const article = articleById.get(output.article_id)
        return {
            rank: action.rank,
            resolutionType: action.resolution_type,
            title: output.title,
            targetUrl: output.target_url,
            selectionReason: action.selection_reason,
            slug: output.slug,
            articleId: article.id,
        }
    })

    const zip = new JSZip()
    zip.file(
        "manifest.json",
        JSON.stringify(
            {
                cycleId: cycle.id,
                periodStart: cycle.period_start,
                periodEnd: cycle.period_end,
                exportedAt: new Date().toISOString(),
                outputs: manifest,
            },
            null,
            2,
        ),
    )
    for (const item of manifest) {
        const output = plannedByAction.get((actions || []).find((row: any) => row.rank === item.rank).id)
        const article = articleById.get(output.article_id)
        const prefix = String(item.rank).padStart(2, "0")
        const filename = `${prefix}-${item.resolutionType}-${safeName(item.title)}`
        zip.file(`${filename}.md`, article.raw_content || "")
        zip.file(`${filename}.html`, article.final_html || "")
    }

    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
    const period = new Date(cycle.period_start).toISOString().slice(0, 10)
    return new NextResponse(Buffer.from(bytes), {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="flipaeo-cycle-${period}.zip"`,
            "Cache-Control": "private, no-store",
        },
    })
}
