import { schedules } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { generateBlogPost } from "./generate-blog"

/**
 * The Watchman - Daily Content Automation Scheduler
 * 
 * Runs every hour to check for content plans with automation enabled.
 * Finds articles scheduled for today (or missed) and triggers generation.
 * 
 * Why hourly? To handle different user timezones gracefully.
 * The concurrency setting on generateBlogPost handles the load.
 */
export const dailyContentWatchman = schedules.task({
    id: "daily-content-watchman",
    // Run every hour at minute 0 to catch different timezones
    // Change to "0 0 * * *" for once daily at midnight UTC
    cron: "0 * * * *",
    run: async () => {
        console.log("👮 Watchman started: Scanning for articles to write...")

        const supabase = createAdminClient() as any // Type cast until types are regenerated

        // Get current date (YYYY-MM-DD) in UTC
        const today = new Date().toISOString().split('T')[0]

        // Fetch ALL active plans
        const { data: plans, error } = await supabase
            .from("content_plans")
            .select("id, user_id, brand_id, plan_data")
            .eq("automation_status", "active")

        if (error) {
            console.error("❌ Watchman DB Error:", error)
            return { result: "Failed to fetch plans", error: error.message }
        }

        if (!plans || plans.length === 0) {
            console.log("😴 Watchman: No active automation plans found.")
            return { result: "No active plans", triggeredCount: 0 }
        }

        let triggeredCount = 0
        let completedPlans = 0

        // Loop through every user's plan
        for (const plan of plans) {
            const items = (plan.plan_data as any[]) || []

            // Find items that are:
            // A) Scheduled for TODAY or earlier (catch missed items)
            // B) Status is still "pending" (not generated yet)
            const itemsDue = items.filter((item: any) => {
                return item.scheduled_date <= today && item.status === "pending"
            })

            // Check if plan is complete (all items published)
            const allPublished = items.every((item: any) => item.status === "published")
            if (allPublished && items.length > 0) {
                // Mark plan as completed
                await supabase
                    .from("content_plans")
                    .update({ automation_status: "completed" })
                    .eq("id", plan.id)
                completedPlans++
                console.log(`✅ Plan ${plan.id} completed - all articles published`)
                continue
            }

            // Trigger the Writer for each due item
            for (const item of itemsDue) {
                console.log(`🚀 Triggering article: "${item.title}" (${item.main_keyword}) for Plan ${plan.id}`)

                // If article_id doesn't exist, we need to create one first
                let articleId = item.article_id
                if (!articleId) {
                    // Create article record on-the-fly
                    const { data: newArticle, error: articleError } = await supabase
                        .from("articles")
                        .insert({
                            brand_id: plan.brand_id,
                            keyword: item.main_keyword,
                            status: "pending",
                            user_id: plan.user_id,
                        })
                        .select("id")
                        .single()

                    if (articleError || !newArticle) {
                        console.error(`❌ Failed to create article for "${item.title}":`, articleError)
                        continue
                    }
                    articleId = newArticle.id

                    // Update plan_data with the new article_id
                    const updatedPlanData = items.map((i: any) =>
                        i.id === item.id ? { ...i, article_id: articleId, status: "writing" } : i
                    )
                    await supabase
                        .from("content_plans")
                        .update({ plan_data: updatedPlanData })
                        .eq("id", plan.id)
                }

                // Trigger the blog generation task
                await generateBlogPost.trigger({
                    articleId: articleId,
                    keyword: item.main_keyword,
                    brandId: plan.brand_id,
                    title: item.title,
                    articleType: item.article_type || "informational",
                    supportingKeywords: item.supporting_keywords || [],
                    cluster: item.cluster || "",
                    planId: plan.id,
                    itemId: item.id,
                })

                // Update item status to writing
                const updatedItems = items.map((i: any) =>
                    i.id === item.id ? { ...i, status: "writing" } : i
                )
                await supabase
                    .from("content_plans")
                    .update({ plan_data: updatedItems })
                    .eq("id", plan.id)

                triggeredCount++
            }
        }

        console.log(`👮 Watchman finished. Triggered ${triggeredCount} articles, completed ${completedPlans} plans.`)
        return {
            result: `Watchman finished successfully`,
            triggeredCount,
            completedPlans,
            activePlans: plans.length,
        }
    },
})
