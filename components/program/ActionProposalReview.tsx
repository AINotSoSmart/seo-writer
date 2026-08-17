"use client"

import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"

export interface ReviewProposal {
    id: string
    resolutionType: "create" | "refresh" | "report_only"
    deliverableType: string
    title: string
    targetUrl: string | null
    priority: number
    reason: string
    questions: string[]
}

export function ActionProposalReview({
    proposalSetId,
    allowance,
    proposals,
}: {
    proposalSetId: string
    allowance: number
    proposals: ReviewProposal[]
}) {
    const router = useRouter()
    const actionable = useMemo(
        () => proposals.filter((proposal) => proposal.resolutionType !== "report_only"),
        [proposals],
    )
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(actionable.slice(0, allowance).map((proposal) => proposal.id)),
    )
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function toggle(id: string) {
        setSelected((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else if (next.size < allowance) next.add(id)
            return next
        })
    }

    async function confirm() {
        setPending(true)
        setError(null)
        try {
            const response = await fetch("/api/visibility/action-proposals/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    proposalSetId,
                    proposalIds: [...selected],
                }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "Confirmation failed.")
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Confirmation failed.")
        } finally {
            setPending(false)
        }
    }

    return (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                        Your confirmation required
                    </p>
                    <h2 className="mt-1 font-serif text-2xl text-stone-900">
                        Confirm grouped work, not individual questions
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
                        We checked the sitemap first. Several measured questions may belong to one
                        page, so each card consumes one action. Select up to {allowance}; genuine
                        extras stay in backlog.
                    </p>
                </div>
                <button
                    type="button"
                    disabled={pending}
                    onClick={() => void confirm()}
                    className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {pending ? "Confirming…" : `Confirm ${selected.size} actions`}
                </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

            <div className="mt-5 space-y-3">
                {proposals.map((proposal) => {
                    const reportOnly = proposal.resolutionType === "report_only"
                    const checked = selected.has(proposal.id)
                    return (
                        <label
                            key={proposal.id}
                            className={`block rounded-lg border p-4 ${
                                checked ? "border-stone-500 bg-white" : "border-stone-200 bg-white/70"
                            }`}
                        >
                            <div className="flex gap-3">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={reportOnly || (!checked && selected.size >= allowance)}
                                    onChange={() => toggle(proposal.id)}
                                    className="mt-1 size-4"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded border border-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-600">
                                            {proposal.resolutionType.replace("_", " ")}
                                        </span>
                                        <span className="text-xs text-stone-500">
                                            {proposal.deliverableType.replaceAll("_", " ")}
                                        </span>
                                    </div>
                                    <h3 className="mt-1 font-medium text-stone-900">{proposal.title}</h3>
                                    <p className="mt-1 text-sm text-stone-600">{proposal.reason}</p>
                                    {proposal.targetUrl && (
                                        <a
                                            href={proposal.targetUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-2 inline-flex items-center gap-1 text-xs text-stone-700 underline"
                                        >
                                            {proposal.targetUrl} <ExternalLink className="size-3" />
                                        </a>
                                    )}
                                    <details className="mt-3 text-xs text-stone-500">
                                        <summary>{proposal.questions.length} measured question{proposal.questions.length === 1 ? "" : "s"}</summary>
                                        <ul className="mt-2 list-disc space-y-1 pl-5">
                                            {proposal.questions.map((question) => (
                                                <li key={question}>{question}</li>
                                            ))}
                                        </ul>
                                    </details>
                                </div>
                            </div>
                        </label>
                    )
                })}
            </div>
        </section>
    )
}

export function ActionProposalRetry({ runId }: { runId: string }) {
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function retry() {
        setPending(true)
        setError(null)
        try {
            const response = await fetch("/api/visibility/action-proposals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ runId }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "Planning failed.")
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Planning failed.")
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-medium text-red-900">Site-aware planning needs a retry</h2>
            <p className="mt-1 text-sm text-red-800">
                The 40 saved answers are intact. Retry the sitemap check without running or paying for the AI measurement again.
            </p>
            <button
                type="button"
                disabled={pending}
                onClick={() => void retry()}
                className="mt-3 rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
                {pending ? "Checking site…" : "Retry site-aware planning"}
            </button>
            {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
    )
}
