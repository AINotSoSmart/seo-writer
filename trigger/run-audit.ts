import { task } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { BrandDetails } from "@/lib/schemas/brand"
import { generateNicheBlueprint } from "@/lib/audit/niche-blueprint"
import { scanSite, generateBlueprintEmbeddings } from "@/lib/audit/site-scanner"
import { discoverCompetitors, scanAllCompetitors } from "@/lib/audit/competitor-scanner"
import { buildGapMatrix, generatePillarSuggestions, assembleAuditResult } from "@/lib/audit/gap-matrix"
import { resend, EMAIL_FROM } from "@/lib/emails/client"
import { AuditFailedEmail } from "@/lib/emails/templates/audit-failed"
import { extractSearchPrefs } from "@/lib/tavily-search"

// ============================================================
// Run Topical Authority Audit — Trigger.dev Background Task
// Ported from app/api/topical-audit/route.ts SSE stream
// ============================================================

interface RunAuditPayload {
    userId: string
    brandId: string
    brandData: BrandDetails
    brandUrl: string
}

export const runAuditTask = task({
    id: "run-topical-audit",
    maxDuration: 600, // 10 minutes max (audit can be slow)
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

                // Self-healing: Create the row if it doesn't exist
                const { error: insertError } = await (supabase as any)
                    .from("topical_audits")
                    .insert({
                        user_id: userId,
                        brand_id: brandId,
                        ...updatePayload,
                        // Defaults for required fields if not in updatePayload
                        niche_blueprint: updatePayload.niche_blueprint || {},
                        user_coverage: updatePayload.user_coverage || {},
                        competitor_coverages: updatePayload.competitor_coverages || [],
                        gap_matrix: updatePayload.gap_matrix || [],
                        pillar_suggestions: updatePayload.pillar_suggestions || [],
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
            await updateStatus("running", "niche_mapping")

            // === PHASE 1: NICHE BLUEPRINT ===
            console.log(`[Audit Task] Phase 1: Generating niche blueprint...`)
            const blueprint = await generateNicheBlueprint(brandData)
            console.log(`[Audit Task] Blueprint: ${blueprint.pillars.length} pillars, ${blueprint.total_required_topics} topics`)

            // Save blueprint immediately (incremental persistence)
            await updateStatus("running", "niche_mapping", {
                niche_blueprint: blueprint,
                topics_analyzed: blueprint.total_required_topics
            })

            // Generate blueprint embeddings (reused for user + competitors)
            console.log(`[Audit Task] Generating blueprint embeddings...`)
            const blueprintEmbeddings = await generateBlueprintEmbeddings(blueprint)

            // === PHASE 2: USER SITE SCAN ===
            await updateStatus("running", "user_scanning")
            console.log(`[Audit Task] Phase 2: Scanning user site ${brandUrl}...`)

            const userCoverage = await scanSite(
                brandUrl,
                brandData.product_name,
                blueprintEmbeddings,
                blueprint
            )

            console.log(`[Audit Task] User scan: ${userCoverage.pages_analyzed} pages, score ${userCoverage.overall_score}/100`)

            // Save user coverage incrementally
            await updateStatus("running", "competitor_scanning", {
                user_coverage: userCoverage,
                user_pages_scanned: userCoverage.pages_analyzed
            })

            // === PHASE 3: COMPETITOR SCANNING ===
            console.log(`[Audit Task] Phase 3: Discovering competitors...`)

            // Check if user provided competitors in brand_details
            let competitors: Array<{ name: string; url: string; domain: string }> = []
            const { data: brandRecord } = await (supabase as any)
                .from("brand_details")
                .select("discovered_competitors")
                .eq("id", brandId)
                .single()

            if (brandRecord?.discovered_competitors?.length > 0) {
                // User provided competitors — use them directly
                competitors = brandRecord.discovered_competitors.map((c: any) => ({
                    name: c.name,
                    url: c.url,
                    domain: new URL(c.url).hostname.replace('www.', '')
                }))
                console.log(`[Audit Task] Using ${competitors.length} user-provided competitors: ${competitors.map(c => c.name).join(', ')}`)
            } else {
                // Auto-discover competitors via Tavily + LLM filter
                competitors = await discoverCompetitors(brandData, 3, searchPrefs)
                console.log(`[Audit Task] Discovered ${competitors.length} competitors: ${competitors.map(c => c.name).join(', ')}`)
            }

            // EXTRA SECURITY GATE: Filter out app store domains so we never save or scan them
            const originalCount = competitors.length;
            competitors = competitors.filter(c => {
                const lower = c.domain.toLowerCase();
                const isBlocked = lower.endsWith('google.com') || lower.endsWith('apple.com');
                if (isBlocked) {
                    console.warn(`[Audit Task] SECURITY GATE: Blocking app store competitor -> ${c.domain}`);
                }
                return !isBlocked;
            });

            // If we auto-discovered and there are valid ones leftover, cache them
            if (!brandRecord?.discovered_competitors?.length && competitors.length > 0) {
                await (supabase as any)
                    .from("brand_details")
                    .update({ discovered_competitors: competitors.map(c => ({ name: c.name, url: c.url })) })
                    .eq("id", brandId)
                console.log(`[Audit Task] Cached ${competitors.length} valid competitors to brand_details`)
            } else if (!brandRecord?.discovered_competitors?.length && originalCount > 0 && competitors.length === 0) {
                console.warn(`[Audit Task] All discovered competitors were blocked by the security gate.`);
            }

            let competitorCoverages: Awaited<ReturnType<typeof scanAllCompetitors>> = []

            if (competitors.length > 0) {
                competitorCoverages = await scanAllCompetitors(
                    competitors,
                    blueprintEmbeddings,
                    blueprint,
                    2,
                    searchPrefs
                )
                console.log(`[Audit Task] Scanned ${competitorCoverages.length} competitors`)

                // Save competitor coverages incrementally
                await updateStatus("running", "scoring", {
                    competitor_coverages: competitorCoverages,
                    competitors_scanned: competitorCoverages.length
                })
            } else {
                console.log(`[Audit Task] No competitors found — scoring without comparison`)
                await updateStatus("running", "scoring", {
                    competitor_coverages: [],
                    competitors_scanned: 0
                })
            }

            // === PHASE 4: SCORING & ASSEMBLY ===
            console.log(`[Audit Task] Phase 4: Scoring and assembly...`)

            const gapMatrix = buildGapMatrix(blueprint, userCoverage, competitorCoverages)

            const pillarSuggestions = await generatePillarSuggestions(
                blueprint,
                gapMatrix,
                brandData
            )

            const durationMs = Date.now() - startTime

            const auditResult = assembleAuditResult(
                blueprint,
                userCoverage,
                competitorCoverages,
                pillarSuggestions,
                durationMs
            )

            // Save complete audit result
            const { error: saveError, count: finalCount } = await (supabase as any)
                .from("topical_audits")
                .update({
                    generation_status: "completed",
                    generation_phase: null,
                    generation_error: null,
                    niche_blueprint: auditResult.niche_blueprint,
                    user_coverage: auditResult.user_coverage,
                    competitor_coverages: auditResult.competitor_coverages,
                    authority_score: auditResult.authority_score,
                    pillar_scores: auditResult.pillar_scores,
                    gap_matrix: auditResult.gap_matrix,
                    pillar_suggestions: auditResult.pillar_suggestions,
                    projected_score: auditResult.projected_score_after_plan,
                    competitors_scanned: auditResult.audit_meta.competitors_scanned,
                    topics_analyzed: auditResult.audit_meta.topics_analyzed,
                    user_pages_scanned: auditResult.audit_meta.user_pages_scanned,
                    updated_at: new Date().toISOString()
                }, { count: 'exact' })
                .eq("user_id", userId)
                .eq("brand_id", brandId)

            if (saveError) {
                console.error("[Audit Task] Save error:", saveError)
                throw new Error(`Failed to save audit result: ${saveError.message}`)
            } else if (finalCount === 0) {
                console.warn(`[Audit Task] Final save row missing! Inserting...`)
                // Self-healing insert for final result
                const { error: finalInsertError } = await (supabase as any)
                    .from("topical_audits")
                    .insert({
                        user_id: userId,
                        brand_id: brandId,
                        generation_status: "completed",
                        niche_blueprint: auditResult.niche_blueprint,
                        user_coverage: auditResult.user_coverage,
                        competitor_coverages: auditResult.competitor_coverages,
                        authority_score: auditResult.authority_score,
                        pillar_scores: auditResult.pillar_scores,
                        gap_matrix: auditResult.gap_matrix,
                        pillar_suggestions: auditResult.pillar_suggestions,
                        projected_score: auditResult.projected_score_after_plan,
                        competitors_scanned: auditResult.audit_meta.competitors_scanned,
                        topics_analyzed: auditResult.audit_meta.topics_analyzed,
                        user_pages_scanned: auditResult.audit_meta.user_pages_scanned,
                        updated_at: new Date().toISOString()
                    })

                if (finalInsertError) {
                    console.error("[Audit Task] FATAL: Failed to insert final result:", finalInsertError)
                    throw finalInsertError
                }
            }

            // Save pillar suggestions to brand_details.pillar_recommendations
            // so they show up on /content-plan page immediately
            if (pillarSuggestions.length > 0) {
                const pillarRecommendations = pillarSuggestions.map((s, i) => ({
                    id: `pillar-${Date.now()}-${i}`,
                    title: s.suggested_title,
                    description: s.description,
                    suggested_slug: s.suggested_slug
                }))

                const { error: pillarError } = await (supabase as any)
                    .from("brand_details")
                    .update({ pillar_recommendations: pillarRecommendations })
                    .eq("id", brandId)

                if (pillarError) {
                    console.warn("[Audit Task] Failed to save pillar recommendations (non-blocking):", pillarError)
                } else {
                    console.log(`[Audit Task] Saved ${pillarRecommendations.length} pillar recommendations to brand_details`)
                }
            }

            console.log(`[Audit Task] ✅ Audit complete! Score: ${auditResult.authority_score}/100 (${durationMs}ms)`)

            return {
                success: true,
                authority_score: auditResult.authority_score,
                topics_analyzed: auditResult.audit_meta.topics_analyzed,
                competitors_scanned: auditResult.audit_meta.competitors_scanned,
                duration_ms: durationMs
            }

        } catch (error: any) {
            console.error("[Audit Task] Fatal error:", error)

            // Save error state to DB
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
