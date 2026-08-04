import type { ArticleContract, CapabilityFact } from "./article-contract"

export const ARTICLE_TARGET_WORDS: Record<ArticleContract["articleLength"], number> = {
  short: 1500,
  medium: 1900,
  long: 2800,
}

export type OutlineResearchEvidence = {
  id: string
  url: string
  supportsIntentIds: string[]
}

/** Deterministically closes structural outline gaps without another model call. */
export function normalizeContractOutline(
  outline: any,
  contract: ArticleContract,
  capabilityFacts: CapabilityFact[],
  researchEvidence: OutlineResearchEvidence[],
  frozenLinks: Array<{ url: string; title?: string; anchor?: string; anchorText?: string }> = [],
) {
  const intents = [contract.primaryIntent, ...contract.requiredIntents]
    .filter((intent, index, all) => all.findIndex((candidate) => candidate.queryId === intent.queryId) === index)
  const intentIds = new Set(intents.map((intent) => intent.queryId))
  const capabilityIds = new Set(capabilityFacts.map((fact) => fact.id))
  const frozenByUrl = new Map(frozenLinks.map((link) => [link.url, link]))
  const owned = new Set<string>()
  outline.intro.intent_ids = []
  outline.intro.capability_fact_ids = []
  outline.intro.research_evidence_ids = []
  outline.sections.forEach((section: any, index: number) => {
    section.id = index + 1
    section.level = 2
    section.intent_ids = (section.intent_ids || []).filter((id: string) => {
      if (!intentIds.has(id) || owned.has(id)) return false
      owned.add(id)
      return true
    })
    if (section.external_link && !researchEvidence.some((item) => item.url === section.external_link.url)) {
      section.external_link = null
    }
    if (section.internal_link && !frozenByUrl.has(section.internal_link.url)) section.internal_link = null
  })
  intents.filter((intent) => !owned.has(intent.queryId)).forEach((intent, index) => {
    outline.sections[index % outline.sections.length].intent_ids.push(intent.queryId)
  })
  const assignedEvidence = new Set<string>()
  outline.sections.forEach((section: any) => {
    const ownedIntents = intents.filter((intent) => section.intent_ids.includes(intent.queryId))
    section.capability_fact_ids = Array.from(new Set(
      ownedIntents.flatMap((intent) => intent.capabilityFactIds).filter((id) => capabilityIds.has(id)),
    )).slice(0, 8)
    const matchingEvidence = researchEvidence.filter((item) =>
      !assignedEvidence.has(item.id) &&
      item.supportsIntentIds.some((intentId) => section.intent_ids.includes(intentId)),
    ).slice(0, 8)
    matchingEvidence.forEach((item) => assignedEvidence.add(item.id))
    section.research_evidence_ids = matchingEvidence.map((item) => item.id)
    section.research_fact_ids = section.research_evidence_ids
    if (section.external_link && !researchEvidence.some((item) =>
      section.research_evidence_ids.includes(item.id) && item.url === section.external_link.url,
    )) section.external_link = null
    if (!section.external_link && matchingEvidence.length > 0) {
      section.external_link = {
        url: matchingEvidence[0].url,
        anchor_context: "Support the assigned external evidence",
      }
    }
  })
  const introBudget = contract.articleLength === "short" ? 160 : 200
  const sectionBudget = Math.floor((ARTICLE_TARGET_WORDS[contract.articleLength] - introBudget) / outline.sections.length)
  outline.sections.forEach((section: any) => { section.word_budget = sectionBudget })
  const imageCap = contract.articleLength === "short" ? 0 : contract.articleLength === "medium" ? 1 : 2
  let images = 0
  outline.sections.forEach((section: any) => {
    if (!section.needs_image || images >= imageCap) {
      section.needs_image = false
      section.image_type = null
    } else {
      images++
    }
  })
  return outline
}
