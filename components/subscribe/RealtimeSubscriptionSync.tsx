'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

// Production-grade debounce to prevent refresh floods
function useDebounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastCallRef = useRef<number>(0)

    return useCallback((...args: Parameters<T>) => {
        const now = Date.now()

        // Rate limit: Max 1 call per 2 seconds
        if (now - lastCallRef.current < 2000) {
            return
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
            lastCallRef.current = Date.now()
            fn(...args)
        }, delay)
    }, [fn, delay]) as T
}

export default function RealtimeSubscriptionSync({ userId }: { userId?: string }) {
    const router = useRouter()
    const refreshCountRef = useRef(0)
    const maxRefreshes = 10 // Safety limit

    // Debounced refresh - prevents rapid-fire refreshes
    const refresh = useCallback(() => {
        if (refreshCountRef.current >= maxRefreshes) {
            console.warn('[SubscriptionSync] Max refresh limit reached, stopping')
            return
        }
        refreshCountRef.current++
        try {
            router.refresh()
        } catch { }
    }, [router])

    const debouncedRefresh = useDebounce(refresh, 1000) // 1 second debounce

    useEffect(() => {
        if (!userId) return

        // Reset counter on mount
        refreshCountRef.current = 0

        const supabase = createClient()
        const channel = supabase
            .channel(`dodo_subscriptions:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'dodo_subscriptions',
                    filter: `user_id=eq.${userId}`,
                } as any,
                () => {
                    // Use debounced refresh instead of direct call
                    debouncedRefresh()
                }
            )
            .subscribe()

        const timeout = setTimeout(() => {
            try {
                supabase.removeChannel(channel)
            } catch { }
        }, 120000) // auto-clean after 2 minutes

        return () => {
            clearTimeout(timeout)
            try {
                supabase.removeChannel(channel)
            } catch { }
        }
    }, [userId, debouncedRefresh])

    // Handle post-return auto-refresh for hosted flows (?subscribed=1 / ?pm_updated=1 / ?return=billing)
    useEffect(() => {
        const hasWindow = typeof window !== 'undefined'
        if (!hasWindow) return

        const params = new URLSearchParams(window.location.search)
        const shouldRefresh =
            params.has('subscribed') ||
            params.has('pm_updated') ||
            params.get('return') === 'billing'

        if (!shouldRefresh) return

        // Clean the URL immediately to prevent repeated loops
        try {
            const url = new URL(window.location.href)
            url.searchParams.delete('subscribed')
            url.searchParams.delete('pm_updated')
            url.searchParams.delete('return')
            window.history.replaceState({}, '', url.toString())
        } catch { }

        // Single refresh first
        try {
            router.refresh()
        } catch { }

        // Polling with rate limit: refresh every 3 seconds for max 30 seconds
        let pollCount = 0
        const maxPolls = 10

        const interval = setInterval(() => {
            pollCount++
            if (pollCount >= maxPolls) {
                clearInterval(interval)
                return
            }
            try {
                router.refresh()
            } catch { }
        }, 3000)

        return () => {
            clearInterval(interval)
        }
    }, [router, userId])

    return null
}
