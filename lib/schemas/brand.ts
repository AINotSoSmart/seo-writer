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
  uvp: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  core_features: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  pricing: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  how_it_works: z.union([z.array(z.string()), z.string().transform(s => [s])]).default([]),
  image_style: z.string().optional().default("stock"),
  style_dna: z.union([
    z.string(),
    z.array(z.string()).transform((arr) => arr.join(" "))
  ]).optional().default(""),
})

export type BrandDetails = z.infer<typeof BrandDetailsSchema>

