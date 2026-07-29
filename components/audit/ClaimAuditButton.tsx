"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function ClaimAuditButton({ token }: { token: string }) {
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function claim() {
        setPending(true)
        setError(null)
        try {
            const response = await fetch("/api/audits/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "Unable to claim audit.")
            router.replace(result.next || "/subscribe")
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to claim audit.")
        } finally {
            setPending(false)
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={() => void claim()}
                disabled={pending}
                className="rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
                {pending
                    ? "Claiming audit…"
                    : "Claim this audit and choose your delivery speed"}
            </button>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
    )
}
