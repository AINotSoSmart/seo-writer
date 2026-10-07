/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import { NextRequest, NextResponse } from "next/server"

import { normalizeHost } from "@/lib/engine/schedule"
import { loadEngineSettings } from "@/lib/engine/settings"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

interface SettingsBody {
    brandId?: string
    enabled?: boolean
    ownedHosts?: string[]
    aliases?: string[]
    wordpressConnectionId?: string | null
}

export async function PATCH(req: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as SettingsBody
    if (!body.brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 })

    const admin = createAdminClient() as any
    let settings
    try {
        settings = await loadEngineSettings(admin, body.brandId)
    } catch {
        return NextResponse.json({ error: "Tool not found" }, { status: 404 })
    }
    if (settings.userId !== user.id) return NextResponse.json({ error: "Tool not found" }, { status: 404 })

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.enabled === "boolean") update.enabled = body.enabled
    if (Array.isArray(body.ownedHosts)) {
        const hosts = body.ownedHosts.map((host) => normalizeHost(String(host))).filter(Boolean)
        update.owned_hosts = [...new Set(hosts)].slice(0, 20)
    }
    if (Array.isArray(body.aliases)) {
        update.aliases = [...new Set(body.aliases.map((alias) => String(alias).trim()).filter((alias) => alias.length >= 2))].slice(0, 20)
    }
    if (body.wordpressConnectionId !== undefined) {
        if (body.wordpressConnectionId) {
            const { data: connection } = await admin
                .from("wordpress_connections")
                .select("id")
                .eq("id", body.wordpressConnectionId)
                .eq("user_id", user.id)
                .maybeSingle()
            if (!connection) return NextResponse.json({ error: "WordPress connection not found" }, { status: 404 })
            await admin.from("wordpress_connections").update({ brand_id: body.brandId }).eq("id", connection.id)
        }
        update.wordpress_connection_id = body.wordpressConnectionId || null
    }

    const { error } = await admin.from("engine_brand_settings").update(update).eq("brand_id", body.brandId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ settings: await loadEngineSettings(admin, body.brandId) })
}
