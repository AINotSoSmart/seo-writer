"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"

interface AITokenContextType {
    tokensRemaining: number | null
    tokensLimit: number
    isSubscribed: boolean | null
    cycleResetsAt: string | null
    updateTokens: (remaining: number, limit?: number, cycleResetsAt?: string) => void
    setSubscribed: (subscribed: boolean) => void
}

const AI_TOKENS_STORAGE_KEY = "ai_tokens_cache"

const AITokenContext = createContext<AITokenContextType>({
    tokensRemaining: null,
    tokensLimit: 200000,
    isSubscribed: null,
    cycleResetsAt: null,
    updateTokens: () => { },
    setSubscribed: () => { }
})

interface CachedTokenData {
    tokensRemaining: number
    tokensLimit: number
    isSubscribed: boolean
    cycleResetsAt: string | null
    cachedAt: number
}

export function AITokenProvider({ children }: { children: ReactNode }) {
    const [tokensRemaining, setTokensRemaining] = useState<number | null>(null)
    const [tokensLimit, setTokensLimit] = useState(200000)
    const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)
    const [cycleResetsAt, setCycleResetsAt] = useState<string | null>(null)

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const cached = localStorage.getItem(AI_TOKENS_STORAGE_KEY)
            if (cached) {
                const data: CachedTokenData = JSON.parse(cached)
                setTokensRemaining(data.tokensRemaining)
                setTokensLimit(data.tokensLimit)
                setIsSubscribed(data.isSubscribed)
                setCycleResetsAt(data.cycleResetsAt)
            }
        } catch (e) {
            // Ignore parse errors
        }
    }, [])

    // Update tokens and persist to localStorage
    const updateTokens = useCallback((remaining: number, limit?: number, resetDate?: string) => {
        setTokensRemaining(remaining)
        if (limit) setTokensLimit(limit)
        if (resetDate) setCycleResetsAt(resetDate)
        setIsSubscribed(true) // If we're updating tokens, user must be subscribed

        const data: CachedTokenData = {
            tokensRemaining: remaining,
            tokensLimit: limit ?? tokensLimit,
            isSubscribed: true,
            cycleResetsAt: resetDate ?? cycleResetsAt,
            cachedAt: Date.now()
        }
        localStorage.setItem(AI_TOKENS_STORAGE_KEY, JSON.stringify(data))
    }, [tokensLimit, cycleResetsAt])

    const setSubscribed = useCallback((subscribed: boolean) => {
        setIsSubscribed(subscribed)
        if (!subscribed) {
            // Clear cache if unsubscribed
            localStorage.removeItem(AI_TOKENS_STORAGE_KEY)
            setTokensRemaining(null)
        }
    }, [])

    return (
        <AITokenContext.Provider value={{
            tokensRemaining,
            tokensLimit,
            isSubscribed,
            cycleResetsAt,
            updateTokens,
            setSubscribed
        }}>
            {children}
        </AITokenContext.Provider>
    )
}

export function useAITokens() {
    return useContext(AITokenContext)
}
