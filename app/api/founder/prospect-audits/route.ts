import { createHash, randomBytes } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { tasks } from "@trigger.dev/sdk/v3"

import { isFounderUser } from "@/lib/founder"
import {
    SCOPE_CONTRACT_VERSION,
    MAX_SCOPE_FAMILIES,
    MAX_TOTAL_SCOPE_SEEDS,
    normalizeSeed,
    scopeHash,
} from "@/lib/brand-scope"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import { ScopeFamilySchema, type ScopeFamily } from "@/lib/schemas/brand"
import type { runProspectAuditTask } from "@/trigger/run-prospect-audit"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

function normalizeUrl(value: string): string {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid website URL")
    url.hash = ""
    return url.toString()
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
        const rawFamilies: unknown[] = Array.isArray(body.businessAreas)
            ? body.businessAreas
            : []
        if (rawFamilies.length > MAX_SCOPE_FAMILIES) {
            return NextResponse.json(
                {
                    error: `Use no more than ${MAX_SCOPE_FAMILIES} confirmed business areas. None were silently removed.`,
                },
                { status: 400 },
            )
        }
        const scopeFamilies: ScopeFamily[] = rawFamilies
            .map((candidate: any, priority: number) =>
                ScopeFamilySchema.parse({
                    name: String(candidate?.name || "").trim(),
                    description:
                        String(candidate?.description || "").trim() ||
                        `Content directly serving ${String(candidate?.name || "").trim()}.`,
                    seed_keywords: Array.from(
                        new Set(
                            (Array.isArray(candidate?.seedKeywords)
                                ? candidate.seedKeywords
                                : []
                            )
                                .map((seed: unknown) =>
                                    normalizeSeed(String(seed)),
                                )
                                .filter(Boolean),
                        ),
                    ),
                    evidence: [],
                    capability_contract: candidate?.capabilityContract,
                    source: "user",
                    priority,
                    enabled: true,
                }),
            )
        if (scopeFamilies.length === 0) {
            return NextResponse.json(
                {
                    error:
                        "Confirm at least one business area and its direct customer searches.",
                },
                { status: 400 },
            )
        }
        // No `deliveryMode` check. `CapabilityContractSchema` normalises a blank
        // one to `UNSPECIFIED_DELIVERY_MODE` above, so this clause could only
        // ever have been unreachable or a lie about which field to fix — the
        // same trap that made hand-added onboarding categories unconfirmable.
        if (
            scopeFamilies.some(
                (family) =>
                    family.capability_contract?.version !== "capability-v1" ||
                    family.capability_contract.operations.length === 0 ||
                    family.capability_contract.operations.some(
                        (operation) =>
                            !operation.action.trim() ||
                            operation.inputs.length === 0 ||
                            operation.outputs.length === 0 ||
                            operation.evidenceRefs.length === 0,
                    ),
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Each business area needs verified input -> action -> output mechanics.",
                },
                { status: 400 },
            )
        }
        const totalSeeds = scopeFamilies.reduce(
            (sum, family) => sum + family.seed_keywords.length,
            0,
        )
        if (totalSeeds > MAX_TOTAL_SCOPE_SEEDS) {
            return NextResponse.json(
                {
                    error: `Use no more than ${MAX_TOTAL_SCOPE_SEEDS} confirmed searches across all business areas.`,
                },
                { status: 400 },
            )
        }
        const effectiveSeeds = scopeFamilies.flatMap(
            (family) => family.seed_keywords,
        )
        const rawCompetitors: unknown[] = Array.isArray(body.competitors)
            ? body.competitors
            : []
        const competitors: string[] = Array.from(
            new Set<string>(
                rawCompetitors
                    .map((competitor: unknown) => String(competitor))
                    .map(normalizeUrl),
            ),
        )
        if (competitors.length > HARVEST_POLICY.maxCompetitors) {
            return NextResponse.json(
                {
                    error: `Use no more than ${HARVEST_POLICY.maxCompetitors} direct competitors. None were silently removed.`,
                },
                { status: 400 },
            )
        }
        const publicToken = randomBytes(24).toString("base64url")
        const claimToken = randomBytes(32).toString("base64url")
        const claimHash = createHash("sha256").update(claimToken).digest("hex")

        const { data: auditId, error: auditError } = await (
            actor.supabase as any
        ).rpc("create_scoped_prospect_audit", {
            p_creator_user_id: actor.user.id,
            p_subject_url: subjectUrl,
            p_input_seeds: effectiveSeeds,
            p_input_competitors: competitors,
            p_brand_snapshot: {
                product_name: new URL(subjectUrl).hostname.replace(/^www\./, ""),
                product_identity: {
                    literally: scopeFamilies.map((family) => family.name).join(", "),
                    emotionally: "Not yet confirmed by the prospect",
                    not: "Outside the confirmed business areas",
                },
                mission: "Not yet confirmed by the prospect",
                audience: {
                    primary: "Not yet confirmed by the prospect",
                    psychology: "Not yet confirmed by the prospect",
                },
                enemy: [],
                category: scopeFamilies[0].name,
                uvp: [],
                core_features: [],
                pricing: [],
                how_it_works: [],
                brand_keywords: [],
                scope_families: scopeFamilies,
                target_seed_keywords: effectiveSeeds,
                search_country: "",
                search_topic: "general",
                article_length: "long",
                image_style: "stock",
                style_dna: "",
            },
            p_policy_version: HARVEST_POLICY.version,
            p_scope_contract_version: SCOPE_CONTRACT_VERSION,
            p_scope_hash: scopeHash(scopeFamilies),
            p_scope_families: scopeFamilies,
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
