import { task } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { BrandDetails } from "@/lib/schemas/brand"
import { discoverCompetitors } from "@/lib/audit/competitor-scanner"
import { runHarvestAudit } from "@/lib/harvest/run-harvest"
import { resend, EMAIL_FROM } from "@/lib/emails/client"
import { AuditFailedEmail } from "@/lib/emails/templates/audit-failed"
import { extractSearchPrefs } from "@/lib/tavily-search"

// ============================================================
// Run Topical Audit — Trigger.dev Background Task
//
// Runs the closed-pool pipeline in lib/harvest: harvest real queries from
// autocomplete, ranking pages, and competitor sitemaps; measure coverage;
// difference the two to get gaps; collapse gaps into interlinked clusters.
//
// The previous version of this task began by asking an LLM to invent a "niche
// blueprint" and scored the site against it. Nothing in the pipeline now
// originates in a model except article headlines.
// ============================================================

interface RunAuditPayload {
    userId: string
    brandId: string
    brandData: BrandDetails
    brandUrl: string
}

export const runAuditTask = task({
    id: "run-topical-audit",
    maxDuration: 900, // 15 minutes — the harvest makes many outbound requests
    retry: {
        maxAttempts: 1 // No retries — audit is expensive
    },
    run: async (payload: RunAuditPayload) => {
        const { userId, brandId, brandData, brandUrl } = payload
        const supabase = createAdminClient()
        const startTime = Date.now()

        // Helper to update audit row status + phase
        // SELF-HEALING: If update affects 0 rows (row missing), we create it.
        async function updateStatus(
            status: string,
            phase: string | null,
            extraData?: Record<string, any>
        ) {
            const updatePayload: Record<string, any> = {
                generation_status: status,
                generation_phase: phase,
                updated_at: new Date().toISOString(),
                ...extraData
            }
            const { error, count } = await (supabase as any)
                .from("topical_audits")
                .update(updatePayload, { count: 'exact' })
                .eq("user_id", userId)
                .eq("brand_id", brandId)

            if (error) {
                console.error(`[Audit Task] Failed to update status:`, error)
            } else if (count === 0) {
                console.warn(`[Audit Task] Row missing! Creating new audit row for User: ${userId}, Brand: ${brandId}`)

                const { error: insertError } = await (supabase as any)
                    .from("topical_audits")
                    .insert({
                        user_id: userId,
                        brand_id: brandId,
                        ...updatePayload,
                        pool_size: updatePayload.pool_size || 0,
                        article_count: updatePayload.article_count || 0,
                        cluster_count: updatePayload.cluster_count || 0,
                        authority_score: updatePayload.authority_score || 0
                    })

                if (insertError) {
                    console.error(`[Audit Task] FATAL: Failed to create missing row:`, insertError)
                } else {
                    console.log(`[Audit Task] ✅ Successfully created missing audit row.`)
                }
            }
        }

        try {
            console.log(`[Audit Task] Starting audit for brand: ${brandId}, user: ${userId}`)
            const searchPrefs = extractSearchPrefs(brandData)
            console.log(`[Audit Task] Search prefs: country=${searchPrefs.country || 'global'}, topic=${searchPrefs.topic}`)

            await updateStatus("running", "competitor_discovery")

            // === COMPETITOR RESOLUTION ===
            // Owned by this task rather than the pipeline because it involves the
            // cached-competitor lookup and the app-store security gate.
            let competitors: Array<{ name: string; url: string; domain: string }> = []

            const { data: brandRecord } = await (supabase as any)
                .from("brand_details")
                .select("discovered_competitors")
                .eq("id", brandId)
                .single()

            if (brandRecord?.discovered_competitors?.length > 0) {
                competitors = brandRecord.discovered_competitors.map((c: any) => ({
                    name: c.name,
                    url: c.url,
                    domain: new URL(c.url).hostname.replace('www.', '')
                }))
                console.log(`[Audit Task] Using ${competitors.length} user-provided competitors: ${competitors.map(c => c.name).join(', ')}`)
            } else {
                competitors = await discoverCompetitors(brandData, 4, searchPrefs)
                console.log(`[Audit Task] Discovered ${competitors.length} competitors: ${competitors.map(c => c.name).join(', ')}`)
            }

            // EXTRA SECURITY GATE: Filter out app store domains so we never save or scan them
            const originalCount = competitors.length
            competitors = competitors.filter(c => {
                const lower = c.domain.toLowerCase()
                const isBlocked = lower.endsWith('google.com') || lower.endsWith('apple.com')
                if (isBlocked) {
                    console.warn(`[Audit Task] SECURITY GATE: Blocking app store competitor -> ${c.domain}`)
                }
                return !isBlocked
            })

            if (!brandRecord?.discovered_competitors?.length && competitors.length > 0) {
                await (supabase as any)
                    .from("brand_details")
                    .update({ discovered_competitors: competitors.map(c => ({ name: c.name, url: c.url })) })
                    .eq("id", brandId)
                console.log(`[Audit Task] Cached ${competitors.length} valid competitors to brand_details`)
            } else if (!brandRecord?.discovered_competitors?.length && originalCount > 0 && competitors.length === 0) {
                console.warn(`[Audit Task] All discovered competitors were blocked by the security gate.`)
            }

            // === THE CLOSED-POOL PIPELINE ===
            const result = await runHarvestAudit(
                userId,
                brandId,
                brandData,
                brandUrl,
                {
                    competitors: competitors.map(c => ({ name: c.name, url: c.url })),
                    onPhase: async (phase) => { await updateStatus("running", phase) }
                }
            )

            const durationMs = Date.now() - startTime

            // Scope numbers live on topical_audits; the gap detail itself lives in
            // query_pool / audit_clusters / planned_articles.
            await updateStatus("completed", null, {
                generation_error: null,
                authority_score: result.authorityScore,
                pool_size: result.poolSize,
                article_count: result.articleCount,
                cluster_count: result.clusterCount,
                competitors_scanned: result.competitorsScanned,
                topics_analyzed: result.poolSize,
                user_pages_scanned: result.userPagesScanned,
                public_token: result.publicToken
            })

            console.log(
                `[Audit Task] ✅ Complete: ${result.poolSize} queries -> ${result.articleCount} articles ` +
                `across ${result.clusterCount} clusters. Authority ${result.authorityScore}% (${durationMs}ms)`
            )

            if (result.belowViableThreshold) {
                console.warn(`[Audit Task] ⚠️ Niche below viable threshold — offer a one-off, not a subscription.`)
            }

            return {
                success: true,
                authority_score: result.authorityScore,
                pool_size: result.poolSize,
                article_count: result.articleCount,
                cluster_count: result.clusterCount,
                competitors_scanned: result.competitorsScanned,
                below_viable_threshold: result.belowViableThreshold,
                public_token: result.publicToken,
                duration_ms: durationMs
            }

        } catch (error: any) {
            console.error("[Audit Task] Fatal error:", error)

            await updateStatus("failed", null, {
                generation_error: error.message || "Unknown error"
            })

            // Send failure notification to developer
            try {
                await resend.emails.send({
                    from: EMAIL_FROM,
                    to: "harvanshjatt@gmail.com",
                    subject: `🚨 Audit Failed: ${payload.brandData.product_name || payload.brandId}`,
                    react: AuditFailedEmail({
                        userId: payload.userId || 'unknown',
                        brandId: payload.brandId,
                        brandName: payload.brandData.product_name,
                        error: error.message || "Unknown error",
                        timestamp: new Date().toISOString()
                    })
                })
                console.log("[Audit Task] 📧 Failure notification sent to developer.")
            } catch (emailError) {
                console.error("[Audit Task] Failed to send failure email:", emailError)
            }

            throw error // Let Trigger.dev handle the failure
        }
    }
})
