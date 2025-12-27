'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function RealtimeSubscriptionSync({ userId }: { userId?: string }) {
    const router = useRouter()

    useEffect(() => {
        if (!userId) return
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
                    try {
                        router.refresh()
                    } catch { }
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
    }, [userId, router])

    // Also handle post-return auto-refresh for hosted flows (?subscribed=1 / ?pm_updated=1 / ?return=billing)
    useEffect(() => {
        const hasWindow = typeof window !== 'undefined'
        if (!hasWindow) return

        const params = new URLSearchParams(window.location.search)
        const shouldRefresh =
            params.has('subscribed') ||
            params.has('pm_updated') ||
            params.get('return') === 'billing'

        if (!shouldRefresh) return

        // Clean the URL to avoid repeated loops
        try {
            const url = new URL(window.location.href)
            url.searchParams.delete('subscribed')
            url.searchParams.delete('pm_updated')
            url.searchParams.delete('return')
            window.history.replaceState({}, '', url.toString())
        } catch { }

        // Kick a refresh loop for a short window while webhooks settle
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