import { z } from "zod"

export const AngleInsightsSchema = z.object({
  // Sub-questions users are also trying to answer — most reliable field, always try to populate
  fanout_intents: z.array(z.string()).max(5).default([]),

  // A pattern across the fact_sheet that no single source explicitly stated.
  // Only populated if 2+ data points support it. NULL if nothing genuine found.
  data_pattern: z.string().nullable().default(null),

  // A real caveat buried in user reviews/limitations. Must be evidence-based. NULL if not found.
  honest_tradeoff: z.string().nullable().default(null),

  // A reframing of the topic — only if conventional wisdom appears incomplete.
  // NOT a contrarian for shock value. NULL if topic is genuinely well-understood.
  unique_angle: z.string().nullable().default(null),

  // Alternative non-commodity title. Only if no user title AND a strong angle was found.
  // Offered as a suggestion to the outline AI — never a hard override.
  title_suggestion: z.string().nullable().default(null),
})

export type AngleInsights = z.infer<typeof AngleInsightsSchema>
