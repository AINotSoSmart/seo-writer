"use client"

import { useState } from "react"
import Link from "next/link"
import {
    CheckCircle2,
    CircleDashed,
    ExternalLink,
    FilePenLine,
    FileText,
    Send,
} from "lucide-react"

import {
    ProductPanel,
    primaryActionClass,
    secondaryActionClass,
} from "@/components/product/product-page"

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
    resolutionType: "create" | "refresh" | null
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
            article.resolutionType === "refresh"
                ? "Confirm that the delivered revision was applied to this existing URL."
                : "Paste the final public URL. It must match the frozen program URL.",
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
            <div className="space-y-4">
                {articles.map((article) => (
                    <ProductPanel key={article.id}>
                        <div className="grid min-w-0 gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <div className="flex min-w-0 items-start gap-3.5">
                                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-700">
                                    <FileText className="size-4" aria-hidden />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="min-w-0 break-words text-sm font-semibold text-[var(--viz-ink)] [overflow-wrap:anywhere]">
                                            {article.keyword}
                                        </h2>
                                        {article.resolutionType && (
                                            <span className="rounded-full bg-[var(--viz-track)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--viz-ink-secondary)]">
                                                {article.resolutionType}
                                            </span>
                                        )}
                                    </div>
                                {article.targetUrl && (
                                    <div className="mt-1 max-w-2xl truncate font-mono text-[10px] text-[var(--viz-ink-muted)]">
                                        {article.targetUrl}
                                    </div>
                                )}
                                    <div className="mt-3 grid max-w-xl gap-2 sm:grid-cols-3">
                                        <WorkflowState
                                            label="Generated"
                                            state={article.generationStatus}
                                            complete={article.finalHtml || article.generationStatus === "generated"}
                                        />
                                        <WorkflowState
                                            label="Delivered"
                                            state={article.deliveryStatus}
                                            complete={article.deliveryStatus === "delivered"}
                                        />
                                        <WorkflowState
                                            label="Published"
                                            state={article.publicationStatus}
                                            complete={article.publicationStatus === "published"}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 lg:max-w-[25rem] lg:justify-end">
                                <Link
                                    href={`/articles/${article.id}`}
                                    className={secondaryActionClass}
                                >
                                    <FilePenLine className="h-3.5 w-3.5" /> Review
                                </Link>
                                {wordpressConnectionId && article.resolutionType !== "refresh" && (
                                    <>
                                        <button
                                            onClick={() => void wordpress(article.id, "draft")}
                                            disabled={pending === article.id}
                                            className={secondaryActionClass}
                                        >
                                            WordPress draft
                                        </button>
                                        <button
                                            onClick={() => void wordpress(article.id, "publish")}
                                            disabled={pending === article.id}
                                            className={primaryActionClass}
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
                                            className={secondaryActionClass}
                                        >
                                            {article.resolutionType === "refresh"
                                                ? "Confirm update applied"
                                                : "Confirm manual URL"}
                                        </button>
                                    )}
                                {article.publicationUrl && (
                                    <a
                                        href={article.publicationUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex size-9 items-center justify-center rounded-[9px] border border-[var(--viz-hairline)] bg-white text-[var(--viz-ink-secondary)] hover:bg-[var(--viz-plane)]"
                                        aria-label="Open public article"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </ProductPanel>
                ))}
            </div>
            {articles.length === 0 && (
                <ProductPanel className="px-6 py-12 text-center">
                    <span className="mx-auto inline-flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <FileText className="size-5" aria-hidden />
                    </span>
                    <h2 className="mt-4 font-serif text-2xl text-[var(--viz-ink)]">No delivered drafts yet</h2>
                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--viz-ink-secondary)]">
                        Selected outputs remain withheld until their complete cycle passes delivery validation.
                    </p>
                </ProductPanel>
            )}
        </div>
    )
}

function WorkflowState({
    label,
    state,
    complete,
}: {
    label: string
    state: string
    complete: boolean
}) {
    return (
        <div className="min-w-0 rounded-lg bg-[var(--viz-plane)] px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--viz-ink-muted)]">
                {complete ? (
                    <CheckCircle2 className="size-3 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                    <CircleDashed className="size-3 shrink-0" aria-hidden />
                )}
                {label}
            </div>
            <p className="mt-1 truncate text-[11px] font-medium capitalize text-[var(--viz-ink-secondary)]">
                {state.replaceAll("_", " ")}
            </p>
        </div>
    )
}
