'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * After returning from hosted checkout (e.g., ?subscribed=1) or short PM flow,
 * keep the /subscribe page fresh without manual reloads.
 * Strategy:
 * - If URL has subscribed=1 or pm_updated=1, trigger a short refresh loop.
 * - Use router.refresh() to re-render SSR data until webhook updates arrive.
 * - Clean the URL (remove query params) to avoid repeated loops on navigation.
 */
export default function SubscribeAutoRefresh({ userId }: { userId?: string }) {
    const router = useRouter()
    const started = useRef(false)

    useEffect(() => {
        if (started.current) return
        started.current = true

        const hasWindow = typeof window !== 'undefined'
        if (!hasWindow) return

        const params = new URLSearchParams(window.location.search)
        const shouldRefresh =
            params.has('subscribed') ||
            params.has('pm_updated') ||
            params.get('return') === 'billing'

        if (!shouldRefresh) return

        // Clean the URL so the loop doesn't repeat on next navigation
        try {
            const url = new URL(window.location.href)
            url.searchParams.delete('subscribed')
            url.searchParams.delete('pm_updated')
            url.searchParams.delete('return')
            window.history.replaceState({}, '', url.toString())
        } catch { }

        // Immediate refresh, then periodic refreshes for a short window (60s)
        try {
            router.refresh()
        } catch { }

        const startedAt = Date.now()
        const interval = setInterval(() => {
            if (Date.now() - startedAt > 60_000) {
                clearInterval(interval)
                return
            }
            try {
                router.refresh()
            } catch { }
        }, 2500)

        return () => {
            clearInterval(interval)
        }
    }, [router, userId])

    return null
}