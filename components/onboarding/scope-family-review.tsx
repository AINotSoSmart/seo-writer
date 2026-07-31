"use client"

import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    Plus,
    Trash2,
} from "lucide-react"

import type { ScopeFamily } from "@/lib/schemas/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PillInput } from "@/components/ui/pill-input"
import { cn } from "@/lib/utils"

function normalizeSeed(value: string): string {
    return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
}

export const MAX_SEARCH_DIRECTIONS = 12

export function countScopeSearches(families: ScopeFamily[]): number {
    return families
        .filter((family) => family.enabled)
        .reduce((total, family) => total + family.seed_keywords.length, 0)
}

export function ScopeFamilyReview({
    families,
    targetSeeds,
    seedsWithoutDemand = [],
    onChange,
}: {
    families: ScopeFamily[]
    targetSeeds: string[]
    /** Advisory: phrases Google Autocomplete does not suggest. */
    seedsWithoutDemand?: string[]
    onChange: (families: ScopeFamily[]) => void
}) {
    const noDemand = new Set(seedsWithoutDemand.map(normalizeSeed))
    const ordered = [...families]
        .filter((family) => family.enabled)
        .sort((a, b) => a.priority - b.priority)
    const assignedSeeds = new Set(
        ordered.flatMap((family) =>
            family.seed_keywords.map((seed) => normalizeSeed(seed)),
        ),
    )
    const unassigned = targetSeeds
        .map(normalizeSeed)
        .filter((seed) => seed && !assignedSeeds.has(seed))
    const totalDirections = countScopeSearches(ordered)
    const overBy = totalDirections - MAX_SEARCH_DIRECTIONS
    const overCap = overBy > 0

    const replace = (index: number, family: ScopeFamily) => {
        onChange(
            ordered.map((current, currentIndex) =>
                currentIndex === index ? family : current,
            ),
        )
    }
    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction
        if (target < 0 || target >= ordered.length) return
        const next = [...ordered]
        ;[next[index], next[target]] = [next[target], next[index]]
        onChange(next.map((family, priority) => ({ ...family, priority })))
    }
    const remove = (index: number) => {
        onChange(
            ordered
                .filter((_, currentIndex) => currentIndex !== index)
                .map((family, priority) => ({ ...family, priority })),
        )
    }
    const add = () => {
        onChange([
            ...ordered,
            {
                id: crypto.randomUUID(),
                name: "New product area",
                description:
                    "Describe the product, service, or customer job this area covers.",
                seed_keywords: [],
                evidence: [],
                source: "user",
                verified: true,
                priority: ordered.length,
                enabled: true,
            },
        ])
    }

    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-stone-500">
                    Priority order · research uses the search chips only
                </p>
                <p
                    className={cn(
                        "font-mono text-[11px] tabular-nums",
                        overCap ? "font-semibold text-red-600" : "text-stone-400",
                    )}
                >
                    {totalDirections}/{MAX_SEARCH_DIRECTIONS}
                </p>
            </div>

            {overCap && (
                <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
                    Remove {overBy} search chip{overBy === 1 ? "" : "s"} (click ×)
                    or delete an area — we cap at {MAX_SEARCH_DIRECTIONS} so the
                    audit stays fast and focused.
                </p>
            )}
            {unassigned.length > 0 && (
                <p className="text-xs text-amber-800">
                    Put these into an area: {unassigned.join(", ")}
                </p>
            )}

            <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {ordered.map((family, index) => {
                    const rare = family.seed_keywords.some((seed) =>
                        noDemand.has(normalizeSeed(seed)),
                    )
                    return (
                        <article
                            key={family.id || `scope-family-${index}`}
                            className="px-2.5 py-2 sm:px-3"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-stone-400">
                                    {index + 1}
                                </span>
                                <Input
                                    value={family.name}
                                    onChange={(event) =>
                                        replace(index, {
                                            ...family,
                                            name: event.target.value,
                                            priority: index,
                                        })
                                    }
                                    placeholder="Area name"
                                    className="h-8 flex-1 border-stone-200 bg-transparent px-2 text-sm font-medium shadow-none"
                                />
                                {(family.verified === false || rare) && (
                                    <span className="hidden shrink-0 text-[10px] text-stone-400 sm:inline">
                                        {family.verified === false
                                            ? "Not on site"
                                            : "Weak search"}
                                    </span>
                                )}
                                <div className="flex shrink-0 items-center">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-stone-400"
                                        onClick={() => move(index, -1)}
                                        disabled={index === 0}
                                        aria-label={`Move ${family.name} up`}
                                    >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-stone-400"
                                        onClick={() => move(index, 1)}
                                        disabled={index === ordered.length - 1}
                                        aria-label={`Move ${family.name} down`}
                                    >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-stone-400 hover:text-red-600"
                                        onClick={() => remove(index)}
                                        aria-label={`Remove ${family.name}`}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-1.5 pl-6">
                                <PillInput
                                    value={family.seed_keywords}
                                    onChange={(seed_keywords) =>
                                        replace(index, {
                                            ...family,
                                            seed_keywords,
                                            priority: index,
                                        })
                                    }
                                    placeholder="Add a Google search, Enter"
                                    className="min-h-0 border-0 bg-stone-50/80 px-1.5 py-1"
                                />
                                <Input
                                    value={family.description}
                                    onChange={(event) =>
                                        replace(index, {
                                            ...family,
                                            description: event.target.value,
                                            priority: index,
                                        })
                                    }
                                    placeholder="Customer job (one line)"
                                    className="mt-1 h-7 border-0 bg-transparent px-1.5 text-xs text-stone-500 shadow-none placeholder:text-stone-300"
                                />
                                {family.evidence.length > 0 ? (
                                    <details className="mt-0.5">
                                        <summary className="cursor-pointer text-[10px] text-stone-400 hover:text-stone-600">
                                            Evidence ({family.evidence.length})
                                        </summary>
                                        <div className="mt-1 space-y-1.5 pb-1">
                                            {family.evidence.map(
                                                (evidence, evidenceIndex) => (
                                                    <div
                                                        key={`${evidence.url}-${evidenceIndex}`}
                                                        className="rounded bg-stone-50 px-2 py-1.5"
                                                    >
                                                        <q className="block text-[11px] leading-snug text-stone-600">
                                                            {evidence.quote}
                                                        </q>
                                                        <a
                                                            href={evidence.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-brand-600"
                                                        >
                                                            Source
                                                            <ExternalLink className="h-2.5 w-2.5" />
                                                        </a>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </details>
                                ) : null}
                            </div>
                        </article>
                    )
                })}
            </div>

            <button
                type="button"
                onClick={add}
                disabled={ordered.length >= 12}
                className="inline-flex h-8 items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 disabled:opacity-40"
            >
                <Plus className="h-3.5 w-3.5" />
                Add area
            </button>
        </section>
    )
}
