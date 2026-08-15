"use client"

import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    Plus,
    Trash2,
} from "lucide-react"

import type { CapabilityContract, ScopeFamily } from "@/lib/schemas/brand"
import {
    CAPABILITY_CONTRACT_VERSION,
    fallbackCapabilityContract,
} from "@/lib/writer/article-contract"
import {
    MECHANICS_GAP_COPY,
    isPlaceholderAction,
    mechanicsGaps,
} from "@/lib/scope-mechanics"
import {
    MAX_SCOPE_FAMILY_COUNT,
    MAX_SEARCH_DIRECTIONS,
    MAX_SEEDS_PER_FAMILY,
} from "@/lib/scope-search-cap"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PillInput } from "@/components/ui/pill-input"
import { Skeleton } from "@/components/ui/skeleton"
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

function titleCaseSeed(seed: string): string {
    return seed.replace(/\b\w/g, (character) => character.toUpperCase()).slice(0, 100)
}

/** Stable per-row key. Families created client-side may not have an id yet. */
function familyKeyOf(family: ScopeFamily, index: number): string {
    return family.id || `scope-${index}`
}

/**
 * Placeholder rows for the window where scope is still being computed.
 *
 * Rendering the real component with an empty array produced a bordered box, a
 * counter reading 0/12 and an enabled "Add category" — indistinguishable from
 * "we found nothing on your site", while the model was still working.
 */
export function ScopeFamilySkeleton() {
    return (
        <section className="space-y-2" aria-busy="true" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-stone-500">
                    Most important category first · keywords belong to that category
                </p>
            </div>
            <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {[0, 1, 2].map((row) => (
                    <div key={row} className="space-y-2 px-2.5 py-3 sm:px-3">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-7 w-full" />
                        <div className="flex gap-1.5">
                            <Skeleton className="h-5 w-24 rounded-full" />
                            <Skeleton className="h-5 w-32 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-stone-400">Reading your site for product areas…</p>
        </section>
    )
}

/** Scrolls a blocker's field into view and focuses it. */
export function focusScopeField(blocker: ScopeBlocker) {
    if (typeof document === "undefined") return
    const target =
        blocker.field === "unassigned" || !blocker.familyId
            ? document.getElementById("scope-unassigned")
            : document.getElementById(`scope-field-${blocker.familyId}-${blocker.field}`) ||
              document.getElementById(`scope-family-${blocker.familyId}`)
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "center" })
    if (target instanceof HTMLInputElement) target.focus({ preventScroll: true })
}

export type ScopeBlockerField =
    | "name"
    | "keywords"
    | "description"
    | "deliveryMode"
    | "action"
    | "unassigned"

export type ScopeBlocker = {
    familyId: string
    familyName: string
    field: ScopeBlockerField
    message: string
}

/**
 * Everything that will stop Continue, computed on the client, per field.
 *
 * The server's `validateConfirmedScope` remains the authority — this exists so
 * the founder never again sees its worst output. A freshly added category fails
 * `BrandDetailsSchema` before the mechanics check runs, so the entire screen
 * used to collapse to the single string "Brand details are invalid." with no
 * field named and nothing to click.
 *
 * Mirrors the server rules deliberately; `mechanicsGaps` is literally the same
 * function the server calls, so the two cannot drift on the hard part.
 */
export function findScopeBlockers(
    families: ScopeFamily[],
    targetSeeds: string[],
): ScopeBlocker[] {
    const enabled = families
        .filter((family) => family.enabled)
        .sort((a, b) => a.priority - b.priority)
    const blockers: ScopeBlocker[] = []
    const seenNames = new Set<string>()

    enabled.forEach((family, index) => {
        const familyId = family.id || `scope-${index}`
        const familyName = family.name.trim() || `Category ${index + 1}`

        if (family.name.trim().length < 2) {
            blockers.push({ familyId, familyName, field: "name", message: "Give this category a name." })
        } else if (seenNames.has(family.name.trim().toLowerCase())) {
            blockers.push({ familyId, familyName, field: "name", message: `Two categories are both called "${family.name.trim()}" — rename one.` })
        }
        seenNames.add(family.name.trim().toLowerCase())

        if (family.seed_keywords.length === 0) {
            blockers.push({ familyId, familyName, field: "keywords", message: "Add at least one keyword people would search." })
        }
        if (family.description.trim().length < 8) {
            blockers.push({ familyId, familyName, field: "description", message: "Say in one line what this helps with." })
        }

        const gaps = mechanicsGaps(family.capability_contract)
        if (gaps.length > 0) {
            blockers.push({
                familyId,
                familyName,
                field: gaps[0] === "missing_delivery_mode" ? "deliveryMode" : "action",
                message: MECHANICS_GAP_COPY[gaps[0]],
            })
        }
    })

    const assigned = new Set(
        enabled.flatMap((family) => family.seed_keywords.map(normalizeSeed)),
    )
    const unassigned = Array.from(
        new Set(targetSeeds.map(normalizeSeed).filter(Boolean)),
    ).filter((seed) => !assigned.has(seed))
    for (const seed of unassigned) {
        blockers.push({
            familyId: "",
            familyName: "",
            field: "unassigned",
            message: `"${seed}" is not in any category yet — put it in one, or drop it.`,
        })
    }

    return blockers
}

const fieldLabelClass = "text-[10px] font-medium uppercase tracking-wide text-stone-400"

/**
 * Records what the founder typed as a first-party capability fact.
 *
 * A founder describing their own product IS the sanctioned evidence source —
 * `CapabilityFactSchema` whitelists the `founder-confirmed:` URL scheme for
 * exactly this. It is the only way a manually added or auto-rescued product area
 * can ever satisfy the confirm gate.
 *
 * Two invariants, both load-bearing:
 *
 * 1. **A fact is only minted from a meaningful action.** With an empty action
 *    the old quote was `"Action: ."` — nine characters, which slips past the
 *    schema's `min(8)` and would satisfy the facts check while saying nothing.
 *    When the action is empty or still placeholder text, the fact and its
 *    reference are withdrawn instead, so the gate keeps failing honestly.
 * 2. **It only ever touches its own id.** `${familyId}:founder-${key}` is
 *    namespaced so this can never overwrite or delete a fact the extractor
 *    read off the customer's site.
 */
function withFounderConfirmedOperation(
    contract: CapabilityContract,
    familyId: string,
    operationIndex: number,
    patch: Partial<CapabilityContract["operations"][number]>,
): CapabilityContract {
    const operation = { ...contract.operations[operationIndex], ...patch }
    const factId = `${familyId}:founder-${operation.key}`.slice(0, 80)
    const operations = [...contract.operations]
    const otherFacts = contract.facts.filter((fact) => fact.id !== factId)

    if (isPlaceholderAction(operation.action)) {
        // Withdraw both halves. Leaving the ref behind would point at nothing.
        operations[operationIndex] = {
            ...operation,
            evidenceRefs: operation.evidenceRefs.filter((ref) => ref !== factId),
        }
        return { ...contract, operations, facts: otherFacts }
    }

    const quote = [
        operation.customerJob.trim() ? `Job: ${operation.customerJob.trim()}.` : "",
        operation.inputs.length ? `Inputs: ${operation.inputs.join(", ")}.` : "",
        `Action: ${operation.action.trim()}.`,
        operation.outputs.length ? `Outputs: ${operation.outputs.join(", ")}.` : "",
        operation.limits.length ? `Limits: ${operation.limits.join(", ")}.` : "",
    ].filter(Boolean).join(" ")

    operations[operationIndex] = {
        ...operation,
        evidenceRefs: Array.from(new Set([...operation.evidenceRefs, factId])).slice(0, 8),
    }
    return {
        ...contract,
        operations,
        facts: [
            ...otherFacts,
            { id: factId, url: "founder-confirmed:onboarding", quote },
        ].slice(-12),
    }
}

/**
 * The four visible founder fields must satisfy the confirm gate without an
 * engineer schema. Description is the customer job; if action is empty or
 * still a placeholder, description also becomes the action so a fact mints.
 * A richer extracted action is left alone.
 */
function withFounderVisibleFields(
    contract: CapabilityContract,
    familyId: string,
    description: string,
    deliveryMode: string,
): CapabilityContract {
    const current = contract.operations[0]
    const action =
        !current || isPlaceholderAction(current.action)
            ? description
            : current.action
    return withFounderConfirmedOperation(
        // Typed by a human, so it is no longer a placeholder whatever it was a
        // moment ago — and the warning above must stop showing.
        { ...contract, deliveryMode, mechanicsSource: "founder" },
        familyId,
        0,
        { customerJob: description, action },
    )
}

export function ScopeFamilyReview({
    families,
    targetSeeds,
    seedsWithoutDemand = [],
    onChange,
    onChangeTargetSeeds,
    onRestart,
    failedEmpty = false,
}: {
    families: ScopeFamily[]
    targetSeeds: string[]
    /** Advisory: phrases Google Autocomplete does not suggest. */
    seedsWithoutDemand?: string[]
    onChange: (families: ScopeFamily[]) => void
    /**
     * Lets the founder drop a target search they decided they do not sell.
     *
     * Without this the "Assign every target search" error can only ever be
     * cleared by inventing a category for it — there was no way to withdraw the
     * demand. Hosts MUST also mirror the change into
     * `brandData.target_seed_keywords`, which is what the server validator reads.
     */
    onChangeTargetSeeds?: (seeds: string[]) => void
    /** Offered only when the founder has deleted every category. */
    onRestart?: () => void
    /** Stream died with no families — do not imply the site sells nothing. */
    failedEmpty?: boolean
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
    /** Attach an unplaced target search to an existing category. */
    const assignSeed = (seed: string, familyIndex: number) => {
        const family = ordered[familyIndex]
        if (!family || family.seed_keywords.length >= MAX_SEEDS_PER_FAMILY) return
        replaceSeeds(familyIndex, [...family.seed_keywords, seed])
    }
    /** Drop a target search the founder has decided they do not sell. */
    const dropSeed = (seed: string) => {
        onChangeTargetSeeds?.(
            targetSeeds.filter((candidate) => normalizeSeed(candidate) !== seed),
        )
    }
    /**
     * Every field starts EMPTY, with its guidance in the placeholder attribute.
     *
     * These used to ship prefilled prose beginning with the word "Describe",
     * which the confirm gate rejects by design — `lib/harvest/scope-classifier.ts`
     * inlines the action verbatim as the definition of the business, so
     * placeholder wording would become the yardstick for the whole audit. The
     * placeholder WAS the failure condition, so a founder who added a category
     * and filled in everything the screen showed them still could not continue,
     * and nothing said why.
     *
     * `seed` pre-fills the name and keyword when the category is being created
     * from an unplaced target search.
     */
    const add = (seed?: string) => {
        if (atCap) return
        onChange([
            ...ordered,
            {
                id: crypto.randomUUID(),
                name: seed ? titleCaseSeed(seed) : "",
                description: "",
                seed_keywords: seed ? [seed] : [],
                evidence: [],
                capability_contract: {
                    version: CAPABILITY_CONTRACT_VERSION,
                    deliveryMode: "",
                    operations: [{
                        key: "op1",
                        customerJob: "",
                        inputs: [],
                        action: "",
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

            {/* One row per unplaced search, each with a way OUT. The flat list this
                replaced named the problem and offered no action: the only cure was
                to retype the search as a keyword, and there has never been a way to
                drop a search you decided you do not sell. */}
            {unassigned.length > 0 && (
                <div id="scope-unassigned" className="space-y-1 rounded-md bg-amber-50/70 px-2 py-1.5 ring-1 ring-amber-200">
                    <p className="text-[11px] font-medium text-amber-900">
                        {unassigned.length === 1
                            ? "One search you gave us is not in a category yet"
                            : `${unassigned.length} searches you gave us are not in a category yet`}
                    </p>
                    {unassigned.map((seed) => {
                        const suggestion = ordered.findIndex(
                            (family) => normalizeSeed(family.name) === seed,
                        )
                        return (
                            <div key={seed} className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[11px] text-amber-900">{seed}</span>
                                {suggestion >= 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => assignSeed(seed, suggestion)}
                                        className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
                                    >
                                        Add to “{ordered[suggestion].name}”
                                    </button>
                                ) : null}
                                <select
                                    aria-label={`Put "${seed}" in a category`}
                                    value=""
                                    onChange={(event) => {
                                        const choice = event.target.value
                                        if (choice === "") return
                                        if (choice === "__new__") add(seed)
                                        else assignSeed(seed, Number(choice))
                                    }}
                                    className="h-6 rounded border border-amber-300 bg-white px-1 text-[10px] text-amber-900"
                                >
                                    <option value="">Put in…</option>
                                    {ordered.map((family, familyIndex) => (
                                        <option key={familyKeyOf(family, familyIndex)} value={familyIndex}>
                                            {family.name.trim() || `Category ${familyIndex + 1}`}
                                        </option>
                                    ))}
                                    {!atCap && ordered.length < MAX_SCOPE_FAMILY_COUNT ? (
                                        <option value="__new__">New category from this</option>
                                    ) : null}
                                </select>
                                {onChangeTargetSeeds ? (
                                    <button
                                        type="button"
                                        onClick={() => dropSeed(seed)}
                                        className="text-[10px] text-amber-700 underline underline-offset-2 hover:text-amber-900"
                                    >
                                        Not something we sell
                                    </button>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {/* An empty box with a counter reading 0/12 used to render here and
                    read as "we found nothing" — including while scope was still
                    loading. Hosts now show a skeleton during analysis, so reaching
                    this means the founder deleted everything. Say so. */}
                {ordered.length === 0 ? (
                    <p className="px-3 py-4 text-xs leading-relaxed text-stone-500">
                        {failedEmpty
                            ? "No product areas were saved from this run. Retry, or add a category below — this does not mean your site sells nothing."
                            : "No product areas yet. Nothing gets researched until there is at least one — add a category below and say what it does for customers."}
                    </p>
                ) : null}
                {ordered.map((family, index) => {
                    const rare = family.seed_keywords.some((seed) =>
                        noDemand.has(normalizeSeed(seed)),
                    )
                    const familyKey = family.id || `scope-${index}`
                    const contract =
                        family.capability_contract ??
                        fallbackCapabilityContract({
                            name: family.name,
                            description: family.description,
                        })
                    return (
                        <article
                            key={familyKey}
                            id={`scope-family-${familyKey}`}
                            className="space-y-1.5 px-2.5 py-2 sm:px-3"
                        >
                            <div>
                                <p className={fieldLabelClass}>Category</p>
                                <div className="mt-0.5 flex items-center gap-2">
                                    <span className="w-4 shrink-0 text-center font-mono text-[10px] text-stone-400">
                                        {index + 1}
                                    </span>
                                    <Input
                                        id={`scope-field-${familyKey}-name`}
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

                            <div id={`scope-field-${familyKey}-keywords`}>
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

                            <div id={`scope-field-${familyKey}-action`}>
                                <p className={fieldLabelClass}>What this helps with</p>
                                <Input
                                    id={`scope-field-${familyKey}-description`}
                                    value={family.description}
                                    onChange={(event) =>
                                        replace(index, {
                                            ...family,
                                            description: event.target.value,
                                            capability_contract: withFounderVisibleFields(
                                                contract,
                                                familyKey,
                                                event.target.value,
                                                contract.deliveryMode,
                                            ),
                                            priority: index,
                                        })
                                    }
                                    placeholder="One line — who it's for"
                                    className="mt-0.5 h-7 border-0 bg-transparent px-1.5 text-xs text-stone-500 shadow-none placeholder:text-stone-300"
                                />
                            </div>

                            <div>
                                <p className={fieldLabelClass}>Delivered as</p>
                                {/* No warning banner here, deliberately. The value is
                                    a placeholder for EVERY family — the scope prompt
                                    is never asked for mechanics, so
                                    `contractFromEvidence` manufactures all of them —
                                    and a warning on every row is decoration, not
                                    signal. The hint text does the work instead, and
                                    `mechanicsSource` records the provenance for the
                                    day extraction produces something real. */}
                                <Input
                                    id={`scope-field-${familyKey}-deliveryMode`}
                                    value={contract.deliveryMode}
                                    onChange={(event) =>
                                        replace(index, {
                                            ...family,
                                            capability_contract: withFounderVisibleFields(
                                                contract,
                                                familyKey,
                                                family.description,
                                                event.target.value,
                                            ),
                                            priority: index,
                                        })
                                    }
                                    placeholder="e.g. Browser software, done-for-you, app, API"
                                    className="mt-0.5 h-7 border-0 bg-transparent px-1.5 text-xs text-stone-500 shadow-none placeholder:text-stone-300"
                                />
                                <p className="px-1.5 text-[10px] leading-relaxed text-stone-400">
                                    Worth correcting — this and the line above shape the
                                    buyer questions we ask the AI engines.
                                </p>
                            </div>

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

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => add()}
                    disabled={atCap || ordered.length >= MAX_SCOPE_FAMILY_COUNT}
                    className="inline-flex h-8 items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 disabled:opacity-40"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add category
                </button>
                {ordered.length === 0 && onRestart ? (
                    <button
                        type="button"
                        onClick={onRestart}
                        className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-800"
                    >
                        Start over and re-run the analysis
                    </button>
                ) : null}
            </div>
        </section>
    )
}
