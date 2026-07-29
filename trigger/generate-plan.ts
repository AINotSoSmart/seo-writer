import { task } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { BrandDetails } from "@/lib/schemas/brand"
import { runHarvestAudit } from "@/lib/harvest/run-harvest"
import Sitemapper from "sitemapper"
import { extractTitleFromUrl, generateEmbedding } from "@/lib/internal-linking"
import { PlanRefilledEmail } from "@/lib/emails/templates/plan-refilled"
import { resend, EMAIL_FROM, EMAIL_REPLY_TO } from "@/lib/emails/client"
import { render } from "@react-email/components"


interface GeneratePlanPayload {
    planId: string
    userId: string
    brandId: string
    brandData: BrandDetails
    brandUrl?: string
    competitorBrands?: Array<{ name: string; url?: string }>
    existingContent?: string[]
    isAutoRefill?: boolean
}

/**
 * Sync sitemap URLs to internal_links table.
 * Returns titles for use in plan generation to avoid duplicate content.
 */
async function syncSitemapToInternalLinks(
    websiteUrl: string,
    userId: string,
    brandId: string
): Promise<{ titles: string[]; syncedCount: number }> {
    const supabase = createAdminClient()

    // Build sitemap URLs to try
    const baseUrl = websiteUrl.replace(/\/$/, '')
    const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']

    let sitemapUrls: string[] = []

    console.log(`[Sitemap Sync] Starting sync for ${baseUrl}`)

    // 1. Try to find sitemap in robots.txt first
    try {
        const robotsUrl = `${baseUrl}/robots.txt`
        console.log(`[Sitemap Sync] Checking robots.txt at ${robotsUrl}`)
        const robotsRes = await fetch(robotsUrl)
        if (robotsRes.ok) {
            const robotsTxt = await robotsRes.text()
            const sitemapMatch = robotsTxt.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i)
            if (sitemapMatch && sitemapMatch[1]) {
                const foundSitemap = sitemapMatch[1].trim()
                console.log(`[Sitemap Sync] Found sitemap in robots.txt: ${foundSitemap}`)
                // Add to front of paths to try (extracted path only)
                try {
                    // Extract path if it's on the same domain, or handle full URL logic
                    const sitemapUrl = new URL(foundSitemap)
                    // If it's a full URL that's not already in our paths-to-try, add it
                    const relativePath = sitemapUrl.pathname

                    if (!sitemapPaths.includes(relativePath) && !sitemapPaths.includes(foundSitemap)) {
                        // Priority to full URL if it differs from base, but ensure we check it
                        // The loop logic handles full URLs correctly now.
                        sitemapPaths.unshift(foundSitemap)
                    }
                } catch (e) {
                    console.warn(`[Sitemap Sync] Invalid sitemap URL in robots.txt: ${foundSitemap}`)
                }
            }
        }
    } catch (e) {
        console.warn(`[Sitemap Sync] Failed to check robots.txt:`, e)
    }

    // Try paths sequentially until we find one with URLs
    for (const pathOrUrl of sitemapPaths) {
        // If it looks like a full URL, use it, otherwise append to base
        const currentUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `${baseUrl}${pathOrUrl}`
        console.log(`[Sitemap Sync] Trying: ${currentUrl}`)

        try {
            const sitemapper = new Sitemapper({
                url: currentUrl,
                timeout: 15000,
                debug: true, // Enable internal debug logs if any
            })

            const { sites, errors } = await sitemapper.fetch()

            if (errors && errors.length > 0) {
                console.warn(`[Sitemap Sync] Errors fetching ${currentUrl}:`, errors)
            }

            if (sites && sites.length > 0) {
                sitemapUrls = Array.from(new Set(sites as string[])) // Deduplicate
                console.log(`[Sitemap Sync] Found ${sitemapUrls.length} URLs at ${currentUrl}`)
                break // Stop if we found a working sitemap
            } else {
                console.log(`[Sitemap Sync] No URLs found at ${currentUrl}`)
            }
        } catch (e: any) {
            console.error(`[Sitemap Sync] Failed to fetch ${currentUrl}:`, e.message || e)
        }
    }

    if (sitemapUrls.length === 0) {
        console.warn(`[Sitemap Sync] FAILED: No URLs found in any sitemap for ${baseUrl}. Checked: ${sitemapPaths.join(', ')}`)
        return { titles: [], syncedCount: 0 }
    }

    // --- BLOG CONTENT FILTER (Production-Grade) ---
    // Only store URLs that are likely blog/article content, not product directories or misc pages
    const BLOG_PATH_PATTERNS = [
        '/blog/',
        '/articles/',
        '/article/',
        '/posts/',
        '/post/',
        '/news/',
        '/resources/',
        '/guides/',
        '/guide/',
        '/insights/',
        '/learn/',
        '/tutorials/',
        '/tutorial/',
        '/how-to/',
        '/tips/',
        '/use-cases/',
    ]

    const blogUrls = sitemapUrls.filter(url => {
        try {
            const pathname = new URL(url).pathname.toLowerCase()
            // Check if URL path contains any blog pattern
            return BLOG_PATH_PATTERNS.some(pattern => pathname.includes(pattern))
        } catch {
            return false // Invalid URL
        }
    })

    console.log(`[Sitemap Sync] Filtered ${sitemapUrls.length} URLs -> ${blogUrls.length} blog URLs`)

    if (blogUrls.length === 0) {
        console.warn(`[Sitemap Sync] No blog URLs found. Site may use non-standard blog paths.`)
        // Don't fail - just return empty. The site might not have a blog.
        return { titles: [], syncedCount: 0 }
    }

    // Get existing URLs to avoid duplicates
    const { data: existingRecords } = await (supabase as any)
        .from("internal_links")
        .select("url")
        .eq("user_id", userId)
        .eq("brand_id", brandId)

    const existingUrls = new Set<string>(existingRecords?.map((r: any) => r.url) || [])
    const urlsToAdd = blogUrls.filter(url => !existingUrls.has(url))

    console.log(`[Sitemap Sync] ${urlsToAdd.length} new blog URLs to add`)

    // Extract titles for blog URLs only (for immediate return to plan generator)
    const allTitles = blogUrls.map(url => extractTitleFromUrl(url))

    // Process new URLs in batches
    const BATCH_SIZE = 5
    let syncedCount = 0

    for (let i = 0; i < urlsToAdd.length; i += BATCH_SIZE) {
        const batch = urlsToAdd.slice(i, i + BATCH_SIZE)

        const inserts = await Promise.all(batch.map(async (url) => {
            const title = extractTitleFromUrl(url)

            try {
                const embedding = await generateEmbedding(title, "SEMANTIC_SIMILARITY")
                return {
                    user_id: userId,
                    brand_id: brandId,
                    url,
                    title,
                    embedding
                }
            } catch (e) {
                console.error(`[Sitemap Sync] Failed embedding for ${url}:`, e)
                // Still save without embedding - can be backfilled later
                return {
                    user_id: userId,
                    brand_id: brandId,
                    url,
                    title,
                    embedding: null
                }
            }
        }))

        const validInserts = inserts.filter(item => item !== null)

        if (validInserts.length > 0) {
            const { error } = await (supabase as any)
                .from("internal_links")
                .insert(validInserts)

            if (error) {
                console.error("[Sitemap Sync] DB Insert error:", error)
            } else {
                syncedCount += validInserts.length
            }
        }
    }

    console.log(`[Sitemap Sync] Synced ${syncedCount} new links`)
    return { titles: allTitles, syncedCount }
}

// discoverCompetitors() removed — the audit task handles competitor discovery +
// deep content scanning, producing real gap data instead of just brand names.

/**
 * Background task for generating content plan using Trigger.dev.
 * 
 * REVAMPED FLOW (3 phases):
 * 1. Intelligence Phase: Discover competitors if not provided
 * 2. Generation Phase: Use strategic mega-prompt to generate plan
 * 3. Deduplication Phase: Filter out topics too similar to existing content
 */
export const generatePlanTask = task({
    id: "generate-content-plan",
    maxDuration: 1200, // 20 minutes — the harvest makes many outbound requests
    retry: {
        maxAttempts: 1, // No retries — the harvest is expensive
    },
    run: async (payload: GeneratePlanPayload) => {
        const { planId, userId, brandId, brandData, brandUrl } = payload
        const supabase = createAdminClient()

        console.log(`[Generate Plan Task] Starting for plan: ${planId}`)

        const updateStatus = async (status: string, phase?: string, error?: string) => {
            const updates: Record<string, any> = { generation_status: status }
            if (phase !== undefined) updates.generation_phase = phase
            if (error) updates.generation_error = error

            await (supabase as any)
                .from("content_plans")
                .update(updates)
                .eq("id", planId)
        }

        try {
            // === PHASE 0: SITEMAP SYNC ===
            // Populates internal_links, which the writer uses for link injection.
            if (brandUrl) {
                await updateStatus("generating", "sitemap")
                try {
                    const syncResult = await syncSitemapToInternalLinks(brandUrl, userId, brandId)
                    console.log(`[Generate Plan Task] Sitemap sync: ${syncResult.syncedCount} new links`)
                } catch (e) {
                    console.warn(`[Generate Plan Task] Sitemap sync failed (non-blocking):`, e)
                }
            }

            // === PHASE 1: THE HARVEST IS THE PLAN ===
            //
            // This task used to run a five-stage LLM chain (SERP intelligence →
            // gap analysis → hierarchy → strategic planner → dedup loop with
            // `targetCount: 30`). That quota is exactly what made the engine
            // ship rewrites once a niche ran dry.
            //
            // The harvest produces `planned_articles` directly, sized to the
            // real gaps that exist. There is no target count.
            await updateStatus("generating", "audit")

            if (!brandUrl) {
                throw new Error("brandUrl is required — coverage cannot be measured without it")
            }

            const result = await runHarvestAudit(
                userId,
                brandId,
                brandData,
                brandUrl,
                { onPhase: async (phase) => { await updateStatus("generating", phase) } }
            )

            console.log(
                `[Generate Plan Task] Harvest: ${result.poolSize} queries -> ` +
                `${result.articleCount} articles across ${result.clusterCount} clusters`
            )

            // === PHASE 2: MIRROR INTO content_plans ===
            // The existing dashboard reads `content_plans.plan_data`. Mirroring
            // keeps it working until the scope/burn-down UI replaces it; the
            // authoritative rows are in `planned_articles`.
            const { data: plannedRows } = await (supabase as any)
                .from("planned_articles")
                .select("id, title, main_keyword, supporting_keywords, article_type, is_pillar, cluster_id, status, scheduled_date, audit_clusters(name)")
                .eq("brand_id", brandId)
                .in("status", ["pending", "scheduled"])

            const planData = (plannedRows || []).map((row: any) => ({
                id: row.id,
                title: row.title,
                main_keyword: row.main_keyword,
                supporting_keywords: row.supporting_keywords || [],
                article_type: row.article_type,
                cluster: row.audit_clusters?.name || "",
                delivery_model: "cluster",
                is_pillar: row.is_pillar,
                scheduled_date: row.scheduled_date || "",
                status: row.status === "scheduled" ? "pending" : row.status,
            }))

            const { error: updateError } = await (supabase as any)
                .from("content_plans")
                .update({
                    plan_data: planData,
                    generation_status: "complete",
                    generation_phase: null,
                    updated_at: new Date().toISOString()
                })
                .eq("id", planId)

            if (updateError) {
                throw new Error(`Failed to save plan: ${updateError.message}`)
            }

            if (result.belowViableThreshold) {
                console.warn(
                    `[Generate Plan Task] Niche yields only ${result.articleCount} articles — ` +
                    `below the threshold for a recurring program. Offer a one-off.`
                )
            }

            console.log(`[Generate Plan Task] Complete.`)

            // --- NOTIFICATION: SEND REFILL EMAIL (only for auto-refill) ---
            if (payload.isAutoRefill) {
                try {
                    const { data: userRec } = await supabase.auth.admin.getUserById(userId)
                    const user = userRec?.user

                    if (user?.email) {
                        const emailHtml = await render(PlanRefilledEmail({
                            articleCount: planData.length,
                            userName: user.user_metadata?.full_name || user.email.split('@')[0] || "there"
                        }))

                        await resend.emails.send({
                            from: EMAIL_FROM,
                            to: user.email,
                            subject: `Your content plan was refreshed`,
                            html: emailHtml,
                            replyTo: EMAIL_REPLY_TO
                        })
                        console.log(`[Generate Plan Task] Refill email sent to ${user.email}`)
                    }
                } catch (emailErr) {
                    console.error("[Generate Plan Task] Failed to send refill email:", emailErr)
                }
            }

            return {
                success: true,
                planId,
                poolSize: result.poolSize,
                articleCount: result.articleCount,
                clusterCount: result.clusterCount,
                authorityScore: result.authorityScore,
                belowViableThreshold: result.belowViableThreshold,
                publicToken: result.publicToken,
            }

        } catch (error: any) {
            console.error(`[Generate Plan Task] Error:`, error)
            await updateStatus("failed", undefined, error.message || "Unknown error")
            throw error
        }
    }
})
