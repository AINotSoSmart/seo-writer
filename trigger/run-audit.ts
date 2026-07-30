import { task } from "@trigger.dev/sdk/v3"

import { discoverCompetitors } from "@/lib/audit/competitor-scanner"
import { resend, EMAIL_FROM } from "@/lib/emails/client"
import { AuditFailedEmail } from "@/lib/emails/templates/audit-failed"
import { HARVEST_POLICY } from "@/lib/harvest/policy"
import { runHarvestAudit } from "@/lib/harvest/run-harvest"
import type { BrandDetails } from "@/lib/schemas/brand"
import { extractSearchPrefs } from "@/lib/tavily-search"
import { createAdminClient } from "@/utils/supabase/admin"

interface RunAuditPayload {
    userId: string
    brandId: string
    auditId: string
    brandData: BrandDetails
    brandUrl: string
}

export const runAuditTask = task({
    id: "run-topical-audit",
    maxDuration: 900,
    retry: { maxAttempts: 1 },
    run: async (payload: RunAuditPayload) => {
        const { userId, brandId, auditId, brandData, brandUrl } = payload
        const supabase = createAdminClient() as any
        const startTime = Date.now()

        const updateStatus = async (
            status: "running" | "failed",
            phase: string | null,
            extra: Record<string, unknown> = {},
        ) => {
            const { error } = await supabase
                .from("topical_audits")
                .update({
                    generation_status: status,
                    run_status: status,
                    generation_phase: phase,
                    updated_at: new Date().toISOString(),
                    ...extra,
                })
                .eq("id", auditId)
                .eq("user_id", userId)
            if (error) throw new Error(`Failed to update audit run: ${error.message}`)
        }

        try {
            await updateStatus("running", "competitor_discovery")
            const searchPrefs = extractSearchPrefs(brandData)
            const { data: brandRecord } = await supabase
                .from("brand_details")
                .select("discovered_competitors")
                .eq("id", brandId)
                .eq("user_id", userId)
                .single()

            let competitors: Array<{ name: string; url: string; domain?: string }>
            const discoveryCalls = new Map<
                string,
                { attempted: number; succeeded: number; failed: number; cached: number }
            >()
            const recordDiscoveryCall = (source: string, succeeded: boolean) => {
                const row = discoveryCalls.get(source) || {
                    attempted: 0,
                    succeeded: 0,
                    failed: 0,
                    cached: 0,
                }
                row.attempted += 1
                if (succeeded) row.succeeded += 1
                else row.failed += 1
                discoveryCalls.set(source, row)
            }
            if (Array.isArray(brandRecord?.discovered_competitors) && brandRecord.discovered_competitors.length) {
                competitors = brandRecord.discovered_competitors
                discoveryCalls.set("competitor_discovery", {
                    attempted: 0,
                    succeeded: 0,
                    failed: 0,
                    cached: 1,
                })
            } else {
                competitors = await discoverCompetitors(
                    brandData,
                    HARVEST_POLICY.maxCompetitors,
                    searchPrefs,
                    (call) => recordDiscoveryCall(call.source, call.succeeded),
                )
                for (const [source, counts] of discoveryCalls) {
                    if (
                        counts.attempted > 0 &&
                        counts.failed === counts.attempted
                    ) {
                        const failure = new Error(
                            `Configured source failed completely: ${source}`,
                        )
                        ;(failure as Error & { code?: string }).code =
                            "competitor_discovery_failed"
                        throw failure
                    }
                }
            }

            competitors = competitors
                .filter((competitor) => {
                    try {
                        const host = new URL(competitor.url).hostname.toLowerCase()
                        return !host.endsWith("google.com") && !host.endsWith("apple.com")
                    } catch {
                        return false
                    }
                })
            if (competitors.length > HARVEST_POLICY.maxCompetitors) {
                throw new Error(
                    `The saved audit input has ${competitors.length} competitors; maximum is ${HARVEST_POLICY.maxCompetitors}. None were silently removed.`,
                )
            }

            if (!brandRecord?.discovered_competitors?.length && competitors.length > 0) {
                await supabase
                    .from("brand_details")
                    .update({
                        discovered_competitors: competitors.map(({ name, url }) => ({
                            name,
                            url,
                        })),
                    })
                    .eq("id", brandId)
                    .eq("user_id", userId)
            }

            await supabase
                .from("topical_audits")
                .update({
                    input_competitors: competitors.map((competitor) => competitor.url),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", auditId)

            const result = await runHarvestAudit(
                userId,
                brandId,
                brandData,
                brandUrl,
                {
                    auditId,
                    competitors: competitors.map(({ name, url }) => ({ name, url })),
                    initialSourceCallLedger: Array.from(
                        discoveryCalls,
                        ([source, counts]) => ({ source, ...counts }),
                    ),
                    onPhase: async (phase) => {
                        await updateStatus("running", phase)
                    },
                    onSourceProgress: async (phase, ledger) => {
                        await updateStatus("running", phase, {
                            source_call_ledger: [
                                ...Array.from(
                                    discoveryCalls,
                                    ([source, counts]) => ({
                                        source,
                                        ...counts,
                                    }),
                                ),
                                ...ledger,
                            ],
                        })
                    },
                },
            )

            return {
                success: true,
                audit_id: auditId,
                authority_score: result.authorityScore,
                pool_size: result.poolSize,
                article_count: result.articleCount,
                cluster_count: result.clusterCount,
                competitors_scanned: result.competitorsScanned,
                below_viable_threshold: result.belowViableThreshold,
                public_token: result.publicToken,
                policy_version: result.policyVersion,
                result_hash: result.resultHash,
                duration_ms: Date.now() - startTime,
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error"
            console.error("[Audit Task] Fatal error:", error)
            try {
                await updateStatus("failed", null, {
                    generation_error: message,
                    failure_code:
                        typeof error === "object" && error && "code" in error
                            ? String(error.code)
                            : "audit_failed",
                    failed_at: new Date().toISOString(),
                })
            } catch (statusError) {
                console.error("[Audit Task] Failed to persist failure status:", statusError)
            }

            try {
                await resend.emails.send({
                    from: EMAIL_FROM,
                    // Same channel as billing alerts. Hardcoding a personal
                    // address meant the release-gate env var was ignored here.
                    to: process.env.FOUNDER_ALERT_EMAIL || "harvanshjatt@gmail.com",
                    subject: `Audit failed: ${brandData.product_name || brandId}`,
                    react: AuditFailedEmail({
                        userId,
                        brandId,
                        brandName: brandData.product_name,
                        error: message,
                        timestamp: new Date().toISOString(),
                    }),
                })
            } catch (emailError) {
                console.error("[Audit Task] Failure notification failed:", emailError)
            }
            throw error
        }
    },
})
