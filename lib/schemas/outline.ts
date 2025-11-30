import { z } from "zod"

export const ArticleOutlineSchema = z.object({
  title: z.string().min(3).max(200),
  intro: z.object({
    instruction_note: z.string().min(10).max(2000),
    keywords_to_include: z.array(z.string()).max(20),
  }),
  sections: z
    .array(
      z.object({
        id: z.number().int().positive(),
        heading: z.string().min(3).max(200),
        level: z.number().int().min(2).max(6).default(2),
        instruction_note: z.string().min(10).max(2000),
        keywords_to_include: z.array(z.string()).max(20),
      })
    )
    .min(1),
})

export type ArticleOutline = z.infer<typeof ArticleOutlineSchema>