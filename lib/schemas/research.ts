import { z } from "zod"

// Product info for commercial/comparison articles
export const ProductMatrixItemSchema = z.object({
  name: z.string(),
  price: z.string().optional().default("Unknown"),
  pros: z.array(z.string()).optional().default([]),
  cons: z.array(z.string()).optional().default([]),
  unique_selling_point: z.string().optional().default(""),
  best_for: z.string().optional().default("")
})

// Step info for how-to/tutorial articles
export const StepSequenceItemSchema = z.object({
  step: z.number(),
  title: z.string(),
  details: z.string(),
  pro_tip: z.string().optional()
})

// Authority link for external citations
export const AuthorityLinkSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string().optional().default("")
})

export const CompetitorDataSchema = z.object({
  fact_sheet: z.array(z.string()),
  content_gap: z.object({
    missing_topics: z.array(z.string()),
    outdated_info: z.string().optional().default(""),
    user_intent_gaps: z.array(z.string()),
  }),
  sources_summary: z.array(z.object({ url: z.string().url(), title: z.string() })).optional().default([]),
  // For commercial/comparison articles
  product_matrix: z.array(ProductMatrixItemSchema).optional().default([]),
  // For how-to/tutorial articles
  step_sequence: z.array(StepSequenceItemSchema).optional().default([]),
  prerequisites: z.array(z.string()).optional().default([]),
  // Authority links for external citations (high-quality, non-competitor URLs)
  authority_links: z.array(AuthorityLinkSchema).optional().default([]),
})

export type CompetitorData = z.infer<typeof CompetitorDataSchema>
export type ProductMatrixItem = z.infer<typeof ProductMatrixItemSchema>
export type StepSequenceItem = z.infer<typeof StepSequenceItemSchema>