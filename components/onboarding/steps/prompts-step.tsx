"use client"

import { useState } from "react"
import {
    ArrowRight,
    ArrowLeft,
    Trash2,
    Plus,
    Check,
    Edit2,
    HelpCircle,
    Sparkles,
    AlertCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { UNKNOWN_SELECTION_CLASS } from "@/lib/visibility/selection-class"
import { normalizeQuery } from "@/lib/harvest/types"
import type { BuyerPrompt } from "@/lib/visibility/prompt-builder"
import { DEFAULT_PROMPTS_PER_RUN, PROMPT_INTENTS } from "@/lib/visibility/prompt-config"
import { inferPromptIntent } from "@/lib/visibility/prompt-selection"
import type { ScopeFamily } from "@/lib/schemas/brand"

export interface PromptItem extends BuyerPrompt {
    id: string
    isCustom?: boolean
}

const INTENT_BADGES: Record<
    string,
    { label: string; bg: string; text: string; border: string }
> = {
    alternatives: {
        label: "Alternatives",
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
    },
    recommendation: {
        label: "Recommendation",
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
    },
    comparison: {
        label: "Comparison",
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        border: "border-indigo-200",
    },
    problem: {
        label: "Informational",
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
    },
    howto: {
        label: "How-To",
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
    },
    custom: {
        label: "Custom",
        bg: "bg-stone-100",
        text: "text-stone-700",
        border: "border-stone-300",
    },
}

export function PromptsStep({
    prompts,
    scopeFamilies,
    productName,
    loading,
    saving,
    error,
    onPromptsChange,
    onBack,
    onContinue,
}: {
    prompts: PromptItem[]
    scopeFamilies: ScopeFamily[]
    productName: string
    loading: boolean
    /** The brand is being written — this screen commits the run. */
    saving: boolean
    error?: string
    onPromptsChange: (prompts: PromptItem[]) => void
    onBack: () => void
    onContinue: () => void
}) {
    const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
    const [editText, setEditText] = useState("")
    const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
    const [brandWarnings, setBrandWarnings] = useState<Record<string, string>>({})

    const activeFamilies = scopeFamilies.filter((f) => f.enabled !== false)

    const checkBrandMention = (text: string): boolean => {
        if (!productName || productName.trim().length < 3) return false
        const cleanProduct = productName.toLowerCase().replace(/[^a-z0-9]/g, "")
        const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, "")
        return cleanText.includes(cleanProduct)
    }

    const handleStartEdit = (prompt: PromptItem) => {
        setEditingPromptId(prompt.id)
        setEditText(prompt.text)
    }

    const handleSaveEdit = (promptId: string) => {
        const trimmed = editText.trim()
        if (!trimmed) {
            handleDeletePrompt(promptId)
            setEditingPromptId(null)
            return
        }

        const edited = prompts.find((prompt) => prompt.id === promptId)
        if (edited && checkBrandMention(trimmed)) {
            setBrandWarnings((current) => ({
                ...current,
                [edited.scopeFamilyId]:
                    "Discovery questions should not name your brand. Test what buyers ask before knowing you exist.",
            }))
            return
        }

        onPromptsChange(
            prompts.map((p) => {
                if (p.id !== promptId) return p
                const intent = inferPromptIntent(trimmed, p.intent)
                const articleType = PROMPT_INTENTS.find(
                    (candidate) => candidate.key === intent,
                )!.articleType
                return {
                    ...p,
                    text: trimmed,
                    textNorm: normalizeQuery(trimmed),
                    intent,
                    articleType,
                }
            }),
        )
        setEditingPromptId(null)
    }

    const handleDeletePrompt = (promptId: string) => {
        onPromptsChange(prompts.filter((p) => p.id !== promptId))
    }

    const handleAddCustomPrompt = (familyId: string, familyName: string) => {
        const input = (customInputs[familyId] || "").trim()
        if (!input || prompts.length >= DEFAULT_PROMPTS_PER_RUN) return

        if (checkBrandMention(input)) {
            setBrandWarnings((prev) => ({
                ...prev,
                [familyId]:
                    "Buyer questions should not name your brand. Test whether AI recommends it unprompted.",
            }))
            return
        }

        setBrandWarnings((prev) => {
            const next = { ...prev }
            delete next[familyId]
            return next
        })

        const intent = inferPromptIntent(input, "problem")
        const articleType = PROMPT_INTENTS.find(
            (candidate) => candidate.key === intent,
        )!.articleType
        const newPrompt: PromptItem = {
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: input,
            textNorm: normalizeQuery(input),
            scopeFamilyId: familyId,
            intent,
            articleType,
            // A question the founder typed by hand has not been through the
            // selection classifier, so it starts in the weakest class and is
            // excluded from the recommendation denominator until it is judged.
            // Guessing a strong class here would let hand-written tutorials do
            // exactly what the classifier exists to prevent.
            selectionClass: UNKNOWN_SELECTION_CLASS,
            sourceSeed: familyName,
            isCustom: true,
        }

        onPromptsChange([...prompts, newPrompt])
        setCustomInputs((prev) => ({ ...prev, [familyId]: "" }))
    }

    const totalPrompts = prompts.length

    return (
        <div className="space-y-5 pb-1">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <h2 className="font-serif text-xl tracking-tight text-stone-900">
                        Confirm the questions buyers ask AI
                    </h2>
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                        {totalPrompts} {totalPrompts === 1 ? "prompt" : "prompts"}
                    </span>
                </div>
                <p className="text-xs text-stone-500">
                    Written from your confirmed topics and the rivals you just
                    confirmed. Edit, remove, or add your own — these exact questions
                    are what we put to ChatGPT &amp; Google AI Mode.
                </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50/80 p-3 text-[11px] leading-relaxed text-stone-600">
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                <p>
                    <strong className="font-medium text-stone-800">
                        Why is your brand not named in these questions?
                    </strong>{" "}
                    We test whether AI assistants recommend you when a buyer describes the
                    problem naturally. A missing answer becomes a measured finding; only
                    findings that owned content can solve become create or refresh work.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {loading && prompts.length === 0 ? (
                <div className="space-y-3 py-6 text-center">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-stone-600">
                        <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />
                        Generating realistic buyer questions from your confirmed scope…
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {activeFamilies.map((family) => {
                        const familyId = family.id || family.name
                        const familyPrompts = prompts.filter(
                            (p) => p.scopeFamilyId === familyId || p.sourceSeed === family.name,
                        )
                        return (
                            <div
                                key={familyId}
                                className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                            >
                                {/* Family Header */}
                                <div className="border-b border-stone-100 bg-stone-50/70 px-3.5 py-2.5">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xs font-semibold text-stone-900">
                                                {family.name}
                                            </h3>
                                            <span className="text-[10px] text-stone-400">
                                                ({familyPrompts.length}{" "}
                                                {familyPrompts.length === 1 ? "question" : "questions"})
                                            </span>
                                        </div>
                                        {family.seed_keywords && family.seed_keywords.length > 0 && (
                                            <p className="text-[10px] text-stone-400">
                                                Seeds: {family.seed_keywords.slice(0, 3).join(", ")}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Prompts List */}
                                <div className="divide-y divide-stone-100 p-2">
                                    {familyPrompts.length === 0 ? (
                                        <div className="py-4 text-center text-xs text-stone-400">
                                            No questions selected for this area. Add one below.
                                        </div>
                                    ) : (
                                        familyPrompts.map((prompt) => {
                                            const isEditing = editingPromptId === prompt.id
                                            const badge =
                                                prompt.isCustom
                                                    ? INTENT_BADGES.custom
                                                    : INTENT_BADGES[prompt.intent]

                                            return (
                                                <div
                                                    key={prompt.id}
                                                    className="group flex items-start gap-2.5 py-2 px-1 text-xs transition-colors hover:bg-stone-50/50"
                                                >
                                                    <span
                                                        className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase ${badge.bg} ${badge.text} ${badge.border}`}
                                                    >
                                                        {badge.label}
                                                    </span>

                                                    <div className="min-w-0 flex-1">
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={editText}
                                                                    onChange={(e) => setEditText(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") handleSaveEdit(prompt.id)
                                                                        if (e.key === "Escape") setEditingPromptId(null)
                                                                    }}
                                                                    autoFocus
                                                                    className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900 shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleSaveEdit(prompt.id)}
                                                                    className="h-6 w-6 p-0 text-stone-700 hover:text-stone-900"
                                                                >
                                                                    <Check className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => handleStartEdit(prompt)}
                                                                className="cursor-pointer leading-relaxed text-stone-700 transition-colors group-hover:text-stone-950"
                                                                title="Click to edit prompt"
                                                            >
                                                                &ldquo;{prompt.text}&rdquo;
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                                                        {!isEditing && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEdit(prompt)}
                                                                className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                                                                title="Edit prompt text"
                                                            >
                                                                <Edit2 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeletePrompt(prompt.id)}
                                                            className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                                                            title="Remove prompt"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}

                                    {/* Add Custom Prompt Row */}
                                    <div className="pt-2 px-1">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={customInputs[familyId] || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value
                                                    setCustomInputs((prev) => ({
                                                        ...prev,
                                                        [familyId]: val,
                                                    }))
                                                    if (brandWarnings[familyId]) {
                                                        setBrandWarnings((prev) => {
                                                            const next = { ...prev }
                                                            delete next[familyId]
                                                            return next
                                                        })
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault()
                                                        handleAddCustomPrompt(familyId, family.name)
                                                    }
                                                }}
                                                placeholder={`Add a question for ${family.name} (e.g. "best tools for...")`}
                                                className="w-full rounded-md border border-dashed border-stone-300 bg-stone-50/50 px-2.5 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={
                                                    totalPrompts >= DEFAULT_PROMPTS_PER_RUN ||
                                                    !(customInputs[familyId] || "").trim()
                                                }
                                                onClick={() => handleAddCustomPrompt(familyId, family.name)}
                                                className="h-8 shrink-0 text-xs"
                                            >
                                                <Plus className="mr-1 h-3 w-3" />
                                                Add
                                            </Button>
                                        </div>

                                        {brandWarnings[familyId] && (
                                            <p className="mt-1 text-[10px] text-amber-600">
                                                {brandWarnings[familyId]}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Bottom Actions */}
            <div className="sticky bottom-0 space-y-3 border-t border-stone-100 bg-white/95 py-3 backdrop-blur-sm">
                {totalPrompts === 0 && (
                    <p className="text-center text-[11px] text-amber-700">
                        Keep at least one distinct buyer question before continuing.
                    </p>
                )}
                <div className="flex items-center justify-between gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onBack}
                        className="h-10 text-xs text-stone-600"
                    >
                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                        Back to rivals
                    </Button>

                    <Button
                        type="button"
                        onClick={onContinue}
                        disabled={
                            loading || saving || totalPrompts === 0 || totalPrompts > DEFAULT_PROMPTS_PER_RUN
                        }
                        className="h-10 flex-1 bg-gradient-to-b from-stone-800 to-stone-950 font-semibold text-white hover:from-stone-700 hover:to-stone-900 disabled:opacity-50 sm:flex-initial sm:min-w-[200px]"
                    >
                        {saving
                            ? "Starting…"
                            : `Ask these ${totalPrompts} question${totalPrompts === 1 ? "" : "s"}`}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
