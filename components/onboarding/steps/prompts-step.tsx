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
import {
    DEFAULT_PROMPTS_PER_RUN,
    PROMPT_INTENTS,
    type PromptIntentKey,
} from "@/lib/visibility/prompt-config"
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
    const [customInput, setCustomInput] = useState("")
    const [brandWarning, setBrandWarning] = useState("")

    /**
     * The questions, in the concern groups the generator produced.
     *
     * Insertion-ordered, so the reader sees them in the order they were
     * written rather than alphabetised into a list that changes shape between
     * runs. A question with no concern — one the founder typed — falls into a
     * named group rather than disappearing.
     */
    const groupedByConcern = (() => {
        const groups = new Map<string, PromptItem[]>()
        for (const prompt of prompts) {
            const key = prompt.concern?.trim() || "Your own questions"
            const list = groups.get(key) ?? []
            list.push(prompt)
            groups.set(key, list)
        }
        return [...groups.entries()]
    })()

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

        if (checkBrandMention(trimmed)) {
            setBrandWarning(
                "Discovery questions should not name your brand. Test what buyers ask before knowing you exist.",
            )
            return
        }

        onPromptsChange(
            prompts.map((p) => {
                if (p.id !== promptId) return p
                // Editing the wording does not reclassify the question. It was
                // re-inferred from the new text by a regex, so fixing a typo
                // could silently move a question into a different article type.
                // The founder changed how it reads, not what it is.
                const intent = p.intent
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

    const handleAddCustomPrompt = () => {
        const input = customInput.trim()
        if (!input || prompts.length >= DEFAULT_PROMPTS_PER_RUN) return

        if (checkBrandMention(input)) {
            setBrandWarning(
                "Buyer questions should not name your brand. Test whether AI recommends it unprompted.",
            )
            return
        }
        setBrandWarning("")

        // A hand-typed question is not classified by guessing at its wording.
        // It starts in the same neutral label the confirm route falls back to,
        // for the same reason the selection class below starts at its weakest
        // value: nothing has judged this question yet, and inventing a
        // confident label is worse than admitting that.
        const intent: PromptIntentKey = "problem"
        const articleType = PROMPT_INTENTS.find(
            (candidate) => candidate.key === intent,
        )!.articleType
        const newPrompt: PromptItem = {
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: input,
            textNorm: normalizeQuery(input),
            // Satisfies the NOT NULL column and nothing else; areas no longer
            // influence generation, binding or grouping.
            scopeFamilyId: scopeFamilies[0]?.id || scopeFamilies[0]?.name || "",
            concern: "Your own questions",
            intent,
            articleType,
            // A question the founder typed by hand has not been through the
            // selection classifier, so it starts in the weakest class and is
            // excluded from the recommendation denominator until it is judged.
            // Guessing a strong class here would let hand-written tutorials do
            // exactly what the classifier exists to prevent.
            selectionClass: UNKNOWN_SELECTION_CLASS,
            sourceSeed: "",
            isCustom: true,
        }

        onPromptsChange([...prompts, newPrompt])
        setCustomInput("")
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
{/*
                      * GROUPED BY BUYER CONCERN, NOT BY PRODUCT AREA.
                      *
                      * This iterated the confirmed scope families and filtered
                      * questions by `scopeFamilyId`. Questions no longer carry a
                      * meaningful area — generation is organised by the reason a
                      * person goes looking, not by which keyword bucket owns the
                      * feature — so that filter would have shown all of them
                      * under the first topic and "no questions" under the rest.
                      *
                      * The concern is the more useful heading anyway. "Editing
                      * without rerolling everything" is a reason someone
                      * searches; "Mobile App Design Templates" is a keyword.
                      */}
                    {groupedByConcern.map(([concern, groupPrompts]) => (
                        <div
                            key={concern}
                            className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                        >
                            <div className="border-b border-stone-100 bg-stone-50/70 px-3.5 py-2.5">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-semibold text-stone-900">
                                        {concern}
                                    </h3>
                                    <span className="text-[10px] text-stone-400">
                                        ({groupPrompts.length}{" "}
                                        {groupPrompts.length === 1 ? "question" : "questions"})
                                    </span>
                                </div>
                            </div>

                            <div className="divide-y divide-stone-100 p-2">
                                {groupPrompts.map((prompt) => {
                                    const isEditing = editingPromptId === prompt.id
                                    const badge = prompt.isCustom
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
                                })}
                            </div>
                        </div>
                    ))}

                    {/*
                      * ONE add control for the whole set.
                      *
                      * There used to be one per area, which only made sense
                      * while a question had to belong to one. Concerns are
                      * emergent, so a founder writing their own question is
                      * adding it to the set rather than filing it in a bucket.
                      */}
                    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={customInput}
                                onChange={(event) => {
                                    setCustomInput(event.target.value)
                                    if (brandWarning) setBrandWarning("")
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault()
                                        handleAddCustomPrompt()
                                    }
                                }}
                                placeholder="Add a question of your own"
                                className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    totalPrompts >= DEFAULT_PROMPTS_PER_RUN || !customInput.trim()
                                }
                                onClick={() => handleAddCustomPrompt()}
                                className="h-8 shrink-0 text-xs"
                            >
                                <Plus className="mr-1 h-3 w-3" />
                                Add
                            </Button>
                        </div>
                        {brandWarning && (
                            <p className="mt-1 text-[10px] text-amber-600">{brandWarning}</p>
                        )}
                    </div>
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
