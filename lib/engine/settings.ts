/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
import "server-only"

import { normalizeHost } from "./schedule"

export interface EngineSettings {
    brandId: string
    userId: string
    enabled: boolean
    ownedHosts: string[]
    aliases: string[]
    wordpressConnectionId: string | null
}

export interface EngineWordPressConnection {
    id: string
    site_url: string
    username: string
    app_password: string
    default_category_id: number | null
}

function unique(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

/**
 * The tool's engine settings, created on first use.
 *
 * Owned hosts always include the website's own host and the host of the linked
 * WordPress site, so a blog on a subdomain (blog.example.com) counts as the
 * tool's own domain without anyone having to remember to add it.
 */
export async function loadEngineSettings(
    admin: any,
    brandId: string,
): Promise<EngineSettings> {
    const { data: brand, error: brandError } = await admin
        .from("brand_details")
        .select("id, user_id, website_url")
        .eq("id", brandId)
        .is("deleted_at", null)
        .single()
    if (brandError || !brand) throw new Error(`Tool ${brandId} was not found.`)

    let { data: row } = await admin
        .from("engine_brand_settings")
        .select("brand_id, user_id, enabled, owned_hosts, aliases, wordpress_connection_id")
        .eq("brand_id", brandId)
        .maybeSingle()

    if (!row) {
        // Adopt the one WordPress connection already pointed at this tool, or
        // the only one the owner has.
        const { data: connections } = await admin
            .from("wordpress_connections")
            .select("id, brand_id")
            .eq("user_id", brand.user_id)
        const list = (connections ?? []) as Array<{ id: string; brand_id: string | null }>
        const linked =
            list.find((connection) => connection.brand_id === brandId) ??
            (list.length === 1 && !list[0].brand_id ? list[0] : null)

        const { data: created, error } = await admin
            .from("engine_brand_settings")
            .upsert(
                {
                    brand_id: brandId,
                    user_id: brand.user_id,
                    owned_hosts: unique([normalizeHost(brand.website_url)]),
                    wordpress_connection_id: linked?.id ?? null,
                },
                { onConflict: "brand_id" },
            )
            .select("brand_id, user_id, enabled, owned_hosts, aliases, wordpress_connection_id")
            .single()
        if (error || !created) throw new Error(`Could not create engine settings: ${error?.message}`)
        row = created
    }

    const connection = row.wordpress_connection_id
        ? await loadWordPressConnection(admin, row.wordpress_connection_id)
        : null

    return {
        brandId,
        userId: row.user_id,
        enabled: row.enabled !== false,
        ownedHosts: unique([
            normalizeHost(brand.website_url),
            ...(row.owned_hosts ?? []).map((host: string) => normalizeHost(host)),
            connection ? normalizeHost(connection.site_url) : null,
        ]),
        aliases: unique((row.aliases ?? []).map((alias: string) => alias.trim())),
        wordpressConnectionId: row.wordpress_connection_id ?? null,
    }
}

export async function loadWordPressConnection(
    admin: any,
    connectionId: string,
): Promise<EngineWordPressConnection | null> {
    const { data } = await admin
        .from("wordpress_connections")
        .select("id, site_url, username, app_password, default_category_id")
        .eq("id", connectionId)
        .maybeSingle()
    return data ?? null
}
