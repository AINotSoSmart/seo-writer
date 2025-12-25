"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Hook to check user's credit balance and availability
 * Provides client-side credit gating for UI components
 */
export function useCredits() {
    const [balance, setBalance] = useState(0)
    const [hasCredits, setHasCredits] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchCredits = useCallback(async () => {
        try {
            const res = await fetch('/api/credits/check?requiredCredits=1')
            if (!res.ok) throw new Error('Failed to check credits')
            const data = await res.json()
            setBalance(data.balance ?? 0)
            setHasCredits(data.hasCredits ?? false)
            setError(null)
        } catch (e: any) {
            setError(e.message)
            setBalance(0)
            setHasCredits(false)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCredits()
        // Refresh credits every 30 seconds
        const interval = setInterval(fetchCredits, 30000)
        return () => clearInterval(interval)
    }, [fetchCredits])

    return {
        balance,
        hasCredits,
        loading,
        error,
        refresh: fetchCredits
    }
}
