"use client"

import { useState } from "react"

import { checkout } from "@/lib/dodopayments"

/**
 * Compatibility button for callers outside the pricing page. It still uses the
 * same server-validated purchase-intent contract; arbitrary product checkout is
 * deliberately unsupported.
 */
export default function SubscribeButton({
    defaultPublicationUrlPattern,
    disabledReason,
    className,
}: {
    defaultPublicationUrlPattern: string
    disabledReason?: string | null
    className?: string
}) {
    const [loading, setLoading] = useState(false)
    const [publicationUrlPattern, setPublicationUrlPattern] = useState(
        defaultPublicationUrlPattern,
    )
    const [error, setError] = useState<string | null>(null)

    async function handleCheckout() {
        setLoading(true)
        setError(null)
        try {
            const result = await checkout({
                publicationUrlPattern,
            })
            window.location.assign(result.checkout_url)
        } catch (checkoutError) {
            setError(
                checkoutError instanceof Error
                    ? checkoutError.message
                    : "Checkout could not be opened.",
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-3">
            <label className="block text-left text-sm font-medium text-stone-800">
                New article URL pattern
                <input
                    type="url"
                    value={publicationUrlPattern}
                    onChange={(event) => setPublicationUrlPattern(event.target.value)}
                    disabled={loading || Boolean(disabledReason)}
                    placeholder="https://example.com/blog/{slug}"
                    className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-700 disabled:bg-stone-100"
                />
            </label>
            <p className="text-left text-xs leading-relaxed text-stone-500">
                Used only to reserve stable URLs for new drafts. It must contain
                {" "}<code>{"{slug}"}</code> once and use your website domain.
            </p>
            <button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={loading || Boolean(disabledReason)}
                className={className}
            >
                {loading ? "Opening secure checkout…" : "Start founding subscription"}
            </button>
            {(disabledReason || error) && (
                <p className="text-sm text-amber-800" role="status">
                    {error || disabledReason}
                </p>
            )}
        </div>
    )
}
