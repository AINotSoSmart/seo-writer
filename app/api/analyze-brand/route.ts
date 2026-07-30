import { NextRequest, NextResponse } from "next/server"
import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { jsonrepair } from "jsonrepair"
import {
  MAX_TOTAL_SCOPE_SEEDS,
  normalizeSeed,
  validateGroundedScope,
} from "@/lib/brand-scope"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
import { extractScopeFamilies } from "@/lib/scope-extraction"
import { findSeedsWithoutDemand } from "@/lib/harvest/query-validation"

export const maxDuration = 300 // 5 minute timeout

export async function POST(req: NextRequest) {
  try {
    const { url, targetSeeds: rawTargetSeeds = [] } = await req.json()
    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 })
    }

    // 1. Crawl with Tavily SDK
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Tavily API key not configured" }, { status: 500 })
    }


    const tvly = tavily({ apiKey })

    // Note: crawl returns a promise that resolves when the crawl is complete (sync mode implied by SDK types or it handles polling)
    // Based on docs, it returns TavilyCrawlResponse
    const targetSeeds = Array.from(
      new Set(
        (Array.isArray(rawTargetSeeds) ? rawTargetSeeds : [])
          .map((seed: unknown) => normalizeSeed(String(seed)))
          .filter(Boolean),
      ),
    )
    if (targetSeeds.length > MAX_TOTAL_SCOPE_SEEDS) {
      return NextResponse.json(
        {
          error: `Add no more than ${MAX_TOTAL_SCOPE_SEEDS} main customer searches.`,
        },
        { status: 400 },
      )
    }

    const crawlResponse = await tvly.crawl(url, {
      limit: 20,
      extractDepth: "advanced",
      format: "markdown",
      instructions: "Find the homepage and every product, service, tool, use-case, feature, pricing, comparison, about, and navigation-linked page. Product scope is more important than blog coverage. Include a small blog sample only for writing style."
    })

    // Aggregate content
    let combinedContent = ""
    const crawledPages: Array<{ url: string; content: string }> = []
    // @ts-ignore - SDK types might be slightly off, checking results property
    const results = crawlResponse.results || crawlResponse.data

    if (results && Array.isArray(results)) {
      for (const page of results) {
        const rawPage = page as any
        crawledPages.push({
            url: String(page.url || ""),
            content: String(
                page.rawContent ||
                    rawPage.markdown ||
                    rawPage.content ||
                    "",
            ),
        })
      }
      combinedContent = results.map((page: any) => `
---
URL: ${page.url}
Title: ${page.title || 'No Title'}
Content:
${page.rawContent || page.markdown || page.content || ''}
---
`).join("\n")
    } else {
      // Fallback dump
      combinedContent = JSON.stringify(crawlResponse).slice(0, 20000)
    }

    if (!combinedContent || combinedContent.length < 50) {
      return NextResponse.json({ error: "No content extracted from website" }, { status: 400 })
    }

    // 2. Analyze with Gemini
    const client = getGeminiClient()

    const prompt = `
      You are an expert brand strategist and linguistic analyst. Analyze the following website content to extract a strategic brand identity and a robust writing style guide.
      
      Target Website: ${url}
      
      Website Content Samples:
      ${combinedContent.slice(0, 50000)}

      Founder-provided target searches (authoritative direction, if any):
      ${targetSeeds.length ? targetSeeds.map((seed) => `- ${seed}`).join("\n") : "- None supplied"}
      
      ## CRITICAL: NOISE FILTERING RULES
      Before analyzing, you MUST filter out the following "noise" frequently found on websites:
      1. **Personal Footers:** Ignore phrases like "Made with ☕️ by...", "Built by...", or personal thank-you notes.
      2. **Transient Social Proof:** Ignore specific numbers that change (e.g., "Loved by 10,000+ users", "Joined by 500 people today"). Focus on the *fact* that they use social proof, not the numbers.
      3. **Boilerplate:** Ignore standard footer links, copyright notices, and "Something missing? Suggest features" type of transient UI text.
      
      ## EXTRACTION GUIDE:
      1. **Product Identity:** What is it literally (tool category), emotionally (the feeling), and what is it NOT (distinction).
      2. **Category:** A professional industry category (e.g., "SaaS for X", "E-commerce for Y").
      3. **Mission:** The core "Why".
      4. **Audience:** Not just "users", but the specific psychology and role (e.g., "Overwhelmed small business owners looking for speed").
      5. **Enemy:** What philosophical or practical problem is this product fighting (e.g., "Complexity", "Slow data", "High costs").
      6. **Unique Value Proposition:** 3-5 distinct, permanent selling points.
      7. **Core Features (The "Fixes"):** List permanent product capabilities, not transient UI features.
      8. **Pricing:** High-level model (Subscription, One-time, Free tier).
      9. **Brand Keywords:** Generate 4-5 SHORT search keywords (2-4 words each) that represent what a user would type into Google to find this type of product. NOT the brand name, NOT full sentences — just the search terms. Example: for a photo restoration app, keywords might be: "ai photo restoration", "restore old photos", "fix damaged photos", "old photo animation", "family photo repair".
      10. **Style DNA (ROBUST LINGUISTIC GUIDE):**
         Create a SINGLE paragraph that defines the LINGUISTIC STYLE. 
         - **Perspective:** (e.g., Second-person addressing user, first-person plural for brand).
         - **Rhetorical Patterns:** (e.g., Do they lead with benefits? Use rhetorical questions? Use active/command verbs?).
         - **Vocabulary:** Describe the "vibe" of their words (e.g., "Outcome-oriented, minimalist, devoid of abstract fluff").
         - **Formality:** Conversational vs Corporate vs Technical.
         - **STRICT RULE:** DO NOT copy-paste specific strings from the website (like "Made with coffee"). Instead, define the *pattern* (e.g., "Uses personal, approachable touches in non-core areas").
      
      Example style_dna:
      "The voice is direct, minimalist, and outcome-oriented. It adopts a conversational yet confident tone, using a second-person perspective ('you') to drive action while referring to the brand as 'we'. Sentences are punchy and start with command verbs. It avoids all corporate 'fluff' and abstract mission-speak, favoring instead clear, benefit-driven headlines and data-backed claims. The writing uses personal, approachable micro-copy to build community trust without losing professional authority."

      Extract into JSON format.
    `

    // Commercial scope is extracted by its own focused call (lib/scope-extraction.ts).
    // Started before the persona call and awaited after, so the split costs a
    // few thousand tokens and no wall-clock time.
    const scopePromise = extractScopeFamilies(url, crawledPages, targetSeeds)

    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            product_name: { type: "STRING" },
            product_identity: {
              type: "OBJECT",
              properties: {
                literally: { type: "STRING" },
                emotionally: { type: "STRING" },
                not: { type: "STRING" }
              },
              required: ["literally", "emotionally", "not"]
            },
            mission: { type: "STRING" },
            audience: {
              type: "OBJECT",
              properties: {
                primary: { type: "STRING" },
                psychology: { type: "STRING" }
              },
              required: ["primary", "psychology"]
            },
            enemy: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            category: {
              type: "STRING",
              description: "Product category, e.g., 'Privacy-First Web Analytics'"
            },
            uvp: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Unique Value Propositions - detailed selling points"
            },
            core_features: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            pricing: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            how_it_works: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            brand_keywords: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "4-5 short search keywords (2-4 words each) users would type to find this product type"
            },
            scope_families: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  description: { type: "STRING" },
                  seed_keywords: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                  },
                  evidence: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        url: { type: "STRING" },
                        quote: { type: "STRING" }
                      },
                      required: ["url", "quote"]
                    }
                  },
                  source: { type: "STRING", enum: ["extracted"] },
                  priority: { type: "INTEGER" },
                  enabled: { type: "BOOLEAN" }
                },
                required: ["name", "description", "seed_keywords", "evidence", "source", "priority", "enabled"]
              }
            },
            style_dna: {
              type: "STRING",
              description: "Complete writing voice and style guide as a single paragraph covering perspective, tone, sentence style, formality, patterns, and words to avoid"
            }
          },
          required: ["product_name", "product_identity", "mission", "audience", "enemy", "category", "uvp", "core_features", "pricing", "how_it_works", "brand_keywords", "style_dna"]
        }
      }
    })

    // Fix: response.text is a getter in newer SDKs, not a method
    const text = response.text || ""
    let brandData: any = {}
    try {
      brandData = JSON.parse(text || "{}")
    } catch (e) {
      console.warn("Brand analysis JSON parse failed, trying repair:", e)
      try {
        brandData = JSON.parse(jsonrepair(text || "{}"))
      } catch (e2) {
        console.error("Critical Brand Analysis JSON parse failure:", e2)
        throw new Error("Failed to parse brand analysis results")
      }
    }

    let extractedFamilies
    try {
      extractedFamilies = await scopePromise
    } catch (scopeError) {
      console.error("[Brand Analysis] Scope extraction failed:", scopeError)
      return NextResponse.json(
        { error: "We could not read what your website sells. Please retry." },
        { status: 422 },
      )
    }

    const grounded = validateGroundedScope(
      extractedFamilies,
      crawledPages,
      url,
      targetSeeds,
    )
    if (grounded.families.length === 0) {
      return NextResponse.json(
        {
          error:
            grounded.issues[0]?.message ||
            "We could not identify what this website sells. Please retry, or add your main customer searches so we can start from those.",
          scopeIssues: grounded.issues,
        },
        { status: 422 },
      )
    }

    const validated = BrandDetailsSchema.safeParse({
      ...brandData,
      scope_families: grounded.families,
      target_seed_keywords: targetSeeds,
    })
    if (!validated.success) {
      console.error("[Brand Analysis] Invalid response:", validated.error.flatten())
      return NextResponse.json(
        { error: "The website analysis returned an invalid business profile. Please retry." },
        { status: 422 },
      )
    }

    // Advisory only, and free — Google Suggest, not a paid API. A product area
    // whose phrases nobody searches is a mispositioning, and it is far cheaper
    // to say so here than to discover it in a delivered content plan.
    const seedsWithoutDemand = await findSeedsWithoutDemand(
      grounded.families.flatMap((family) => family.seed_keywords),
    )

    return NextResponse.json({
      ...validated.data,
      scope_analysis_issues: grounded.issues,
      unassigned_target_seeds: grounded.unassignedTargetSeeds,
      seeds_without_demand: seedsWithoutDemand,
    })

  } catch (e: unknown) {
    console.error("Brand analysis error:", e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
