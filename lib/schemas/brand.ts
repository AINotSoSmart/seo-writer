import { z } from "zod"

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

