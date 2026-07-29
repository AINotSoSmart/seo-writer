"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import {
    BarChart3,
    CheckCircle2,
    Database,
    GitMerge,
    Globe2,
    Layers3,
    Loader2,
    Search,
    ShieldCheck,
    Users,
} from "lucide-react"
import type { BrandDetails } from "@/lib/schemas/brand"
import { cn } from "@/lib/utils"

interface AuditConsoleProps {
    brandData: BrandDetails
    brandId: string
    brandUrl: string
    onComplete: () => void
    onError: (message: string) => void
}

type AuditPhase =
    | "competitor_discovery"
    | "harvesting"
    | "scanning_user_site"
    | "scanning_competitors"
    | "computing_gaps"
    | "clustering"
    | "persisting"

type PhaseState = {
    status: "pending" | "active" | "complete"
}

type AuditStatusResponse = {
    status: "not_found" | "running" | "completed" | "failed"
    phase?: AuditPhase | null
    error?: string | null
    audit?: {
        pool_size: number
        article_count: number
        cluster_count: number
        authority_score: number
    } | null
    partial?: {
        topics_analyzed: number
        user_pages_scanned: number
        competitors_scanned: number
        pool_size: number
        article_count: number
        cluster_count: number
    }
}

const PHASE_ORDER: AuditPhase[] = [
    "competitor_discovery",
    "harvesting",
    "scanning_user_site",
    "scanning_competitors",
    "computing_gaps",
    "clustering",
    "persisting",
]

const PHASE_COPY: Record<AuditPhase, {
    label: string
    description: string
    icon: React.ElementType
}> = {
    competitor_discovery: {
        label: "Finding the competitive set",
        description: "Resolving the sites that compete for the same search demand.",
        icon: Users,
    },
    harvesting: {
        label: "Harvesting observed searches",
        description: "Collecting real queries and preserving where each one was found.",
        icon: Search,
    },
    scanning_user_site: {
        label: "Scanning your published coverage",
        description: "Checking which harvested searches your current pages already cover.",
        icon: Globe2,
    },
    scanning_competitors: {
        label: "Scanning competitor coverage",
        description: "Verifying which gaps are already supported by competitor pages.",
        icon: BarChart3,
    },
    computing_gaps: {
        label: "Computing verified gaps",
        description: "Subtracting your coverage from the observed query pool.",
        icon: Database,
    },
    clustering: {
        label: "Collapsing gaps into article clusters",
        description: "Removing overlap and grouping articles that should ship together.",
        icon: GitMerge,
    },
    persisting: {
        label: "Saving your finite scope",
        description: "Writing the evidence, clusters, and planned articles to your account.",
        icon: Layers3,
    },
}

const emptyPhases = (): Record<AuditPhase, PhaseState> =>
    Object.fromEntries(PHASE_ORDER.map((phase) => [phase, { status: "pending" }])) as Record<AuditPhase, PhaseState>

const POLL_INTERVAL = 3000

export function AuditConsole({
    brandData,
    brandId,
    brandUrl,
    onComplete,
    onError,
}: AuditConsoleProps) {
    const [phases, setPhases] = useState<Record<AuditPhase, PhaseState>>(emptyPhases)
    const [summary, setSummary] = useState<AuditStatusResponse["audit"]>(null)
    const [isRunning, setIsRunning] = useState(false)
    const hasStartedRef = useRef(false)
    const completionSentRef = useRef(false)
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
        }
    }, [])

    const completeOnce = useCallback(() => {
        if (completionSentRef.current) return
        completionSentRef.current = true
        window.setTimeout(onComplete, 600)
    }, [onComplete])

    const updatePhasesFromServer = useCallback((currentPhase?: AuditPhase | null) => {
        if (!currentPhase) return
        const currentIndex = PHASE_ORDER.indexOf(currentPhase)
        if (currentIndex < 0) return

        setPhases(() => {
            const next = emptyPhases()
            PHASE_ORDER.forEach((phase, index) => {
                next[phase] = {
                    status: index < currentIndex ? "complete" : index === currentIndex ? "active" : "pending",
                }
            })
            return next
        })
    }, [])

    const handleStatus = useCallback((data: AuditStatusResponse) => {
        if (data.status === "running") {
            setIsRunning(true)
            updatePhasesFromServer(data.phase)
            return
        }

        if (data.status === "completed") {
            setPhases(Object.fromEntries(
                PHASE_ORDER.map((phase) => [phase, { status: "complete" }])
            ) as Record<AuditPhase, PhaseState>)
            setSummary(data.audit ?? null)
            setIsRunning(false)
            stopPolling()
            completeOnce()
            return
        }

        if (data.status === "failed") {
            setIsRunning(false)
            stopPolling()
            onError(data.error || "Audit failed")
        }
    }, [completeOnce, onError, stopPolling, updatePhasesFromServer])

    const pollStatus = useCallback(async () => {
        try {
            const response = await fetch(`/api/topical-audit?brandId=${brandId}`, { cache: "no-store" })
            if (!response.ok) return
            handleStatus(await response.json())
        } catch (error) {
            console.error("[Audit Console] Status check failed:", error)
        }
    }, [brandId, handleStatus])

    const beginPolling = useCallback(() => {
        stopPolling()
        pollIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL)
    }, [pollStatus, stopPolling])

    const startAudit = useCallback(async () => {
        try {
            const response = await fetch("/api/topical-audit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ brandId, brandData, brandUrl }),
            })

            if (!response.ok) {
                const body = await response.json().catch(() => ({ error: "Audit failed to start" }))
                throw new Error(body.error || "Audit failed to start")
            }

            setIsRunning(true)
            updatePhasesFromServer("competitor_discovery")
            beginPolling()
        } catch (error) {
            onError(error instanceof Error ? error.message : "Audit failed to start")
        }
    }, [beginPolling, brandData, brandId, brandUrl, onError, updatePhasesFromServer])

    useEffect(() => {
        if (hasStartedRef.current) return
        hasStartedRef.current = true

        const recoverOrStart = async () => {
            try {
                const response = await fetch(`/api/topical-audit?brandId=${brandId}`, { cache: "no-store" })
                if (!response.ok) {
                    await startAudit()
                    return
                }

                const data: AuditStatusResponse = await response.json()
                if (data.status === "not_found") {
                    await startAudit()
                } else {
                    handleStatus(data)
                    if (data.status === "running") beginPolling()
                }
            } catch {
                await startAudit()
            }
        }

        void recoverOrStart()
        return stopPolling
    }, [beginPolling, brandId, handleStatus, startAudit, stopPolling])

    const currentPhase = PHASE_ORDER.find((phase) => phases[phase].status === "active")
    const isComplete = phases.persisting.status === "complete"

    return (
        <div className="w-full max-w-2xl mx-auto py-8">
            <div className="text-center mb-10">
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-stone-200 shadow-xs mb-6">
                    <ShieldCheck className="w-10 h-10 text-stone-900" strokeWidth={1.5} />
                    {isRunning && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
                        </span>
                    )}
                </div>
                <h3 className="font-serif text-3xl text-stone-900 mb-2">
                    {isComplete ? "Scope verified" : isRunning ? "Mapping real search demand" : "Preparing your audit"}
                </h3>
                <p className="text-stone-500 text-base max-w-lg mx-auto leading-relaxed">
                    {currentPhase
                        ? PHASE_COPY[currentPhase].description
                        : isComplete
                            ? "Your finite content scope and its source evidence are ready."
                            : "Preparing the closed-pool audit."}
                </p>
            </div>

            <div className="space-y-3 px-2 sm:px-0">
                {PHASE_ORDER.map((phase, index) => {
                    const { status } = phases[phase]
                    const copy = PHASE_COPY[phase]
                    const Icon = copy.icon
                    return (
                        <motion.div
                            key={phase}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            className={cn(
                                "flex items-center gap-4 rounded-xl border p-4 transition-colors",
                                status === "active" && "border-stone-300 bg-white",
                                status === "complete" && "border-stone-200 bg-stone-50/60",
                                status === "pending" && "border-transparent opacity-45"
                            )}
                        >
                            <div className={cn(
                                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                                status === "active" && "bg-stone-900 text-white",
                                status === "complete" && "bg-emerald-100 text-emerald-700",
                                status === "pending" && "bg-stone-100 text-stone-400"
                            )}>
                                {status === "active"
                                    ? <Loader2 className="h-5 w-5 animate-spin" />
                                    : status === "complete"
                                        ? <CheckCircle2 className="h-5 w-5" />
                                        : <Icon className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-stone-900">{copy.label}</div>
                                {status === "active" && (
                                    <div className="mt-1 text-xs text-stone-500">{copy.description}</div>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {isComplete && summary && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 grid grid-cols-3 gap-3 border-t border-stone-100 pt-7 text-center"
                >
                    <div>
                        <div className="text-xs uppercase tracking-wide text-stone-400">Queries</div>
                        <div className="mt-1 font-serif text-2xl text-stone-900">{summary.pool_size}</div>
                    </div>
                    <div className="border-x border-stone-100">
                        <div className="text-xs uppercase tracking-wide text-stone-400">Articles</div>
                        <div className="mt-1 font-serif text-2xl text-stone-900">{summary.article_count}</div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-stone-400">Clusters</div>
                        <div className="mt-1 font-serif text-2xl text-stone-900">{summary.cluster_count}</div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}
