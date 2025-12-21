'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { checkout } from '@/lib/dodopayments'

export default function SubscribeButton({ productId, isAuthenticated, className, children }: { productId: string; isAuthenticated: boolean; className?: string; children?: React.ReactNode }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleCheckout = useCallback(async () => {
        try {
            if (!isAuthenticated) {
                router.push('/login?redirect=/subscribe')
                return
            }

            setLoading(true)
            const origin = typeof window !== 'undefined' ? window.location.origin : ''
            const return_url = `${origin}/subscribe?subscribed=1`

            const { checkout_url } = await checkout(
                [
                    {
                        product_id: productId,
                        quantity: 1,
                    },
                ],
                // Keep friction low: we let server set metadata.user_id and allow Dodo to capture details
                undefined as any,
                undefined as any,
                return_url,
                { source: 'subscribe_page' }
            )

            if (checkout_url) {
                window.location.href = checkout_url
            } else {
                throw new Error('Checkout URL missing in response')
            }
        } catch (e: any) {
            console.error('Checkout error:', e)
            alert(e?.message ?? 'Failed to initiate checkout')
        } finally {
            setLoading(false)
        }
    }, [productId, isAuthenticated, router])



    return (
        <button
            onClick={handleCheckout}
            disabled={loading}
            className={`group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-center text-base font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${className}`}
        >
            {loading ? 'Redirecting…' : (children || 'Start Subscription')}
            {!loading && (
                <svg
                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            )}
        </button>
    )
}