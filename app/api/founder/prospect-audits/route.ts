import { createHash, randomBytes } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@trigger.dev/sdk/v3"

import { isFounderUser } from "@/lib/founder"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import type { runProspectAuditTask } from "@/trigger/run-prospect-audit"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

function normalizeUrl(value: string): string {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid website URL")
    url.hash = ""
    return url.toString()
}

function fallbackSeeds(subjectUrl: string): string[] {
    const host = new URL(subjectUrl).hostname.replace(/^www\./, "")
    const words = host
        .split(".")[0]
        .split(/[-_]+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 2)
    return [words.join(" ") || host]
}

async function founder() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user && isFounderUser(user.id)
        ? { supabase: createAdminClient() as any, user }
        : null
}

export async function GET() {
    const actor = await founder()
    if (!actor) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data, error } = await (actor.supabase as any)
        .from("topical_audits")
        .select(
            "id, subject_url, input_seeds, input_competitors, run_status, generation_phase, generation_error, failure_code, source_call_ledger, public_token, pool_size, article_count, cluster_count, completed_at, created_at, audit_claims(claim_email_normalized, expires_at, claimed_at, revoked_at)",
        )
        .eq("created_by_user_id", actor.user.id)
        .eq("audit_kind", "prospect")
        .order("created_at", { ascending: false })
        .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ audits: data || [] })
}

export async function POST(request: NextRequest) {
    const actor = await founder()
    if (!actor) return NextResponse.json({ error: "Not found" }, { status: 404 })

    try {
        const body = await request.json()
        const subjectUrl = normalizeUrl(String(body.website || ""))
        const prospectEmail = String(body.email || "").trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(prospectEmail)) {
            return NextResponse.json(
                { error: "A valid prospect email is required." },
                { status: 400 },
            )
        }
        const rawSeeds: unknown[] = Array.isArray(body.seeds) ? body.seeds : []
        const seeds: string[] = Array.from(
            new Set<string>(
                rawSeeds
                    .map((seed: unknown) => String(seed))
                    .map((seed) => seed.trim())
                    .filter(Boolean),
            ),
        ).slice(0, 6)
        const effectiveSeeds = seeds.length ? seeds : fallbackSeeds(subjectUrl)
        const rawCompetitors: unknown[] = Array.isArray(body.competitors)
            ? body.competitors
            : []
        const competitors: string[] = Array.from(
            new Set<string>(
                rawCompetitors
                    .map((competitor: unknown) => String(competitor))
                    .map(normalizeUrl),
            ),
        ).slice(0, HARVEST_POLICY.maxCompetitors)
        const publicToken = randomBytes(24).toString("base64url")
        const claimToken = randomBytes(32).toString("base64url")
        const claimHash = createHash("sha256").update(claimToken).digest("hex")

        const { data: auditId, error: auditError } = await (
            actor.supabase as any
        ).rpc("create_prospect_audit", {
            p_creator_user_id: actor.user.id,
            p_subject_url: subjectUrl,
            p_input_seeds: effectiveSeeds,
            p_input_competitors: competitors,
            p_brand_snapshot: {
                product_name: new URL(subjectUrl).hostname.replace(/^www\./, ""),
                category: effectiveSeeds[0],
            },
            p_policy_version: HARVEST_POLICY.version,
            p_public_token: publicToken,
            p_claim_token_hash: claimHash,
            p_claim_email_normalized: prospectEmail,
        })
        if (auditError || !auditId) {
            throw new Error(auditError?.message || "Audit creation failed")
        }

        try {
            await tasks.trigger<typeof runProspectAuditTask>("run-prospect-audit", {
                auditId,
                founderUserId: actor.user.id,
                subjectUrl,
                seeds: effectiveSeeds,
                competitors,
            })
        } catch (queueError) {
            await Promise.all([
                (actor.supabase as any)
                    .from("topical_audits")
                    .update({
                        run_status: "failed",
                        generation_status: "failed",
                        generation_phase: null,
                        failure_code: "queue_failed",
                        failed_at: new Date().toISOString(),
                    })
                    .eq("id", auditId),
                (actor.supabase as any)
                    .from("audit_claims")
                    .update({ revoked_at: new Date().toISOString() })
                    .eq("audit_id", auditId),
            ])
            throw queueError
        }

        const origin = new URL(request.url).origin
        return NextResponse.json({
            auditId,
            publicReportUrl: `${origin}/audit/${publicToken}`,
            claimUrl: `${origin}/claim/${claimToken}`,
        })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to queue audit." },
            { status: 400 },
        )
    }
}
