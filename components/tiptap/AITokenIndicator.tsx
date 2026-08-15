"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip"

const CACHE_KEY = "ai_tokens_cache"

interface CachedData {
    remaining: number
    limit: number
    resetDate?: string
}

// Helper to update cache from anywhere
export function updateTokenCache(remaining: number, limit: number, resetDate?: string) {
    const data: CachedData = { remaining, limit, resetDate }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    // Dispatch custom event to notify indicator
    window.dispatchEvent(new CustomEvent("ai-tokens-updated", { detail: data }))
}

// Format tokens to compact form: 195560 → "195.6k"
function formatTokens(n: number): string {
    if (n >= 1000) {
        return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    }
    return n.toString()
}

export function AITokenIndicator({ className }: { className?: string }) {
    const [data, setData] = useState<CachedData | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        // Try loading from cache first
        let cached: CachedData | null = null
        try {
            const raw = localStorage.getItem(CACHE_KEY)
            if (raw) {
                cached = JSON.parse(raw)
                setData(cached)
            }
        } catch {
            // Ignore
        }

        // If no cache, fetch from API (only once)
        if (!cached) {
            setIsLoading(true)
            fetch("/api/editor/ai/usage")
                .then(res => res.ok ? res.json() : null)
                .then(result => {
                    if (result && result.is_subscribed) {
                        const newData: CachedData = {
                            remaining: result.tokens_remaining,
                            limit: result.tokens_limit,
                            resetDate: result.cycle_resets_at
                        }
                        setData(newData)
                        localStorage.setItem(CACHE_KEY, JSON.stringify(newData))
                    }
                })
                .catch(() => { })
                .finally(() => setIsLoading(false))
        }

        // Listen for updates
        const handleUpdate = (e: CustomEvent<CachedData>) => {
            setData(e.detail)
        }
        window.addEventListener("ai-tokens-updated", handleUpdate as EventListener)
        return () => window.removeEventListener("ai-tokens-updated", handleUpdate as EventListener)
    }, [])

    // Loading state
    if (isLoading) {
        return (
            <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
                <Loader2 className="h-3 w-3 animate-spin" />
            </div>
        )
    }

    // No data yet
    if (!data) return null

    const resetDate = data.resetDate ? new Date(data.resetDate).toLocaleDateString() : null

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 cursor-default ${className}`}>
                        <Sparkles className="h-3 w-3 text-brand-500" />
                        <span className="text-xs font-medium tabular-nums text-brand-600 dark:text-brand-400">
                            {formatTokens(data.remaining)}
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                    <p className="font-medium">{data.remaining.toLocaleString()} / {data.limit.toLocaleString()} AI tokens</p>
                    {resetDate && <p className="text-muted-foreground">Resets on {resetDate}</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
