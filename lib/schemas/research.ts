import { z } from "zod"

export const CompetitorDataSchema = z.object({
  fact_sheet: z.array(z.string()),
  content_gap: z.object({
    missing_topics: z.array(z.string()),
    outdated_info: z.string().optional().default(""),
    user_intent_gaps: z.array(z.string()),
  }),
  sources_summary: z.array(z.object({ url: z.string().url(), title: z.string() })).optional().default([]),
})

export type CompetitorData = z.infer<typeof CompetitorDataSchema>