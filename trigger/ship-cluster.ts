import { schedules } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { generateBlogPost } from "./generate-blog"
import { adminHasCredits, adminDeductCredits, adminAddCredits } from "@/lib/credits"

/**
 * Cluster Shipper — the delivery cadence for the closed-pool model.
 *
 * Ships one complete cluster at a time rather than one article per day.
 *
 * WHY: a cluster's value is its internal link graph, and that graph is only
 * valid once every member exists. The previous scheduler dripped a single
 * article per hour, which meant article 2 linked to article 30 for four weeks.
 * Shipping the batch whole makes the graph resolve at publish time and gives the
 * customer a monthly deliverable that reads as one thing.
 *
 * Reads `planned_articles` / `audit_clusters` / `programs` — the closed-pool
 * tables. The legacy `dailyContentWatchman` in scheduler.ts still serves
 * `content_plans` rows and skips any brand that has an active program, so the
 * two never process the same brand.
 */

/** Cap per run so one large cluster cannot drain a balance unnoticed */
const MAX_ARTICLES_PER_CLUSTER_RUN = 20

interface DueCluster {
    clusterId: string
    clusterName: string
    articles: Array<{
        id: string
        title: string
        main_keyword: string
        supporting_keywords: string[]
        article_type: string
        is_pillar: boolean
    }>
}

export const clusterShipper = schedules.task({
    id: "ship-cluster",
    // Hourly so different timezones are handled gracefully; the scheduled_date
    // check means a cluster still only ships once.
    cron: "0 * * * *",
    run: async () => {
        console.log("📦 Cluster Shipper: scanning for clusters due...")

        const supabase = createAdminClient() as any
        const today = new Date().toISOString().split("T")[0]

        const { data: programs, error } = await supabase
            .from("programs")
            .select("id, user_id, brand_id, tier, clusters_per_month, total_articles, completed_count")
            .eq("status", "active")

        if (error) {
            console.error("❌ Cluster Shipper DB error:", error)
            return { result: "Failed to fetch programs", error: error.message }
        }

        if (!programs || programs.length === 0) {
            console.log("😴 Cluster Shipper: no active programs.")
            return { result: "No active programs", shipped: 0 }
        }

        let clustersShipped = 0
        let articlesTriggered = 0

        for (const program of programs) {
            const due = await findDueCluster(supabase, program.brand_id, today)

            if (!due) {
                // Nothing due. If nothing is left at all, the niche is complete.
                const { count: remaining } = await supabase
                    .from("planned_articles")
                    .select("id", { count: "exact", head: true })
                    .eq("brand_id", program.brand_id)
                    .in("status", ["pending", "scheduled"])

                if ((remaining ?? 0) === 0) {
                    await supabase
                        .from("programs")
                        .update({
                            status: "completed",
                            completed_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", program.id)

                    // Running out is the designed outcome, not a failure. The UI
                    // tells the customer their niche is closed rather than
                    // quietly re-shipping rewrites of their own articles.
                    console.log(
                        `🏁 Program ${program.id}: niche complete — no gaps left for brand ${program.brand_id}`
                    )
                }
                continue
            }

            const batch = due.articles.slice(0, MAX_ARTICLES_PER_CLUSTER_RUN)

            // Credits are charged per cluster, matching how the plan is sold
            const { hasCredits, currentBalance, error: creditError } = await adminHasCredits(
                program.user_id,
                batch.length
            )

            if (creditError) {
                console.error(`❌ Credit check failed for user ${program.user_id}: ${creditError}`)
                continue
            }

            if (!hasCredits) {
                console.warn(
                    `⚠️ User ${program.user_id} has ${currentBalance} credits, needs ${batch.length} ` +
                    `for cluster "${due.clusterName}". Pausing program ${program.id}.`
                )
                await supabase
                    .from("programs")
                    .update({ status: "paused", updated_at: new Date().toISOString() })
                    .eq("id", program.id)
                continue
            }

            console.log(
                `🚀 Shipping cluster "${due.clusterName}" (${batch.length} articles) for brand ${program.brand_id}`
            )

            const shippedIds: string[] = []

            for (const article of batch) {
                const { success: deducted } = await adminDeductCredits(
                    program.user_id,
                    1,
                    `Cluster "${due.clusterName}": ${article.main_keyword}`
                )
                if (!deducted) {
                    console.error(`❌ Credit deduction failed for ${article.main_keyword}`)
                    continue
                }

                try {
                    const { data: newArticle, error: articleError } = await supabase
                        .from("articles")
                        .insert({
                            brand_id: program.brand_id,
                            keyword: article.main_keyword,
                            status: "queued",
                            user_id: program.user_id,
                        })
                        .select("id")
                        .single()

                    if (articleError || !newArticle) {
                        console.error(`❌ Failed to create article row:`, articleError)
                        await adminAddCredits(program.user_id, 1, "Refund: article row creation failed")
                        continue
                    }

                    await generateBlogPost.trigger({
                        articleId: newArticle.id,
                        keyword: article.main_keyword,
                        brandId: program.brand_id,
                        title: article.title,
                        articleType: (article.article_type as any) || "informational",
                        supportingKeywords: article.supporting_keywords || [],
                        cluster: due.clusterName,
                    })

                    await supabase
                        .from("planned_articles")
                        .update({
                            status: "writing",
                            article_id: newArticle.id,
                            shipped_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", article.id)

                    shippedIds.push(article.id)
                    articlesTriggered++
                } catch (e) {
                    console.error(`❌ Trigger failed for "${article.main_keyword}":`, e)
                    await adminAddCredits(program.user_id, 1, "Refund: cluster trigger failed")
                }
            }

            if (shippedIds.length > 0) {
                clustersShipped++
                await supabase
                    .from("programs")
                    .update({
                        completed_count: (program.completed_count || 0) + shippedIds.length,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", program.id)
            }
        }

        console.log(
            `📦 Cluster Shipper done: ${clustersShipped} clusters, ${articlesTriggered} articles triggered`
        )
        return { result: "OK", clustersShipped, articlesTriggered }
    },
})

/**
 * Finds the highest-priority cluster with articles due today or earlier.
 *
 * Returns the whole cluster, not the individual due articles — partial delivery
 * is what the batch model exists to avoid.
 */
async function findDueCluster(
    supabase: any,
    brandId: string,
    today: string
): Promise<DueCluster | null> {
    const { data: dueArticles } = await supabase
        .from("planned_articles")
        .select("cluster_id")
        .eq("brand_id", brandId)
        .in("status", ["pending", "scheduled"])
        .lte("scheduled_date", today)
        .limit(200)

    if (!dueArticles || dueArticles.length === 0) return null

    const clusterIds = Array.from(
        new Set(dueArticles.map((a: any) => a.cluster_id).filter(Boolean))
    )
    if (clusterIds.length === 0) return null

    // Lowest priority number ships first — clusters arrive pre-sorted from the
    // harvest, so index 0 is the highest-value one.
    const { data: clusters } = await supabase
        .from("audit_clusters")
        .select("id, name, priority")
        .in("id", clusterIds)
        .order("priority", { ascending: true })
        .limit(1)

    const cluster = clusters?.[0]
    if (!cluster) return null

    const { data: articles } = await supabase
        .from("planned_articles")
        .select("id, title, main_keyword, supporting_keywords, article_type, is_pillar")
        .eq("brand_id", brandId)
        .eq("cluster_id", cluster.id)
        .in("status", ["pending", "scheduled"])
        // Pillar first: it is the hub every leaf links back to
        .order("is_pillar", { ascending: false })

    if (!articles || articles.length === 0) return null

    return { clusterId: cluster.id, clusterName: cluster.name, articles }
}
