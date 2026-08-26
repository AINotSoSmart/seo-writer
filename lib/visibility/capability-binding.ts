import type {
    CapabilityContract,
    CapabilityOperation,
    QueryIntentBinding,
} from "@/lib/writer/article-contract"

const WORD = /[a-z0-9]+/g
const STOP = new Set([
    "a", "an", "and", "are", "best", "can", "do", "for", "from", "get",
    "how", "i", "in", "is", "it", "my", "of", "on", "or", "the", "to",
    "use", "way", "what", "when", "with",
])

function tokens(value: string): Set<string> {
    return new Set((value.toLowerCase().match(WORD) ?? []).filter((word) => !STOP.has(word)))
}

function operationText(operation: CapabilityOperation): string {
    return [
        operation.customerJob,
        operation.action,
        ...operation.inputs,
        ...operation.outputs,
    ].join(" ")
}

function usableJob(operation: CapabilityOperation): string {
    const job = operation.customerJob.trim()
    if (tokens(job).size >= 3 && job.length >= 12) return job
    const action = operation.action.trim()
    const outputs = operation.outputs.filter(Boolean).join(", ")
    if (action && outputs) return `${action} to produce ${outputs}`
    return action || outputs || "Address the confirmed customer task"
}

export interface BoundCapability {
    binding: QueryIntentBinding
    customerJob: string
    capabilityFactIds: string[]
}

/**
 * Every confirmed operation in one pool, regardless of which area declared it.
 *
 * Binding used to go question -> area -> that area's contract, so a question
 * could only ever match an operation belonging to the area the generator
 * happened to tag it with. Questions no longer carry a meaningful area, and
 * they never should have: a buyer describing a problem does not know which of
 * our keyword buckets owns the answer.
 *
 * Merging is safe because operation keys and fact ids are already unique within
 * a brand's extracted scope — the areas were partitioning one product's
 * capabilities, not describing separate products.
 */
export function mergeCapabilityContracts(
    contracts: Array<CapabilityContract | null | undefined>,
): CapabilityContract | null {
    const operations: CapabilityContract["operations"] = []
    const facts: CapabilityContract["facts"] = []
    const seenOperations = new Set<string>()
    const seenFacts = new Set<string>()

    for (const contract of contracts) {
        if (!contract) continue
        for (const operation of contract.operations) {
            if (seenOperations.has(operation.key)) continue
            seenOperations.add(operation.key)
            operations.push(operation)
        }
        for (const fact of contract.facts) {
            if (seenFacts.has(fact.id)) continue
            seenFacts.add(fact.id)
            facts.push(fact)
        }
    }

    if (operations.length === 0) return null
    // Delivery mode is a property of the product, not of an area, so the first
    // declared value stands for the brand.
    const deliveryMode =
        contracts.find((contract) => contract?.deliveryMode)?.deliveryMode ??
        "self_serve_software"
    return { version: "capability-v1", deliveryMode, operations, facts }
}

/**
 * Binds a buyer question to one evidenced operation. Unproven mechanics stay
 * educational instead of being upgraded into a product claim.
 */
export function bindPromptCapability(input: {
    scopeFamilyId: string
    prompt: string
    sourceSeed?: string
    contract: CapabilityContract | null | undefined
}): BoundCapability {
    const contract = input.contract
    if (!contract?.operations.length) {
        return {
            binding: {
                scopeFamilyId: input.scopeFamilyId,
                operationKey: null,
                capabilityFit: "educational",
                solutionMode: "category_educational",
                reason: "No verified product operation is attached to this product area.",
            },
            customerJob: "Address the confirmed customer task",
            capabilityFactIds: [],
        }
    }

    const queryTokens = tokens(`${input.prompt} ${input.sourceSeed ?? ""}`)
    const ranked = contract.operations
        .map((operation) => {
            const operationTokens = tokens(operationText(operation))
            const overlap = [...queryTokens].filter((word) => operationTokens.has(word)).length
            const validFacts = new Set(contract.facts.map((fact) => fact.id))
            const factIds = operation.evidenceRefs.filter((id) => validFacts.has(id))
            return { operation, overlap, factIds }
        })
        .sort((a, b) => b.overlap - a.overlap || a.operation.key.localeCompare(b.operation.key))

    const selected = ranked[0]
    const unambiguous =
        selected &&
        selected.factIds.length > 0 &&
        (contract.operations.length === 1 || selected.overlap > (ranked[1]?.overlap ?? -1))
    if (!selected || !unambiguous) {
        return {
            binding: {
                scopeFamilyId: input.scopeFamilyId,
                operationKey: null,
                capabilityFit: "educational",
                solutionMode: "category_educational",
                reason:
                    "The question could not be bound unambiguously to one evidenced product operation.",
            },
            customerJob: selected ? usableJob(selected.operation) : "Address the confirmed customer task",
            capabilityFactIds: [],
        }
    }

    return {
        binding: {
            scopeFamilyId: input.scopeFamilyId,
            operationKey: selected.operation.key,
            capabilityFit: "explicit",
            solutionMode: "product_led",
            reason: `Bound to the verified operation “${usableJob(selected.operation)}”.`,
        },
        customerJob: usableJob(selected.operation),
        capabilityFactIds: selected.factIds,
    }
}
