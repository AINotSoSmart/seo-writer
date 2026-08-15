"use client"

/**
 * The waiting screen for an AI-visibility probe, and the last step of onboarding.
 *
 * It replaces `AuditConsole` in that slot. The screens before it ask the
 * customer to review the exact questions we are about to put to ChatGPT and
 * Google AI Mode; sending them into the Google harvest instead meant confirming
 * one thing and measuring another.
 *
 * Two rules inherited from the audit console, for the same reasons:
 *
 * 1. **A run only auto-starts when none exists.** Every probe spends real Cloro
 *    credits, so a failure surfaces and waits for a deliberate click. A page
 *    refresh must never buy a second measurement.
 * 2. **The failure state owns the whole surface.** It explains what happened and
 *    offers one next step, rather than bouncing the customer back to re-enter a
 *    brand that was never the problem.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react"

import type { BuyerPrompt } from "@/lib/visibility/prompt-builder"
import { cn } from "@/lib/utils"

interface ProbeConsoleProps {
    brandId: string
    /** The questions the customer confirmed on the prompts screen. */
    prompts: BuyerPrompt[]
    /** A run already in flight — restored from storage after a refresh. */
    existingRunId?: string | null
    /** Called as soon as a run id exists, so the caller can persist it. */
    onRunStarted: (runId: string) => void
    onComplete: (runId: string) => void
}

/**
 * Phases as `lib/visibility/run-probe.ts` reports them. `estimated_cost` is
 * deliberately absent: it is an instant log line between two real phases, and
 * showing it would flash a step that is never waited on.
 */
type ProbePhase =
    | "queued"
    | "building_prompts"
    | "probing_engines"
    | "awaiting_answers"
    | "reading_answers"
    | "clustering"

const PHASE_ORDER: ProbePhase[] = [
    "queued",
    "building_prompts",
    "probing_engines",
    "awaiting_answers",
    "reading_answers",
    "clustering",
]

const PHASE_COPY: Record<ProbePhase, { label: string; description: string }> = {
    queued: {
        label: "Queueing your questions",
        description: "Handing the confirmed questions to the answer engines.",
    },
    building_prompts: {
        label: "Preparing the questions",
        description: "Binding every question to a product area you confirmed.",
    },
    probing_engines: {
        label: "Asking ChatGPT and Google AI Mode",
        description:
            "Each question goes to the real consumer app, not a developer API — the surface your buyers actually use.",
    },
    awaiting_answers: {
        label: "Waiting for the answers",
        description:
            "Answer engines take their time. Every answer is stored word for word so any claim can be checked.",
    },
    reading_answers: {
        label: "Reading the answers",
        description: "Counting who gets named, who gets named first, and who gets cited.",
    },
    clustering: {
        label: "Turning absences into a plan",
        description: "Grouping the questions you lose into the articles that would win them.",
    },
}

type PhaseState = { status: "pending" | "active" | "complete" }

const emptyPhases = (): Record<ProbePhase, PhaseState> =>
    Object.fromEntries(
        PHASE_ORDER.map((phase) => [phase, { status: "pending" }]),
    ) as Record<ProbePhase, PhaseState>

type ProbeStatusResponse = {
    id: string
    status: "running" | "completed" | "failed"
    phase?: string | null
    phase_detail?: string | null
    failure_reason?: string | null
    prompt_count?: number | null
    answer_count?: number | null
    gap_prompt_count?: number | null
    stale?: boolean
}

/** Cloro answers are slow by nature; 4s is plenty and keeps the run cheap. */
const POLL_INTERVAL = 4000

export function ProbeConsole({
    brandId,
    prompts,
    existingRunId,
    onRunStarted,
    onComplete,
}: ProbeConsoleProps) {
    const [phases, setPhases] = useState<Record<ProbePhase, PhaseState>>(emptyPhases)
    const [detail, setDetail] = useState<string | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [failure, setFailure] = useState<{
        message: string
        /** Set when the engines are not configured — retrying cannot help. */
        unconfigured: boolean
        retryAfterSeconds: number
        retryBlocked: boolean
    } | null>(null)

    const runIdRef = useRef<string | null>(existingRunId ?? null)
    const hasStartedRef = useRef(false)
    const completionSentRef = useRef(false)
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
        }
    }, [])

    const completeOnce = useCallback(
        (runId: string) => {
            if (completionSentRef.current) return
            completionSentRef.current = true
            window.setTimeout(() => onComplete(runId), 700)
        },
        [onComplete],
    )

    const advanceTo = useCallback((currentPhase?: string | null) => {
        if (!currentPhase) return
        const currentIndex = PHASE_ORDER.indexOf(currentPhase as ProbePhase)
        // An unrecognised phase leaves the list alone rather than resetting it.
        // `estimated_cost` lands here, and a rewind would read as a stall.
        if (currentIndex < 0) return
        setPhases(() => {
            const next = emptyPhases()
            PHASE_ORDER.forEach((phase, index) => {
                next[phase] = {
                    status:
                        index < currentIndex
                            ? "complete"
                            : index === currentIndex
                              ? "active"
                              : "pending",
                }
            })
            return next
        })
    }, [])

    const handleStatus = useCallback(
        (data: ProbeStatusResponse) => {
            setDetail(data.phase_detail ?? null)

            if (data.status === "running") {
                if (data.stale) {
                    setIsRunning(false)
                    stopPolling()
                    setFailure({
                        message:
                            "This probe was queued but never started. Nothing was charged. You can start it again.",
                        unconfigured: false,
                        retryAfterSeconds: 0,
                        retryBlocked: false,
                    })
                    return
                }
                setIsRunning(true)
                advanceTo(data.phase)
                return
            }

            if (data.status === "completed") {
                setPhases(
                    Object.fromEntries(
                        PHASE_ORDER.map((phase) => [phase, { status: "complete" }]),
                    ) as Record<ProbePhase, PhaseState>,
                )
                setIsRunning(false)
                stopPolling()
                completeOnce(data.id)
                return
            }

            setIsRunning(false)
            stopPolling()
            setFailure({
                message:
                    data.failure_reason || "The probe could not be completed.",
                unconfigured: false,
                retryAfterSeconds: 0,
                retryBlocked: false,
            })
        },
        [advanceTo, completeOnce, stopPolling],
    )

    const pollStatus = useCallback(async () => {
        const runId = runIdRef.current
        if (!runId) return
        try {
            const response = await fetch(`/api/visibility/probe?runId=${runId}`, {
                cache: "no-store",
            })
            if (!response.ok) return
            handleStatus(await response.json())
        } catch (error) {
            console.error("[Probe Console] Status check failed:", error)
        }
    }, [handleStatus])

    const beginPolling = useCallback(() => {
        stopPolling()
        pollIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL)
    }, [pollStatus, stopPolling])

    const startProbe = useCallback(async () => {
        setIsStarting(true)
        try {
            const response = await fetch("/api/visibility/probe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brandId,
                    // The exact questions the customer reviewed. Omitting them
                    // would silently regenerate a different set, which is the
                    // bug this whole screen exists to close.
                    prompts: prompts.map(
                        ({ text, textNorm, scopeFamilyId, intent, articleType, sourceSeed }) => ({
                            text,
                            textNorm,
                            scopeFamilyId,
                            intent,
                            articleType,
                            sourceSeed,
                        }),
                    ),
                    maxPrompts: prompts.length || undefined,
                }),
            })
            const body = await response.json().catch(() => null)

            if (!response.ok) {
                setFailure({
                    message:
                        body?.error || "The visibility probe could not be started.",
                    unconfigured: body?.reason === "no_engines",
                    retryAfterSeconds: body?.retryAfterSeconds ?? 0,
                    retryBlocked: Boolean(body?.retryBlocked),
                })
                return
            }

            runIdRef.current = body.runId
            onRunStarted(body.runId)
            setFailure(null)
            setIsRunning(true)
            advanceTo("queued")
            beginPolling()
        } catch (error) {
            setFailure({
                message:
                    error instanceof Error
                        ? error.message
                        : "We could not reach the visibility service.",
                unconfigured: false,
                retryAfterSeconds: 0,
                retryBlocked: false,
            })
        } finally {
            setIsStarting(false)
        }
    }, [advanceTo, beginPolling, brandId, onRunStarted, prompts])

    useEffect(() => {
        if (hasStartedRef.current) return
        hasStartedRef.current = true

        const recoverOrStart = async () => {
            // A run restored from storage is adopted, never restarted. Starting
            // a second one would ask every question twice and bill for both.
            if (runIdRef.current) {
                await pollStatus()
                beginPolling()
                return
            }
            await startProbe()
        }

        void recoverOrStart()
        return stopPolling
    }, [beginPolling, pollStatus, startProbe, stopPolling])

    // Tick the cooldown down locally so the retry becomes available at the
    // moment the server would actually accept it.
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

    const currentPhase = PHASE_ORDER.find((phase) => phases[phase].status === "active")
    const isComplete = phases.clustering.status === "complete"

    if (failure) {
        const waiting = failure.retryAfterSeconds > 0
        const minutes = Math.floor(failure.retryAfterSeconds / 60)
        const seconds = failure.retryAfterSeconds % 60
        const canRetry = !waiting && !failure.retryBlocked && !failure.unconfigured

        return (
            <div className="mx-auto w-full max-w-2xl py-8">
                <div className="mb-8 text-center">
                    <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-200 bg-white shadow-xs">
                        <AlertTriangle className="h-10 w-10 text-amber-600" strokeWidth={1.5} />
                    </div>
                    <h3 className="mb-2 font-serif text-3xl text-stone-900">
                        {failure.unconfigured
                            ? "Answer engines aren't connected yet"
                            : "This probe didn't finish"}
                    </h3>
                    <p className="mx-auto max-w-lg text-base leading-relaxed text-stone-500">
                        Nothing was charged and your confirmed questions are still saved.
                        You don&apos;t need to enter anything again.
                    </p>
                </div>

                <div className="mb-6 rounded-xl border border-stone-200 bg-white p-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">
                        What happened
                    </p>
                    <p className="text-sm leading-relaxed text-stone-700">{failure.message}</p>
                </div>

                {failure.unconfigured ? (
                    // Retrying cannot fix a missing key, so this offers no button
                    // that would fail identically one second later.
                    <div className="rounded-xl border border-stone-300 bg-stone-50 p-5 text-center text-sm leading-relaxed text-stone-700">
                        The probe measures the real ChatGPT and Google AI Mode apps through
                        Cloro. Until that connection is configured, no answer can be
                        collected — and reporting you as absent without asking would be a
                        fabricated result, which this product will not do.
                    </div>
                ) : (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-stone-600">
                                {waiting ? (
                                    <>
                                        <span className="font-medium text-stone-900">
                                            You can try again in {minutes}:
                                            {String(seconds).padStart(2, "0")}
                                        </span>
                                        <span className="mt-1 block text-xs text-stone-500">
                                            A short wait prevents an accidental loop of paid runs.
                                        </span>
                                    </>
                                ) : failure.retryBlocked ? (
                                    <span className="font-medium text-stone-900">
                                        We&apos;ve paused retries for this website.
                                    </span>
                                ) : (
                                    <span className="font-medium text-stone-900">
                                        Ready to try again
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    runIdRef.current = null
                                    completionSentRef.current = false
                                    setPhases(emptyPhases())
                                    void startProbe()
                                }}
                                disabled={!canRetry || isStarting}
                                className={cn(
                                    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-colors",
                                    canRetry && !isStarting
                                        ? "bg-stone-900 text-white hover:bg-stone-800"
                                        : "cursor-not-allowed bg-stone-200 text-stone-400",
                                )}
                            >
                                <RefreshCw
                                    size={15}
                                    className={cn(isStarting && "animate-spin")}
                                    strokeWidth={2}
                                />
                                {isStarting ? "Starting…" : "Ask the questions again"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="mx-auto w-full max-w-3xl py-6">
            <div className="mb-12 text-center">
                <div className="relative mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200/80 bg-white">
                    <Sparkles className="h-5 w-5 text-stone-800" strokeWidth={1.5} />
                    {isRunning && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                    )}
                </div>
                <h3 className="font-serif text-2xl tracking-tight text-stone-900 sm:text-[1.75rem]">
                    {isComplete
                        ? "Your answers are in"
                        : isRunning
                          ? "Asking the answer engines"
                          : "Preparing your questions"}
                </h3>
                <div className="relative mx-auto mt-3 h-12 max-w-md">
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
                                  ? "Every answer is saved word for word behind the report."
                                  : "Handing your confirmed questions to the answer engines."}
                        </motion.p>
                    </AnimatePresence>
                </div>
                {detail && (
                    <p className="mt-1 font-mono text-[11px] tabular-nums text-stone-400">
                        {detail}
                    </p>
                )}
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
                                    status === "active"
                                        ? 1
                                        : status === "complete"
                                          ? 0.38
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

            <p className="mx-auto mt-10 max-w-sm border-t border-stone-100 pt-6 text-center text-xs leading-relaxed text-stone-400">
                {prompts.length} confirmed question{prompts.length === 1 ? "" : "s"} are being
                asked of the real consumer apps. This usually takes a few minutes — you can
                leave this page open.
            </p>
        </div>
    )
}
