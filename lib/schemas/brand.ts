import { z } from "zod"

export const ScopeEvidenceSchema = z.object({
  url: z.string().url(),
  quote: z.string().min(8).max(500),
})

export const ScopeFamilySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(8).max(500),
  seed_keywords: z.array(z.string().trim().min(2).max(100)).min(1).max(8),
  evidence: z.array(ScopeEvidenceSchema).max(5).default([]),
  source: z.enum(["extracted", "user"]).default("extracted"),
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

