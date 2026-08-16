"use client"

import { useState } from "react"

import { checkout } from "@/lib/dodopayments"

/**
 * Compatibility button for callers outside the pricing page. It still uses the
 * same server-validated purchase-intent contract; arbitrary product checkout is
 * deliberately unsupported.
 */
export default function SubscribeButton({
    auditId,
    tier,
    publicationUrlPattern,
    className,
    children,
}: {
    auditId: string
    tier: "close" | "accelerate" | "dominate"
    publicationUrlPattern: string
    className?: string
    children?: React.ReactNode
}) {
    const [loading, setLoading] = useState(false)

    async function handleCheckout() {
        setLoading(true)
        try {
            const result = await checkout({
                auditId,
                tier,
                publicationUrlPattern,
                returnUrl: `${window.location.origin}/subscribe?subscribed=1`,
            })
            window.location.assign(result.checkout_url)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={loading}
            className={className}
        >
            {loading ? "Opening checkout…" : children || "Start subscription"}
        </button>
    )
}
