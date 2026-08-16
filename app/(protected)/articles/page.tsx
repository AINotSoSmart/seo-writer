import { DeliveredArticles } from "@/components/articles/DeliveredArticles"
import { createClient } from "@/utils/supabase/server"

export default async function ArticlesPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const [{ data: rows }, { data: connection }] = await Promise.all([
        (supabase as any)
            .from("articles")
            .select(
                "id, keyword, final_html, wordpress_post_url, planned_article_id, planned_articles(target_url, generation_status, delivery_status, publication_status, publication_url, cycle_actions(resolution_type))",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        supabase
            .from("wordpress_connections")
            .select("id")
            .eq("user_id", user.id)
            .order("is_default", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ])

    const articles = (rows || []).map((row: any) => {
        const planned = Array.isArray(row.planned_articles)
            ? row.planned_articles[0]
            : row.planned_articles
        return {
            id: row.id,
            keyword: row.keyword,
            finalHtml: Boolean(row.final_html),
            wordpressUrl: row.wordpress_post_url,
            plannedArticleId: row.planned_article_id,
            targetUrl: planned?.target_url || null,
            generationStatus: planned?.generation_status || "generated",
            deliveryStatus: planned?.delivery_status || "delivered",
            publicationStatus:
                planned?.publication_status ||
                (row.wordpress_post_url ? "published" : "unpublished"),
            publicationUrl: planned?.publication_url || row.wordpress_post_url,
            resolutionType: Array.isArray(planned?.cycle_actions)
                ? planned.cycle_actions[0]?.resolution_type || null
                : planned?.cycle_actions?.resolution_type || null,
        }
    })

    return (
        <main className="mx-auto w-full max-w-6xl py-6">
            <header className="mb-7">
                <h1 className="font-serif text-3xl text-stone-900">Delivered articles</h1>
                <p className="mt-2 text-sm text-stone-600">
                    Generation, delivery, and publication are tracked separately. WordPress
                    and confirmed manual publication are the only active delivery controls.
                </p>
            </header>
            <DeliveredArticles
                initialArticles={articles}
                wordpressConnectionId={connection?.id || null}
            />
        </main>
    )
}
