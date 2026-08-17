/* eslint-disable @typescript-eslint/no-explicit-any -- proposal-cycle relations are unavailable until the forward migrations are applied and types regenerated. */
import { notFound } from "next/navigation"

import {
    BatchApprovalWorkbench,
    type ApprovalBatch,
} from "@/components/founder/BatchApprovalWorkbench"
import { isFounderUser } from "@/lib/founder"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export default async function FounderDeliveryBatchesPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user || !isFounderUser(user.id)) notFound()

    const db = createAdminClient() as any
    const { data: cycles } = await db
        .from("subscription_cycles")
        .select(
            "id, brand_id, period_start, period_end, " +
                "cycle_actions(id, resolution_type, target_url, state, " +
                "planned_articles(title, article_id))",
        )
        .eq("state", "ready")
        .order("period_start", { ascending: true })
    const brandIds = [...new Set((cycles || []).map((cycle: any) => cycle.brand_id))]
    const { data: brands } = brandIds.length
        ? await db.from("brand_details").select("id, website_url, brand_data").in("id", brandIds)
        : { data: [] }
    const brandById = new Map((brands || []).map((brand: any) => [brand.id, brand]))
    const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" })
    const batches: ApprovalBatch[] = (cycles || []).map((cycle: any) => {
        const brand = brandById.get(cycle.brand_id) as any
        return {
            cycleId: cycle.id,
            brandName: brand?.brand_data?.product_name || brand?.website_url || "Customer brand",
            period: `${date.format(new Date(cycle.period_start))}–${date.format(new Date(cycle.period_end))}`,
            actions: (cycle.cycle_actions || []).map((action: any) => {
                const output = Array.isArray(action.planned_articles)
                    ? action.planned_articles[0]
                    : action.planned_articles
                return {
                    id: action.id,
                    resolutionType: action.resolution_type,
                    title: output?.title || action.target_url || "Content action",
                    articleId: output?.article_id || null,
                    targetUrl: action.target_url,
                }
            }),
        }
    })

    return (
        <main className="mx-auto w-full max-w-5xl py-6">
            <header className="mb-7">
                <h1 className="font-serif text-3xl text-stone-900">Batch release review</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
                    Generation stops here during the founding beta. Review every create and refresh output; approval releases the complete batch to the customer at once.
                </p>
            </header>
            <BatchApprovalWorkbench batches={batches} />
        </main>
    )
}
