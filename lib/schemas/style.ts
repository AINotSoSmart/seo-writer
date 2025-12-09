import { z } from "zod"

export const StyleDNASchema = z.object({
  // Core voice settings
  tone: z.string().min(1).max(200), // e.g., "Authoritative and data-driven"

  // Perspective: Who is speaking?
  perspective: z.enum(["first-person", "third-person", "brand-we", "neutral"]).optional().default("neutral"),

  // Formality level
  formality: z.enum(["casual", "professional", "formal", "academic"]).optional().default("professional"),

  // Sentence structure preferences
  sentence_structure: z.object({
    avg_length: z.enum(["short", "medium", "long", "varied"]),
    complexity: z.enum(["simple", "academic", "technical"]),
    use_of_questions: z.boolean(),
  }),

  // Custom narrative rules for this brand
  narrative_rules: z.array(z.string()).max(50),

  // Words/phrases to avoid
  avoid_words: z.array(z.string()).optional().default([]),
})

export type StyleDNA = z.infer<typeof StyleDNASchema>