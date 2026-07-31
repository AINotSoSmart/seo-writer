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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

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
    const overCap = totalDirections > MAX_SEARCH_DIRECTIONS
    const hasUnverified = ordered.some((family) => family.verified === false)
    const hasRare = ordered.some((family) =>
        family.seed_keywords.some((seed) => noDemand.has(normalizeSeed(seed))),
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
        <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-100 pb-3">
                <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-400">
                        Product areas
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                        First area is highest priority. Research uses only the
                        searches listed under each area.
                    </p>
                </div>
                <p
                    className={cn(
                        "font-mono text-xs tabular-nums",
                        overCap ? "font-medium text-red-600" : "text-stone-400",
                    )}
                >
                    {totalDirections}/{MAX_SEARCH_DIRECTIONS} searches
                </p>
            </div>

            {(overCap || unassigned.length > 0 || hasUnverified || hasRare) && (
                <div className="space-y-1.5 text-xs leading-relaxed">
                    {overCap && (
                        <p className="text-red-700">
                            Combine close variations — you have {totalDirections}{" "}
                            searches; the limit is {MAX_SEARCH_DIRECTIONS}.
                        </p>
                    )}
                    {unassigned.length > 0 && (
                        <p className="text-amber-800">
                            Assign to an area before continuing:{" "}
                            <span className="font-medium">
                                {unassigned.join(", ")}
                            </span>
                        </p>
                    )}
                    {hasUnverified && (
                        <p className="text-stone-500">
                            <span className="font-medium text-stone-700">
                                Not on site
                            </span>{" "}
                            means we could not quote your pages — keep only if
                            real.
                        </p>
                    )}
                    {hasRare && (
                        <p className="text-stone-500">
                            <span className="font-medium text-stone-700">
                                Rarely searched
                            </span>{" "}
                            means Google Suggest had no expansions — reword if
                            customers would phrase it differently.
                        </p>
                    )}
                </div>
            )}

            <div className="divide-y divide-stone-100">
                {ordered.map((family, index) => (
                    <article
                        key={family.id || `scope-family-${index}`}
                        className="py-5 first:pt-1"
                    >
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <span className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                                {index + 1}
                                {family.source === "founder" && (
                                    <span className="rounded bg-stone-900 px-1.5 py-0.5 text-white">
                                        Your search
                                    </span>
                                )}
                                {family.verified === false && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                                        Not on site
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
                            <div className="flex shrink-0 items-center gap-0.5">
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

                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1 block text-[11px] font-medium text-stone-500">
                                        Area name
                                    </label>
                                    <Input
                                        value={family.name}
                                        onChange={(event) =>
                                            replace(index, {
                                                ...family,
                                                name: event.target.value,
                                                priority: index,
                                            })
                                        }
                                        placeholder="e.g. Photo restoration"
                                        className="font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[11px] font-medium text-stone-500">
                                        Customer job
                                    </label>
                                    <Textarea
                                        value={family.description}
                                        onChange={(event) =>
                                            replace(index, {
                                                ...family,
                                                description: event.target.value,
                                                priority: index,
                                            })
                                        }
                                        placeholder="What do customers hire this area to do?"
                                        rows={2}
                                        className="resize-none text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-stone-500">
                                    Searches we research
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
                                    placeholder="Customer search phrase, then Enter"
                                    className="min-h-[5.5rem]"
                                />
                                <p className="mt-1.5 text-[10px] leading-relaxed text-stone-400">
                                    These are the Google phrases for this area —
                                    not the area title above.
                                </p>
                            </div>
                        </div>

                        {family.evidence.length > 0 ? (
                            <details className="mt-3">
                                <summary className="cursor-pointer text-[11px] text-stone-400 hover:text-stone-600">
                                    Site evidence ({family.evidence.length})
                                </summary>
                                <div className="mt-2 space-y-2">
                                    {family.evidence.map((evidence, evidenceIndex) => (
                                        <div
                                            key={`${evidence.url}-${evidenceIndex}`}
                                            className="rounded-md bg-stone-50 px-3 py-2"
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
                                                Open source
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        ) : null}
                    </article>
                ))}
            </div>

            <Button
                type="button"
                variant="ghost"
                className="h-9 w-full border border-dashed border-stone-200 text-stone-600 hover:bg-stone-50"
                onClick={add}
                disabled={ordered.length >= 12}
            >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add product area
            </Button>
        </section>
    )
}
