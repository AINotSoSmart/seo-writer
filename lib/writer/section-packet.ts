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

/**
 * Deterministically closes structural outline gaps without another model call.
 *
 * The load-bearing invariant is that **no section may leave here empty**. The
 * previous version assigned each contract intent to exactly one section and
 * left every surplus section with `intent_ids: []`, which cascaded into
 * `capability_fact_ids: []` and `research_evidence_ids: []`. Combined with a
 * writer prompt that ignored `instruction_note`, those sections were handed a
 * heading, a purpose label and the tail of the previous paragraph — so the only
 * executable instruction left was "continue the previous sentence", and the
 * article came out as one severed paragraph with headings wedged between the
 * pieces.
 *
 * Ownership is still exclusive: each intent appears in exactly one section's
 * `intent_ids`, so two sections never both claim to be *the* answer to a query.
 * Surplus sections instead receive `supporting_intent_ids`, which grants
 * read access to that intent's evidence without transferring ownership.
 */
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

  // The introduction answers the primary intent, so it carries that intent's
  // evidence. It previously carried none at all, which is why intros invented
  // architecture, accuracy percentages and market statistics out of nothing.
  const primaryFactIds = contract.primaryIntent.capabilityFactIds.filter((id) => capabilityIds.has(id))
  outline.intro.intent_ids = [contract.primaryIntent.queryId]
  outline.intro.capability_fact_ids = primaryFactIds.slice(0, 8)
  outline.intro.research_evidence_ids = researchEvidence
    .filter((item) => item.supportsIntentIds.includes(contract.primaryIntent.queryId))
    .slice(0, 4)
    .map((item) => item.id)

  outline.sections.forEach((section: any, index: number) => {
    section.id = index + 1
    section.level = 2
    section.supporting_intent_ids = []
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

  // Unowned intents go to intentless sections first, so surplus headings become
  // real answers rather than padding, and only then round-robin.
  const unowned = intents.filter((intent) => !owned.has(intent.queryId))
  const intentless = () => outline.sections.filter((section: any) => section.intent_ids.length === 0)
  for (const intent of unowned) {
    const target = intentless()[0]
      || outline.sections[owned.size % outline.sections.length]
    target.intent_ids.push(intent.queryId)
    owned.add(intent.queryId)
  }

  // Anything still empty supports the primary intent. It does not own it: the
  // section brief keeps it on its own sub-topic, but it may now cite evidence.
  outline.sections.forEach((section: any) => {
    if (section.intent_ids.length === 0) {
      section.supporting_intent_ids = [contract.primaryIntent.queryId]
    }
  })

  const assignedEvidence = new Set<string>()
  outline.sections.forEach((section: any) => {
    const readableIntentIds: string[] = [...section.intent_ids, ...section.supporting_intent_ids]
    const ownedIntents = intents.filter((intent) => readableIntentIds.includes(intent.queryId))
    section.capability_fact_ids = Array.from(new Set(
      ownedIntents.flatMap((intent) => intent.capabilityFactIds).filter((id) => capabilityIds.has(id)),
    )).slice(0, 8)

    const relevant = researchEvidence.filter((item) =>
      item.supportsIntentIds.some((intentId) => readableIntentIds.includes(intentId)),
    )
    const fresh = relevant.filter((item) => !assignedEvidence.has(item.id))
    // Prefer evidence no other section has used, so citations spread across the
    // article. Fall back to sharing rather than leaving a section evidence-blind.
    const matchingEvidence = (fresh.length > 0 ? fresh : relevant).slice(0, 8)
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
