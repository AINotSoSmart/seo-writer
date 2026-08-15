"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, FilePenLine, Send } from "lucide-react"

type Article = {
    id: string
    keyword: string
    finalHtml: boolean
    wordpressUrl: string | null
    plannedArticleId: string | null
    targetUrl: string | null
    generationStatus: string
    deliveryStatus: string
    publicationStatus: string
    publicationUrl: string | null
}

export function DeliveredArticles({
    initialArticles,
    wordpressConnectionId,
}: {
    initialArticles: Article[]
    wordpressConnectionId: string | null
}) {
    const [articles, setArticles] = useState(initialArticles)
    const [pending, setPending] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function wordpress(articleId: string, publishStatus: "draft" | "publish") {
        if (!wordpressConnectionId) return
        setPending(articleId)
        setError(null)
        try {
            const response = await fetch("/api/wordpress/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    articleId,
                    connectionId: wordpressConnectionId,
                    publishStatus,
                }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "WordPress action failed.")
            setArticles((current) =>
                current.map((article) =>
                    article.id === articleId
                        ? {
                              ...article,
                              wordpressUrl: result.postUrl,
                              publicationUrl: result.postUrl,
                              publicationStatus:
                                  result.status === "publish" ? "published" : "draft",
                          }
                        : article,
                ),
            )
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "WordPress action failed.")
        } finally {
            setPending(null)
        }
    }

    async function markManual(article: Article) {
        if (!article.targetUrl) return
        const value = window.prompt(
            "Paste the final public URL. It must match the frozen program URL.",
            article.targetUrl,
        )
        if (!value) return
        setPending(article.id)
        setError(null)
        try {
            const response = await fetch(`/api/articles/${article.id}/publication`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicationUrl: value, confirmed: true }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "Unable to confirm publication.")
            setArticles((current) =>
                current.map((row) =>
                    row.id === article.id
                        ? {
                              ...row,
                              publicationStatus: "published",
                              publicationUrl: result.publicationUrl,
                          }
                        : row,
                ),
            )
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to confirm publication.")
        } finally {
            setPending(null)
        }
    }

    return (
        <div>
            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}
            <div className="space-y-3">
                {articles.map((article) => (
                    <article key={article.id} className="rounded-xl border border-stone-200 bg-white p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <h2 className="truncate font-medium text-stone-900">{article.keyword}</h2>
                                <div className="mt-1 flex flex-wrap gap-3 text-xs text-stone-500">
                                    <span>Generated: {article.generationStatus}</span>
                                    <span>Delivered: {article.deliveryStatus}</span>
                                    <span>Published: {article.publicationStatus}</span>
                                </div>
                                {article.targetUrl && (
                                    <div className="mt-1 truncate font-mono text-[11px] text-stone-400">
                                        {article.targetUrl}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Link
                                    href={`/articles/${article.id}`}
                                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
                                >
                                    <FilePenLine className="h-3.5 w-3.5" /> Review
                                </Link>
                                {wordpressConnectionId && (
                                    <>
                                        <button
                                            onClick={() => void wordpress(article.id, "draft")}
                                            disabled={pending === article.id}
                                            className="rounded-lg border px-3 py-2 text-xs font-medium"
                                        >
                                            WordPress draft
                                        </button>
                                        <button
                                            onClick={() => void wordpress(article.id, "publish")}
                                            disabled={pending === article.id}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-950 px-3 py-2 text-xs font-medium text-white"
                                        >
                                            <Send className="h-3.5 w-3.5" /> Publish
                                        </button>
                                    </>
                                )}
                                {article.plannedArticleId &&
                                    article.publicationStatus !== "published" && (
                                        <button
                                            onClick={() => void markManual(article)}
                                            disabled={pending === article.id}
                                            className="rounded-lg border px-3 py-2 text-xs font-medium"
                                        >
                                            Confirm manual URL
                                        </button>
                                    )}
                                {article.publicationUrl && (
                                    <a
                                        href={article.publicationUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-lg border p-2"
                                        aria-label="Open public article"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
            </div>
            {articles.length === 0 && (
                <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
                    No delivered articles yet. Generated cluster members remain withheld until
                    their complete cluster passes delivery validation.
                </div>
            )}
        </div>
    )
}
