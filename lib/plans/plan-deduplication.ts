import { createAdminClient } from "@/utils/supabase/admin"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { generateEmbedding } from "@/lib/gemini-embedding"
import { scheduleByCluster } from "@/lib/plans/cluster-scheduler"

/**
 * Semantic Deduplication "Bouncer" for Content Plans
 * 
 * Filters out generated content plan items that are semantically too similar to:
 * 1. Existing sitemap pages (internal_links table)
 * 2. Previously written articles (articles table)
 * 
 * This prevents the AI from suggesting topics that already have coverage.
 */

export interface DeduplicationResult {
    filteredPlan: ContentPlanItem[]
    removedItems: Array<{
        item: ContentPlanItem
        reason: string
        similarTo: string
        similarity: number
    }>
    stats: {
        originalCount: number
        filteredCount: number
        removedBySitemap: number
        removedByArticles: number
    }
}

const SIMILARITY_THRESHOLD_STRICT = 0.88
const SIMILARITY_THRESHOLD_LOOSE = 0.60

const GEMINI_MODEL = "gemini-3.1-flash-lite"

// Initialize Gemini Client
// We use a lazy initialization or direct import if env is available
import { checkSimilarityWithAgent } from "@/lib/plans/similarity-agent"

// Removed local checkSimilarityWithAgent definition as it is now imported

/**
 * Deduplicate a content plan against existing content
 */
export async function deduplicateContentPlan(
    plan: ContentPlanItem[],
    userId: string,
    brandId?: string
): Promise<DeduplicationResult> {
    const supabase = createAdminClient()

    const removedItems: DeduplicationResult['removedItems'] = []
    const filteredPlan: ContentPlanItem[] = []

    let removedBySitemap = 0
    let removedByArticles = 0

    console.log(`\n${'='.repeat(80)}`)
    console.log(`[Deduplication] 🚀 STARTING BOUNCER CHECK (Agentic Mode)`)
    console.log(`${'='.repeat(80)}`)
    console.log(`[Deduplication] Input: ${plan.length} plan items`)
    console.log(`[Deduplication] User ID: ${userId}`)
    console.log(`[Deduplication] Brand ID: ${brandId || 'NONE'}`)
    console.log(`[Deduplication] Thresholds: Loose=${SIMILARITY_THRESHOLD_LOOSE}, Strict=${SIMILARITY_THRESHOLD_STRICT}`)
    console.log(`[Deduplication] Agent Model: ${GEMINI_MODEL}`)
    console.log(`${'='.repeat(80)}\n`)

    for (let i = 0; i < plan.length; i++) {
        const item = plan[i]
        const itemLabel = `[${i + 1}/${plan.length}]`

        console.log(`\n${'─'.repeat(60)}`)
        console.log(`[Deduplication] ${itemLabel} Processing: "${item.main_keyword}"`)
        console.log(`[Deduplication] ${itemLabel} Title: "${item.title}"`)

        // Create embedding text
        const embeddingText = `${item.title} ${item.main_keyword}`

        let embedding: number[]
        try {
            embedding = await generateEmbedding(embeddingText, "SEMANTIC_SIMILARITY")
        } catch (error) {
            console.error(`[Deduplication] ${itemLabel} ❌ FAILED to get embedding:`, error)
            filteredPlan.push(item)
            continue
        }

        // Helper to process match result
        const processMatch = async (match: { title: string, similarity: number } | null, source: 'sitemap' | 'article') => {
            if (!match) return false

            const { title: matchTitle, similarity } = match
            console.log(`[Deduplication] ${itemLabel} ⚠️ Potential match found in ${source}: "${matchTitle}" (${(similarity * 100).toFixed(2)}%)`)

            // 1. Strict Match (High Confidence) -> Auto Reject
            if (similarity > SIMILARITY_THRESHOLD_STRICT) {
                console.log(`[Deduplication] ${itemLabel} 🚫 REJECTED by strict threshold (> ${SIMILARITY_THRESHOLD_STRICT})`)
                removedItems.push({
                    item,
                    reason: `Too similar to existing ${source} (Strict)`,
                    similarTo: matchTitle,
                    similarity
                })
                if (source === 'sitemap') removedBySitemap++
                else removedByArticles++
                return true
            }

            // 2. Loose Match (Gray Area) -> Agent Check
            // We know similarity > SIMILARITY_THRESHOLD_LOOSE because the RPC filters by it
            console.log(`[Deduplication] ${itemLabel} 🕵️ Gray area match (${SIMILARITY_THRESHOLD_LOOSE} - ${SIMILARITY_THRESHOLD_STRICT}). Asking Agent...`)

            const isDuplicate = await checkSimilarityWithAgent(item.title, matchTitle)

            if (isDuplicate) {
                console.log(`[Deduplication] ${itemLabel} 🚫 REJECTED by Agent!`)
                removedItems.push({
                    item,
                    reason: `Agent confirmed duplicate of existing ${source}`,
                    similarTo: matchTitle,
                    similarity
                })
                if (source === 'sitemap') removedBySitemap++
                else removedByArticles++
                return true
            } else {
                console.log(`[Deduplication] ${itemLabel} ✅ Agent allowed it (False positive vector match)`)
                return false
            }
        }

        // Check 1: Sitemap
        const sitemapMatch = await checkAgainstSitemap(supabase, embedding, userId, itemLabel)
        if (await processMatch(sitemapMatch, 'sitemap')) continue

        // Check 2: Articles
        const articleMatch = await checkAgainstArticles(supabase, embedding, userId, brandId, itemLabel)
        if (await processMatch(articleMatch, 'article')) continue

        console.log(`[Deduplication] ${itemLabel} ✅ Keeping item`)
        filteredPlan.push(item)
    }

    const stats = {
        originalCount: plan.length,
        filteredCount: filteredPlan.length,
        removedBySitemap,
        removedByArticles
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`[Deduplication] 🏁 BOUNCER CHECK COMPLETE`)
    console.log(`[Deduplication] Final Stats: Tried ${stats.originalCount}, Kept ${stats.filteredCount}, Rejected ${stats.removedBySitemap + stats.removedByArticles}`)
    console.log(`${'='.repeat(80)}\n`)

    return { filteredPlan, removedItems, stats }
}

/**
 * Check if an embedding matches any existing sitemap pages
 */
async function checkAgainstSitemap(
    supabase: any,
    embedding: number[],
    userId: string,
    itemLabel: string
): Promise<{ title: string; similarity: number } | null> {
    try {
        const { data, error } = await supabase.rpc('match_internal_links', {
            query_embedding: embedding,
            match_threshold: SIMILARITY_THRESHOLD_LOOSE, // Use loose threshold for initial fetch
            match_count: 1,
            p_user_id: userId
        })

        if (error) {
            console.error(`[Deduplication] ${itemLabel}    ❌ RPC ERROR (Sitemap):`, error.message)
            return null
        }

        if (data && data.length > 0) {
            return {
                title: data[0].title,
                similarity: data[0].similarity
            }
        }
        return null
    } catch (error) {
        console.error(`[Deduplication] ${itemLabel}    ❌ EXCEPTION (Sitemap):`, error)
        return null
    }
}

/**
 * Check if an embedding matches any existing articles
 */
async function checkAgainstArticles(
    supabase: any,
    embedding: number[],
    userId: string,
    brandId: string | undefined,
    itemLabel: string
): Promise<{ title: string; similarity: number } | null> {
    try {
        const { data, error } = await supabase.rpc('match_articles', {
            query_embedding: embedding,
            match_threshold: SIMILARITY_THRESHOLD_LOOSE, // Use loose threshold for initial fetch
            match_count: 1,
            p_user_id: userId,
            p_brand_id: brandId || null
        })

        if (error) {
            // Quietly fail or warn
            return null
        }

        if (data && data.length > 0) {
            return {
                title: data[0].keyword,
                similarity: data[0].similarity
            }
        }
        return null
    } catch (error) {
        console.error(`[Deduplication] ${itemLabel}    ❌ EXCEPTION (Articles):`, error)
        return null
    }
}

/**
 * Full deduplication with replacement loop.
 * Ensures we always hit the target count (default 30) by generating replacements.
 */
export async function deduplicateWithReplacementLoop(
    plan: ContentPlanItem[],
    userId: string,
    brandData: import("@/lib/schemas/brand").BrandDetails,
    options: {
        brandId?: string
        targetCount?: number
        maxAttempts?: number
    } = {}
): Promise<{
    finalPlan: ContentPlanItem[]
    totalRejected: number
    replacementsGenerated: number
    attempts: number
}> {
    const { generateReplacementArticles } = await import("@/lib/plans/strategic-planner")

    const targetCount = options.targetCount ?? 30
    const maxAttempts = options.maxAttempts ?? 3 // Prevent infinite loops

    let currentPlan = [...plan]
    let allRejectedKeywords: string[] = [] // Track all rejected topics across attempts
    let totalRejected = 0
    let replacementsGenerated = 0
    let attempt = 0

    console.log(`\n${'#'.repeat(80)}`)
    console.log(`[Replacement Loop] 🔄 STARTING REPLACEMENT LOOP`)
    console.log(`${'#'.repeat(80)}`)
    console.log(`[Replacement Loop] Initial items: ${currentPlan.length}`)
    console.log(`[Replacement Loop] Target count: ${targetCount}`)
    console.log(`[Replacement Loop] Max attempts: ${maxAttempts}`)
    console.log(`[Replacement Loop] Brand ID: ${options.brandId || 'NONE'}`)
    console.log(`${'#'.repeat(80)}\n`)

    // CRITICAL: Use do-while to ALWAYS run deduplication at least once
    // Previously used while loop which skipped entirely when starting with target count
    do {
        attempt++
        console.log(`\n${'*'.repeat(60)}`)
        console.log(`[Replacement Loop] 🔁 ATTEMPT ${attempt}/${maxAttempts}`)
        console.log(`[Replacement Loop] Current plan size: ${currentPlan.length}`)
        console.log(`${'*'.repeat(60)}\n`)

        // Deduplicate current plan
        const { filteredPlan, removedItems, stats } = await deduplicateContentPlan(
            currentPlan,
            userId,
            options.brandId
        )

        // If nothing was removed, we're done with deduplication
        if (removedItems.length === 0) {
            console.log(`[Replacement Loop] ✅ No duplicates found this round`)
            console.log(`[Replacement Loop] Keeping all ${filteredPlan.length} items`)
            currentPlan = filteredPlan
            break
        }

        totalRejected += removedItems.length
        console.log(`[Replacement Loop] 🚫 ${removedItems.length} items rejected this round`)

        // Track rejected keywords to prevent re-suggesting them
        allRejectedKeywords.push(...removedItems.map(r => r.item.main_keyword))
        console.log(`[Replacement Loop] Total rejected keywords so far: ${allRejectedKeywords.length}`)
        console.log(`[Replacement Loop] Rejected keywords:`, allRejectedKeywords)

        const needed = targetCount - filteredPlan.length
        console.log(`[Replacement Loop] Need ${needed} replacements to reach target ${targetCount}`)

        // Build rejected items info for LLM
        const rejectedForLLM = removedItems.map(r => ({
            rejected_keyword: r.item.main_keyword,
            rejected_title: r.item.title,
            reason: `${r.reason}: "${r.similarTo}" (${(r.similarity * 100).toFixed(1)}% similar)`,
            phase: r.item.phase,
            category: r.item.article_category,
            cluster: r.item.cluster
        }))

        // Get keywords from verified plan so LLM doesn't duplicate them
        const existingPlanKeywords = [
            ...filteredPlan.map(p => p.main_keyword),
            ...allRejectedKeywords // Also include all previously rejected keywords
        ]

        console.log(`[Replacement Loop] Sending ${rejectedForLLM.length} rejected items to LLM`)
        console.log(`[Replacement Loop] Existing keywords to avoid: ${existingPlanKeywords.length}`)

        // Generate replacements
        try {
            console.log(`[Replacement Loop] 🤖 Calling generateReplacementArticles...`)
            const replacements = await generateReplacementArticles({
                brandData,
                rejectedItems: rejectedForLLM,
                existingPlanKeywords
            })

            replacementsGenerated += replacements.length
            console.log(`[Replacement Loop] ✅ Generated ${replacements.length} replacement articles`)
            replacements.forEach((r, idx) => {
                console.log(`[Replacement Loop]    ${idx + 1}. "${r.main_keyword}" - ${r.title}`)
            })

            // Combine verified items with new replacements for next iteration
            currentPlan = [...filteredPlan, ...replacements]
            console.log(`[Replacement Loop] New plan size: ${currentPlan.length}`)

        } catch (error) {
            console.error(`[Replacement Loop] ❌ Replacement generation FAILED:`, error)
            // If replacement generation fails, just use what we have
            currentPlan = filteredPlan
            break
        }
    } while (currentPlan.length < targetCount && attempt < maxAttempts)

    // Final safety check - ensure we don't exceed target
    if (currentPlan.length > targetCount) {
        console.log(`[Replacement Loop] ⚠️ Trimming plan from ${currentPlan.length} to ${targetCount}`)
        currentPlan = currentPlan.slice(0, targetCount)
    }

    // === RE-SCHEDULE ALL ITEMS WITH CONSECUTIVE DATES ===
    // After deduplication + replacement, dates have gaps (from removed items)
    // and replacements may share the same date (LLM picks unreliable day numbers).
    // Re-schedule using cluster-aware scheduling to get clean, consecutive dates.
    console.log(`[Replacement Loop] 📅 Re-scheduling ${currentPlan.length} items with consecutive dates...`)
    const today = new Date()
    const schedulable = currentPlan.map(item => ({ ...item, cluster: item.cluster || "General" }))
    const rescheduled = scheduleByCluster(schedulable, today)

    // Preserve any extra fields from ContentPlanItem that ScheduledArticle doesn't have
    // (scheduleByCluster spreads all fields via ...article, so they're preserved)
    currentPlan = rescheduled as unknown as ContentPlanItem[]
    console.log(`[Replacement Loop] ✅ Re-scheduled. First date: ${currentPlan[0]?.scheduled_date}, Last: ${currentPlan[currentPlan.length - 1]?.scheduled_date}`)

    console.log(`\n${'#'.repeat(80)}`)
    console.log(`[Replacement Loop] 🏁 REPLACEMENT LOOP COMPLETE`)
    console.log(`${'#'.repeat(80)}`)
    console.log(`[Replacement Loop] 📊 FINAL STATS:`)
    console.log(`[Replacement Loop]    Final count: ${currentPlan.length}/${targetCount}`)
    console.log(`[Replacement Loop]    Total rejected: ${totalRejected}`)
    console.log(`[Replacement Loop]    Replacements generated: ${replacementsGenerated}`)
    console.log(`[Replacement Loop]    Attempts used: ${attempt}`)
    console.log(`${'#'.repeat(80)}\n`)

    return {
        finalPlan: currentPlan,
        totalRejected,
        replacementsGenerated,
        attempts: attempt
    }
}
