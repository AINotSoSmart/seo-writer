"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
    AlertTriangle,
    RefreshCw,
    ShieldCheck,
} from "lucide-react"
import type { BrandDetails } from "@/lib/schemas/brand"
import { cn } from "@/lib/utils"

interface AuditConsoleProps {
    brandData: BrandDetails
    brandId: string
    brandUrl: string
    onComplete: () => void
}

type AuditPhase =
    | "competitor_discovery"
    | "harvesting"
    | "validating_business_scope"
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
    /** Present when status is "failed" — mirrors the server's own cooldown rule */
    retryAfterSeconds?: number
    attemptsRemaining?: number
    retryBlocked?: boolean
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
    "validating_business_scope",
    "scanning_user_site",
    "scanning_competitors",
    "computing_gaps",
    "clustering",
    "persisting",
]

const PHASE_COPY: Record<AuditPhase, {
    label: string
    description: string
}> = {
    competitor_discovery: {
        label: "Finding the competitive set",
        description: "Resolving the sites that compete for the same search demand.",
    },
    harvesting: {
        label: "Harvesting observed searches",
        description: "Collecting real queries and preserving where each one was found.",
    },
    validating_business_scope: {
        label: "Enforcing confirmed business scope",
        description:
            "Assigning each observed search to a product area you approved and rejecting adjacent markets.",
    },
    scanning_user_site: {
        label: "Scanning your published coverage",
        description: "Checking which harvested searches your current pages already cover.",
    },
    scanning_competitors: {
        label: "Scanning competitor coverage",
        description: "Verifying which gaps are already supported by competitor pages.",
    },
    computing_gaps: {
        label: "Computing verified gaps",
        description: "Comparing observed searches with the coverage found on your pages.",
    },
    clustering: {
        label: "Collapsing gaps into article clusters",
        description: "Removing overlap and grouping articles that should ship together.",
    },
    persisting: {
        label: "Saving your evidence snapshot",
        description: "Writing the evidence, clusters, and planned articles to your account.",
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
}: AuditConsoleProps) {
    const [phases, setPhases] = useState<Record<AuditPhase, PhaseState>>(emptyPhases)
    const [summary, setSummary] = useState<AuditStatusResponse["audit"]>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [failure, setFailure] = useState<{
        message: string
        retryAfterSeconds: number
        attemptsRemaining: number
        retryBlocked: boolean
    } | null>(null)
    const [isRetrying, setIsRetrying] = useState(false)
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
            // Handled inline. The previous callback bounced the customer back
            // to the brand step — implying they had entered something wrong,
            // and losing all context of what actually failed.
            setFailure({
                message: data.error || "The audit could not be completed.",
                retryAfterSeconds: data.retryAfterSeconds ?? 0,
                attemptsRemaining: data.attemptsRemaining ?? 0,
                retryBlocked: Boolean(data.retryBlocked),
            })
        }
    }, [completeOnce, stopPolling, updatePhasesFromServer])

    // Tick the cooldown down locally so the retry button becomes available at
    // the moment the server would actually accept it.
    useEffect(() => {
        if (!failure || failure.retryAfterSeconds <= 0) return
        const timer = setInterval(() => {
            setFailure((current) =>
                current && current.retryAfterSeconds > 0
                    ? { ...current, retryAfterSeconds: current.retryAfterSeconds - 1 }
                    : current,
            )
        }, 1000)
        return () => clearInterval(timer)
    }, [failure])

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
        setIsRetrying(true)
        try {
            const response = await fetch("/api/topical-audit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ brandId, brandData, brandUrl }),
            })
            const body = await response.json().catch(() => null)

            if (!response.ok) {
                // 429 means the cooldown is still active. Re-render the failure
                // state from the server's own numbers rather than guessing.
                if (response.status === 429 && body) {
                    setFailure({
                        message: body.error || "Please wait before trying again.",
                        retryAfterSeconds: body.retryAfterSeconds ?? 0,
                        attemptsRemaining: body.attemptsRemaining ?? 0,
                        retryBlocked: Boolean(body.retryBlocked),
                    })
                    return
                }
                throw new Error(body?.error || "Audit failed to start")
            }

            setFailure(null)
            setIsRunning(true)
            updatePhasesFromServer("competitor_discovery")
            beginPolling()
        } catch (error) {
            setFailure({
                message: error instanceof Error ? error.message : "Audit failed to start.",
                retryAfterSeconds: 0,
                attemptsRemaining: 0,
                retryBlocked: false,
            })
        } finally {
            setIsRetrying(false)
        }
    }, [beginPolling, brandData, brandId, brandUrl, updatePhasesFromServer])

    useEffect(() => {
        if (hasStartedRef.current) return
        hasStartedRef.current = true

        const recoverOrStart = async () => {
            try {
                const response = await fetch(`/api/topical-audit?brandId=${brandId}`, { cache: "no-store" })
                if (!response.ok) {
                    // Cannot confirm there is no existing run, so do not start
                    // one. Surface it and let the user decide.
                    setFailure({
                        message: "We could not check your audit status.",
                        retryAfterSeconds: 0,
                        attemptsRemaining: 0,
                        retryBlocked: false,
                    })
                    return
                }

                const data: AuditStatusResponse = await response.json()
                // Only an audit that has genuinely never run may auto-start.
                // A failed run must surface its error and wait for an explicit
                // retry — auto-starting it meant every page refresh paid for a
                // whole new crawl.
                if (data.status === "not_found") {
                    await startAudit()
                } else {
                    handleStatus(data)
                    if (data.status === "running") beginPolling()
                }
            } catch {
                setFailure({
                    message: "We could not reach the audit service.",
                    retryAfterSeconds: 0,
                    attemptsRemaining: 0,
                    retryBlocked: false,
                })
            }
        }

        void recoverOrStart()
        return stopPolling
    }, [beginPolling, brandId, handleStatus, startAudit, stopPolling])

    const currentPhase = PHASE_ORDER.find((phase) => phases[phase].status === "active")
    const isComplete = phases.persisting.status === "complete"

    // --- Failure state -------------------------------------------------------
    // Owns the whole surface when a run fails, so the customer sees one clear
    // explanation and one clear next step. No auto-retry: every run costs real
    // crawl and search work, so restarting is always a deliberate click.
    if (failure) {
        const waiting = failure.retryAfterSeconds > 0
        const minutes = Math.floor(failure.retryAfterSeconds / 60)
        const seconds = failure.retryAfterSeconds % 60
        const canRetry = !waiting && !failure.retryBlocked

        return (
            <div className="w-full max-w-2xl mx-auto py-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-amber-200 shadow-xs mb-6">
                        <AlertTriangle className="w-10 h-10 text-amber-600" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-serif text-3xl text-stone-900 mb-2">
                        This audit didn&apos;t finish
                    </h3>
                    <p className="text-stone-500 text-base max-w-lg mx-auto leading-relaxed">
                        Nothing was charged and nothing was saved. Your website details are still
                        here &mdash; you don&apos;t need to enter anything again. Our team has been
                        alerted automatically.
                    </p>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white p-5 mb-6">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">
                        What happened
                    </p>
                    <p className="text-sm text-stone-700 leading-relaxed">{failure.message}</p>
                </div>

                {failure.retryBlocked ? (
                    <div className="rounded-xl border border-stone-300 bg-stone-50 p-5 text-center">
                        <p className="text-sm text-stone-700 leading-relaxed mb-4">
                            We&apos;ve stopped retrying automatically so this can&apos;t keep
                            consuming resources in the background. Send us the website and
                            we&apos;ll look at the run ourselves.
                        </p>
                        <a
                            href="mailto:support@flipaeo.com?subject=Audit%20failed%20repeatedly"
                            className="inline-flex items-center justify-center rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
                        >
                            Email support
                        </a>
                    </div>
                ) : (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="text-sm text-stone-600">
                                {waiting ? (
                                    <>
                                        <span className="font-medium text-stone-900">
                                            You can try again in {minutes}:{String(seconds).padStart(2, "0")}
                                        </span>
                                        <span className="block text-xs text-stone-500 mt-1">
                                            A short wait prevents an accidental loop of expensive runs.
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="font-medium text-stone-900">Ready to try again</span>
                                        <span className="block text-xs text-stone-500 mt-1">
                                            {failure.attemptsRemaining} attempt
                                            {failure.attemptsRemaining === 1 ? "" : "s"} left before we
                                            pause retries.
                                        </span>
                                    </>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => void startAudit()}
                                disabled={!canRetry || isRetrying}
                                className={cn(
                                    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-colors",
                                    canRetry && !isRetrying
                                        ? "bg-stone-900 text-white hover:bg-stone-800"
                                        : "bg-stone-200 text-stone-400 cursor-not-allowed"
                                )}
                            >
                                <RefreshCw
                                    size={15}
                                    className={cn(isRetrying && "animate-spin")}
                                    strokeWidth={2}
                                />
                                {isRetrying ? "Starting…" : "Run the audit again"}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        )
    }

    return (
        <div className="w-full max-w-3xl mx-auto py-6">
            <div className="mb-12 text-center">
                <div className="relative mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200/80 bg-white">
                    <ShieldCheck className="h-5 w-5 text-stone-800" strokeWidth={1.5} />
                    {isRunning && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                    )}
                </div>
                <h3 className="font-serif text-2xl tracking-tight text-stone-900 sm:text-[1.75rem]">
                    {isComplete
                        ? "Scope verified"
                        : isRunning
                            ? "Mapping real search demand"
                            : "Preparing your audit"}
                </h3>
                <div className="relative mx-auto mt-3 h-10 max-w-sm">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={currentPhase ?? (isComplete ? "done" : "prep")}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-x-0 text-sm leading-relaxed text-stone-500"
                        >
                            {currentPhase
                                ? PHASE_COPY[currentPhase].description
                                : isComplete
                                    ? "Your content evidence snapshot is ready."
                                    : "Preparing the closed-pool audit."}
                        </motion.p>
                    </AnimatePresence>
                </div>
            </div>

            <ol className="mx-auto max-w-xs space-y-0">
                {PHASE_ORDER.map((phase, index) => {
                    const { status } = phases[phase]
                    const copy = PHASE_COPY[phase]
                    const step = String(index + 1).padStart(2, "0")

                    return (
                        <motion.li
                            key={phase}
                            initial={false}
                            animate={{
                                opacity:
                                    status === "active" ? 1
                                        : status === "complete" ? 0.38
                                            : 0.22,
                            }}
                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                            className="flex items-baseline gap-3 py-[0.45rem]"
                        >
                            <span
                                className={cn(
                                    "w-5 shrink-0 font-mono text-[10px] tabular-nums tracking-wide",
                                    status === "active" ? "text-stone-400" : "text-stone-300",
                                )}
                            >
                                {status === "complete" ? "✓" : step}
                            </span>
                            <span
                                className={cn(
                                    "text-[13px] leading-snug tracking-[-0.01em] transition-[font-weight] duration-300",
                                    status === "active"
                                        ? "font-medium text-stone-900"
                                        : "font-normal text-stone-600",
                                )}
                            >
                                {status === "active" ? (
                                    <motion.span
                                        className="inline-block"
                                        animate={{ opacity: [1, 0.55, 1] }}
                                        transition={{
                                            duration: 2.4,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                        }}
                                    >
                                        {copy.label}
                                    </motion.span>
                                ) : (
                                    copy.label
                                )}
                            </span>
                        </motion.li>
                    )
                })}
            </ol>

            {isComplete && summary && (
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="mt-12 grid grid-cols-3 gap-2 border-t border-stone-100 pt-8 text-center"
                >
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                            Queries
                        </div>
                        <div className="mt-1.5 font-serif text-xl text-stone-900">
                            {summary.pool_size}
                        </div>
                    </div>
                    <div className="border-x border-stone-100">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                            Articles
                        </div>
                        <div className="mt-1.5 font-serif text-xl text-stone-900">
                            {summary.article_count}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                            Clusters
                        </div>
                        <div className="mt-1.5 font-serif text-xl text-stone-900">
                            {summary.cluster_count}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}
