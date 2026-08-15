"use client"

import { useState } from "react"
import { Pause, Play } from "lucide-react"
import { useRouter } from "next/navigation"

export function ProgramDeliveryControls({
    programId,
    scopeStatus,
    publicationUrlPattern,
}: {
    programId: string
    scopeStatus: string
    publicationUrlPattern: string | null
}) {
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const paused = scopeStatus === "paused"

    async function change() {
        setPending(true)
        setError(null)
        try {
            const response = await fetch("/api/content-plan/automation", {
                method: paused ? "POST" : "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ programId }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "Unable to update deliveries.")
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to update deliveries.")
        } finally {
            setPending(false)
        }
    }

    if (!["active", "paused"].includes(scopeStatus)) return null
    if (paused && !publicationUrlPattern) {
        return (
            <div className="max-w-xs text-right">
                <p className="text-sm font-medium text-amber-800">
                    Deliveries remain paused
                </p>
                <p className="mt-1 text-xs text-stone-500">
                    This earlier program needs a confirmed publication URL pattern
                    and frozen link graph before it can resume.
                </p>
            </div>
        )
    }

    return (
        <div className="text-right">
            <button
                type="button"
                onClick={() => void change()}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 disabled:opacity-50"
            >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {pending
                    ? "Saving…"
                    : paused
                      ? "Resume deliveries"
                      : "Pause deliveries"}
            </button>
            <p className="mt-1 text-xs text-stone-500">Billing continues while paused.</p>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    )
}
