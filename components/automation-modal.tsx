"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Clock, SkipForward, CalendarClock, X, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AutomationModalProps {
    isOpen: boolean
    onClose: () => void
    missedCount: number
    onConfirm: (action: "gradual" | "skip" | "reschedule") => Promise<void>
}

export function AutomationModal({ isOpen, onClose, missedCount, onConfirm }: AutomationModalProps) {
    const [selectedAction, setSelectedAction] = useState<"gradual" | "skip" | "reschedule">("gradual")
    const [isLoading, setIsLoading] = useState(false)

    const handleConfirm = async () => {
        setIsLoading(true)
        try {
            await onConfirm(selectedAction)
            onClose()
        } catch (e) {
            console.error("Failed to activate automation:", e)
        } finally {
            setIsLoading(false)
        }
    }

    const options = [
        {
            value: "gradual" as const,
            icon: Clock,
            title: "Catch up gradually",
            description: `Process 1 missed article per hour. All ${missedCount} articles will be written over the next ${missedCount} hours.`,
            recommended: true,
        },
        {
            value: "skip" as const,
            icon: SkipForward,
            title: "Skip missed articles",
            description: `Mark ${missedCount} missed articles as skipped and continue with future scheduled articles only.`,
            recommended: false,
        },
        {
            value: "reschedule" as const,
            icon: CalendarClock,
            title: "Reschedule all",
            description: `Shift all pending articles to start from today. Your 30-day schedule restarts now.`,
            recommended: false,
        },
    ]

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
                    >
                        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                            {/* Header */}
                            <div className="p-6 pb-4 border-b border-stone-100 dark:border-stone-800">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-amber-500" />
                                            Resume Automation
                                        </h2>
                                        <p className="text-sm text-stone-500 mt-1">
                                            You have <span className="font-semibold text-stone-900 dark:text-white">{missedCount} missed articles</span> that were scheduled while automation was paused.
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4 text-stone-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="p-4 space-y-3">
                                {options.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setSelectedAction(option.value)}
                                        className={cn(
                                            "w-full p-4 rounded-xl border-2 text-left transition-all",
                                            selectedAction === option.value
                                                ? "border-stone-900 bg-stone-50 dark:border-white dark:bg-stone-800/50"
                                                : "border-stone-200 hover:border-stone-300 dark:border-stone-700 dark:hover:border-stone-600"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                selectedAction === option.value
                                                    ? "bg-stone-900 text-white dark:bg-white dark:text-black"
                                                    : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                                            )}>
                                                <option.icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-stone-900 dark:text-white text-sm">
                                                        {option.title}
                                                    </span>
                                                    {option.recommended && (
                                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full dark:bg-emerald-900/30 dark:text-emerald-400">
                                                            Recommended
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                                    {option.description}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="p-4 pt-2 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={onClose}
                                        className="flex-1"
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleConfirm}
                                        disabled={isLoading}
                                        className="flex-1 bg-stone-900 text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            "Start Automation"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
