"use client"

import { useState } from "react"
import { ExternalLink, Link2, Send } from "lucide-react"

export type AssistedRefreshAction = {
    id: string
    brandName: string
    cycleLabel: string
    title: string
    deliverableType: "full_page_replacement" | "section_patch"
    targetUrl: string
    selectionReason: string
    state: string
    requiredLinks: Array<{ title: string; url: string }>
}

export function RefreshActionWorkbench({ actions }: { actions: AssistedRefreshAction[] }) {
    const [remaining, setRemaining] = useState(actions)
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [pending, setPending] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function complete(action: AssistedRefreshAction) {
        const markdown = drafts[action.id]?.trim() || ""
        if (markdown.length < 300) {
            setError("The reviewed refresh deliverable must contain at least 300 characters.")
            return
        }
        setPending(action.id)
        setError(null)
        try {
            const response = await fetch(`/api/founder/refresh-actions/${action.id}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markdown }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "Could not complete refresh.")
            setRemaining((current) => current.filter((row) => row.id !== action.id))
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not complete refresh.")
        } finally {
            setPending(null)
        }
    }

    if (remaining.length === 0) {
        return (
            <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-600">
                No selected refresh actions are waiting for founder review.
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}
            {remaining.map((action) => (
                <article key={action.id} className="rounded-xl border border-stone-200 bg-white p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                                {action.brandName} · {action.cycleLabel} · {action.state}
                            </p>
                            <h2 className="mt-1 font-serif text-xl text-stone-900">{action.title}</h2>
                            <p className="mt-2 max-w-3xl text-sm text-stone-600">
                                {action.selectionReason}
                            </p>
                        </div>
                        <a
                            href={action.targetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700"
                        >
                            Open current page <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>

                    {action.requiredLinks.length > 0 && (
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                                <Link2 className="h-3.5 w-3.5" /> Required frozen links
                            </p>
                            <ul className="mt-2 space-y-1 text-xs text-amber-800">
                                {action.requiredLinks.map((link) => (
                                    <li key={link.url}>
                                        [{link.title}]({link.url})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <label className="mt-4 block text-xs font-semibold text-stone-700">
                        {action.deliverableType === "section_patch"
                            ? "Reviewed section patch (Markdown)"
                            : "Reviewed full-page replacement (Markdown)"}
                    </label>
                    <textarea
                        value={drafts[action.id] || ""}
                        onChange={(event) =>
                            setDrafts((current) => ({ ...current, [action.id]: event.target.value }))
                        }
                        rows={18}
                        placeholder={
                            action.deliverableType === "section_patch"
                                ? "Paste the exact replacement/addition sections with headings and placement notes. This does not publish or create a page."
                                : "Paste the complete revised page. This becomes the customer-visible replacement draft; it does not publish or replace the live page."
                        }
                        className="mt-2 w-full rounded-lg border border-stone-300 p-3 font-mono text-xs leading-relaxed outline-none focus:border-stone-500"
                    />
                    <div className="mt-3 flex items-center justify-between gap-4">
                        <p className="text-xs text-stone-500">
                            This attaches a draft only. It never creates a second public page.
                        </p>
                        <button
                            type="button"
                            onClick={() => void complete(action)}
                            disabled={pending === action.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                            <Send className="h-3.5 w-3.5" />
                            {pending === action.id ? "Saving…" : "Approve refresh draft"}
                        </button>
                    </div>
                </article>
            ))}
        </div>
    )
}
