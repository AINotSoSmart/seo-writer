"use client"

import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    Plus,
    Trash2,
} from "lucide-react"

import type { CapabilityContract, ScopeFamily } from "@/lib/schemas/brand"
import { CAPABILITY_CONTRACT_VERSION } from "@/lib/writer/article-contract"
import { MAX_SEARCH_DIRECTIONS } from "@/lib/scope-search-cap"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PillInput } from "@/components/ui/pill-input"
import { cn } from "@/lib/utils"

function normalizeSeed(value: string): string {
    return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
}

export { MAX_SEARCH_DIRECTIONS }

export function countScopeSearches(families: ScopeFamily[]): number {
    return families
        .filter((family) => family.enabled)
        .reduce((total, family) => total + family.seed_keywords.length, 0)
}

const fieldLabelClass = "text-[10px] font-medium uppercase tracking-wide text-stone-400"

function withFounderConfirmedOperation(
    contract: CapabilityContract,
    familyId: string,
    operationIndex: number,
    patch: Partial<CapabilityContract["operations"][number]>,
): CapabilityContract {
    const operation = { ...contract.operations[operationIndex], ...patch }
    const factId = `${familyId}:founder-${operation.key}`.slice(0, 80)
    const quote = [
        operation.inputs.length ? `Inputs: ${operation.inputs.join(", ")}.` : "",
        `Action: ${operation.action}.`,
        operation.outputs.length ? `Outputs: ${operation.outputs.join(", ")}.` : "",
        operation.limits.length ? `Limits: ${operation.limits.join(", ")}.` : "",
    ].filter(Boolean).join(" ")
    const operations = [...contract.operations]
    operations[operationIndex] = {
        ...operation,
        evidenceRefs: Array.from(new Set([...operation.evidenceRefs, factId])).slice(0, 8),
    }
    return {
        ...contract,
        operations,
        facts: [
            ...contract.facts.filter((fact) => fact.id !== factId),
            {
                id: factId,
                url: "founder-confirmed:onboarding",
                quote,
            },
        ].slice(-12),
    }
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
    const atCap = totalDirections >= MAX_SEARCH_DIRECTIONS

    const replace = (index: number, family: ScopeFamily) => {
        onChange(
            ordered.map((current, currentIndex) =>
                currentIndex === index ? family : current,
            ),
        )
    }
    const replaceSeeds = (index: number, seed_keywords: string[]) => {
        const family = ordered[index]
        const others =
            totalDirections - family.seed_keywords.length
        const room = Math.max(0, MAX_SEARCH_DIRECTIONS - others)
        replace(index, {
            ...family,
            seed_keywords: seed_keywords.slice(0, room),
            priority: index,
        })
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
        if (atCap) return
        onChange([
            ...ordered,
            {
                id: crypto.randomUUID(),
                name: "New category",
                description: "",
                seed_keywords: [],
                evidence: [],
                capability_contract: {
                    version: CAPABILITY_CONTRACT_VERSION,
                    deliveryMode: "Browser software, API, installed product, or human-delivered service",
                    operations: [{
                        key: "op1",
                        customerJob: "Describe the customer job",
                        inputs: [],
                        action: "Describe what your product or service does",
                        outputs: [],
                        limits: [],
                        evidenceRefs: [],
                    }],
                    facts: [],
                },
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
                    Most important category first · keywords belong to that category
                </p>
                <p
                    className={cn(
                        "font-mono text-[11px] tabular-nums text-stone-400",
                        atCap && "text-stone-600",
                    )}
                >
                    {totalDirections}/{MAX_SEARCH_DIRECTIONS}
                </p>
            </div>

            {unassigned.length > 0 && (
                <p className="text-xs text-amber-800">
                    Put these into a category: {unassigned.join(", ")}
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
                            className="space-y-1.5 px-2.5 py-2 sm:px-3"
                        >
                            <div>
                                <p className={fieldLabelClass}>Category</p>
                                <div className="mt-0.5 flex items-center gap-2">
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
                                        placeholder="e.g. AI photo restoration"
                                        className="h-8 flex-1 border-stone-200 bg-transparent px-2 text-sm font-medium shadow-none"
                                    />
                                    {/*
                                      * `parent_hint` is set when extraction judged
                                      * this area a sub-case of a broader one.
                                      * Areas emitted at inconsistent depth measure
                                      * too little demand to sustain a cluster, so
                                      * surfacing the suggested parent lets the
                                      * founder merge deliberately rather than find
                                      * out later that an area produced nothing.
                                      */}
                                    {family.parent_hint ? (
                                        <span
                                            className="hidden shrink-0 text-[10px] text-stone-400 sm:inline"
                                            title={`Extraction judged this a sub-area of "${family.parent_hint}". Merge it in, or keep it separate if it is genuinely its own customer job.`}
                                        >
                                            Sub-area of {family.parent_hint}
                                        </span>
                                    ) : (family.verified === false || rare) && (
                                        <span className="hidden shrink-0 text-[10px] text-stone-400 sm:inline">
                                            {family.verified === false
                                                ? "Not on site"
                                                : "Weak keyword"}
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
                            </div>

                            <div>
                                <p className={fieldLabelClass}>Keywords</p>
                                <PillInput
                                    value={family.seed_keywords}
                                    onChange={(seed_keywords) =>
                                        replaceSeeds(index, seed_keywords)
                                    }
                                    disableAdd={atCap}
                                    placeholder="Add a keyword, Enter"
                                    className="mt-0.5 min-h-0 border-0 bg-stone-50/80 px-1.5 py-1"
                                />
                            </div>

                            <div>
                                <p className={fieldLabelClass}>What this helps with</p>
                                <Input
                                    value={family.description}
                                    onChange={(event) =>
                                        replace(index, {
                                            ...family,
                                            description: event.target.value,
                                            capability_contract: family.capability_contract
                                                ? {
                                                      ...family.capability_contract,
                                                      operations: family.capability_contract.operations.map(
                                                          (operation) => ({
                                                              ...operation,
                                                              customerJob: event.target.value,
                                                          }),
                                                      ),
                                                  }
                                                : family.capability_contract,
                                            priority: index,
                                        })
                                    }
                                    placeholder="One line — who it's for"
                                    className="mt-0.5 h-7 border-0 bg-transparent px-1.5 text-xs text-stone-500 shadow-none placeholder:text-stone-300"
                                />
                            </div>

                            {family.capability_contract ? (
                                <details className="rounded-md bg-stone-50/80 px-2 py-1.5">
                                    <summary className="cursor-pointer text-[10px] font-medium text-stone-500 hover:text-stone-700">
                                        How we understand this works
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                        <div>
                                            <p className={fieldLabelClass}>Delivered as</p>
                                            <Input
                                                value={family.capability_contract.deliveryMode}
                                                onChange={(event) =>
                                                    replace(index, {
                                                        ...family,
                                                        capability_contract: {
                                                            ...family.capability_contract!,
                                                            deliveryMode: event.target.value,
                                                        },
                                                    })
                                                }
                                                placeholder="e.g. Browser-based software"
                                                className="mt-0.5 h-7 border-stone-200 bg-white px-2 text-xs shadow-none"
                                            />
                                        </div>
                                        {family.capability_contract.operations.map((operation, operationIndex) => (
                                            <div key={operation.key} className="space-y-1.5 border-t border-stone-200 pt-2 first:border-0 first:pt-0">
                                                <Input
                                                    value={operation.action}
                                                    onChange={(event) => {
                                                        replace(index, {
                                                            ...family,
                                                            capability_contract: withFounderConfirmedOperation(
                                                                family.capability_contract!,
                                                                family.id || `scope-${index}`,
                                                                operationIndex,
                                                                {
                                                                    action: event.target.value,
                                                                    customerJob: family.description || operation.customerJob,
                                                                },
                                                            ),
                                                        })
                                                    }}
                                                    aria-label={`How ${family.name} works`}
                                                    placeholder="What the product does to the input"
                                                    className="h-7 border-stone-200 bg-white px-2 text-xs shadow-none"
                                                />
                                                <div className="grid gap-1.5 sm:grid-cols-3">
                                                    {(["inputs", "outputs", "limits"] as const).map((field) => (
                                                        <Input
                                                            key={field}
                                                            value={operation[field].join(", ")}
                                                            onChange={(event) => {
                                                                const values = event.target.value
                                                                    .split(",")
                                                                    .map((item) => item.trim())
                                                                    .filter(Boolean)
                                                                    .slice(0, 8)
                                                                replace(index, {
                                                                    ...family,
                                                                    capability_contract: withFounderConfirmedOperation(
                                                                        family.capability_contract!,
                                                                        family.id || `scope-${index}`,
                                                                        operationIndex,
                                                                        { [field]: values },
                                                                    ),
                                                                })
                                                            }}
                                                            placeholder={
                                                                field === "inputs"
                                                                    ? "Inputs, comma separated"
                                                                    : field === "outputs"
                                                                      ? "Outputs, comma separated"
                                                                      : "Known limits, comma separated"
                                                            }
                                                            className="h-7 border-stone-200 bg-white px-2 text-[11px] shadow-none"
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ) : null}

                            {family.evidence.length > 0 ? (
                                <details>
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
                        </article>
                    )
                })}
            </div>

            <button
                type="button"
                onClick={add}
                disabled={atCap || ordered.length >= 12}
                className="inline-flex h-8 items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 disabled:opacity-40"
            >
                <Plus className="h-3.5 w-3.5" />
                Add category
            </button>
        </section>
    )
}
