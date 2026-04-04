"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    Map,
    Search,
    Users,
    BarChart3,
    CheckCircle2,
    Loader2,
    ShieldCheck,
    AlertTriangle,
    ArrowRight
} from "lucide-react"
import { BrandDetails } from "@/lib/schemas/brand"
import { TopicalAuditResult } from "@/lib/audit/types"
import { cn } from "@/lib/utils"

interface AuditConsoleProps {
    brandData: BrandDetails
    brandId: string
    brandUrl: string
    onComplete: (auditResult: TopicalAuditResult) => void
    onError: (message: string) => void
}

type AuditPhase = "niche_mapping" | "user_scanning" | "competitor_scanning" | "scoring"

const PHASE_ORDER: AuditPhase[] = ["niche_mapping", "user_scanning", "competitor_scanning", "scoring"]

interface PhaseState {
    status: 'pending' | 'active' | 'complete'
    data: any
}

const PHASE_LABELS: Record<AuditPhase, string> = {
    niche_mapping: "Mapping Niche Topics",
    user_scanning: "Analyzing Your Content",
    competitor_scanning: "Scanning Competitive Landscape",
    scoring: "Calculating Authority Score"
}

const PHASE_DESCRIPTIONS: Record<AuditPhase, string> = {
    niche_mapping: "Identifying core topics and semantic clusters...",
    user_scanning: "Crawling your site for existing coverage...",
    competitor_scanning: "Checking how competitors rank for these topics...",
    scoring: "Finalizing your Topical Authority Score..."
}

const PHASE_ICONS: Record<AuditPhase, React.ElementType> = {
    niche_mapping: Map,
    user_scanning: Search,
    competitor_scanning: Users,
    scoring: BarChart3
}

const POLL_INTERVAL = 3000 // 3 seconds

export function AuditConsole({
    brandData,
    brandId,
    brandUrl,
    onComplete,
    onError
}: AuditConsoleProps) {
    const [phases, setPhases] = useState<Record<AuditPhase, PhaseState>>({
        niche_mapping: { status: 'pending', data: {} },
        user_scanning: { status: 'pending', data: {} },
        competitor_scanning: { status: 'pending', data: {} },
        scoring: { status: 'pending', data: {} }
    })
    const [isRunning, setIsRunning] = useState(false)
    const hasStartedRef = useRef(false)
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Update phase indicators based on current phase from server
    const updatePhasesFromServer = useCallback((currentPhase: string | null) => {
        if (!currentPhase) return

        setPhases(prev => {
            const updated = { ...prev }
            const currentIdx = PHASE_ORDER.indexOf(currentPhase as AuditPhase)

            for (let i = 0; i < PHASE_ORDER.length; i++) {
                const phase = PHASE_ORDER[i]
                if (i < currentIdx) {
                    updated[phase] = { ...updated[phase], status: 'complete' }
                } else if (i === currentIdx) {
                    updated[phase] = { ...updated[phase], status: 'active' }
                }
                // phases after current stay 'pending'
            }
            return updated
        })
    }, [])

    // Poll the audit status
    const pollStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/topical-audit?brandId=${brandId}`)
            if (!res.ok) return

            const data = await res.json()

            if (data.status === "running") {
                updatePhasesFromServer(data.phase)

                // Update stats from partial data
                if (data.partial) {
                    setPhases(prev => {
                        const updated = { ...prev }
                        if (data.partial.topics_analyzed > 0 && prev.niche_mapping.status === 'complete') {
                            updated.niche_mapping = {
                                status: 'complete',
                                data: { topic_count: data.partial.topics_analyzed }
                            }
                        }
                        if (data.partial.user_pages_scanned > 0 && prev.user_scanning.status === 'complete') {
                            updated.user_scanning = {
                                status: 'complete',
                                data: { pages_analyzed: data.partial.user_pages_scanned }
                            }
                        }
                        if (data.partial.competitors_scanned > 0 && prev.competitor_scanning.status === 'complete') {
                            updated.competitor_scanning = {
                                status: 'complete',
                                data: { competitor_count: data.partial.competitors_scanned }
                            }
                        }
                        return updated
                    })
                }
            } else if (data.status === "completed" && data.audit) {
                // Mark all phases complete
                setPhases({
                    niche_mapping: { status: 'complete', data: { topic_count: data.partial?.topics_analyzed } },
                    user_scanning: { status: 'complete', data: { pages_analyzed: data.partial?.user_pages_scanned } },
                    competitor_scanning: { status: 'complete', data: { competitor_count: data.partial?.competitors_scanned } },
                    scoring: { status: 'complete', data: { authority_score: data.audit.authority_score } }
                })
                setIsRunning(false)
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }
                setTimeout(() => onComplete(data.audit), 1000)
            } else if (data.status === "failed") {
                setIsRunning(false)
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }
                onError(data.error || 'Audit failed')
            }
        } catch (error) {
            console.error("Poll error:", error)
        }
    }, [brandId, updatePhasesFromServer, onComplete, onError])

    // Start the audit
    const startAudit = useCallback(async () => {
        try {
            const response = await fetch('/api/topical-audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandId, brandData, brandUrl })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
                throw new Error(errorData.error || 'Audit failed to start')
            }

            const result = await response.json()

            if (result.status === "running") {
                setIsRunning(true)
                setPhases(prev => ({
                    ...prev,
                    niche_mapping: { status: 'active', data: {} }
                }))
                // Start polling
                pollIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL)
            }
        } catch (error: any) {
            console.error('Audit start error:', error)
            onError(error.message)
        }
    }, [brandId, brandData, brandUrl, onError, pollStatus])

    // Check for existing audit on mount, or start new one
    useEffect(() => {
        if (hasStartedRef.current) return
        hasStartedRef.current = true

        const checkExistingAudit = async () => {
            try {
                const res = await fetch(`/api/topical-audit?brandId=${brandId}`)
                if (!res.ok) {
                    startAudit()
                    return
                }
                const data = await res.json()

                if (data.status === "running") {
                    setIsRunning(true)
                    updatePhasesFromServer(data.phase)
                    pollIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL)
                } else if (data.status === "completed" && data.audit) {
                    setPhases({
                        niche_mapping: { status: 'complete', data: { topic_count: data.partial?.topics_analyzed } },
                        user_scanning: { status: 'complete', data: { pages_analyzed: data.partial?.user_pages_scanned } },
                        competitor_scanning: { status: 'complete', data: { competitor_count: data.partial?.competitors_scanned } },
                        scoring: { status: 'complete', data: { authority_score: data.audit.authority_score } }
                    })
                    setTimeout(() => onComplete(data.audit), 500)
                } else if (data.status === "failed") {
                    onError(data.error || 'Audit failed')
                } else {
                    startAudit()
                }
            } catch {
                startAudit()
            }
        }
        checkExistingAudit()
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps


    const currentPhaseKey = PHASE_ORDER.find(p => phases[p].status === 'active') ||
        (phases.scoring.status === 'complete' ? 'scoring' : null)

    return (
        <div className="w-full max-w-2xl mx-auto py-8">

            {/* Header: Pulsing Brand Analysis */}
            <div className="text-center mb-12">
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-stone-200 shadow-xs mb-6">
                    <ShieldCheck className="w-10 h-10 text-stone-900" strokeWidth={1.5} />
                    {isRunning && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                        </span>
                    )}
                </div>
                <h3 className="font-serif text-3xl text-stone-900 mb-2">
                    {isRunning ? "Running Topical Audit" : phases.scoring.status === 'complete' ? "Audit Complete" : "Initializing..."}
                </h3>
                <p className="text-stone-500 text-lg max-w-md mx-auto leading-relaxed">
                    {currentPhaseKey
                        ? PHASE_DESCRIPTIONS[currentPhaseKey]
                        : "Preparing to analyze your brand's authority..."}
                </p>
            </div>

            {/* Progress Steps */}
            <div className="space-y-4 mb-12 px-4 sm:px-0">
                {PHASE_ORDER.map((phase, index) => {
                    const status = phases[phase].status
                    const Icon = PHASE_ICONS[phase]
                    const isComplete = status === 'complete'
                    const isActive = status === 'active'
                    const isPending = status === 'pending'

                    return (
                        <motion.div
                            key={phase}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn(
                                "relative flex items-center p-4 rounded-xl border transition-all duration-500",
                                isActive ? "bg-white border-stone-300 scale-[1.02]"
                                    : isComplete ? "bg-stone-50/50 border-stone-200 opacity-60" // Dim completed steps slightly
                                        : "bg-transparent border-transparent opacity-40 grayscale"
                            )}
                        >
                            {/* Icon Box */}
                            <div className={cn(
                                "w-12 h-12 rounded-lg flex items-center justify-center mr-4 transition-colors duration-300 shrink-0",
                                isActive ? "bg-stone-900 text-white"
                                    : isComplete ? "bg-emerald-100 text-emerald-600"
                                        : "bg-stone-100 text-stone-400"
                            )}>
                                {isActive ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : isComplete ? (
                                    <CheckCircle2 className="w-6 h-6" />
                                ) : (
                                    <Icon className="w-5 h-5" />
                                )}
                            </div>

                            {/* Text Content */}
                            <div className="flex-1 min-w-0">
                                <h4 className={cn(
                                    "font-medium text-base mb-0.5",
                                    isActive ? "text-stone-900" : "text-stone-500"
                                )}>
                                    {PHASE_LABELS[phase]}
                                </h4>
                                {isActive && (
                                    <motion.div
                                        layoutId="active-indicator"
                                        className="h-1 w-12 bg-stone-200 rounded-full overflow-hidden mt-2"
                                    >
                                        <motion.div
                                            className="h-full bg-stone-900"
                                            initial={{ x: "-100%" }}
                                            animate={{ x: "0%" }} // Simple infinite load bar
                                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                        />
                                    </motion.div>
                                )}
                            </div>

                            {/* Data Stats (if complete) */}
                            {isComplete && phases[phase].data && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="px-3 py-1 bg-white border border-stone-200 rounded-full"
                                >
                                    <span className="text-xs font-bold text-stone-700">
                                        {phase === 'niche_mapping' && `${phases[phase].data.topic_count || 0} Topics`}
                                        {phase === 'user_scanning' && `${phases[phase].data.pages_analyzed || 0} Pages`}
                                        {phase === 'competitor_scanning' && `${phases[phase].data.competitor_count || 0} Competitors`}
                                        {phase === 'scoring' && `${phases[phase].data.authority_score || 0}/100 Score`}
                                    </span>
                                </motion.div>
                            )}
                        </motion.div>
                    )
                })}
            </div>

            {/* Grid Stats for Final Summary view */}
            {phases.niche_mapping.status === 'complete' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-3 gap-4 border-t border-stone-100 pt-8"
                >
                    <div className="text-center">
                        <div className="text-sm text-stone-400 uppercase tracking-wider mb-1 font-medium">Topics</div>
                        <div className="text-2xl font-serif text-stone-900">{phases.niche_mapping.data?.topic_count || '—'}</div>
                    </div>
                    <div className="text-center border-l border-stone-100">
                        <div className="text-sm text-stone-400 uppercase tracking-wider mb-1 font-medium">Competitors</div>
                        <div className="text-2xl font-serif text-stone-900">{phases.competitor_scanning.data?.competitor_count || '—'}</div>
                    </div>
                    <div className="text-center border-l border-stone-100">
                        <div className="text-sm text-stone-400 uppercase tracking-wider mb-1 font-medium">Pages</div>
                        <div className="text-2xl font-serif text-stone-900">{phases.user_scanning.data?.pages_analyzed || '—'}</div>
                    </div>
                </motion.div>
            )}

        </div>
    )
}
