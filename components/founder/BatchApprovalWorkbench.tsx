"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export interface ApprovalBatch {
    cycleId: string
    brandName: string
    period: string
    actions: Array<{
        id: string
        resolutionType: string
        title: string
        articleId: string | null
        targetUrl: string | null
    }>
}

export function BatchApprovalWorkbench({ batches }: { batches: ApprovalBatch[] }) {
    const router = useRouter()
    const [pending, setPending] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function approve(cycleId: string) {
        setPending(cycleId)
        setError(null)
        try {
            const response = await fetch("/api/founder/delivery-batches/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cycleId }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "Approval failed.")
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Approval failed.")
        } finally {
            setPending(null)
        }
    }

    if (batches.length === 0) {
        return <p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">No complete batches are waiting for approval.</p>
    }

    return (
        <div className="space-y-4">
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {batches.map((batch) => (
                <article key={batch.cycleId} className="rounded-xl border border-stone-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h2 className="font-medium text-stone-900">{batch.brandName}</h2>
                            <p className="mt-1 text-xs text-stone-500">{batch.period} · {batch.actions.length} complete actions</p>
                        </div>
                        <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() => void approve(batch.cycleId)}
                            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {pending === batch.cycleId ? "Releasing…" : "Approve complete batch"}
                        </button>
                    </div>
                    <ul className="mt-4 divide-y divide-stone-100 border-y border-stone-100">
                        {batch.actions.map((action) => (
                            <li key={action.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                                <div>
                                    <span className="mr-2 rounded border border-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-500">{action.resolutionType}</span>
                                    <span className="text-stone-800">{action.title}</span>
                                </div>
                                {action.articleId ? (
                                    <Link href={`/articles/${action.articleId}`} className="shrink-0 text-xs font-semibold underline">Review draft</Link>
                                ) : action.targetUrl ? (
                                    <a href={action.targetUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold underline">Review target</a>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </article>
            ))}
        </div>
    )
}
