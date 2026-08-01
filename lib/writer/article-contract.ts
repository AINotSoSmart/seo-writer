import type { ArticleType } from "../harvest/cluster-types"

export const CAPABILITY_CONTRACT_VERSION = "capability-v1" as const
export const ARTICLE_CONTRACT_VERSION = "article-contract-v1" as const

export type CapabilityFact = {
    id: string
    url: string
    quote: string
}

export type CapabilityOperation = {
    key: string
    customerJob: string
    inputs: string[]
    action: string
    outputs: string[]
    limits: string[]
    evidenceRefs: string[]
}

export type CapabilityContract = {
    version: typeof CAPABILITY_CONTRACT_VERSION
    deliveryMode: string
    operations: CapabilityOperation[]
    facts: CapabilityFact[]
}

export type CapabilityFit = "explicit" | "mechanically_entailed" | "educational"
export type SolutionMode = "product_led" | "category_educational"

export type QueryIntentBinding = {
    scopeFamilyId: string
    operationKey: string | null
    capabilityFit: CapabilityFit
    solutionMode: SolutionMode
    reason: string
}

export type ArticleContractIntent = {
    queryId: string
    query: string
    sourceUrl: string
    sourceContext: string
    operationKey: string | null
    capabilityFit: CapabilityFit
    capabilityFactIds: string[]
}

export type ArticleContract = {
    version: typeof ARTICLE_CONTRACT_VERSION
    entity: {
        name: string
        entityType: string
        deliveryMode: string
    }
    primaryIntent: ArticleContractIntent
    requiredIntents: ArticleContractIntent[]
    scopeFamilyId: string
    solutionMode: SolutionMode
    capabilityFactIds: string[]
    researchQuery: string
    articleLength: "short" | "medium" | "long"
}

export function fallbackCapabilityContract(input: {
    name: string
    description: string
}): CapabilityContract {
    return {
        version: CAPABILITY_CONTRACT_VERSION,
        deliveryMode: "Product or service described by the customer",
        operations: [{
            key: "op1",
            customerJob: input.description,
            inputs: [],
            action: input.description,
            outputs: [],
            limits: [],
            evidenceRefs: [],
        }],
        facts: [],
    }
}

export function selectIntentSizedLength(input: {
    isPillar: boolean
    articleType: ArticleType
    absorbedIntentCount: number
}): ArticleContract["articleLength"] {
    if (input.isPillar || input.absorbedIntentCount >= 2) return "long"
    if (
        input.articleType === "howto" ||
        input.articleType === "commercial" ||
        input.absorbedIntentCount === 1
    ) {
        return "medium"
    }
    return "short"
}

export function capabilityFactIdsForOperation(
    contract: CapabilityContract | null | undefined,
    operationKey: string | null,
): string[] {
    if (!contract || !operationKey) return []
    const operation = contract.operations.find((candidate) => candidate.key === operationKey)
    if (!operation) return []
    const validFacts = new Set(contract.facts.map((fact) => fact.id))
    return operation.evidenceRefs.filter((id) => validFacts.has(id))
}

export function resolveCapabilityFacts(
    contracts: CapabilityContract[],
    factIds: string[],
): CapabilityFact[] {
    const wanted = new Set(factIds)
    const seen = new Set<string>()
    return contracts.flatMap((contract) =>
        contract.facts.filter((fact) => {
            if (!wanted.has(fact.id) || seen.has(fact.id)) return false
            seen.add(fact.id)
            return true
        }),
    )
}
