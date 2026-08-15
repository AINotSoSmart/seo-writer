import { z } from "zod"

import { CAPABILITY_CONTRACT_VERSION } from "../writer/article-contract.ts"

export const ScopeEvidenceSchema = z.object({
  url: z.string().url(),
  quote: z.string().min(8).max(500),
})

export const CapabilityFactSchema = z.object({
  id: z.string().trim().min(1).max(80),
  url: z.string().refine(
    (value) => value.startsWith("founder-confirmed:") || z.string().url().safeParse(value).success,
    "Capability evidence must be a source URL or founder-confirmed onboarding reference",
  ),
  quote: z.string().trim().min(8).max(500),
})

export const CapabilityOperationSchema = z.object({
  key: z.string().trim().min(1).max(80),
  customerJob: z.string().trim().min(4).max(240),
  inputs: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
  action: z.string().trim().min(4).max(300),
  outputs: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
  limits: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  evidenceRefs: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
})

export const CapabilityContractSchema = z.object({
  version: z.literal(CAPABILITY_CONTRACT_VERSION),
  deliveryMode: z.string().trim().min(2).max(160),
  operations: z.array(CapabilityOperationSchema).min(1).max(6),
  facts: z.array(CapabilityFactSchema).max(12).default([]),
  /**
   * How these mechanics were obtained — provenance, not content.
   *
   * `extracted` is the real thing: the model read the pages and described what
   * the product does. `salvaged` means extraction failed and the contract was
   * rebuilt from surviving page quotes, which sets `deliveryMode` to a
   * placeholder and collapses the single operation into the family description
   * repeated twice. `brand_card` means even that failed and the confirmed brand
   * card filled the hole.
   *
   * Recorded because the last two are indistinguishable from the first on
   * screen and in the database, while feeding the buyer-question prompt and the
   * writer's frozen contract as though they were read off the site. Absent on
   * rows written before this existed, which is why it is optional rather than
   * defaulted — an old row is unknown provenance, not proven extraction.
   */
  mechanicsSource: z
    .enum(["extracted", "derived", "brand_card", "founder"])
    .optional(),
})

export const ScopeFamilySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(8).max(500),
  seed_keywords: z.array(z.string().trim().min(2).max(100)).min(1).max(8),
  evidence: z.array(ScopeEvidenceSchema).max(5).default([]),
  capability_contract: CapabilityContractSchema.nullable().optional(),
  /**
   * Broader area this one is a sub-intent of, as judged at extraction.
   * Advisory: shown on the confirmation screen so the founder can merge or keep
   * it deliberately. Extraction emitting areas at inconsistent depth is what
   * produced areas too narrow to sustain a cluster.
   */
  parent_hint: z.string().trim().max(100).nullable().optional(),
  /** Resolved at confirm time from parent_hint; steers thin-domain absorption. */
  parent_scope_family_id: z.string().uuid().nullable().optional(),
  /**
   * extracted — read off the site by the scope model.
   * founder   — created from a target search the founder typed. Authoritative:
   *             the founder knows what they sell better than a crawler does.
   * user      — added or renamed by hand on the confirmation screen.
   */
  source: z.enum(["extracted", "founder", "user"]).default("extracted"),
  /**
   * Whether an exact quote from the crawled site backs this family.
   *
   * An unverified family is shown for confirmation, never silently deleted.
   * Deleting on a failed quote match cost real product areas: models paraphrase
   * when they quote, so the check was rejecting the wording, not the capability.
   */
  verified: z.boolean().default(true),
  priority: z.number().int().min(0).max(99).default(0),
  enabled: z.boolean().default(true),
})

export const BrandDetailsSchema = z.object({
  product_name: z.string(),
  product_identity: z.object({
    literally: z.string(),
    emotionally: z.string(),
    not: z.string(),
  }),
  mission: z.string(),
  audience: z.object({
    primary: z.string(),
    psychology: z.string(),
  }),
  enemy: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  category: z.string().optional().default(""),  // e.g., "Privacy-First Web Analytics"
  uvp: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  core_features: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  pricing: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  how_it_works: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  brand_keywords: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),  // Search keywords for competitor discovery
  /**
   * Confirmed commercial areas, not interchangeable keyword synonyms.
   * This is the positive scope contract used by the evidence audit.
   */
  scope_families: z.array(ScopeFamilySchema).max(12).default([]),
  /** Founder-supplied search direction captured before brand analysis. */
  target_seed_keywords: z.array(z.string().trim().min(2).max(100)).max(12).default([]),
  /**
   * The market the brand is measured in — ISO-3166 alpha-2.
   *
   * Load-bearing for the AI probe: Cloro takes a country per request and
   * defaults to `US`, so a brand without this is measured against American
   * answers whoever it sells to. `search_country` below is the Tavily string
   * for the same fact and is derived from this one — see lib/target-market.ts
   * for why one question feeds two formats.
   */
  target_region: z.string().trim().optional().default("US"),
  /** ISO-639-1. The language buyer questions are written in. */
  target_language: z.string().trim().optional().default("en"),
  search_country: z.string().optional().default(""),       // Tavily search country filter, e.g. "australia"
  search_topic: z.enum(["general", "news", "finance", "journal"]).optional().default("general"),
  article_length: z.enum(["short", "medium", "long", "very_long", "extra_long"]).optional().default("long"),
  image_style: z.string().optional().default("stock"),
  style_dna: z.union([
    z.string(),
    z.array(z.string()).transform((arr) => arr.join(" "))
  ]).optional().default(""),
})

export type BrandDetails = z.infer<typeof BrandDetailsSchema>
export type ScopeFamily = z.infer<typeof ScopeFamilySchema>
export type ScopeEvidence = z.infer<typeof ScopeEvidenceSchema>
export type CapabilityContract = z.infer<typeof CapabilityContractSchema>

