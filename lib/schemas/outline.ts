import { z } from "zod"

// External link schema for section citations
export const ExternalLinkSchema = z.object({
  url: z.string(),
  anchor_context: z.string().describe("What concept should this link verify? e.g. 'The 2024 price increase'")
})

export const ArticleOutlineSchema = z.object({
  title: z.string().min(3).max(200),
  intro: z.object({
    instruction_note: z.string().min(10).max(2000),
    keywords_to_include: z.array(z.string()).max(20).default([]),
  }),
  sections: z
    .array(
      z.object({
        id: z.number().int().positive(),
        heading: z.string().min(3).max(200),
        level: z.number().int().min(2).max(6).default(2),
        instruction_note: z.string().min(10).max(2000),
        keywords_to_include: z.array(z.string()).max(20).default([]),
        // Optional external link to include in this section
        external_link: ExternalLinkSchema.nullable().optional(),
        // Optional internal link to include in this section
        internal_link: z.object({
          url: z.string(),
          title: z.string(),
          anchor_context: z.string().describe("Context for the link anchor"),
        }).nullable().optional(),
        /**
         * Does this section need real product knowledge to be written well?
         *
         * The section writer is given only the brand name and audience — it has
         * no features, no how-it-works, no pricing. That is why How-To steps
         * came out generic and comparison tables omitted our own tool: the
         * writer literally did not know how the product works. The outline
         * model DOES have the full brand context, so it marks which sections
         * need it and only those receive the relevant slice.
         */
        needs_product_detail: z.boolean().nullable().optional().transform(v => v ?? false),
        product_aspect: z
          .enum(['how_it_works', 'core_features', 'pricing', 'uvp'])
          .nullable()
          .optional(),
        /** True when this section contains a comparison the product must appear in. */
        is_comparison: z.boolean().nullable().optional().transform(v => v ?? false),
        // Optional: Should this section have an in-content image?
        needs_image: z.boolean().nullable().optional().transform(v => v ?? false),
        // Optional: Type of image if needs_image is true
        image_type: z.enum(['concept', 'how_to', 'comparison', 'process', 'insight']).nullable().optional(),
      })
    )
    .min(1),
})

export type ArticleOutline = z.infer<typeof ArticleOutlineSchema>
export type ExternalLink = z.infer<typeof ExternalLinkSchema>