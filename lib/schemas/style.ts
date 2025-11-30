import { z } from "zod"

export const StyleDNASchema = z.object({
  tone: z.string().min(1).max(100),
  sentence_structure: z.object({
    avg_length: z.enum(["short", "medium", "long", "varied"]),
    complexity: z.enum(["simple", "academic", "technical"]),
    use_of_questions: z.boolean(),
  }),
  formatting: z.object({
    use_bullet_points: z.enum(["frequent", "rare", "never"]),
    header_style: z.enum(["declarative", "clickbaity", "question-based"]),
    bold_key_phrases: z.boolean(),
  }),
  vocabulary: z.object({
    level: z.enum(["Grade 8", "Grade 12", "PhD"]),
    jargon_usage: z.enum(["heavy", "minimal", "explained"]),
    forbidden_words: z.array(z.string()).max(50),
  }),
  narrative_rules: z.array(z.string()).max(50),
})

export type StyleDNA = z.infer<typeof StyleDNASchema>