import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { ContentPlanItem } from "@/lib/schemas/content-plan"
import { BrandDetails } from "@/lib/schemas/brand"
import { validateArticleKeywords, expandKeyword } from "@/lib/plans/keyword-validator"

/**
 * Strategic Planner - Revamped content plan generation using mega-prompt approach.
 * 
 * Replaces the old 5-phase pipeline (Seeds → SERP → Gap → Hierarchy → Generator)
 * with a single strategic prompt that produces persona-driven, interconnected content.
 */

export interface StrategicPlanParams {
    brandData: BrandDetails
    brandUrl?: string
    competitorBrands: Array<{ name: string; url?: string }>
    existingContent?: string[]
    auditGaps?: Array<{ topic: string; importance: string; pillar: string; competitors_covering: string[] }>
    auditPillarSuggestions?: Array<{ suggested_title: string; key_sections: string[] }>
}

export interface StrategicPlanResult {
    plan: ContentPlanItem[]
    categoryDistribution: Record<string, number>
}

/**
 * Generate a strategic 30-day content plan using the mega-prompt approach.
 * This produces persona-driven, interconnected content plans instead of abstract keyword lists.
 */
/**
 * Gather real search queries from Google Autocomplete to seed the LLM.
 * This prevents the LLM from hallucinating keywords nobody actually searches.
 */
async function gatherAutocompleteSeed(brandData: BrandDetails): Promise<string[]> {
    // Build 3-5 seed phrases from brand identity
    const seedPhrases: string[] = []

    // From product identity ("literally" field is the plain-language description)
    const literally = brandData.product_identity?.literally || brandData.category || ''
    if (literally) {
        // Extract core noun phrases: "automated smart blinds" → ["smart blinds", "automated blinds"]
        const words = literally.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2)
        if (words.length >= 2) {
            seedPhrases.push(words.slice(0, 3).join(' '))
        }
        if (words.length >= 1) {
            seedPhrases.push(words[0])
        }
    }

    // From category
    if (brandData.category && !seedPhrases.includes(brandData.category.toLowerCase())) {
        seedPhrases.push(brandData.category.toLowerCase())
    }

    // From core features (take first 2 meaningful ones)
    if (Array.isArray(brandData.core_features)) {
        for (const feature of brandData.core_features.slice(0, 2)) {
            const cleaned = feature.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
            if (cleaned.length > 3 && cleaned.split(' ').length <= 4) {
                seedPhrases.push(cleaned)
            }
        }
    }

    // Deduplicate and limit
    const uniqueSeeds = [...new Set(seedPhrases)].slice(0, 5)

    if (uniqueSeeds.length === 0) {
        console.warn('[Autocomplete Seed] No seed phrases could be derived from brand data')
        return []
    }

    console.log(`[Autocomplete Seed] Expanding ${uniqueSeeds.length} seed phrases: ${uniqueSeeds.join(', ')}`)

    // Hit Google Autocomplete for each seed
    const allSuggestions: string[] = []
    for (const seed of uniqueSeeds) {
        try {
            const suggestions = await expandKeyword(seed)
            allSuggestions.push(...suggestions)
        } catch (e) {
            console.warn(`[Autocomplete Seed] Failed to expand "${seed}":`, e)
        }
    }

    // Also try question-form seeds: "how to [seed]", "best [seed]"
    const questionSeeds = uniqueSeeds.slice(0, 2).flatMap(s => [
        `how to ${s}`,
        `best ${s}`,
        `${s} vs`
    ])

    for (const qs of questionSeeds) {
        try {
            const suggestions = await expandKeyword(qs)
            allSuggestions.push(...suggestions)
        } catch (e) {
            // Non-blocking
        }
    }

    // Deduplicate and return
    const unique = [...new Set(allSuggestions)].slice(0, 40)
    console.log(`[Autocomplete Seed] Gathered ${unique.length} real search suggestions`)
    return unique
}

export async function generateStrategicPlan({
    brandData,
    brandUrl,
    competitorBrands = [],
    existingContent = [],
    auditGaps,
    auditPillarSuggestions
}: StrategicPlanParams): Promise<StrategicPlanResult> {
    const client = getGeminiClient()
    const today = new Date()
    const currentDate = `${today.toLocaleDateString('en-US', { month: 'long' })} ${today.getFullYear()}`

    // === GATHER REAL SEARCH DATA BEFORE GENERATION ===
    let autocompleteSuggestions: string[] = []
    try {
        autocompleteSuggestions = await gatherAutocompleteSeed(brandData)
    } catch (e) {
        console.warn('[Strategic Planner] Autocomplete seeding failed (non-blocking):', e)
    }

    // Format competitor section
    const competitorSection = competitorBrands.length > 0
        ? `## Known Competitors (Use for Comparison Articles)
${competitorBrands.slice(0, 10).map(c => `- ${c.name}${c.url ? ` (${c.url})` : ''}`).join('\n')}

Use EXACT competitor names in comparison articles. Create at least 2-3 "X vs Y" articles.`
        : `No specific competitors identified. Focus on generic comparison patterns like "AI vs Traditional".`

    // Format existing content section
    const existingContentSection = existingContent.length > 0
        ? `## Existing Content (DO NOT DUPLICATE)
The brand already has content on these topics:
${existingContent.slice(0, 20).map(c => `- ${c}`).join('\n')}

Create EXPANSION content, not duplicate coverage.`
        : ``

    // Format audit gaps section (if audit was performed)
    const auditGapsSection = auditGaps && auditGaps.length > 0
        ? `## CRITICAL: Authority Gap Analysis Results
A topical authority audit has identified these SPECIFIC content gaps that competitors cover but this brand does NOT.
PRIORITIZE creating articles that address these gaps, especially the CRITICAL ones:

${auditGaps.slice(0, 20).map(g => `- [${g.importance.toUpperCase()}] ${g.topic} (Pillar: ${g.pillar})${g.competitors_covering.length > 0 ? ` — ${g.competitors_covering.length} competitors cover this` : ''}`).join('\n')}

At least 60% of the 30 articles MUST directly address one of these gaps. The remaining articles can be supporting or conversion content.`
        : ``

    const pillarSuggestionsSection = auditPillarSuggestions && auditPillarSuggestions.length > 0
        ? `## Recommended Pillar Page Topics
The audit recommends these pillar pages. Create supporting articles that naturally link back to these pillar topics:
${auditPillarSuggestions.map(p => `- ${p.suggested_title} (Sections: ${p.key_sections.join(', ')})`).join('\n')}`
        : ``

    // Extract features for negative constraints
    const featureList = brandData.core_features || []

    const bannedTerms = [brandData.product_name, ...featureList].filter(Boolean)
    const bannedExamples = bannedTerms.slice(0, 3).map(t => `- "${t}" ← Brand feature (User doesn't know this name)`).join('\n')

    // Format autocomplete section
    const autocompleteSection = autocompleteSuggestions.length > 0
        ? `## REAL SEARCH QUERIES FROM GOOGLE AUTOCOMPLETE (PRIMARY KEYWORD SOURCE)
These are ACTUAL queries people type into Google right now. Use these as your PRIMARY source for main_keyword values.
You may adapt or extend them, but at least 70% of your main_keywords should come from or closely match these:

${autocompleteSuggestions.map(s => `- "${s}"`).join('\n')}

If you need keywords NOT on this list, they must still follow the natural query format shown above.`
        : ''

    const megaPrompt = `
## Context
You are analyzing a brand: ${brandData.product_name}
${brandUrl ? `Website: ${brandUrl}` : ''}
Current Date: ${currentDate}

## Brand Intelligence (HIGH-LEVEL ONLY)
- **Product:** ${brandData.product_name} - ${brandData.product_identity?.literally || brandData.category || 'Software'}
- **What it is (literally):** ${brandData.product_identity?.literally || brandData.category || 'Software'}
- **Category:** ${brandData.category || 'SaaS Software'}
- **Primary Audience:** ${brandData.audience?.primary || 'business professionals'}
- **The Problem We Solve (UVP):** ${Array.isArray(brandData.uvp) ? brandData.uvp.slice(0, 2).join(', ') : brandData.uvp}

## Internal Product Capabilities (Background Context ONLY)
*Use these to understand HOW we solve problems, but DO NOT use these names as keywords.*
${Array.isArray(brandData.core_features) ? brandData.core_features.join(', ') : brandData.core_features}

${autocompleteSection}

here are the competitor brands:
${competitorSection}

${auditGapsSection}

${pillarSuggestionsSection}

here is the existing content which is already been published by the brand:
${existingContentSection}

---

## Your Role
Senior SEO Strategist. Your goal: Create a 30-day content plan based on **REAL SEARCH QUERIES** users type into Google.

## CRITICAL: "Translate, Don't Repeat" Rule
The features listed above are **INTERNAL NAMES**. Users do not know them.
You MUST translate features into the **User Problem** they solve.

- ❌ **BAD (Feature-First):** "What is Anti-AI Filter?" (User doesn't know this exists)
- ✅ **GOOD (Problem-First):** "How to bypass AI detection" (The problem the filter solves)

---

## KEYWORD FORMAT RULES (MOST CRITICAL SECTION — READ CAREFULLY)

The main_keyword MUST be a query a real human would type into Google.

### ❌ KEYWORD-STUFFED (INSTANTLY REJECTED):
- "circadian rhythm smart home blinds" ← Nobody searches 5 jammed-together nouns
- "automated shades for light management" ← Corporate jargon, not a search
- "product strategic confusion assessment" ← Invented academic phrase
- "reduce handoff loss product engineering" ← Nobody types this
- "smart shades for seasonal depression" ← Keyword salad
- "scaling product value for growth" ← Buzzword soup
${bannedExamples}

### ✅ NATURAL SEARCH QUERIES (WHAT REAL PEOPLE TYPE):
- "do smart blinds help you sleep" ← Natural question
- "best smart blinds for bedroom" ← Simple shopping query
- "smart blinds vs regular blinds" ← Clean comparison
- "how to fix product strategy" ← Real problem search
- "why is my team not shipping" ← Real pain point
- "best AI headshot generator 2026" ← Time-stamped shopping query

### THE RULES:
1. **Maximum 5 words** for main_keyword. If you write 6+ words, you're keyword-stuffing.
2. Must sound like **natural speech** — read it aloud. Would you say this to a friend?
3. **Questions work great:** "how to...", "why does...", "is X worth it", "can you..."
4. **Shopping queries work:** "best X for Y", "X vs Y", "X cost 2026", "X reviews"
5. **No jargon stacking:** Don't combine 3+ technical terms into one keyword
6. **The Google test:** Paste your keyword into Google. If autocomplete suggests something DIFFERENT, use the autocomplete version instead.

---

## TITLE ≠ KEYWORD RULE (MANDATORY)

The title and main_keyword must NOT be the same string or a trivial rearrangement.
- **main_keyword** = what the user searches (short, plain, 2-5 words)
- **title** = a compelling headline that earns the click (can be longer, specific, opinionated)

❌ BAD (title IS the keyword):
- main_keyword: "smart window treatments for health" / title: "Smart Window Treatments for Health"
- main_keyword: "circadian rhythm smart home blinds" / title: "Circadian Rhythm & Smart Home Blinds"

✅ GOOD (title adds value beyond the keyword):
- main_keyword: "smart blinds for sleep" / title: "I Replaced My Bedroom Blinds—Here's How My Sleep Changed"
- main_keyword: "best smart blinds 2026" / title: "We Tested 5 Smart Blind Brands. Only 2 Were Worth It."

---

## The 4 Content Categories (Strict Distribution)

### 1. Core Answers (12 articles)
Educational "hub" content. Example queries:
- "what are smart blinds"
- "are AI headshots legal"
- "how long do AI headshots take"

### 2. Supporting Articles (8 articles)
Specific how-to guides and tips. Example queries:
- "how to install smart blinds"
- "best outfit for headshot"
- "how to smile naturally in photos"

### 3. Conversion Pages (6 articles)
Persona + comparison content. Example queries:
- "smart blinds for renters"
- "HeadshotPro vs Aragon"
- "best AI headshot for LinkedIn"

### 4. Authority Plays (4 articles)
Data-driven thought leadership. Example queries:
- "smart home statistics 2026"
- "do recruiters prefer professional photos"

---

## article_type: Choose Based on CONTENT, Not Category

**CRITICAL: You MUST use a MIX of all 3 article types.** Do NOT default everything to "informational".

| article_type | When to Use | Example Keywords |
|--------------|-------------|------------------|
| "informational" | Explains concepts, answers "what is", educational | "what are AI headshots", "are AI photos legal" |
| "howto" | Step-by-step guides, tutorials, "how to" content | "how to pose for headshot", "best lighting for photos" |
| "commercial" | Comparisons, alternatives, "best X", persona-specific buying guides | "best AI headshot generator", "Photoroom vs Aragon", "AI headshots for realtors" |

**REQUIRED DISTRIBUTION:** Your 30-article plan MUST include:
- 8-12 articles with article_type: "informational"
- 8-10 articles with article_type: "howto"
- 8-12 articles with article_type: "commercial"

---

## MANDATORY CONSTRAINTS

### 1. Title Length: MAXIMUM 60 CHARACTERS
- ❌ BANNED: "Data Study of Ten Thousand Users Shows That Authentic AI Photos Increase Recruiter Response by Forty Percent" (107 chars!)
- ✅ GOOD: "Do AI Photos Hurt Your LinkedIn Response Rate?" (46 chars)

### 2. NO Self-Promotional Content
- ❌ "What our customers say about us"
- ❌ "Why our money-back guarantee matters"
- ❌ "How [brand name] works"
- ✅ "How AI headshot generators work" (generic, educational)

### 3. Supporting Keywords: Provide 3-5 Related Queries
Each supporting_keyword must ALSO be a natural search query (2-5 words).

### 4. Impact Must Vary
- **High** (10 articles): Highest traffic potential, core topics
- **Medium** (15 articles): Supporting content
- **Low** (5 articles): Niche or experimental topics

### 5. Reason Field = STRATEGIC RATIONALE (Not the hook!)
- ❌ "Stop settling for rubbery skin..." (this is a hook)
- ✅ "High-volume query with low competition; establishes authority on core category question"

### 6. Connected_to = Article Day Numbers (Not titles)
Use integers: \`[1, 5, 12]\` not \`["day-1", "day-5"]\`

---

## Phased Rollout

- **Days 1-7 (Foundation):** Core category definitions, "what is X" content
- **Days 8-14 (Use-Case):** Persona-specific and problem-solving content
- **Days 15-21 (Technical):** How-to guides, process content
- **Days 22-30 (Trust):** Comparisons, alternatives, decision content

---

## Output Format

Return JSON with:
1. \`plan\`: Array of 30 articles

Each article schema:
\`\`\`json
{
  "day": 8,
  "phase": "Use-Case",
  "category": "Supporting Articles",
  "main_keyword": "how to pose for headshot",
  "supporting_keywords": ["headshot poses tips", "best pose professional photo", "linkedin photo poses"],
  "title": "5 Headshot Poses That Actually Look Natural",
  "hook": "Get camera-ready in 5 minutes",
  "reason": "High-traffic how-to query for users actively preparing to use the product",
  "user_intent": "Informational",
  "impact": "Medium",
  "connected_to": [1, 3, 12],
  "cluster": "Photo Tips",
  "article_type": "howto"
}
\`\`\`

**CRITICAL: Vary your article_type!**
- Use "informational" for educational/explanatory articles (8-12 total)
- Use "howto" for step-by-step guides and tutorials (8-10 total)
- Use "commercial" for comparisons, alternatives, and buying guides (8-12 total)

---

## FINAL CHECKLIST
Before finalizing, verify:
- [ ] ALL main_keywords are 2-5 words (NEVER 6+)
- [ ] ALL main_keywords sound like natural speech (read aloud test)
- [ ] NO main_keyword is the same as its title
- [ ] ALL titles are under 60 characters
- [ ] NO self-promotional content
- [ ] \`supporting_keywords\` has 3-5 items per article (also natural queries)
- [ ] \`reason\` explains strategy, NOT repeat the hook
- [ ] \`impact\` is properly distributed (10 High, 15 Medium, 5 Low)
- [ ] \`connected_to\` uses day numbers as integers
- [ ] At least 3 competitor comparison articles with real names
- [ ] At least 3 persona-specific articles
- [ ] article_type distribution: 8-12 informational, 8-10 howto, 8-12 commercial
`

    try {
        const response = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: megaPrompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        plan: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    day: { type: "INTEGER" },
                                    phase: { type: "STRING" },
                                    category: { type: "STRING" },
                                    main_keyword: { type: "STRING" },
                                    supporting_keywords: {
                                        type: "ARRAY",
                                        items: { type: "STRING" }
                                    },
                                    title: { type: "STRING" },
                                    hook: { type: "STRING" },
                                    reason: { type: "STRING" },
                                    user_intent: { type: "STRING" },
                                    impact: { type: "STRING" },
                                    connected_to: {
                                        type: "ARRAY",
                                        items: { type: "INTEGER" }
                                    },
                                    cluster: { type: "STRING" },
                                    article_type: { type: "STRING" }
                                },
                                required: ["day", "phase", "category", "main_keyword", "supporting_keywords", "title", "hook", "reason", "user_intent", "impact", "connected_to", "cluster", "article_type"]
                            }
                        }
                    },
                    required: ["plan"]
                }
            }
        })

        const text = response.text || "{}"
        const result = JSON.parse(text)

        // Transform raw plan into ContentPlanItem format
        let planItems: ContentPlanItem[] = (result.plan || []).map((item: any, index: number) => {
            const scheduledDate = new Date(today)
            scheduledDate.setDate(today.getDate() + (item.day - 1))

            return {
                id: `plan-${Date.now()}-${index}`,
                title: item.title || `Article ${index + 1}`,
                main_keyword: item.main_keyword || "",
                supporting_keywords: item.supporting_keywords || [],
                article_type: validateArticleType(item.article_type),
                cluster: item.cluster || "General",
                scheduled_date: scheduledDate.toISOString().split('T')[0],
                status: "pending" as const,
                // Strategic planner fields
                article_category: validateCategory(item.category),
                phase: validatePhase(item.phase),
                hook: item.hook || "",
                user_intent: validateUserIntent(item.user_intent),
                connected_to: (item.connected_to || []).map((d: number) => d), // Keep as integers
                // New fields from improved prompt
                impact: validateImpact(item.impact),
                reason: item.reason || "Strategic content for topic cluster authority."
            }
        })

        // === POST-GENERATION: VALIDATE KEYWORDS AGAINST GOOGLE AUTOCOMPLETE ===
        try {
            console.log(`[Strategic Planner] Validating ${planItems.length} keywords against Google Autocomplete...`)
            const validated = await validateArticleKeywords(planItems, true) // autoReplace = true
            const replacedCount = validated.filter(v => v.original_keyword).length
            const invalidCount = validated.filter(v => !v.keyword_validated && !v.original_keyword).length

            console.log(`[Strategic Planner] Keyword validation: ${replacedCount} auto-replaced, ${invalidCount} still unvalidated`)

            // Update plan items with validated/replaced keywords
            planItems = validated.map(({ keyword_validated, original_keyword, ...rest }) => rest) as ContentPlanItem[]
        } catch (validationError) {
            console.warn('[Strategic Planner] Keyword validation failed (non-blocking):', validationError)
            // Continue with unvalidated keywords — better than failing entirely
        }

        // Calculate distribution
        const categoryDistribution: Record<string, number> = {
            "Core Answers": 0,
            "Supporting Articles": 0,
            "Conversion Pages": 0,
            "Authority Plays": 0
        }
        for (const item of planItems) {
            const cat = item.article_category || "Core Answers"
            if (cat in categoryDistribution) {
                categoryDistribution[cat]++
            }
        }


        return {
            plan: planItems,
            categoryDistribution
        }

    } catch (error) {
        console.error("[Strategic Planner] Generation failed:", error)
        throw error
    }
}

// Validation helpers
function validateArticleType(type: string): "informational" | "commercial" | "howto" {
    const valid = ["informational", "commercial", "howto"]
    return valid.includes(type) ? type as any : "informational"
}

function validateCategory(category: string): "Core Answers" | "Supporting Articles" | "Conversion Pages" | "Authority Plays" {
    const valid = ["Core Answers", "Supporting Articles", "Conversion Pages", "Authority Plays"]
    return valid.includes(category) ? category as any : "Core Answers"
}

function validatePhase(phase: string): "Foundation" | "Use-Case" | "Technical" | "Trust" {
    const valid = ["Foundation", "Use-Case", "Technical", "Trust"]
    return valid.includes(phase) ? phase as any : "Foundation"
}

function validateUserIntent(intent: string): "Informational" | "Transactional" | "Commercial Investigation" {
    const valid = ["Informational", "Transactional", "Commercial Investigation"]
    return valid.includes(intent) ? intent as any : "Informational"
}

function validateImpact(impact: string): "High" | "Medium" | "Low" {
    const valid = ["High", "Medium", "Low"]
    return valid.includes(impact) ? impact as any : "Medium"
}

/**
 * Rejected item structure for replacement generation
 */
export interface RejectedItem {
    rejected_keyword: string
    rejected_title: string
    reason: string
    phase?: string
    category?: string
    cluster?: string
}

/**
 * Generate replacement articles for rejected duplicates.
 * This is called when the bouncer rejects items and we need replacements to hit 30 articles.
 */
export async function generateReplacementArticles({
    brandData,
    rejectedItems,
    existingPlanKeywords
}: {
    brandData: BrandDetails
    rejectedItems: RejectedItem[]
    existingPlanKeywords: string[] // Keywords from the verified plan so far
}): Promise<ContentPlanItem[]> {
    const client = getGeminiClient()
    const today = new Date()
    const count = rejectedItems.length

    if (count === 0) return []

    // Format rejected items with reasons for the LLM
    const rejectedList = rejectedItems.map((item, i) =>
        `${i + 1}. REJECTED: "${item.rejected_keyword}" (Title: "${item.rejected_title}")
   - Reason: ${item.reason}
   - Was in phase: ${item.phase || 'Unknown'}, category: ${item.category || 'Unknown'}, cluster: ${item.cluster || 'Unknown'}`
    ).join('\n\n')

    // Format existing plan keywords so LLM doesn't repeat them
    const existingList = existingPlanKeywords.slice(0, 30).map(k => `- ${k}`).join('\n')

    const replacementPrompt = `
## Context
You previously generated a content plan for: ${brandData.product_name}
${count} articles were REJECTED because they were too similar to existing content.

## REJECTED ARTICLES (DO NOT SUGGEST ANYTHING SIMILAR)
${rejectedList}

## ARTICLES ALREADY IN THE PLAN (DO NOT DUPLICATE)
${existingList}

## Your Task
Generate EXACTLY ${count} NEW, UNIQUE article ideas to replace the rejected ones.

CRITICAL RULES:
1. DO NOT suggest topics similar to the rejected ones - that's WHY they were rejected
2. DO NOT duplicate any keyword from "ARTICLES ALREADY IN THE PLAN"
3. Maintain the same phase/category/cluster distribution as the rejected items when possible
4. ALL keywords must be REAL search queries people actually type into Google
5. Titles MUST be under 60 characters
6. Choose article_type based on CONTENT:
   - "informational" for explanatory/educational content
   - "howto" for step-by-step guides and tutorials
   - "commercial" for comparisons, alternatives, and buying guides

## KEYWORD FORMAT RULES (CRITICAL)
- main_keyword MUST be 2-5 words maximum. NEVER 6+ words.
- Must sound like natural speech (read it aloud — would you say this to a friend?)
- main_keyword must NOT be the same as the title
- ❌ "automated shades for light management" ← keyword-stuffed jargon
- ✅ "best smart blinds" ← real search query

## Product Context (Quick Reference)
- Product: ${brandData.product_name}
- What it is: ${brandData.product_identity?.literally || brandData.category || 'Software'}
- Core Features: ${Array.isArray(brandData.core_features) ? brandData.core_features.join(', ') : brandData.core_features}

## Output Format
Return a JSON array of ${count} articles. Each article:
\`\`\`json
{
  "day": 15,
  "phase": "Technical",
  "category": "Supporting Articles",
  "main_keyword": "smile naturally in photos",
  "supporting_keywords": ["natural smile tips", "candid photo pose", "photo smile tricks"],
  "title": "5 Tricks for a Natural Smile in Photos",
  "hook": "Look confident, not awkward",
  "reason": "High-volume how-to query for photo preparation",
  "user_intent": "Informational",
  "impact": "Medium",
  "connected_to": [1, 5],
  "cluster": "Photo Tips",
  "article_type": "howto"
}
\`\`\`

Think of COMPLETELY DIFFERENT angles, topics, or audiences that the brand could target.
For example, if rejected topic was about "AI headshots vs professional photographer", suggest something completely unrelated like "best lighting for selfie photos" or "corporate headshot outfit guide for men".
`

    try {
        const response = await client.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: replacementPrompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            day: { type: "INTEGER" },
                            phase: { type: "STRING" },
                            category: { type: "STRING" },
                            main_keyword: { type: "STRING" },
                            supporting_keywords: {
                                type: "ARRAY",
                                items: { type: "STRING" }
                            },
                            title: { type: "STRING" },
                            hook: { type: "STRING" },
                            reason: { type: "STRING" },
                            user_intent: { type: "STRING" },
                            impact: { type: "STRING" },
                            connected_to: {
                                type: "ARRAY",
                                items: { type: "INTEGER" }
                            },
                            cluster: { type: "STRING" },
                            article_type: { type: "STRING" }
                        },
                        required: ["day", "phase", "category", "main_keyword", "supporting_keywords", "title", "hook", "reason", "user_intent", "impact", "connected_to", "cluster", "article_type"]
                    }
                }
            }
        })

        const text = response.text || "[]"
        const rawItems = JSON.parse(text)

        // Transform to ContentPlanItem format
        let replacements: ContentPlanItem[] = rawItems.map((item: any, index: number) => {
            const scheduledDate = new Date(today)
            scheduledDate.setDate(today.getDate() + (item.day - 1))

            return {
                id: `replacement-${Date.now()}-${index}`,
                title: item.title || `Replacement Article ${index + 1}`,
                main_keyword: item.main_keyword || "",
                supporting_keywords: item.supporting_keywords || [],
                article_type: validateArticleType(item.article_type),
                cluster: item.cluster || "General",
                scheduled_date: scheduledDate.toISOString().split('T')[0],
                status: "pending" as const,
                article_category: validateCategory(item.category),
                phase: validatePhase(item.phase),
                hook: item.hook || "",
                user_intent: validateUserIntent(item.user_intent),
                connected_to: (item.connected_to || []).map((d: number) => d),
                impact: validateImpact(item.impact),
                reason: item.reason || "Replacement article for deduplicated content."
            }
        })

        // === POST-GENERATION: VALIDATE REPLACEMENT KEYWORDS TOO ===
        try {
            const validated = await validateArticleKeywords(replacements, true)
            const replacedCount = validated.filter(v => v.original_keyword).length
            if (replacedCount > 0) {
                console.log(`[Replacement Generator] Keyword validation: ${replacedCount} keywords auto-replaced`)
            }
            replacements = validated.map(({ keyword_validated, original_keyword, ...rest }) => rest) as ContentPlanItem[]
        } catch (e) {
            console.warn('[Replacement Generator] Keyword validation failed (non-blocking):', e)
        }

        console.log(`[Replacement Generator] Generated ${replacements.length} replacement articles`)
        return replacements

    } catch (error) {
        console.error("[Replacement Generator] Failed:", error)
        throw error
    }
}
