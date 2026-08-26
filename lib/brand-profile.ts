/**
 * The onboarding brand-profile call: what the system decides a product IS.
 *
 * Split out of `app/api/analyze-brand/route.ts` for the reason stated at the
 * top of `lib/visibility/prompt-template.ts` — a prompt living inside a request
 * handler cannot be imported, so it cannot be exercised without a session, a
 * crawl and a stream. This one is the most consequential instruction in
 * onboarding: the scope families, the buyer questions and every downstream
 * measurement inherit whatever it decides, and a diagnostic harness that held a
 * COPY of it was measuring a prompt that had already drifted from production.
 */

import { getGeminiClient } from "@/utils/gemini/geminiClient"

/**
 * Was `gemini-3.1-flash-lite`. This runs once per onboarding and settles the
 * product's identity for every run that follows, which is the wrong place to
 * save a fraction of a cent.
 */
export const BRAND_PROFILE_MODEL = "gemini-3-flash-preview"

export function buildBrandProfilePrompt(
    url: string,
    combinedContent: string,
    targetSeeds: string[] = [],
): string {
    return `
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
      1. **Product Identity:** literally — ONE FULL SENTENCE naming concretely what it does and who for, specific enough that a competitor in an adjacent niche would not fit it; emotionally — the feeling it sells; not — what it is distinct from.
      2. **Category:** The short label a buyer would use for this kind of product, named the way this site names it. NOT an abstract industry bucket — "SaaS for Design", "Analytics Platform" and "Productivity Tool" are true of thousands of companies and describe none of them. Test it: if the category you wrote would equally fit a competitor selling something different, it is too broad. Do NOT repeat the Product Identity sentence here; that one is a sentence, this one is a label.
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
           "Starter — $49 / month — one workspace; five team members"
           "Business — $149 / month — unlimited projects; priority support"
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

      Extract into JSON format.`
}

export const BRAND_PROFILE_CONFIG = {

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
                  not: { type: "STRING" },
                },
                required: ["literally", "emotionally", "not"],
              },
              mission: { type: "STRING" },
              audience: {
                type: "OBJECT",
                properties: {
                  primary: { type: "STRING" },
                  psychology: { type: "STRING" },
                },
                required: ["primary", "psychology"],
              },
              enemy: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
              category: {
                type: "STRING",
                description: "Product category, e.g., 'Privacy-First Web Analytics'",
              },
              uvp: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Unique Value Propositions - detailed selling points",
              },
              core_features: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
              pricing: {
                type: "ARRAY",
                items: { type: "STRING" },
                description:
                  "One string per plan: name — $price / period — key perks. Not a vague model label.",
              },
              how_it_works: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
              brand_keywords: {
                type: "ARRAY",
                items: { type: "STRING" },
                description:
                  "4-5 short search keywords (2-4 words each) users would type to find this product type",
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
                      items: { type: "STRING" },
                    },
                    evidence: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          url: { type: "STRING" },
                          quote: { type: "STRING" },
                        },
                        required: ["url", "quote"],
                      },
                    },
                    source: { type: "STRING", enum: ["extracted"] },
                    priority: { type: "INTEGER" },
                    enabled: { type: "BOOLEAN" },
                  },
                  required: [
                    "name",
                    "description",
                    "seed_keywords",
                    "evidence",
                    "source",
                    "priority",
                    "enabled",
                  ],
                },
              },
              style_dna: {
                type: "STRING",
                description:
                  "Complete writing voice and style guide as a single paragraph covering perspective, tone, sentence style, formality, patterns, and words to avoid",
              },
            },
            required: [
              "product_name",
              "product_identity",
              "mission",
              "audience",
              "enemy",
              "category",
              "uvp",
              "core_features",
              "pricing",
              "how_it_works",
              "brand_keywords",
              "style_dna",
            ],
          },
} as const

/** One call. Returns the raw model text so the caller owns parsing and repair. */
export async function requestBrandProfile(
    url: string,
    combinedContent: string,
    targetSeeds: string[] = [],
): Promise<string> {
    const client = getGeminiClient()
    const response = await client.models.generateContent({
        model: BRAND_PROFILE_MODEL,
        contents: [
            {
                role: "user",
                parts: [{ text: buildBrandProfilePrompt(url, combinedContent, targetSeeds) }],
            },
        ],
        config: BRAND_PROFILE_CONFIG,
    })
    return response.text || ""
}
