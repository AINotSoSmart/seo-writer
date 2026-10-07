/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@trigger.dev/sdk/v3"

import { startCreate } from "@/lib/engine/produce"
import { pushArticleDraft } from "@/lib/engine/push"
import { loadEngineSettings, loadWordPressConnection } from "@/lib/engine/settings"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import type { engineProduceRefreshTask } from "@/trigger/engine"

export const maxDuration = 120

type Op = "push" | "done" | "dismiss" | "retry"

/**
 * The owner's decisions on one action:
 *   push    a ready new article goes to WordPress as a draft
 *   done    the owner applied it (a refresh or page suggestion they published)
 *   dismiss not worth doing
 *   retry   a failed action is produced again
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { op?: Op }
    const admin = createAdminClient() as any
    const { data: action } = await admin
        .from("engine_actions")
        .select("id, user_id, brand_id, kind, state, article_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 })

    const now = new Date().toISOString()
    switch (body.op) {
        case "push": {
            if (action.kind !== "create" || action.state !== "ready" || !action.article_id) {
                return NextResponse.json({ error: "Only a ready new article can be pushed." }, { status: 409 })
            }
            const settings = await loadEngineSettings(admin, action.brand_id)
            const connection = settings.wordpressConnectionId
                ? await loadWordPressConnection(admin, settings.wordpressConnectionId)
                : null
            if (!connection) {
                return NextResponse.json({ error: "Link a WordPress site to this tool first." }, { status: 409 })
            }
            try {
                const draft = await pushArticleDraft(admin, action.article_id, connection)
                await admin
                    .from("engine_actions")
                    .update({ state: "pushed", wordpress_post_id: draft.postId, wordpress_url: draft.postUrl, updated_at: now })
                    .eq("id", id)
                return NextResponse.json({ state: "pushed", ...draft })
            } catch (error) {
                return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
            }
        }
        case "done":
        case "dismiss": {
            const state = body.op === "done" ? "done" : "dismissed"
            await admin.from("engine_actions").update({ state, updated_at: now }).eq("id", id)
            return NextResponse.json({ state })
        }
        case "retry": {
            if (!["failed", "blocked_duplicate"].includes(action.state) || !["create", "refresh"].includes(action.kind)) {
                return NextResponse.json({ error: "Only a failed article or refresh can be retried." }, { status: 409 })
            }
            if (action.state === "blocked_duplicate") {
                // The owner overrules the duplicate guard: the written article is kept.
                await admin.from("engine_actions").update({ state: "ready", updated_at: now }).eq("id", id)
                return NextResponse.json({ state: "ready" })
            }
            await admin
                .from("engine_actions")
                .update({ state: "planned", failure_reason: null, article_id: null, output: null, updated_at: now })
                .eq("id", id)
            if (action.kind === "create") {
                await startCreate(admin, id)
            } else {
                await admin.from("engine_actions").update({ state: "producing" }).eq("id", id)
                await tasks.trigger<typeof engineProduceRefreshTask>("engine-produce-refresh", { actionId: id })
            }
            return NextResponse.json({ state: "producing" })
        }
        default:
            return NextResponse.json({ error: "Unknown operation" }, { status: 400 })
    }
}
