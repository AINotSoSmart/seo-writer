import { NextRequest, NextResponse } from "next/server"
import { tavily } from "@tavily/core"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { jsonrepair } from "jsonrepair"
import {
  MAX_TOTAL_SCOPE_SEEDS,
  normalizeSeed,
  trimFamiliesToSearchCap,
  validateGroundedScope,
} from "@/lib/brand-scope"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
import {
  buildRankedBrandCorpus,
  extractScopeFamilies,
} from "@/lib/scope-extraction"

export const maxDuration = 300 // 5 minute timeout

/** Enough for homepage + pricing + a few product surfaces; 20 burned ~80s. */
const BRAND_CRAWL_LIMIT = 8
/** Escalate to advanced extract only when basic crawl is too thin. */
const THIN_CORPUS_CHARS = 1_500

const CRAWL_INSTRUCTIONS =
  "Prioritize the homepage (/), /pricing or /price, and product/feature/use-case/service pages. Deprioritize blog, news, careers, legal, login, and signup. Product scope and pricing matter more than writing-style samples."

type CrawledPage = { url: string; content: string }

function pagesFromCrawl(crawlResponse: unknown): CrawledPage[] {
  const raw = crawlResponse as { results?: unknown[]; data?: unknown[] }
  const results = raw.results || raw.data
  if (!results || !Array.isArray(results)) return []
  return results.map((page) => {
    const rawPage = page as Record<string, unknown>
    return {
      url: String(rawPage.url || ""),
      content: String(
        rawPage.rawContent ||
          rawPage.markdown ||
          rawPage.content ||
          "",
      ),
    }
  })
}

function totalContentChars(pages: CrawledPage[]): number {
  return pages.reduce((sum, page) => sum + (page.content?.trim().length || 0), 0)
}

export async function POST(req: NextRequest) {
  try {
    const { url, targetSeeds: rawTargetSeeds = [] } = await req.json()
    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 })
    }

    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Tavily API key not configured" }, { status: 500 })
    }

    const tvly = tavily({ apiKey })

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

    // Prefer basic extract first — advanced was the main wall-clock and credit
    // cost. Escalate once only when the first pass is too thin to ground scope.
    let crawlResponse = await tvly.crawl(url, {
      limit: BRAND_CRAWL_LIMIT,
      extractDepth: "basic",
      format: "markdown",
      instructions: CRAWL_INSTRUCTIONS,
    })
    let crawledPages = pagesFromCrawl(crawlResponse)
    if (totalContentChars(crawledPages) < THIN_CORPUS_CHARS) {
      crawlResponse = await tvly.crawl(url, {
        limit: BRAND_CRAWL_LIMIT,
        extractDepth: "advanced",
        format: "markdown",
        instructions: CRAWL_INSTRUCTIONS,
      })
      crawledPages = pagesFromCrawl(crawlResponse)
    }

    const combinedContent =
      buildRankedBrandCorpus(crawledPages) ||
      JSON.stringify(crawlResponse).slice(0, 20000)

    if (!combinedContent || combinedContent.length < 50) {
      return NextResponse.json({ error: "No content extracted from website" }, { status: 400 })
    }

    const client = getGeminiClient()

    const prompt = `
      You are an expert brand strategist and linguistic analyst. Analyze the following website content to extract a strategic brand identity and a robust writing style guide.
      
      Target Website: ${url}
      
      Website Content Samples (homepage, pricing, and product pages ranked first):
      ${combinedContent}

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
      8. **Pricing:** Extract the real plans visible on the pages. Do NOT summarize as only "Subscription", "One-time", or "Free tier".
         - When plan cards or pricing tables are visible, each pricing array item is ONE plan line:
           "Plan name — $price / period — key perk 1; key perk 2; key perk 3"
         - Copy dollar amounts and plan names from the page; never invent prices.
         - If the site only states a model with no dollar amounts, use one item like
           "Subscription — price not listed on crawled pages".
         - Worked examples:
           "Close — $249 / month — one cluster per period; finite six-cluster scope"
           "Accelerate — $449 / month — two clusters per period; same six-cluster scope"
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
              items: { type: "STRING" },
              description:
                "One string per plan: name — $price / period — key perks. Not a vague model label.",
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

    const scopedFamilies = trimFamiliesToSearchCap(grounded.families)

    const validated = BrandDetailsSchema.safeParse({
      ...brandData,
      scope_families: scopedFamilies,
      target_seed_keywords: targetSeeds,
    })
    if (!validated.success) {
      console.error("[Brand Analysis] Invalid response:", validated.error.flatten())
      return NextResponse.json(
        { error: "The website analysis returned an invalid business profile. Please retry." },
        { status: 422 },
      )
    }

    // Demand-checking seed keywords against Google Suggest is advisory only and
    // must never sit in this request's critical path — see the incident note
    // on findSeedsWithoutDemand in lib/harvest/query-validation.ts. The client
    // fetches it separately, after this response has already rendered, from
    // POST /api/analyze-brand/demand-check.
    return NextResponse.json({
      ...validated.data,
      scope_analysis_issues: grounded.issues,
      unassigned_target_seeds: grounded.unassignedTargetSeeds,
    })

  } catch (e: unknown) {
    console.error("Brand analysis error:", e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
