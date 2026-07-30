"use client"

import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    Plus,
    ShieldCheck,
    Trash2,
} from "lucide-react"

import type { ScopeFamily } from "@/lib/schemas/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PillInput } from "@/components/ui/pill-input"
import { Textarea } from "@/components/ui/textarea"

function normalizeSeed(value: string): string {
    return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
}

const MAX_SEARCH_DIRECTIONS = 12

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
    const totalDirections = ordered.reduce(
        (total, family) => total + family.seed_keywords.length,
        0,
    )

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
                // Hand-added areas need no site quote — the founder is the
                // authority on what the business sells.
                verified: true,
                priority: ordered.length,
                enabled: true,
            },
        ])
    }

    return (
        <section className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-white p-2 text-stone-700 shadow-sm">
                    <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-stone-950">
                        Confirm what your business actually sells
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-stone-600">
                        The audit may only research these confirmed areas. Rename, remove,
                        add, or reorder them now. The first area has the highest priority.
                    </p>
                </div>
            </div>

            {unassigned.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                    Assign these searches to a product area before continuing:{" "}
                    <strong>{unassigned.join(", ")}</strong>
                </div>
            )}
            {ordered.some((family) => family.verified === false) && (
                <div className="rounded-lg border border-stone-300 bg-white p-3 text-xs text-stone-700">
                    Some areas below are marked{" "}
                    <strong>not found on your site</strong>. We kept them rather
                    than guessing — keep the ones that are real, remove the rest.
                </div>
            )}
            {ordered.some((family) =>
                family.seed_keywords.some((seed) => noDemand.has(normalizeSeed(seed))),
            ) && (
                <div className="rounded-lg border border-stone-300 bg-white p-3 text-xs text-stone-700">
                    Searches marked <strong>rarely searched</strong> got no
                    suggestions from Google. That usually means the wording
                    describes how the product works rather than what customers
                    call it. Reword them for better results.
                </div>
            )}
            {totalDirections > MAX_SEARCH_DIRECTIONS && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    Keep the confirmed scope to {MAX_SEARCH_DIRECTIONS} main
                    searches. You currently have {totalDirections}; combine
                    close variations before continuing.
                </div>
            )}

            <div className="space-y-3">
                {ordered.map((family, index) => (
                    <article
                        key={family.id || `scope-family-${index}`}
                        className="rounded-lg border border-stone-200 bg-white p-4"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <span className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                                Priority {index + 1}
                                {family.source === "founder" && (
                                    <span className="rounded bg-stone-900 px-1.5 py-0.5 text-white">
                                        From your search
                                    </span>
                                )}
                                {family.verified === false && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                                        Not found on your site
                                    </span>
                                )}
                                {family.seed_keywords.some((seed) =>
                                    noDemand.has(normalizeSeed(seed)),
                                ) && (
                                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-600">
                                        Rarely searched
                                    </span>
                                )}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
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
                                    className="h-7 w-7"
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
                                    className="h-7 w-7 text-red-600 hover:text-red-700"
                                    onClick={() => remove(index)}
                                    aria-label={`Remove ${family.name}`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Input
                                value={family.name}
                                onChange={(event) =>
                                    replace(index, {
                                        ...family,
                                        name: event.target.value,
                                        priority: index,
                                    })
                                }
                                placeholder="Product or service area"
                                className="font-medium"
                            />
                            <Textarea
                                value={family.description}
                                onChange={(event) =>
                                    replace(index, {
                                        ...family,
                                        description: event.target.value,
                                        priority: index,
                                    })
                                }
                                placeholder="What customer job does this area serve?"
                                rows={2}
                            />
                            <div>
                                <label className="mb-1 block text-xs font-medium text-stone-600">
                                    Main searches for this area
                                </label>
                                <PillInput
                                    value={family.seed_keywords}
                                    onChange={(seed_keywords) =>
                                        replace(index, {
                                            ...family,
                                            seed_keywords,
                                            priority: index,
                                        })
                                    }
                                    placeholder="Type a direct customer search and press Enter"
                                />
                            </div>
                        </div>

                        <div className="mt-3 border-t border-stone-100 pt-3">
                            {family.evidence.length > 0 ? (
                                <details>
                                    <summary className="cursor-pointer text-xs font-medium text-stone-600">
                                        Why we found this area ({family.evidence.length} website
                                        source{family.evidence.length === 1 ? "" : "s"})
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                        {family.evidence.map((evidence, evidenceIndex) => (
                                            <div
                                                key={`${evidence.url}-${evidenceIndex}`}
                                                className="rounded-md bg-stone-50 p-2.5"
                                            >
                                                <q className="block text-xs leading-relaxed text-stone-600">
                                                    {evidence.quote}
                                                </q>
                                                <a
                                                    href={evidence.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600"
                                                >
                                                    Open source page
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ) : (
                                <p className="text-xs text-stone-500">
                                    Added or confirmed by you.
                                </p>
                            )}
                        </div>
                    </article>
                ))}
            </div>

            <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={add}
                disabled={ordered.length >= 12}
            >
                <Plus className="mr-2 h-4 w-4" />
                Add missing product area
            </Button>
        </section>
    )
}
