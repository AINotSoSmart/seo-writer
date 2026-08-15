import { z } from "zod"

export const ResearchEvidenceSchema = z.object({
  id: z.string().min(1),
  quote: z.string().min(1),
  url: z.string().url(),
  sourceTitle: z.string().min(1),
  supportsIntentIds: z.array(z.string()).min(1),
  kind: z.enum(["definition", "fact", "step", "comparison", "limitation"]),
  sourceKind: z.enum(["independent", "known_competitor"]),
})

export const CompetitorDataSchema = z.object({
  evidence: z.array(ResearchEvidenceSchema).max(12).default([]),
  sources_summary: z.array(z.object({ url: z.string().url(), title: z.string() })).max(12).default([]),
  limitations: z.array(z.string()).max(3).default([]),
  fact_sheet: z.array(z.object({ fact: z.string(), url: z.string().url() })).default([]),
  content_gap: z.object({
    missing_topics: z.array(z.string()).default([]),
    outdated_info: z.string().default(""),
    user_intent_gaps: z.array(z.string()).default([]),
  }).default({ missing_topics: [], outdated_info: "", user_intent_gaps: [] }),
  product_matrix: z.array(z.any()).default([]),
  step_sequence: z.array(z.any()).default([]),
  prerequisites: z.array(z.string()).default([]),
  authority_links: z.array(z.object({
    url: z.string().url(), title: z.string(), snippet: z.string().default(""),
  })).default([]),
})

export type ResearchEvidence = z.infer<typeof ResearchEvidenceSchema>
export type CompetitorData = z.infer<typeof CompetitorDataSchema>
