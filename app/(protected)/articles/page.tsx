import Link from "next/link"
import { FileCheck2, Files, Globe2 } from "lucide-react"

import { DeliveredArticles } from "@/components/articles/DeliveredArticles"
import {
    ProductHeader,
    ProductMetric,
    ProductPage,
    secondaryActionClass,
} from "@/components/product/product-page"
import { createClient } from "@/utils/supabase/server"

type CycleActionRelation = { resolution_type: "create" | "refresh" | null }
type PlannedArticleRelation = {
    target_url: string | null
    generation_status: string | null
    delivery_status: string | null
    publication_status: string | null
    publication_url: string | null
    cycle_actions: CycleActionRelation | CycleActionRelation[] | null
}
type ArticleRow = {
    id: string
    keyword: string
    final_html: string | null
    wordpress_post_url: string | null
    planned_article_id: string | null
    planned_articles: PlannedArticleRelation | PlannedArticleRelation[] | null
}

export default async function ArticlesPage() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const [{ data: rows }, { data: connection }] = await Promise.all([
        // Generated types do not yet include the forward delivery relations.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    const articles = ((rows || []) as ArticleRow[]).map((row) => {
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
    const reviewReady = articles.filter((article) => article.finalHtml).length
    const published = articles.filter(
        (article) => article.publicationStatus === "published",
    ).length

    return (
        <ProductPage>
            <ProductHeader
                eyebrow="Production library"
                icon={Files}
                title="Articles"
                description="Review delivered drafts and move them into publication. Generation, delivery, and publication remain separate so every state is explicit."
                actions={
                    <>
                        <Link href="/content-plan" className={secondaryActionClass}>
                            Open content plan
                        </Link>
                        <Link href="/integrations" className={secondaryActionClass}>
                            {connection?.id ? "Manage WordPress" : "Connect WordPress"}
                        </Link>
                    </>
                }
            />

            <section className="grid gap-3 py-6 sm:grid-cols-3">
                <ProductMetric
                    icon={Files}
                    iconTint="#ede9fe"
                    iconColor="#6d28d9"
                    label="Delivered drafts"
                    value={String(articles.length)}
                    note="Complete outputs in your library"
                />
                <ProductMetric
                    icon={FileCheck2}
                    iconTint="#dbeafe"
                    iconColor="#1d4ed8"
                    label="Ready to review"
                    value={`${reviewReady}/${articles.length}`}
                    filled={reviewReady}
                    total={articles.length}
                    note="Final HTML is available"
                    emptyNote="Nothing to review until a cycle is delivered"
                />
                <ProductMetric
                    icon={Globe2}
                    iconTint="#dcfce7"
                    iconColor="#15803d"
                    label="Published"
                    value={`${published}/${articles.length}`}
                    filled={published}
                    total={articles.length}
                    note="Confirmed on a public URL"
                    emptyNote="Nothing published yet"
                />
            </section>
            <DeliveredArticles
                initialArticles={articles}
                wordpressConnectionId={connection?.id || null}
            />
        </ProductPage>
    )
}
