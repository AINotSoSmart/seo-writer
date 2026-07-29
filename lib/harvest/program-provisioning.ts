import "server-only"

const RECOMMENDED_CLUSTER_COUNT = 6
const VALID_TIERS = new Set(["close", "accelerate", "dominate"])

type ProvisioningResult =
    | { ok: true; programId: string; brandId: string; tier: string }
    | { ok: false; skipped: string }

/**
 * Turns an active billing plan into an active delivery program.
 *
 * Checkout is user-scoped, so the latest completed audit identifies the brand.
 * The operation is idempotent: repeated activation/updated webhooks update the
 * existing active program and reschedule only work that has not shipped.
 */
export async function provisionProgramForSubscription(
    supabase: any,
    userId: string,
    pricingPlanId: string | null,
): Promise<ProvisioningResult> {
    if (!pricingPlanId) return { ok: false, skipped: "missing pricing plan" }

    const { data: plan } = await supabase
        .from("dodo_pricing_plans")
        .select("name, metadata")
        .eq("id", pricingPlanId)
        .maybeSingle()

    const rawTier = String(plan?.metadata?.tier || plan?.name || "").toLowerCase()
    if (!VALID_TIERS.has(rawTier)) {
        return { ok: false, skipped: "pricing plan is not a velocity tier" }
    }

    const clustersPerMonth = Number(plan?.metadata?.clusters_per_month)
    if (!Number.isFinite(clustersPerMonth) || clustersPerMonth < 1) {
        return { ok: false, skipped: "velocity metadata is invalid" }
    }

    const { data: audit } = await supabase
        .from("topical_audits")
        .select("brand_id")
        .eq("user_id", userId)
        .eq("generation_status", "completed")
        .gt("article_count", 0)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!audit?.brand_id) return { ok: false, skipped: "no completed audit" }

    const { data: clusters, error: clusterError } = await supabase
        .from("audit_clusters")
        .select("id, article_count")
        .eq("user_id", userId)
        .eq("brand_id", audit.brand_id)
        .order("priority", { ascending: true })
        .limit(RECOMMENDED_CLUSTER_COUNT)

    if (clusterError) throw new Error(`Failed to load program clusters: ${clusterError.message}`)
    if (!clusters?.length) return { ok: false, skipped: "audit has no clusters" }

    const clusterIds = clusters.map((cluster: any) => cluster.id)
    const totalArticles = clusters.reduce(
        (sum: number, cluster: any) => sum + Number(cluster.article_count || 0),
        0,
    )

    const { data: articleStates, error: articleStateError } = await supabase
        .from("planned_articles")
        .select("cluster_id, status")
        .eq("user_id", userId)
        .eq("brand_id", audit.brand_id)
        .in("cluster_id", clusterIds)

    if (articleStateError) {
        throw new Error(`Failed to load planned article state: ${articleStateError.message}`)
    }

    const unfinishedStatuses = new Set(["pending", "scheduled"])
    const completedCount = (articleStates || []).filter(
        (article: any) => !unfinishedStatuses.has(article.status),
    ).length
    const unfinishedClusterSet = new Set(
        (articleStates || [])
            .filter((article: any) => unfinishedStatuses.has(article.status))
            .map((article: any) => article.cluster_id),
    )
    const unfinishedClusterIds = clusterIds.filter((id: string) => unfinishedClusterSet.has(id))

    const { data: existing } = await supabase
        .from("programs")
        .select("id, completed_count, status")
        .eq("user_id", userId)
        .eq("brand_id", audit.brand_id)
        .in("status", ["active", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    let programId: string
    if (existing?.id) {
        const { error } = await supabase
            .from("programs")
            .update({
                tier: rawTier,
                clusters_per_month: clustersPerMonth,
                clusters_included: clusterIds,
                total_articles: totalArticles,
                completed_count: Math.max(Number(existing.completed_count || 0), completedCount),
                status: "active",
                updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)

        if (error) throw new Error(`Failed to update delivery program: ${error.message}`)
        programId = existing.id
    } else {
        const { data: program, error } = await supabase
            .from("programs")
            .insert({
                user_id: userId,
                brand_id: audit.brand_id,
                tier: rawTier,
                clusters_per_month: clustersPerMonth,
                clusters_included: clusterIds,
                total_articles: totalArticles,
                completed_count: completedCount,
                status: "active",
            })
            .select("id")
            .single()

        if (error || !program) {
            throw new Error(`Failed to create delivery program: ${error?.message || "unknown error"}`)
        }
        programId = program.id
    }

    const daysBetweenClusters = Math.max(1, Math.round(30 / clustersPerMonth))
    for (let index = 0; index < unfinishedClusterIds.length; index++) {
        const date = new Date()
        date.setUTCDate(date.getUTCDate() + index * daysBetweenClusters)

        const { error } = await supabase
            .from("planned_articles")
            .update({
                scheduled_date: date.toISOString().slice(0, 10),
                status: "scheduled",
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("brand_id", audit.brand_id)
            .eq("cluster_id", unfinishedClusterIds[index])
            .in("status", ["pending", "scheduled"])

        if (error) throw new Error(`Failed to schedule cluster: ${error.message}`)
    }

    // content_plans is still the dashboard's compatibility read model. Keep its
    // dates in sync so checkout does not leave the UI saying "unscheduled".
    const [{ data: scheduledRows }, { data: contentPlan }] = await Promise.all([
        supabase
            .from("planned_articles")
            .select("id, scheduled_date, status")
            .eq("user_id", userId)
            .eq("brand_id", audit.brand_id),
        supabase
            .from("content_plans")
            .select("id, plan_data")
            .eq("user_id", userId)
            .eq("brand_id", audit.brand_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ])

    if (contentPlan?.id && Array.isArray(contentPlan.plan_data)) {
        const scheduleById = new Map(
            (scheduledRows || []).map((row: any) => [row.id, row]),
        )
        const planData = contentPlan.plan_data.map((item: any) => {
            const scheduled = scheduleById.get(item.id) as any
            if (!scheduled) return item
            return {
                ...item,
                scheduled_date: scheduled.scheduled_date || "",
                status: scheduled.status === "scheduled" ? "pending" : scheduled.status,
            }
        })

        await supabase
            .from("content_plans")
            .update({ plan_data: planData, updated_at: new Date().toISOString() })
            .eq("id", contentPlan.id)
    }

    return { ok: true, programId, brandId: audit.brand_id, tier: rawTier }
}
