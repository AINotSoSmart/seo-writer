"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Building2, ChevronDown, ExternalLink, Check, Link2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export interface PillarRecommendation {
    id: string
    title: string
    description: string
    suggested_slug: string
    created_url?: string
    created_at?: string
}

interface PillarPagesSectionProps {
    pillars: PillarRecommendation[] | null
    brandId: string
    onPillarUpdated?: (updatedPillar: PillarRecommendation) => void
}

export function PillarPagesSection({ pillars, brandId, onPillarUpdated }: PillarPagesSectionProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [addingUrlForId, setAddingUrlForId] = useState<string | null>(null)
    const [urlInput, setUrlInput] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!pillars || pillars.length === 0) {
        return null
    }

    const completedCount = pillars.filter(p => p.created_url).length

    const handleSubmitUrl = async (pillarId: string) => {
        if (!urlInput.trim()) {
            toast.error("Please enter a URL")
            return
        }

        // Basic URL validation
        try {
            new URL(urlInput.trim())
        } catch {
            toast.error("Please enter a valid URL")
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/pillar-pages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pillarId,
                    url: urlInput.trim(),
                    brandId
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Failed to save URL")
            }

            toast.success("Pillar page marked as created!")
            setAddingUrlForId(null)
            setUrlInput("")

            // Notify parent to update state
            if (onPillarUpdated && data.pillar) {
                onPillarUpdated(data.pillar)
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to save URL")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="border-b border-stone-200 pb-2 mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="cursor-pointer w-full flex items-center justify-between group py-2"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                        isOpen ? "bg-violet-100/50 text-violet-600" : "bg-stone-100 text-stone-500 group-hover:text-violet-600 group-hover:bg-violet-50"
                    )}>
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-3">
                        <h3 className={cn(
                            "text-xs font-bold uppercase tracking-wide transition-colors",
                            isOpen ? "text-violet-900" : "text-stone-500 group-hover:text-violet-900"
                        )}>
                            Pillar Pages
                        </h3>
                        <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors",
                            completedCount === pillars.length
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-stone-100 text-stone-500"
                        )}>
                            {completedCount}/{pillars.length}
                        </span>
                    </div>
                </div>
                <div className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300",
                    isOpen ? "bg-violet-100 text-violet-900 rotate-180" : "bg-stone-100 text-stone-400 group-hover:text-stone-600"
                )}>
                    <ChevronDown className="w-4 h-4" />
                </div>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                    >
                        <div className="pt-4 pb-2 space-y-3">
                            <p className="text-xs text-stone-500 pl-11 pr-2 -mt-2 mb-4">
                                Create these pages on your website to establish domain authority.
                                When done, add the URL so future articles can link to them.
                            </p>

                            {pillars.map((pillar) => (
                                <div
                                    key={pillar.id}
                                    className={cn(
                                        "ml-11 mr-2 p-4 rounded-xl border transition-all",
                                        pillar.created_url
                                            ? "bg-emerald-50/50 border-emerald-200"
                                            : "bg-stone-50/50 border-stone-200 hover:border-stone-300"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-semibold text-stone-900 truncate">
                                                    {pillar.title}
                                                </h4>
                                                {pillar.created_url && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                                        <Check className="w-3 h-3" />
                                                        Created
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                                                {pillar.description}
                                            </p>
                                            <p className="text-[10px] text-stone-400 mt-2 font-mono">
                                                Suggested: {pillar.suggested_slug}
                                            </p>
                                        </div>

                                        {!pillar.created_url && addingUrlForId !== pillar.id && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setAddingUrlForId(pillar.id)
                                                    setUrlInput("")
                                                }}
                                                className="shrink-0 h-8 text-xs"
                                            >
                                                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                                                Add URL
                                            </Button>
                                        )}

                                        {pillar.created_url && (
                                            <a
                                                href={pillar.created_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 transition-colors"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                View
                                            </a>
                                        )}
                                    </div>

                                    {/* URL Input Form */}
                                    <AnimatePresence>
                                        {addingUrlForId === pillar.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="flex gap-2 mt-3 pt-3 border-t border-stone-200">
                                                    <Input
                                                        type="url"
                                                        placeholder="https://yoursite.com/page"
                                                        value={urlInput}
                                                        onChange={(e) => setUrlInput(e.target.value)}
                                                        className="flex-1 h-9 text-sm"
                                                        disabled={isSubmitting}
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                handleSubmitUrl(pillar.id)
                                                            } else if (e.key === "Escape") {
                                                                setAddingUrlForId(null)
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSubmitUrl(pillar.id)}
                                                        disabled={isSubmitting}
                                                        className="h-9 px-3"
                                                    >
                                                        {isSubmitting ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            "Save"
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setAddingUrlForId(null)}
                                                        disabled={isSubmitting}
                                                        className="h-9 px-3 text-stone-500"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
