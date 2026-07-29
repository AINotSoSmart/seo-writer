import { schedules } from "@trigger.dev/sdk/v3"
import { createAdminClient } from "@/utils/supabase/admin"
import { generateBlogPost } from "./generate-blog"
import { adminHasCredits, adminDeductCredits, adminAddCredits } from "@/lib/credits"
import { BillingAlertEmail } from "@/lib/emails/templates/billing-alert"
import { resend, EMAIL_FROM, EMAIL_REPLY_TO } from "@/lib/emails/client"
import { render } from "@react-email/components"

/**
 * The Watchman - Daily Content Automation Scheduler
 * 
 * Runs every hour to check for content plans with automation enabled.
 * Finds articles scheduled for today (or missed) and triggers generation.
 * 
 * Why hourly? To handle different user timezones gracefully.
 * For 'gradual' catch_up_mode: only processes 1 article per hour to avoid credit spikes.
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

        // Fetch ALL active plans with catch_up_mode and updated_at for grace period check
        const { data: plans, error } = await supabase
            .from("content_plans")
            .select("id, user_id, brand_id, plan_data, catch_up_mode, updated_at")
            .eq("automation_status", "active")

        if (error) {
            console.error("❌ Watchman DB Error:", error)
            return { result: "Failed to fetch plans", error: error.message }
        }

        if (!plans || plans.length === 0) {
            console.log("😴 Watchman: No active automation plans found.")
            return { result: "No active plans", triggeredCount: 0 }
        }

        console.log(`📋 Watchman: Found ${plans.length} active plans to check`)

        let triggeredCount = 0
        let completedPlans = 0

        // Brands running a closed-pool program are shipped by `clusterShipper`
        // (trigger/ship-cluster.ts) in whole-cluster batches. Skipping them here
        // stops the two schedulers double-charging the same brand.
        const { data: activePrograms } = await supabase
            .from("programs")
            .select("brand_id")
            .eq("status", "active")

        const brandsOnPrograms = new Set(
            (activePrograms || []).map((p: any) => p.brand_id).filter(Boolean)
        )

        if (brandsOnPrograms.size > 0) {
            console.log(`⏭️ Watchman: ${brandsOnPrograms.size} brand(s) handled by the cluster shipper`)
        }

        // Loop through every user's plan
        for (const plan of plans) {
            if (plan.brand_id && brandsOnPrograms.has(plan.brand_id)) continue

            const items = (plan.plan_data as any[]) || []
            const catchUpMode = plan.catch_up_mode || "gradual"

            // Find items that are:
            // A) Scheduled for TODAY or earlier (catch missed items)
            // B) Status is still "pending" (not generated yet, not skipped)
            const itemsDue = items.filter((item: any) => {
                return item.scheduled_date <= today && item.status === "pending"
            })

            // Check if plan is complete (all items published or skipped)
            const allDone = items.every((item: any) =>
                item.status === "published" || item.status === "skipped"
            )
            if (allDone && items.length > 0) {
                // Plan is complete. Check if we should auto-refill (Infinite Loop).
                console.log(`🔄 Plan ${plan.id} finished. Checking for auto-refill...`)

                // 1. Check for Active Subscription OR Available Credits
                const { data: subscription } = await supabase
                    .from("dodo_subscriptions")
                    .select("status")
                    .eq("user_id", plan.user_id)
                    .eq("status", "active")
                    .limit(1)
                    .maybeSingle()

                // Check if user has at least 1 credit available (for LTD users who get refilled)
                const { hasCredits, error: creditCheckError } = await adminHasCredits(plan.user_id, 1)

                if (creditCheckError) {
                    console.error(`❌ Failed to check credits for plan auto-refill (User ${plan.user_id}): ${creditCheckError}`)
                    continue // Skip for now to avoid falsely completing the plan due to a DB error
                }

                if (!subscription && !hasCredits) {
                    console.log(`⏹️ User ${plan.user_id} has no active subscription and no credits available. Stopping automation.`)
                    await supabase.from("content_plans").update({ automation_status: "completed" }).eq("id", plan.id)
                    completedPlans++
                    continue
                }

                // 2. Fetch brand data for the background task payload
                const { data: brand } = await supabase
                    .from("brand_details")
                    .select("*")
                    .eq("id", plan.brand_id)
                    .single()

                if (!brand) {
                    console.warn(`⚠️ Cannot auto-refill plan ${plan.id}: Missing brand data.`)
                    await supabase.from("content_plans").update({ automation_status: "completed" }).eq("id", plan.id)
                    completedPlans++
                    continue
                }

                // 3. Create a new pending plan row (mirrors frontend onboarding flow)
                console.log(`✨ Auto-refilling plan for User ${plan.user_id} via background task...`)

                const { data: newPlan, error: insertError } = await supabase
                    .from("content_plans")
                    .insert({
                        user_id: plan.user_id,
                        brand_id: plan.brand_id,
                        plan_data: [],
                        competitor_seeds: [],
                        gsc_enhanced: false,
                        generation_status: "pending",
                        generation_phase: "sitemap",
                        automation_status: "active",
                        catch_up_mode: plan.catch_up_mode || "gradual",
                    })
                    .select()
                    .single()

                if (insertError || !newPlan) {
                    console.error("❌ Failed to create pending plan for auto-refill:", insertError)
                    await supabase.from("content_plans").update({ automation_status: "completed" }).eq("id", plan.id)
                    completedPlans++
                    continue
                }

                // 4. Trigger the background generation task (same as first-time generation)
                try {
                    const { tasks } = await import("@trigger.dev/sdk/v3")
                    const { generatePlanTask } = await import("@/trigger/generate-plan")

                    await tasks.trigger<typeof generatePlanTask>(
                        "generate-content-plan",
                        {
                            planId: newPlan.id,
                            userId: plan.user_id,
                            brandId: plan.brand_id,
                            brandData: brand.brand_data,
                            brandUrl: brand.brand_url,
                            isAutoRefill: true
                        }
                    )

                    console.log(`✅ Background plan generation triggered for User ${plan.user_id} (plan ${newPlan.id})`)
                } catch (triggerError: any) {
                    console.error("❌ Failed to trigger background plan generation:", triggerError)
                    // Mark the new plan as failed
                    await supabase
                        .from("content_plans")
                        .update({
                            generation_status: "failed",
                            generation_error: triggerError.message || "Failed to start auto-refill generation"
                        })
                        .eq("id", newPlan.id)
                }

                // 5. Mark OLD plan as completed
                await supabase
                    .from("content_plans")
                    .update({ automation_status: "completed" })
                    .eq("id", plan.id)

                completedPlans++
                continue
            }

            if (itemsDue.length === 0) continue

            // Rate limiting for gradual catch-up mode: only process 1 article per hour
            const itemsToProcess = catchUpMode === "gradual" ? [itemsDue[0]] : itemsDue
            console.log(`📋 Plan ${plan.id}: ${itemsDue.length} due, processing ${itemsToProcess.length} (mode: ${catchUpMode})`)

            // Check credits for the user (only need 1 credit at a time for gradual mode)
            const creditsNeeded = catchUpMode === "gradual" ? 1 : itemsToProcess.length
            const { hasCredits: userHasCredits, currentBalance, error: creditError } = await adminHasCredits(plan.user_id, creditsNeeded)

            if (creditError) {
                console.error(`❌ Failed to check credits for User ${plan.user_id}: ${creditError}. Skipping plan to avoid false pause.`)
                continue
            }

            console.log(`💰 User ${plan.user_id}: Credits needed=${creditsNeeded}, hasCredits=${userHasCredits}, balance=${currentBalance}`)

            if (!userHasCredits) {
                // GRACE PERIOD: If plan was enabled in the last 60 minutes, don't pause immediately
                // This prevents the scheduler from immediately pausing a just-enabled automation due to sync delays
                const gracePeriod = 60 * 60 * 1000 // 1 Hour
                const graceCutoff = new Date(Date.now() - gracePeriod).toISOString()

                if (plan.updated_at && plan.updated_at > graceCutoff) {
                    console.log(`⏳ Grace Period: Skipping pause for Plan ${plan.id} (updated ${plan.updated_at}). Credits will be checked again next run.`)
                    continue
                }

                console.warn(`⚠️ User ${plan.user_id} has insufficient credits (${currentBalance}) for plan ${plan.id}. Pausing automation.`)

                // Pause the plan
                await supabase
                    .from("content_plans")
                    .update({ automation_status: "paused" })
                    .eq("id", plan.id)

                // TODO: Notify user via email (future feature)
                continue
            }

            // Trigger the Writer for each item to process
            for (const item of itemsToProcess) {
                console.log(`🚀 Triggering article: "${item.title}" (${item.main_keyword}) for Plan ${plan.id}`)

                // Deduct credit
                const { success: deductionSuccess } = await adminDeductCredits(plan.user_id, 1, `Automated article: ${item.main_keyword}`)
                if (!deductionSuccess) {
                    console.error(`❌ Failed to deduct credit for user ${plan.user_id}. Skipping item.`)
                    continue
                }

                try {
                    // If article_id doesn't exist, we need to create one first
                    let articleId = item.article_id
                    if (!articleId) {
                        // Create article record on-the-fly
                        const { data: newArticle, error: articleError } = await supabase
                            .from("articles")
                            .insert({
                                brand_id: plan.brand_id,
                                keyword: item.main_keyword,
                                status: "queued",
                                user_id: plan.user_id,
                            })
                            .select("id")
                            .single()

                        if (articleError || !newArticle) {
                            console.error(`❌ Failed to create article for "${item.title}":`, articleError)
                            // Refund credit since we failed before triggering task
                            await adminAddCredits(plan.user_id, 1, "Refund: Failed to create article record")
                            continue
                        }
                        articleId = newArticle.id
                    }

                    // Update plan_data with the article_id and status
                    const updatedPlanData = items.map((i: any) =>
                        i.id === item.id ? { ...i, article_id: articleId, status: "writing" } : i
                    )
                    await supabase
                        .from("content_plans")
                        .update({ plan_data: updatedPlanData })
                        .eq("id", plan.id)

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

                    triggeredCount++
                } catch (e) {
                    // Catch trigger failures and refund
                    console.error(`❌ Failed to trigger automation for item ${item.id}`, e)
                    await adminAddCredits(plan.user_id, 1, "Refund: Automation trigger failed")
                }
            }
        }

        // --- DAILY BILLING CHECK (Run at approx 10 AM UTC) ---
        const currentHour = new Date().getUTCHours()
        if (currentHour === 10) {
            console.log("🧾 Watchman: Checking for upcoming billing...")
            try {
                const targetDate = new Date()
                targetDate.setDate(targetDate.getDate() + 5)
                const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString()
                const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString()

                // Query dodo_subscriptions
                // Note: next_billing_date must be added to column via migration
                const { data: subs } = await supabase
                    .from("dodo_subscriptions")
                    .select("*, dodo_pricing_plans(name, price, currency)")
                    .eq("status", "active")
                    .gte("next_billing_date", startOfDay)
                    .lte("next_billing_date", endOfDay)

                if (subs && subs.length > 0) {
                    console.log(`🧾 Found ${subs.length} subscriptions renewing soon`)

                    for (const sub of subs) {
                        const plan = (sub.dodo_pricing_plans as any)
                        try {
                            // Fetch user email via Admin Auth
                            const { data: userRec } = await supabase.auth.admin.getUserById(sub.user_id)
                            const user = userRec?.user

                            if (user?.email) {
                                const emailHtml = await render(BillingAlertEmail({
                                    userName: user.user_metadata?.full_name || user.email.split('@')[0],
                                    billingDate: new Date(sub.next_billing_date).toLocaleDateString(),
                                    amount: plan ? `${plan.price} ${plan.currency}` : "Subscription Price",
                                    planName: plan?.name || "Pro Plan"
                                }))

                                await resend.emails.send({
                                    from: EMAIL_FROM,
                                    to: user.email,
                                    subject: `Upcoming Invoice Reminder 🧾`,
                                    html: emailHtml,
                                    replyTo: EMAIL_REPLY_TO
                                })
                                console.log(`📧 Billing email sent to ${user.email}`)
                            }
                        } catch (err) {
                            console.error(`Failed to trigger billing email for sub ${sub.id}`, err)
                        }
                    }
                }
            } catch (billingErr) {
                console.error("Billing check failed:", billingErr)
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

/**
 * SEO Health Auto-Refresh Scheduler
 * 
 * Runs weekly (every Sunday at 2 AM UTC) to find stale SEO metrics
 * and trigger background refresh for domains with data > 30 days old.
 */
export const seoHealthAutoRefresh = schedules.task({
    id: "seo-health-auto-refresh",
    cron: "0 2 * * 0", // Every Sunday at 2:00 AM UTC
    run: async () => {
        console.log("🔍 SEO Auto-Refresh: Checking for stale metrics...")

        const supabase = createAdminClient() as any

        // Find metrics older than 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: staleMetrics, error } = await supabase
            .from("seo_metrics")
            .select("id, user_id, brand_id, domain, fetched_at, status")
            .lt("fetched_at", thirtyDaysAgo.toISOString())
            .neq("status", "running") // Don't re-trigger if already running
            .neq("status", "pending")

        if (error) {
            console.error("❌ SEO Auto-Refresh DB Error:", error)
            return { result: "Failed to fetch stale metrics", error: error.message }
        }

        if (!staleMetrics || staleMetrics.length === 0) {
            console.log("✅ SEO Auto-Refresh: All metrics are fresh!")
            return { result: "No stale metrics found", refreshedCount: 0 }
        }

        console.log(`📊 SEO Auto-Refresh: Found ${staleMetrics.length} stale domains to refresh`)

        // Import the task dynamically to avoid circular deps
        const { seoHealthTask } = await import("./seo-health")

        let refreshedCount = 0

        for (const metric of staleMetrics) {
            try {
                // Update status to pending
                await supabase
                    .from("seo_metrics")
                    .update({ status: "pending" })
                    .eq("id", metric.id)

                // Trigger the background task
                await seoHealthTask.trigger({
                    userId: metric.user_id,
                    brandId: metric.brand_id,
                    domain: metric.domain,
                    force: true
                })

                console.log(`🔄 Triggered refresh for ${metric.domain}`)
                refreshedCount++

                // Small delay to avoid rate limits
                await new Promise(r => setTimeout(r, 1000))

            } catch (err) {
                console.error(`Failed to refresh ${metric.domain}:`, err)
            }
        }

        console.log(`✅ SEO Auto-Refresh: Triggered ${refreshedCount} refreshes`)
        return {
            result: "SEO auto-refresh completed",
            refreshedCount,
            totalStale: staleMetrics.length
        }
    }
})

/**
 * Sitemap Sync Scheduler
 * 
 * Runs every 3 days at 3:00 AM UTC to keep internal link database fresh.
 * Triggers the sync-internal-links task for all brands that have a sitemap configured.
 */
export const sitemapSyncScheduler = schedules.task({
    id: "sitemap-sync-scheduler",
    cron: "0 3 */3 * *", // At 03:00 on every 3rd day-of-month
    run: async () => {
        console.log("🗺️ Sitemap Scheduler: Starting batch sync...")

        const supabase = createAdminClient() as any

        // Fetch all brands with a valid website_url
        const { data: brands, error } = await supabase
            .from("brand_details")
            .select("id, user_id, website_url")
            .not("website_url", "is", null)
            .neq("website_url", "")

        if (error) {
            console.error("❌ Sitemap Scheduler DB Error:", error)
            return { result: "Failed to fetch brands", error: error.message }
        }

        if (!brands || brands.length === 0) {
            console.log("😴 Sitemap Scheduler: No brands with sitemaps found.")
            return { result: "No brands to sync", count: 0 }
        }

        console.log(`📋 Sitemap Scheduler: Found ${brands.length} brands to sync.`)

        // Dynamic import to avoid circular deps
        const { syncInternalLinks } = await import("./sync-links")

        let triggeredCount = 0

        for (const brand of brands) {
            try {
                const sitemapUrl = brand.website_url.endsWith('/') ? `${brand.website_url}sitemap.xml` : `${brand.website_url}/sitemap.xml`
                await syncInternalLinks.trigger({
                    userId: brand.user_id,
                    brandId: brand.id,
                    sitemapUrl: sitemapUrl
                })
                triggeredCount++
                // Tiny delay just to be polite to the queueing system
                await new Promise(r => setTimeout(r, 100))
            } catch (err) {
                console.error(`❌ Failed to trigger sync for brand ${brand.id}:`, err)
            }
        }

        console.log(`✅ Sitemap Scheduler: Triggered ${triggeredCount} sync jobs.`)
        return {
            result: "Sitemap sync batch triggered",
            triggeredCount,
            totalBrands: brands.length
        }
    }
})

/**
 * GSC Data Strict 30-Day Auto-Refresh Scheduler
 * 
 * Runs daily to check the chronological lock (last_fetched_at) on all GSC connections.
 * If 30 days have passed (or it's null), it triggers the sync task in the background.
 */
export const gscDailyAutoRefresh = schedules.task({
    id: "gsc-daily-auto-refresh",
    cron: "0 4 * * *", // At 04:00 AM UTC every day
    run: async () => {
        console.log("🔍 GSC Auto-Refresh: Checking for connections exceeding 30-day chronological lock...")

        const supabase = createAdminClient() as any
        
        // Find 30 days ago
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const cutoffString = thirtyDaysAgo.toISOString()

        // Fetch connections where last_fetched is null or older than 30 days
        const { data: staleConnections, error } = await supabase
            .from("gsc_connections")
            .select("id, user_id, site_url, last_fetched_at")
            .or(`last_fetched_at.is.null,last_fetched_at.lt.${cutoffString}`)

        if (error) {
            console.error("❌ GSC Auto-Refresh DB Error:", error)
            return { result: "Failed to fetch stale GSC connections", error: error.message }
        }

        if (!staleConnections || staleConnections.length === 0) {
            console.log("✅ GSC Auto-Refresh: All connections are safely within their 30-day lock period!")
            return { result: "No stale connections found", triggeredCount: 0 }
        }

        console.log(`📊 GSC Auto-Refresh: Found ${staleConnections.length} stale connections to renew`)

        // Import task dynamically
        const { syncGscDataTask } = await import("./gsc-sync")

        let triggeredCount = 0

        for (const conn of staleConnections) {
            try {
                // Trigger the background sync task
                await syncGscDataTask.trigger({
                    userId: conn.user_id,
                    connectionId: conn.id,
                    siteUrl: conn.site_url,
                    isInitialSync: !conn.last_fetched_at
                })

                console.log(`🔄 Triggered GSC sync for ${conn.site_url}`)
                triggeredCount++

                // Small delay to prevent queue flooding
                await new Promise(r => setTimeout(r, 1000))

            } catch (err) {
                console.error(`Failed to dispatch GSC sync for ${conn.site_url}:`, err)
            }
        }

        console.log(`✅ GSC Auto-Refresh: Triggered ${triggeredCount} full data extractions.`)
        return {
            result: "GSC auto-refresh scheduling completed",
            triggeredCount,
            totalStale: staleConnections.length
        }
    }
})
