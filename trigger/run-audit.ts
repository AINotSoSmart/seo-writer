import { task } from "@trigger.dev/sdk/v3"

import { discoverCompetitors } from "@/lib/audit/competitor-scanner"
import { mergeUserFirstCompetitors } from "@/lib/audit/merge-competitors"
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
    // 30 minutes — matches trigger.config.ts default. Big sites with dense
    // coverage + SERP + classification need headroom beyond the old 15m cap.
    maxDuration: 1800,
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

            // User-named competitors are preferred seeds. Discover a reserve
            // pool (up to maxCompetitorCandidates) so coverage can skip
            // unreadable sites and still fill the working set of four.
            const userCompetitors = (
                Array.isArray(brandRecord?.discovered_competitors)
                    ? brandRecord.discovered_competitors
                    : []
            ).filter((competitor: { url?: string }) => {
                try {
                    const host = new URL(String(competitor.url || "")).hostname.toLowerCase()
                    return !host.endsWith("google.com") && !host.endsWith("apple.com")
                } catch {
                    return false
                }
            }) as Array<{ name: string; url: string; domain?: string }>

            if (userCompetitors.length > HARVEST_POLICY.maxCompetitors) {
                throw new Error(
                    `The saved audit input has ${userCompetitors.length} competitors; maximum is ${HARVEST_POLICY.maxCompetitors}. None were silently removed.`,
                )
            }

            let discovered: Array<{ name: string; url: string; domain?: string }> = []
            const remainingCandidateSlots =
                HARVEST_POLICY.maxCompetitorCandidates - userCompetitors.length
            if (remainingCandidateSlots > 0) {
                discovered = await discoverCompetitors(
                    brandData,
                    remainingCandidateSlots,
                    searchPrefs,
                    (call) => recordDiscoveryCall(call.source, call.succeeded),
                )
                for (const [source, counts] of discoveryCalls) {
                    if (
                        counts.attempted > 0 &&
                        counts.failed === counts.attempted
                    ) {
                        // User seeds still let harvest proceed; only fail hard
                        // when there was nothing user-supplied either.
                        if (userCompetitors.length === 0) {
                            const failure = new Error(
                                `Configured source failed completely: ${source}`,
                            )
                            ;(failure as Error & { code?: string }).code =
                                "competitor_discovery_failed"
                            throw failure
                        }
                    }
                }
            } else if (userCompetitors.length > 0) {
                discoveryCalls.set("competitor_discovery", {
                    attempted: 0,
                    succeeded: 0,
                    failed: 0,
                    cached: 1,
                })
            }

            const competitorCandidates = mergeUserFirstCompetitors(
                userCompetitors,
                discovered.filter((competitor) => {
                    try {
                        const host = new URL(competitor.url).hostname.toLowerCase()
                        return (
                            !host.endsWith("google.com") &&
                            !host.endsWith("apple.com")
                        )
                    } catch {
                        return false
                    }
                }),
                HARVEST_POLICY.maxCompetitorCandidates,
            )

            // Provisional candidate list for the run; rewritten to the usable
            // working set after coverage failover.
            if (competitorCandidates.length > 0) {
                await supabase
                    .from("brand_details")
                    .update({
                        discovered_competitors: competitorCandidates.map(
                            ({ name, url }) => ({ name, url }),
                        ),
                    })
                    .eq("id", brandId)
                    .eq("user_id", userId)
            }

            await supabase
                .from("topical_audits")
                .update({
                    input_competitors: competitorCandidates.map(
                        (competitor) => competitor.url,
                    ),
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
                    competitors: competitorCandidates.map(({ name, url }) => ({
                        name,
                        url,
                    })),
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

            // Persist only competitors that produced readable coverage — drop
            // failures like MyHeritage-with-no-sitemap from the brand record.
            const usedByUrl = new Map(
                competitorCandidates.map((competitor) => [
                    competitor.url.replace(/\/$/, "").toLowerCase(),
                    competitor,
                ]),
            )
            const workingCompetitors = result.competitorsUsed.map((url) => {
                const key = url.replace(/\/$/, "").toLowerCase()
                const known = usedByUrl.get(key)
                let host = url
                try {
                    host = new URL(url).hostname.replace(/^www\./i, "")
                } catch {
                    /* keep url */
                }
                return {
                    name: known?.name || host,
                    url,
                }
            })
            await supabase
                .from("brand_details")
                .update({
                    discovered_competitors: workingCompetitors,
                })
                .eq("id", brandId)
                .eq("user_id", userId)
            await supabase
                .from("topical_audits")
                .update({
                    input_competitors: result.competitorsUsed,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", auditId)

            if (result.competitorsSkipped.length > 0) {
                console.log(
                    `[Audit Task] Skipped ${result.competitorsSkipped.length} competitor(s): ` +
                        result.competitorsSkipped
                            .map((row) => `${row.url} (${row.reason})`)
                            .join("; "),
                )
            }

            return {
                success: true,
                audit_id: auditId,
                authority_score: result.authorityScore,
                pool_size: result.poolSize,
                article_count: result.articleCount,
                cluster_count: result.clusterCount,
                competitors_scanned: result.competitorsScanned,
                competitors_skipped: result.competitorsSkipped.length,
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
