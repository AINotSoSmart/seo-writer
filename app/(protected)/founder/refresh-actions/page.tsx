/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 7 relations are absent from generated database types until its migration is applied and types are regenerated. */
import { notFound } from "next/navigation"

import {
    RefreshActionWorkbench,
    type AssistedRefreshAction,
} from "@/components/founder/RefreshActionWorkbench"
import { isFounderUser } from "@/lib/founder"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export default async function FounderRefreshActionsPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user || !isFounderUser(user.id)) notFound()

    const db = createAdminClient() as any
    const { data: actionRows } = await db
        .from("cycle_actions")
        .select("id, brand_id, cycle_id, state, target_url, selection_reason")
        .eq("resolution_type", "refresh")
        .in("state", ["selected", "failed"])
        .order("created_at", { ascending: true })

    const actions = actionRows || []
    const actionIds = actions.map((row: any) => row.id)
    const brandIds = [...new Set(actions.map((row: any) => row.brand_id))]
    const cycleIds = [...new Set(actions.map((row: any) => row.cycle_id))]

    const [{ data: plannedRows }, { data: brands }, { data: cycles }] = await Promise.all([
        actionIds.length
            ? db
                  .from("planned_articles")
                  .select("id, cycle_action_id, title, main_keyword")
                  .in("cycle_action_id", actionIds)
            : Promise.resolve({ data: [] }),
        brandIds.length
            ? db.from("brand_details").select("id, website_url, brand_data").in("id", brandIds)
            : Promise.resolve({ data: [] }),
        cycleIds.length
            ? db
                  .from("subscription_cycles")
                  .select("id, state, period_start, period_end")
                  .in("id", cycleIds)
            : Promise.resolve({ data: [] }),
    ])

    const planned = plannedRows || []
    const plannedIds = planned.map((row: any) => row.id)
    const { data: links } = plannedIds.length
        ? await db
              .from("planned_article_links")
              .select("source_article_id, target_url, anchor_text")
              .in("source_article_id", plannedIds)
        : { data: [] }

    const brandById = new Map<string, any>((brands || []).map((row: any) => [row.id, row]))
    const cycleById = new Map<string, any>((cycles || []).map((row: any) => [row.id, row]))
    const plannedByAction = new Map<string, any>(
        planned.map((row: any) => [row.cycle_action_id, row]),
    )
    const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" })

    const work: AssistedRefreshAction[] = actions
        .filter((row: any) => cycleById.get(row.cycle_id)?.state === "producing")
        .map((row: any) => {
            const brand = brandById.get(row.brand_id)
            const cycle = cycleById.get(row.cycle_id)
            const output = plannedByAction.get(row.id)
            return {
                id: row.id,
                brandName:
                    brand?.brand_data?.product_name || brand?.website_url || "Customer brand",
                cycleLabel: `${date.format(new Date(cycle.period_start))}–${date.format(new Date(cycle.period_end))}`,
                title: output?.title || output?.main_keyword || "Existing-page refresh",
                targetUrl: row.target_url,
                selectionReason: row.selection_reason,
                state: row.state,
                requiredLinks: (links || [])
                    .filter((link: any) => link.source_article_id === output?.id)
                    .map((link: any) => ({ title: link.anchor_text, url: link.target_url })),
            }
        })

    return (
        <main className="mx-auto w-full max-w-5xl py-6">
            <header className="mb-7">
                <h1 className="font-serif text-3xl text-stone-900">Assisted refresh queue</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
                    Review the confirmed live page, prepare its complete replacement draft, and
                    attach that draft to the selected action. This queue never publishes or
                    creates a second page. Provider usage is outside this control and remains a
                    founder decision during beta.
                </p>
            </header>
            <RefreshActionWorkbench actions={work} />
        </main>
    )
}
