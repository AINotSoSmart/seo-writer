"use client"

import React, { useRef, useEffect, useState } from "react"
import { AnimatePresence, motion, useWillChange } from "motion/react"
import { ArrowRight, Check, Loader2, ArrowLeft, Search } from "lucide-react"
import { cn } from "@/lib/utils"

// Refined spring animation configs - tighter, less bouncy
const springConfig = { stiffness: 350, damping: 25 }
const springConfigSoft = { stiffness: 250, damping: 20 }

// State-based size configurations
type IslandState = "idle" | "focus" | "typing" | "generating" | "selection"

const SIZE_CONFIGS: Record<IslandState, { width: number; height: number; borderRadius: number }> = {
    idle: { width: 260, height: 52, borderRadius: 26 },
    focus: { width: 480, height: 60, borderRadius: 30 },
    typing: { width: 480, height: 68, borderRadius: 34 },
    generating: { width: 300, height: 72, borderRadius: 36 },
    selection: { width: 600, height: 420, borderRadius: 24 },
}

interface BlogWriterIslandProps {
    keyword: string
    onKeywordChange: (value: string) => void
    onSubmit: () => void
    isGenerating: boolean
    titles: string[]
    selectedTitle: string
    onSelectTitle: (title: string) => void
    onGenerateArticle: () => void
    isLoading: boolean
    onBack: () => void
    disabled?: boolean
}

export function BlogWriterIsland({
    keyword,
    onKeywordChange,
    onSubmit,
    isGenerating,
    titles,
    selectedTitle,
    onSelectTitle,
    onGenerateArticle,
    isLoading,
    onBack,
    disabled = false,
}: BlogWriterIslandProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const willChange = useWillChange()
    const [isFocused, setIsFocused] = useState(false)

    // Determine current state
    const getState = (): IslandState => {
        if (titles.length > 0) return "selection"
        if (isGenerating) return "generating"
        if (keyword.length > 0 && isFocused) return "typing"
        if (isFocused) return "focus"
        return "idle"
    }

    const state = getState()
    const config = SIZE_CONFIGS[state]

    // Auto-focus input when transitioning to focus state
    useEffect(() => {
        if ((state === "focus" || state === "typing") && inputRef.current) {
            inputRef.current.focus()
        }
    }, [state])

    // Handle clicking idle state - set focused to trigger state change
    const handleIdleClick = () => {
        setIsFocused(true)
    }

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (keyword.trim() && !isGenerating && !disabled) {
            onSubmit()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
        if (e.key === "Escape") {
            inputRef.current?.blur()
            setIsFocused(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 font-sans">
            {/* Header - Clean & Minimal */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center mb-10"
            >
                <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">
                    Blog Writer
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-base">
                    {state === "selection"
                        ? "Select the best title"
                        : "What do you want to write about?"}
                </p>
            </motion.div>

            {/* Dynamic Island Container */}
            <motion.div
                layout
                className={cn(
                    "relative overflow-hidden z-20",
                    "bg-white dark:bg-zinc-900",
                    "border border-slate-200 dark:border-zinc-800",
                    "shadow-xl shadow-slate-200/50 dark:shadow-black/50",
                    state === "idle" && "cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                )}
                style={{ willChange }}
                animate={{
                    width: state === "selection" ? Math.min(config.width, typeof window !== "undefined" ? window.innerWidth - 32 : 640) : config.width,
                    height: state === "selection" ? "auto" : config.height,
                    borderRadius: config.borderRadius,
                }}
                transition={{
                    type: "spring",
                    ...springConfig,
                }}
                onClick={state === "idle" ? handleIdleClick : undefined}
            >
                {/* Inner content area */}
                <div className="relative z-10 h-full">
                    <AnimatePresence mode="wait">
                        {/* Idle State */}
                        {state === "idle" && (
                            <motion.div
                                key="idle"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center justify-center h-full gap-2.5"
                            >
                                <Search className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">Start writing...</span>
                            </motion.div>
                        )}

                        {/* Focus/Typing State */}
                        {(state === "focus" || state === "typing") && (
                            <motion.form
                                key="input"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                onSubmit={handleSubmit}
                                className="flex items-center h-full px-1.5 gap-2"
                            >
                                <div className="flex-1 relative pl-4">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={keyword}
                                        onChange={(e) => onKeywordChange(e.target.value)}
                                        onFocus={() => setIsFocused(true)}
                                        onBlur={() => setIsFocused(false)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Enter topic..."
                                        className={cn(
                                            "w-full bg-transparent",
                                            "text-slate-900 dark:text-white placeholder:text-slate-400",
                                            "text-lg font-medium",
                                            "focus:outline-none",
                                            "py-2"
                                        )}
                                        autoFocus
                                        disabled={disabled}
                                    />
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={!keyword.trim() || disabled}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={cn(
                                        "flex items-center justify-center w-10 h-10 rounded-full",
                                        "bg-slate-900 dark:bg-white",
                                        "text-white dark:text-black",
                                        "disabled:opacity-30 disabled:cursor-not-allowed",
                                        "transition-all duration-200"
                                    )}
                                >
                                    <ArrowRight className="w-5 h-5" />
                                </motion.button>
                            </motion.form>
                        )}

                        {/* Generating State */}
                        {state === "generating" && (
                            <motion.div
                                key="generating"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center justify-center h-full gap-3"
                            >
                                <Loader2 className="w-5 h-5 text-slate-900 dark:text-white animate-spin" />
                                <span className="text-slate-900 dark:text-white font-medium">Thinking...</span>
                            </motion.div>
                        )}

                        {/* Selection State */}
                        {state === "selection" && (
                            <motion.div
                                key="selection"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="p-6 flex flex-col h-full"
                            >
                                {/* Title options */}
                                <div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                    {titles.map((title, index) => (
                                        <motion.button
                                            key={index}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => onSelectTitle(title)}
                                            className={cn(
                                                "w-full text-left p-4 rounded-xl transition-all duration-200",
                                                "border",
                                                selectedTitle === title
                                                    ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-black shadow-md"
                                                    : "bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-zinc-600"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={cn(
                                                    "text-sm font-mono mt-0.5 opacity-60",
                                                    selectedTitle === title ? "text-white dark:text-black" : "text-slate-400"
                                                )}>
                                                    {String(index + 1).padStart(2, '0')}
                                                </span>
                                                <span className="font-medium leading-relaxed">{title}</span>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                    <button
                                        onClick={onBack}
                                        className="px-4 py-2.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm font-medium transition-colors"
                                    >
                                        Back
                                    </button>

                                    <button
                                        onClick={onGenerateArticle}
                                        disabled={!selectedTitle || isLoading}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl",
                                            "bg-slate-900 dark:bg-white",
                                            "text-white dark:text-black font-semibold",
                                            "disabled:opacity-50 disabled:cursor-not-allowed",
                                            "transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                                        )}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Writing...
                                            </>
                                        ) : (
                                            "Generate Article"
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Minimal Keyboard hint */}
            {(state === "focus" || state === "typing") && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 flex items-center gap-2 text-xs text-slate-400"
                >
                    <span>Press</span>
                    <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 font-mono text-[10px]">Enter</kbd>
                    <span>to continue</span>
                </motion.div>
            )}
        </div>
    )
}
