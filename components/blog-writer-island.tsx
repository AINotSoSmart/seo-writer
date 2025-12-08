"use client"

import React, { useRef, useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronUp, Check, Loader2, Sparkles, Search, ArrowRight, ArrowLeft, ChevronDown, FileText, Scale, BookOpen } from "lucide-react"
import { ArticleType, ARTICLE_TYPES } from "@/lib/prompts/article-types"

interface BlogWriterIslandProps {
    keyword: string
    onKeywordChange: (value: string) => void
    articleType: ArticleType
    onArticleTypeChange: (type: ArticleType) => void
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

// Icon map for article types
const ARTICLE_TYPE_ICONS: Record<ArticleType, React.ReactNode> = {
    informational: <BookOpen className="w-4 h-4" />,
    commercial: <Scale className="w-4 h-4" />,
    howto: <FileText className="w-4 h-4" />
}

export function BlogWriterIsland({
    keyword,
    onKeywordChange,
    articleType,
    onArticleTypeChange,
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
    const [isFocused, setIsFocused] = useState(false)
    const [isDark, setIsDark] = useState(false) // Simple dark mode detection for now

    // Check system preference
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
        }
    }, [])

    const hasTitles = titles.length > 0

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
    }

    return (
        <div className="flex w-full items-center justify-center font-sans">
            {/* Outer Muted Wrapper (The Border/Padding Layer) */}
            <motion.div
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`
                    relative p-1 overflow-hidden w-full transition-all duration-300
                    shadow-[0_0_0_1px_rgba(0,0,0,0.08),0px_1px_2px_rgba(0,0,0,0.04)]
                    ${hasTitles ? 'max-w-2xl rounded-[20px]' : 'max-w-[420px] rounded-[16px]'}
                    ${isDark ? 'bg-stone-800' : 'bg-stone-100'}
                `}
            >

                {/* Top Notch Decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-6 z-20 flex justify-center pointer-events-none">
                    <div className={`w-8 h-4 rounded-b-lg border-b border-x ${isDark ? 'bg-stone-800 border-stone-700' : 'bg-stone-100 border-stone-200/50'} flex items-center justify-center`}>
                        <ChevronUp className={`w-3 h-3 ${isDark ? 'text-stone-500' : 'text-stone-400'}`} />
                    </div>
                </div>

                {/* Inner White Card */}
                <div className={`
                   relative border overflow-hidden transition-all
                   ${hasTitles ? 'rounded-[16px]' : 'rounded-[12px]'}
                   ${isDark ? 'bg-stone-900 border-stone-700' : 'bg-white border-stone-200'}
                `}>
                    <AnimatePresence mode="wait">
                        {/* STATE 1: GENERATING LOADING */}
                        {isGenerating ? (
                            <motion.div
                                key="generating"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-8 text-center py-12 flex flex-col items-center justify-center min-h-[180px]"
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-stone-800' : 'bg-stone-50'}`}>
                                    <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-stone-400' : 'text-stone-600'}`} />
                                </div>
                                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-stone-900'}`}>Crafting titles...</h3>
                                <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Analyzing SEO trends for "{keyword}"</p>
                            </motion.div>
                        ) : hasTitles ? (
                            /* STATE 2: TITLE SELECTION */
                            <motion.div
                                key="selection"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-6"
                            >
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h3 className={`font-medium ${isDark ? 'text-white' : 'text-stone-900'}`}>Select a title</h3>
                                    <button onClick={onBack} className={`text-xs hover:underline cursor-pointer ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>Start over</button>
                                </div>

                                <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto pr-1">
                                    {titles.map((title, i) => (
                                        <button
                                            key={i}
                                            onClick={() => onSelectTitle(title)}
                                            className={`
                                                w-full text-left p-4 rounded-lg border transition-all duration-200
                                                group flex items-start gap-3 relative cursor-pointer
                                                ${selectedTitle === title
                                                    ? (isDark ? 'bg-stone-800 border-stone-600 ring-1 ring-stone-600' : 'bg-stone-50 border-stone-300 ring-1 ring-stone-300')
                                                    : (isDark ? 'border-stone-800 hover:bg-stone-800/50' : 'border-stone-100 hover:bg-stone-50 hover:border-stone-200')
                                                }
                                            `}
                                        >
                                            <div className={`
                                                w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors
                                                ${selectedTitle === title
                                                    ? (isDark ? 'bg-stone-700 border-stone-600 text-white' : 'bg-stone-900 border-stone-900 text-white')
                                                    : (isDark ? 'border-stone-700 text-transparent' : 'border-stone-200 text-transparent')
                                                }
                                            `}>
                                                <Check className="w-3 h-3" />
                                            </div>
                                            <span className={`text-sm leading-relaxed ${isDark ? 'text-stone-200' : 'text-stone-700'}`}>{title}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-3 pt-2 border-t border-stone-100 dark:border-stone-800">
                                    <button
                                        onClick={onGenerateArticle}
                                        disabled={!selectedTitle || isLoading}
                                        className={`
                                        flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-md px-4 text-sm font-semibold text-white transition-all
                                        disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer
                                        bg-gradient-to-b from-stone-800 to-stone-950
                                        hover:from-stone-700 hover:to-stone-900
                                        dark:from-stone-200 dark:to-stone-400 dark:text-stone-900 dark:hover:from-white dark:hover:to-stone-200
                                        shadow-[0_0_1px_1px_rgba(255,255,255,0.08)_inset,0_1px_1.5px_0_rgba(0,0,0,0.32)]
                                      `}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="size-4 animate-spin" />
                                                <span>Writing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="size-4" />
                                                <span>Generate Article</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            /* STATE 3: INPUT FORM */
                            <form onSubmit={handleSubmit} className="p-4">
                                {/* Article Type Selector */}
                                <div className="mb-4">
                                    <label
                                        className={`block text-xs font-medium mb-2 pl-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}
                                    >
                                        Article Type
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {ARTICLE_TYPES.map((type) => (
                                            <button
                                                key={type.value}
                                                type="button"
                                                onClick={() => onArticleTypeChange(type.value)}
                                                className={`
                                                    flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all duration-200
                                                    ${articleType === type.value
                                                        ? (isDark
                                                            ? 'bg-stone-800 border-stone-600 ring-1 ring-stone-600'
                                                            : 'bg-stone-50 border-stone-400 ring-1 ring-stone-400')
                                                        : (isDark
                                                            ? 'border-stone-800 hover:bg-stone-800/50 hover:border-stone-700'
                                                            : 'border-stone-200 hover:bg-stone-50 hover:border-stone-300')
                                                    }
                                                `}
                                            >
                                                <div className={`${articleType === type.value
                                                    ? (isDark ? 'text-white' : 'text-stone-900')
                                                    : (isDark ? 'text-stone-500' : 'text-stone-400')
                                                    }`}>
                                                    {ARTICLE_TYPE_ICONS[type.value]}
                                                </div>
                                                <span className={`text-[10px] text-center leading-tight font-medium ${articleType === type.value
                                                        ? (isDark ? 'text-white' : 'text-stone-900')
                                                        : (isDark ? 'text-stone-400' : 'text-stone-600')
                                                    }`}>
                                                    {type.value === 'informational' ? 'Deep Dive' :
                                                        type.value === 'commercial' ? 'Comparison' : 'Tutorial'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Keyword Section */}
                                <div className="mb-4 space-y-2">
                                    <label
                                        htmlFor="keyword"
                                        className={`block text-xs font-medium mb-1 pl-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}
                                    >
                                        Keyword / Topic
                                    </label>

                                    <div className="relative group">
                                        <input
                                            ref={inputRef}
                                            id="keyword"
                                            type="text"
                                            placeholder={
                                                articleType === 'informational' ? 'e.g. What is Next.js?' :
                                                    articleType === 'commercial' ? 'e.g. Top 5 AI Writing Tools' :
                                                        'e.g. How to deploy to Vercel'
                                            }
                                            value={keyword}
                                            onChange={(e) => onKeywordChange(e.target.value)}
                                            onFocus={() => setIsFocused(true)}
                                            onBlur={() => setIsFocused(false)}
                                            onKeyDown={handleKeyDown}
                                            autoFocus
                                            required
                                            disabled={disabled}
                                            className={`
                                        w-full px-3 py-2.5 border rounded-md shadow-sm outline-none transition-all
                                        placeholder:text-stone-400 text-sm
                                        ${isDark
                                                    ? 'bg-stone-950 border-stone-800 text-white focus:border-stone-600 focus:ring-1 focus:ring-stone-600'
                                                    : 'bg-white border-stone-200 text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400'
                                                }
                                      `}
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <Search className={`size-4 ${isDark ? 'text-stone-600' : 'text-stone-400'}`} />
                                        </div>
                                    </div>

                                    <p className={`text-xs tracking-tight pl-1 ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                                        {articleType === 'informational' ? 'Topic or concept you want to explain in depth.' :
                                            articleType === 'commercial' ? 'Product category or tools to compare.' :
                                                'Task or process you want to teach.'}
                                    </p>
                                </div>

                                {/* Premium Button */}
                                <button
                                    type="submit"
                                    disabled={!keyword.trim() || disabled}
                                    className={`
                                    flex h-9 w-full items-center justify-center overflow-hidden rounded-md px-3 text-xs font-semibold text-white transition-all
                                    disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer
                                    bg-gradient-to-b from-stone-800 to-stone-950
                                    hover:from-stone-700 hover:to-stone-900
                                    dark:from-stone-200 dark:to-stone-400 dark:text-stone-900 dark:hover:from-white dark:hover:to-stone-200
                                    shadow-[0_0_1px_1px_rgba(255,255,255,0.08)_inset,0_1px_1.5px_0_rgba(0,0,0,0.32)]
                                    ${isDark ? 'border border-stone-700' : ''}
                                  `}
                                >
                                    <span>Generate Titles</span>
                                </button>
                            </form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}
