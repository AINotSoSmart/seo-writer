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
  enemy: z.array(z.string()),
  voice_tone: z.array(z.string()),
  uvp: z.array(z.string()),
  core_features: z.array(z.string()),
  pricing: z.array(z.string()),
  how_it_works: z.array(z.string()),
})

export type BrandDetails = z.infer<typeof BrandDetailsSchema>
