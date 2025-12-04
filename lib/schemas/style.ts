import { z } from "zod"

export const StyleDNASchema = z.object({
  tone: z.string().min(1).max(100),
  sentence_structure: z.object({
    avg_length: z.enum(["short", "medium", "long", "varied"]),
    complexity: z.enum(["simple", "academic", "technical"]),
    use_of_questions: z.boolean(),
  }),
  narrative_rules: z.array(z.string()).max(50),
})

export type StyleDNA = z.infer<typeof StyleDNASchema>