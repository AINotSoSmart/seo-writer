import { notFound } from "next/navigation"

import { TestArticleRunner } from "@/components/founder/TestArticleRunner"
import { isFounderUser } from "@/lib/founder"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

export default async function TestArticlePage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user || !isFounderUser(user.id)) notFound()

    const db = createAdminClient() as any

    const { data: brands } = await db
        .from("brand_details")
        .select("id, website_url, brand_data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

    const brandIds = (brands || []).map((brand: any) => brand.id)

    // Planned articles from any completed audit on these brands. Present so a
    // real planned title can be generated in one click instead of retyped;
    // absent is fine, because this route deliberately does not require an audit.
    const { data: planned } = brandIds.length
        ? await db
              .from("planned_articles")
              .select(
                  "id, brand_id, cluster_id, title, main_keyword, supporting_keywords, article_type, is_pillar, generation_status",
              )
              .in("brand_id", brandIds)
              .order("is_pillar", { ascending: false })
              .limit(200)
        : { data: [] }

    const clusterIds = Array.from(
        new Set((planned || []).map((row: any) => row.cluster_id).filter(Boolean)),
    )
    const { data: clusters } = clusterIds.length
        ? await db.from("audit_clusters").select("id, name").in("id", clusterIds)
        : { data: [] }
    const clusterNameById = new Map(
        (clusters || []).map((row: any) => [row.id, row.name]),
    )

    // Position within its cluster decides the intro pattern, so the UI can show
    // which opening shape a given article would actually be written with.
    const positionByArticle = new Map<string, number>()
    for (const clusterId of clusterIds) {
        const members = (planned || []).filter((row: any) => row.cluster_id === clusterId)
        members.forEach((row: any, index: number) => positionByArticle.set(row.id, index))
    }

    return (
        <main className="mx-auto w-full max-w-5xl py-6">
            <header className="mb-7">
                <h1 className="font-serif text-3xl text-stone-900">Single-article QA</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
                    Generate one article with the real writer to check quality, without
                    shipping a cluster. No planned article is updated, no frozen link
                    graph is required, no credit is consumed, and no program or cluster
                    state is touched. Provider costs are real.
                </p>
            </header>

            <TestArticleRunner
                brands={(brands || []).map((brand: any) => ({
                    id: brand.id,
                    websiteUrl: brand.website_url || "",
                    productName: brand.brand_data?.product_name || brand.website_url || "Brand",
                }))}
                plannedArticles={(planned || []).map((row: any) => ({
                    id: row.id,
                    brandId: row.brand_id,
                    title: row.title,
                    mainKeyword: row.main_keyword,
                    supportingKeywords: row.supporting_keywords || [],
                    articleType: row.article_type || "informational",
                    isPillar: Boolean(row.is_pillar),
                    generationStatus: row.generation_status,
                    clusterName: clusterNameById.get(row.cluster_id) || null,
                    clusterPosition: positionByArticle.get(row.id) ?? 0,
                }))}
            />
        </main>
    )
}
