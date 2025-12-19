import { task } from "@trigger.dev/sdk/v3"
import { tavily } from "@tavily/core"
import { createAdminClient } from "@/utils/supabase/admin"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { CompetitorDataSchema } from "@/lib/schemas/research"
import { ArticleOutlineSchema } from "@/lib/schemas/outline"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
import { marked } from "marked"
import { generateImage } from "@/lib/fal"
import { putR2Object } from "@/lib/r2"
import { randomUUID } from "crypto"
import { jsonrepair } from "jsonrepair"
import { ArticleType } from "@/lib/prompts/article-types"
import { getArticleStrategy } from "@/lib/prompts/strategies"
import { getFormalityDefinition, getPerspectiveDefinition } from "@/lib/prompts/voice-definitions"
import { getCurrentDateContext } from "@/lib/utils/date-context"
import { getRelevantInternalLinks } from "@/lib/internal-linking"

const cleanAndParse = (text: string) => {
  const clean = text.replace(/```json/g, "").replace(/```/g, "")
  try {
    return JSON.parse(clean)
  } catch (e) {
    try {
      return JSON.parse(jsonrepair(clean))
    } catch (e2) {
      console.error("JSON Parse Failed. Original:", text, "Error:", e2)
      throw new Error("Failed to parse JSON from LLM response")
    }
  }
}

// Self-correcting JSON parser with Zod validation retry
const cleanParseAndValidate = async <T>(
  text: string,
  schema: { parse: (data: unknown) => T },
  genAI: any,
  maxRetries: number = 2
): Promise<T> => {
  const parsed = cleanAndParse(text)

  try {
    return schema.parse(parsed)
  } catch (zodError: any) {
    if (maxRetries <= 0) {
      console.error("Zod validation failed after retries:", zodError)
      throw zodError
    }

    console.log(`[Self-Correction] Zod validation failed, asking Gemini to fix. Retries left: ${maxRetries}`)

    // Feed the error and invalid JSON back to Gemini to fix
    const fixPrompt = `
The following JSON failed Zod schema validation:

=== INVALID JSON ===
${JSON.stringify(parsed, null, 2)}

=== VALIDATION ERROR ===
${zodError.message || JSON.stringify(zodError.errors || zodError)}

=== YOUR TASK ===
Fix the JSON to match the required schema. Return ONLY the corrected JSON, no explanations.
Make sure all required fields are present and have the correct types.
`

    const fixResponse = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      config: { responseMimeType: "application/json" },
      contents: [{ role: "user", parts: [{ text: fixPrompt }] }]
    })

    const fixedText = fixResponse.text || ""
    console.log(`[Self-Correction] Gemini returned fixed JSON, attempting to parse...`)

    // Recursively try to parse and validate the fixed JSON
    return cleanParseAndValidate(fixedText, schema, genAI, maxRetries - 1)
  }
}


// Clients will be initialized inside the task


// --- Prompts & Rules from Blueprint ---

const AUTHENTIC_WRITING_RULES = `
### CORE FORMATTING & STYLE (STRICT ENFORCEMENT)

**SCANNABILITY & STRUCTURE:**
1. Assume readers will NOT read full paragraphs. The core message must be understandable at a glance.
2. **BOLD** the important points as required for good seo practice. Use bullet points to break up concepts.
3. Keep paragraphs under 3-4 sentences. One idea per paragraph.
4. Every line must EARN its place. If a sentence doesn't serve a critical purpose, DELETE IT, be ruthless.

**SENTENCE VARIATION (BURSTINESS) - CRITICAL FOR HUMAN FEEL:**
5. Mix sentence lengths dramatically: some very short (7-9 words), some longer (20-30 words).
6. Infuse genuine emotional undertones appropriate to the content using active voice.
7. Start sentences with different elements: adverbs, prepositional phrases, dependent clauses, questions
8. Occasional sentence fragments are OK if they add punch. "Not always. But often."

**ACTIVE VOICE & DIRECTNESS:**
9. USE ACTIVE VOICE. "Management canceled the meeting" NOT "The meeting was canceled by management."
10. Be direct strictly. "Call me at 3pm." NOT "I was wondering if you might be available for a call."
11. Use certainty when you ARE certain. "This approach improves results." NOT "This approach might improve results."
12. Add personal opinions, hesitations, or qualifiers ("I believe," "perhaps," "it seems")
13. Use contractions and colloquialisms when appropriate

**NO AI-FILLER PHRASES (CRITICAL):**
12. **BANNED STARTERS:** "Let's dive in", "Let's be honest", "here's the truth", "Let's explore", "In today's digital age", "You know that gut-wrenching feeling", "In this article we will", "It goes without saying", "As we navigate"
14. **BANNED PHRASES:** "cutting-edge", "leverage", "streamline", "take your X to the next level", "unparalleled", "revolutionize"
15. **BANNED WORDS:** "delve", "unleash", "landscape", "tapestry", "game-changer", "realm", "bustling", "elevate", "harness", "robust"
16. Instead of: "Let's explore this fascinating opportunity" → Say: "This opporunity is fascinating."

**SPECIFICITY & AUTHENTICITY:**
17. Use SPECIFIC, CONCRETE details. "Saves 2 hours per week" NOT "saves time."
18. Avoid generic statements. "The project failed because the API timed out" NOT "The project had issues."
19. If something has problems, SAY IT. "This approach has problems." Be real.

**STRUCTURAL PATTERN DISRUPTION:**
20. Don't always follow fixed template, sometimes start mid-thought.
21. Include natural digressions if they add value. "(this also works for X.)"
22. Use varied paragraph lengths. Some can be one-two sentences. Others 3-5.
23. Break conventional grammar rules occasionally in natural ways, make a little mistakes to avoid detection

**PERSPECTIVE REMINDER:**
24. **AUTHENTIC PERSPECTIVE:** Write with authority. Avoid passive voice ("It is said that..."). Use the perspective (I/We/Brand) defined in the Narrative Rules.
`

// Type-specific intro templates
const INTRO_TEMPLATES: Record<string, string> = {
  informational: `
GOAL: Write an "Authority-Backed Answer" intro. 
You must satisfy the user's intent within the first 2 sentences (AI Snippet Optimized) while immediately establishing Trust (EEAT).

**THE INGREDIENTS (You must mix these dynamically):**
1. **The Direct Answer (BLUF):** Define the concept, answer the question, or state the core reality immediately. No fluff.
2.  **The Trust Anchor:** Cite *why* this answer is true. Use phrases like "Based on 2024 analysis...", "Contrary to popular belief...", "In our experience testing X...".
3. **The Value Proposition:** What specific problem will this guide solve?

**DYNAMIC RULES (Do NOT use the same formula every time):**
- **Option A (The Expert Correction):** Start with a common misconception, then immediately correct it with facts.
  *Example:* "Many believe X is Y. However, our data shows X is actually Z. This guide explains why."
- **Option B (The Direct Definition):** Start with the answer, then back it up with context.
  *Example:* "X is the process of Y. While simple in theory, 90% of failures happen at stage Z."
- **Option C (The Data Hook):** Start with a startling statistic or fact that anchors the article.

**NEGATIVE CONSTRAINTS:**
- NO "In this article" or "Let's dive in".
- NO dictionary definitions ("Webster defines...").
- NO rhetorical questions ("Have you ever wondered?").
`,

  commercial: `
GOAL: Write a "Verdict with Proof" intro. 
Commercial intent users want to know the *best* choice immediately. Do not bury the lead.

**THE INGREDIENTS (You must mix these dynamically):**
1. **The Verdict:** If there is a clear winner, NAME IT immediately. If it's a tie, name the top 2.
2. **The Trust Anchor:** You MUST establish that you have actually tested/analyzed these tools.
   *Required Phrase Vibe:* "We tested 15 tools...", "After analyzing the top 5...", "Our benchmark revealed..."
3. **The User Filter:** Who is this for? (e.g. "Best for enterprise, but overkill for startups").

**DYNAMIC RULES (Do NOT use the same formula every time):**
- **Option A (The Hard Verdict):** Name the winner instantly.
  *Example:* "Slack is the best team chat app for large orgs, period. But for small teams, Discord might be better."
- **Option B (The Testing Story):** Start with the *scale* of your research.
  *Example:* "We spent 40 hours testing every major AI writer. Only 3 passed our hallucination check."
- **Option C (The 'One Thing' Filter):** Start with the single most important buying factor.
  *Example:* "If you need X, you only have two real options: A and B. Everything else is a compromise."

**NEGATIVE CONSTRAINTS:**
- NO "Choosing the right tool is hard".
- NO "There are many options on the market".
- NO generic summaries. Be specific.
`,

  howto: `
GOAL: Write an "Efficiency Promise" intro.
The user wants to do the task *fast* and without *errors*.

**THE INGREDIENTS (You must mix these dynamically):**
1. **The Efficiency Mechanism:** What is the "secret sauce" or specific method? (e.g. "Using the XYZ shortcut").
2. **The Result/Benefit:** "This saves 2 hours" or "This prevents the common crash error".
3. **The Ease of Access:** "You don't need expert skills, just..."

**DYNAMIC RULES (Do NOT use the same formula every time):**
- **Option A (The Shortcut):** Start with the trick that makes it easy.
  *Example:* "You don't need Photoshop to remove backgrounds. The fastest way is actually using..."
- **Option B (The 'Stop Doing It Wrong' Angle):** Warn against the slow/bad way first.
  *Example:* "Stop using the manual export function. It degrades quality. Instead, use the..."
- **Option C (The Outcome First):** Describe the perfect end state.
  *Example:* "To get a perfect standard deviation calculation, you need to set up your formula like this..."

**NEGATIVE CONSTRAINTS:**
- NO "In this tutorial we will show you".
- NO "Have you ever wanted to...".
- NO false empathy ("We know it's frustrating").
`
}

// Helper to get intro template by article type
const getIntroTemplate = (articleType: ArticleType): string => {
  return INTRO_TEMPLATES[articleType] || INTRO_TEMPLATES.informational
}

// --- PHASE 2 HELPER: "The Critic" Gap Analysis Prompt ---
const getCriticGapPrompt = (keyword: string, articleType: ArticleType, broadContext: string) => {
  const strategy = getArticleStrategy(articleType)

  return `
You are a ruthless Research Critic. ${getCurrentDateContext()}

I have gathered initial search results for the keyword: "${keyword}"

YOUR TASK:
Analyze this research data and identify EXACTLY what is MISSING that we need to write a winning article.

**ARTICLE TYPE: ${articleType.toUpperCase()}**
${strategy.research_focus}

THINK LIKE A CRITIC:
- "I see features, but where is the 2025 pricing?"
- "They mention customer support, but is it 24/7 or email-only?"
- "Where are the real user reviews? This is all marketing fluff."
- "What specific statistics or benchmarks are missing?"
- "Are there competitor comparisons that should exist but don't?"

=== INITIAL RESEARCH DATA ===
${broadContext}

OUTPUT (Strict JSON):
Return EXACTLY 3-5 highly specific search queries that will fill these gaps.
Be SPECIFIC - not "best CRM" but "Salesforce pricing 2025" or "HubSpot vs Pipedrive user reviews reddit"

{
  "gap_analysis": string,  // Brief description of what's missing
  "targeted_queries": string[]  // 3-5 SPECIFIC search queries to fill gaps
}
`
}

// --- PHASE 2 HELPER: Final Synthesis Prompt ---
const getSynthesisPrompt = (articleType: ArticleType, keyword: string) => {
  const strategy = getArticleStrategy(articleType)

  return `
You are an expert SEO Strategist and Data Analyst. ${getCurrentDateContext()}

I will provide you with TWO sets of research data:
1. BROAD LANDSCAPE DATA - General information from top search results
2. DEEP DIVE DATA - Specific gap-filling information we hunted down

YOUR GOAL:
Combine these into ONE comprehensive "Research Brief" that allows us to write a better article than all competitors combined.

**KEYWORD: "${keyword}"**
**ARTICLE TYPE: ${articleType.toUpperCase()}**

${strategy.research_focus}

DATA CLEANING RULES:
1. Ignore UI elements like "Login", "Sign Up", "Footer", "Cookie Policy", "Alt tags".
2. Focus ONLY on educational content, tutorials, and facts.
3. PRIORITIZE the Deep Dive data - it contains the specific facts that competitors miss.

OUTPUT REQUIREMENTS (Return strict JSON):
1. "fact_sheet": Extract hard facts, statistics, dates, and specific steps. MUST include fresh data from Deep Dive.
2. "content_gap": What is STILL missing after both research phases? This helps the writer know where to add original insight.
3. "product_matrix": (ONLY for commercial/comparison articles) Product details with REAL pricing if found.
4. "step_sequence": (ONLY for how-to/tutorial articles) Extract step-by-step sequence.
5. "prerequisites": (ONLY for how-to/tutorial articles) What the reader needs.
6. "sources_summary": All sources used.
7. "authority_links": Extract 3-5 HIGH-QUALITY, non-competitor URLs suitable for citation (e.g., statistics from Statista, definitions from Wikipedia, official docs, industry reports, major news). These will be used as external links in the article.

JSON SCHEMA:
{
  "fact_sheet": string[], 
  "content_gap": {
    "missing_topics": string[],
    "outdated_info": string,
    "user_intent_gaps": string[]
  },
  "sources_summary": [{ "url": string, "title": string }],
  "product_matrix": [{ "name": string, "price": string, "pros": string[], "cons": string[], "unique_selling_point": string, "best_for": string }],
  "step_sequence": [{ "step": number, "title": string, "details": string, "pro_tip": string }],
  "prerequisites": string[],
  "authority_links": [{ "url": string, "title": string, "snippet": string }]
}
`
}

// --- PHASE 2 HELPER: Deep Research Lite (2-Phase Tavily + Critic) ---
const performDeepResearch = async (
  tvly: any,
  genAI: any,
  keyword: string,
  articleType: ArticleType,
  supportingKeywords: string[] = []
) => {
  console.log(`[Deep Research] Phase 1: Broad Landscape Search for "${keyword}"`)

  // === STEP 1: BROAD LANDSCAPE SEARCH ===
  const broadQuery = `${keyword} ${supportingKeywords.slice(0, 2).join(' ')}`.trim()
  const broadSearch = await tvly.search(broadQuery, {
    search_depth: "advanced",
    include_text: true,
    max_results: 5,
  })

  const broadContext = broadSearch.results.map((r: any) =>
    `Source: ${r.title} (${r.url})\nContent: ${r.content}`
  ).join("\n\n---\n\n")

  console.log(`[Deep Research] Phase 1 Complete: ${broadSearch.results.length} sources extracted`)

  // === STEP 2: THE CRITIC (Gap Analysis) ===
  console.log(`[Deep Research] Phase 2: The Critic - Analyzing gaps...`)

  const criticPrompt = getCriticGapPrompt(keyword, articleType, broadContext)
  const criticResp = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    config: { responseMimeType: "application/json" },
    contents: [{ role: "user", parts: [{ text: criticPrompt }] }]
  })

  const criticAnalysis = cleanAndParse(criticResp.text || '{"gap_analysis":"","targeted_queries":[]}')
  const targetedQueries: string[] = criticAnalysis.targeted_queries || []

  console.log(`[Deep Research] Critic identified gaps:`, criticAnalysis.gap_analysis)
  console.log(`[Deep Research] Targeted queries:`, targetedQueries)

  // === STEP 3: SNIPER SEARCH (Fill the Gaps) ===
  let deepContext = ""
  if (targetedQueries.length > 0) {
    console.log(`[Deep Research] Phase 3: Sniper Search - Hunting ${targetedQueries.length} specific queries...`)

    // Execute targeted searches in parallel for speed
    const deepResults = await Promise.all(
      targetedQueries.slice(0, 4).map((q: string) =>
        tvly.search(q, {
          search_depth: "basic",
          include_text: true,
          max_results: 2
        }).catch((err: any) => {
          console.log(`[Deep Research] Sniper query failed: ${q}`, err.message)
          return { results: [] }
        })
      )
    )

    const allDeepResults = deepResults.flatMap(r => r.results)
    deepContext = allDeepResults.map((r: any) =>
      `Source (Gap Fill - ${r.query || 'targeted'}): ${r.title} (${r.url})\nContent: ${r.content}`
    ).join("\n\n---\n\n")

    console.log(`[Deep Research] Phase 3 Complete: ${allDeepResults.length} gap-filling sources extracted`)
  }

  // === STEP 4: FINAL SYNTHESIS ===
  console.log(`[Deep Research] Phase 4: Final Synthesis...`)

  const synthesisPrompt = getSynthesisPrompt(articleType, keyword)
  const combinedData = `
=== BROAD LANDSCAPE DATA (Initial Search) ===
${broadContext}

=== DEEP DIVE DATA (Gap-Filling Search) ===
${deepContext || "No additional gap-filling data was needed."}

=== CRITIC'S GAP ANALYSIS ===
${criticAnalysis.gap_analysis || "No major gaps identified."}
`

  const synthesisStream = await genAI.models.generateContentStream({
    model: "gemini-3-flash-preview",
    config: {},
    contents: [{ role: "user", parts: [{ text: synthesisPrompt + "\n\n" + combinedData }] }]
  })

  let synthesisText = ""
  for await (const c of synthesisStream) {
    synthesisText += (c as any).text || ""
  }

  console.log(`[Deep Research] Complete! Synthesized comprehensive research brief.`)
  // Use self-correcting parser for Zod validation with retry
  return cleanParseAndValidate(synthesisText, CompetitorDataSchema, genAI)
}

const generateOutlineSystemPrompt = (keyword: string, styleDNA: any, competitorData: any, articleType: ArticleType, brandDetails: any = null, title?: string, internalLinks: any[] = []) => {
  const strategy = getArticleStrategy(articleType)

  // Extract authority links from competitor data for external linking
  const authorityLinks = competitorData.authority_links || []

  return `
You are an expert Content Architect and SEO Strategist.
Your goal is to outline a high-ranking blog post that beats the competition by filling their "Content Gaps".

**CRITICAL RULE: RELEVANCE OVER LENGTH.**
Do not fluff the outline. Only include sections that are really necessary.

**ARTICLE TYPE: ${articleType.toUpperCase()}**

INPUT CONTEXT:
1. KEYWORD: "${keyword}"
2. COMPETITOR & GAP DATA: ${JSON.stringify(competitorData)}
${brandDetails ? `### BRAND DNA\n${JSON.stringify(brandDetails, null, 2)}` : ''}
${internalLinks.length > 0 ? `### INTERNAL LINKS POOL (USE 1-2 MAX)\n${internalLinks.map(l => `- Title: ${l.title} | URL: ${l.url}`).join('\n')}` : ''}

### ARTICLE REQUIREMENT STRATEGY:
${strategy.outline_instruction}

---
Before outlining, analyze the "Keyword Intent" to determine the required depth:

1. **The "Quick Answer" Scope** (e.g., "how to reset iphone", "what is x"):
   - Structure: Short, direct.
   - Depth: Mostly H2s, few H3s.
   - Total Sections: **5-8 sections** is sufficient.
   - GOAL: Speed to solution.

2. **The "Comprehensive Guide" Scope** (e.g., "ultimate guide to seo", "best crm software"):
   - Structure: Deep, nested.
   - Depth: Heavy use of H3s and H4s.
   - Total Sections: **12-20 sections**.
   - GOAL: Exhaustive coverage.

**INSTRUCTION:** Adjust your outline length to match the keyword. Do not force a 15-section outline for a 8-section topic.

## HEADING HIERARCHY RULES (CRITICAL FOR SEO - MUST FOLLOW)

Google rewards articles with proper nested heading hierarchy. You MUST create a rich structure:

**LEVEL DEFINITIONS:**
- **level: 2 (H2)** = Main topic sections. These are your primary content pillars.
- **level: 3 (H3)** = Subtopics UNDER an H2 wherever required.
- **level: 4 (H4)** = Detailed points UNDER an H3 wherever required.

**STRUCTURE PATTERN (FOLLOW THIS):**
\`\`\`
H2: Main Topic A
  H3: Subtopic A.1
  H3: Subtopic A.2
    H4: Detail A.2.1 (if needed)
    H4: Detail A.2.2
  H3: Subtopic A.3
H2: Main Topic B
  H3: Subtopic B.1
  H3: Subtopic B.2
\`\`\`

**HIERARCHY REQUIREMENTS:**
1. NEVER have all sections at level 2. This is WRONG and hurts SEO.
2. Aim for at least 60% of sections to be level 3 or 4.
3. Use level 4 (H4) for lists, comparisons, step details, or deep dives.
4. The sections array should be FLAT but with levels indicating hierarchy.
5. **Nesting is Optional:** If an H2 topic is simple, do NOT force H3s under it.
6. **The 60/40 Rule:** Only use deep nesting (H3/H4) for complex sections (like "How-To Steps" or "Detailed Features").
7. Maintain a consistent voice while ensuring the content is logically organized for both humans and search engines.
8. If internal links are provided, plan where 1-2 of them would naturally fit in the outline.

---

## EXTERNAL LINKING STRATEGY (CRITICAL FOR SEO & E-E-A-T)

I have provided a list of "Authority Links" from our research:
${JSON.stringify(authorityLinks)}

**YOUR TASK:** 
- Select exactly 1-2 of these links that add the most value (e.g., a statistic, a definition, official documentation).
- Assign them to the MOST relevant sections using the "external_link" field.

**EXTERNAL LINKING RULES:**
1. Do NOT put all links in one section. Distribute them across different sections.
2. Do NOT force a link if it doesn't fit naturally. 1-2 links total for the whole article is enough.
3. The "anchor_context" must explain to the writer *why* to include this link (what fact or concept it verifies).
4. Prefer links to statistics, definitions, or official docs over generic articles.
5. If no authority links are suitable, leave the "external_link" field empty for all sections.

---

## OUTPUT INSTRUCTIONS:
1. **Title:** ${title ? `Use the provided title: "${title}".` : 'Generate a catchy H1 based on the Keyword and Content Gap.'}
2. **Intro/Hook:** Plan a strong introduction.
   - Do NOT list this in the "sections" array.
   - It needs to hook the reader immediately.
3. **Structure:** Create a logical flow FOLLOWING the TYPE-SPECIFIC STRATEGY above.
   - **MANDATORY:** You MUST create specific sections that address the "missing_topics" identified in the Competitor Data.
   - **USER INTENT:** Ensure the structure answers the specific questions users are asking.
4. **Instruction Notes:** 
   - For EACH section, write a "Content Focus" note.
   - **Tell the writer WHAT data points, facts, or specific "Gap" concepts to cover.**
   - **DO NOT** write style instructions. Only focus on the **Substance**.

## OUTPUT SCHEMA (Return strict JSON):
{
  "title": string,
  "intro": {
    "instruction_note": string,
    "keywords_to_include": string[]
  },
  "sections": [
    {
      "id": number (1-based index, sequential),
      "heading": string,
      "level": number (2, 3, or 4 - USE ALL THREE LEVELS),
      "instruction_note": string, 
      "keywords_to_include": string[],
      "external_link": { "url": string, "anchor_context": string } // OPTIONAL - only add if assigning an authority link to this section
    }
  ]
}

**FINAL CHECK:** Before outputting, verify that:
- You have H2, H3, AND H4 levels in your outline
- Does this outline solve the specific intent of "${keyword}"?
- Did you remove unnecessary fluff sections?
- Did you assign 1-2 external links to relevant sections?
`
}


const generateWritingSystemPrompt = (styleDNA: string, factSheet: any, brandDetails: any = null, internalLinks: any[] = []) => {
  // styleDNA is now a paragraph describing the writing style
  // Build brand context section
  let brandContextSection = ""
  if (brandDetails) {
    brandContextSection = `
### 5. BRAND CONTEXT
- We are writing as: ${brandDetails.product_name}.
- Audience: ${JSON.stringify(brandDetails.audience)}

**Note:** When discussing ${brandDetails.product_name} (your product), follow the brand voice guidelines below.
`
  }

  return `
You are an expert Blog Writer. You are NOT an AI assistant. You are a subject matter expert. ${getCurrentDateContext()}

### 1. WRITING STYLE & VOICE (FOLLOW THESE INSTRUCTIONS PRECISELY)
${styleDNA}

### 2. STRATEGY & MINDSET
- **Goal:** Rank #1 on Google by being more specific, helpful, and "human" than the competition.
- **Mindset:** The user is frustrated and wants a quick answer. Do not fluff. Get to the point.

### 3. GOLDEN RULES (THE LAW)
${AUTHENTIC_WRITING_RULES}
${brandContextSection}
${internalLinks.length > 0 ? `
### 4. INTERNAL LINKING RULES (CRITICAL)
You have access to the following internal links from our site:
${internalLinks.map(l => `- Title: ${l.title} | URL: ${l.url}`).join('\n')}

**YOUR TASK:**
Select and insert **exactly 1-2** of these internal links naturally into the article draft.
- Use descriptive, SEO-friendly anchor text.
- Do NOT use generic text like "click here".
- Embed them where they add genuine value to the reader.
` : ''}

### 4. KNOWLEDGE BASE (Facts to use)
${JSON.stringify(factSheet)}

### 5. OUTPUT FORMAT
Return **Markdown** formatted text. 
- Make use of proper H2, H3, and H4 headers for SEO appropriately.
- Do NOT include the main H2 Section Heading (system adds it).
- Start directly with the body content.
`
}

const generateWritingUserPrompt = (previousFullText: string, currentSection: any) => {
  // Build the Link Instruction Block if section has an assigned external link
  let linkInstruction = ""
  if (currentSection.external_link) {
    linkInstruction = `
### MANDATORY CITATION REQUIREMENT
You MUST include an external hyperlink in this section.
- **URL:** ${currentSection.external_link.url}
- **Context:** Used to verify "${currentSection.external_link.anchor_context}"
- **Instruction:** Embed this link naturally on relevant anchor text. Do NOT say "Click here" or "Read more". Link the relevant keywords or phrase.
- **Format:** Use markdown link syntax: [anchor text](url)
`
  }

  return `
### CONTEXT (What you have written so far)
${previousFullText}

### YOUR CURRENT TASK
**Write Section:** "${currentSection.heading}"

**CONTENT FOCUS (What to cover):**
${currentSection.instruction_note}

**SEO KEYWORDS:** ${currentSection.keywords_to_include.join(", ")}
${linkInstruction}
### INSTRUCTIONS
1. **DO NOT repeat or rephrase the heading.** The heading "${currentSection.heading}" is already added by the system. Start DIRECTLY with the substantive content.
   - ❌ WRONG: "So, what exactly is ${currentSection.heading.toLowerCase().replace(/\?/g, '')}?"
   - ❌ WRONG: "Let's talk about ${currentSection.heading.toLowerCase()}..."
   - ✅ RIGHT: Jump straight into the answer, fact, or point.
2. Read the last sentence of the Context. Ensure your first sentence flows naturally from it.
3. **Apply the Golden Rules:** BOLD the key takeaways. Keep sentences short and varied.
4. **Simulate Experience:** If the content note asks for a review/opinion, write confidently as if you have tested it.
`
}

const generatePolishEditorPrompt = (draft: string, styleDNA: string, brandDetails: any = null) => `
You are a Ruthless Direct-Response Copyeditor. 
Your goal is to maximize **Readability** following strict EEAT principles.
You hate "Walls of Text" and "AI Clichés".

### 1. THE DRAFT TO EDIT
${draft}

### 2. STRICT FORMATTING RULES (The Law)
1. **DESTROY WALLS OF TEXT:** If a paragraph has more than 4 sentences, BREAK IT. 
2. **ONE IDEA PER LINE:** Use single-sentence paragraphs frequently to create rhythm (not too much).
3. **SCANNABILITY:** Ensure key takeaways are **bolded** but in limits, do not overdo it.
4. **NO "GLUE" WORDS:** Remove fluff transitions like "In conclusion," "Furthermore," "It is important to note.", "Here's the truth", "Here's the deal", "Here comes", "Here's the catch". Just say what you mean.

### 3. BANNED "AI" PHRASES (Instant Deletion)
If you see these patterns or anything from this vibe, rewrite the sentence immediately:
- ❌ "That's where [X] comes in..."
- ❌ "Whether you are [X] or [Y]..."
- ❌ "In this digital landscape..."
- ❌ "Unlock / Unleash / Elevate..."
- ❌ "It sounds counterintuitive, but..."
- ❌ "Let's dive in..."
- ❌ "Magic happens..." / "Game-changer..."

### 4. THE VOICE (Do NOT Violate)
The brand's writing style:
${styleDNA}.

**CRITICAL:** Do NOT make it sound generic or "AI-generated". Preserve the unique flair, idioms, and formatting quirks.

${brandDetails ? `
### 5. BRAND PERSPECTIVE CHECK (CRITICAL)
You MUST remove any "cringe" self-reviews, check if the brand is overlay mentioned and can destroy brand reputation.
- **When discussing Competitors:** It is OK to say "I tested X".
- **When discussing ${brandDetails.product_name} (Our Product):**
  - **BAD:** "I tested ${brandDetails.product_name} and it was fast." (Sounds fake/cringe).
  - **GOOD:** "We built ${brandDetails.product_name} to be fast." or "Our tool excels at..."
  - **FIX:** Change any "I tested [Our Product]" to "We designed [Our Product]" or "Our tool".
` : ""}

### 6. OUTPUT
Return the polished content in **Raw Markdown**. Do NOT use code blocks.
`

export const generateBlogPost = task({
  id: "generate-blog-post",
  run: async (payload: {
    articleId: string;
    keyword: string;
    brandId: string;
    title?: string;
    articleType?: ArticleType;
    supportingKeywords?: string[];
    cluster?: string;
    planId?: string;
    itemId?: string;
  }) => {
    const {
      articleId,
      keyword,
      brandId,
      title,
      articleType = 'informational',
      supportingKeywords = [],
      cluster = '',
      planId,
      itemId
    } = payload
    const supabase = createAdminClient()
    let phase: "research" | "outline" | "writing" | "polish" = "research"

    // Initialize clients inside the task to avoid build-time errors
    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })
    const genAI = getGeminiClient()

    try {
      // 0. Brand is required - fetch brand details including style_dna
      if (!brandId) throw new Error("Brand ID is required")

      const { data: brandRec } = await supabase
        .from("brand_details")
        .select("brand_data")
        .eq("id", brandId)
        .single()

      if (!brandRec) throw new Error("Brand not found")
      const brandDetails = BrandDetailsSchema.parse(brandRec.brand_data)

      // style_dna is now a paragraph from brand_details, not a separate brand_voices lookup
      const styleDNA = brandDetails.style_dna || "Write in a professional yet conversational tone. Use active voice and be direct. Address the reader as 'you'. Keep sentences varied for natural rhythm. Avoid corporate jargon and be specific with examples and data."

      // --- NEW: FETCH INTERNAL LINKS POOL ---
      // Fetch user_id for this article
      const { data: articleRec } = await supabase
        .from("articles")
        .select("user_id")
        .eq("id", articleId)
        .single()

      const userId = articleRec?.user_id
      let internalLinks: any[] = []

      if (userId) {
        console.log(`🔗 Searching for internal links for user ${userId} and brand ${brandId}...`)
        internalLinks = await getRelevantInternalLinks(title || keyword, keyword, userId, brandId)
        console.log(`🔗 Found ${internalLinks.length} relevant internal links.`)
      }

      // --- PHASE 2: RESEARCH (Deep Research - 2-Phase Tavily + Critic) ---
      await supabase.from("articles").update({ status: "researching" }).eq("id", articleId)
      phase = "research"

      // Use the 2-phase deep research: Broad Search → Critic Gap Analysis → Sniper Search → Synthesis
      const competitorData = await performDeepResearch(
        tvly,
        genAI,
        keyword,
        articleType,
        supportingKeywords
      )

      await supabase
        .from("articles")
        .update({ competitor_data: competitorData, status: "outlining" })
        .eq("id", articleId)

      // --- PHASE 3: OUTLINE (The "Architect") ---
      phase = "outline"

      // Filter authority links to exclude social media and generic domains
      const filterAuthorityLinks = (links: Array<{ url: string, title: string, snippet?: string }>) => {
        const badDomains = [
          "youtube.com", "facebook.com", "twitter.com", "linkedin.com",
          "instagram.com", "tiktok.com", "pinterest.com", "reddit.com",
          "medium.com", "quora.com" // Also exclude user-generated content platforms
        ]

        return links.filter(link => {
          try {
            const domain = new URL(link.url).hostname.toLowerCase()
            return !badDomains.some(d => domain.includes(d))
          } catch {
            return false // Invalid URL, filter it out
          }
        }).slice(0, 5) // Keep top 5 candidates
      }

      // Clean authority links before passing to outline
      const cleanedCompetitorData = {
        ...competitorData,
        authority_links: filterAuthorityLinks(competitorData.authority_links || [])
      }

      const outlinePrompt = generateOutlineSystemPrompt(keyword, styleDNA, cleanedCompetitorData, articleType, brandDetails, title, internalLinks)
      const outlineConfig = {}
      const outlineContents = [
        {
          role: "user",
          parts: [{ text: outlinePrompt }],
        },
      ]

      const outlineStream = await genAI.models.generateContentStream({
        model: "gemini-3-flash-preview",
        config: outlineConfig,
        contents: outlineContents
      })

      let outlineText = ""
      for await (const c of outlineStream) {
        outlineText += (c as any).text || ""
      }

      // Use self-correcting parser for Zod validation with retry
      const outline = await cleanParseAndValidate(outlineText, ArticleOutlineSchema, genAI)

      // Use user's chosen title if provided, otherwise use AI-generated title
      const finalTitle = title || outline.title

      // Initialize draft with Title
      const initialDraft = `# ${finalTitle} \n\n`

      await supabase
        .from("articles")
        .update({
          outline,
          raw_content: initialDraft,
          status: "writing",
          current_step_index: 0
        })
        .eq("id", articleId)

      // --- PHASE 4: WRITING (The "Snowball" Loop) ---
      phase = "writing"

      let currentDraft = initialDraft
      let startIndex = 0
      const factSheet = competitorData.fact_sheet

      // === CHECKPOINT RESUMPTION: Fetch existing progress ===
      const { data: existingArticle } = await supabase
        .from("articles")
        .select("raw_content, current_step_index")
        .eq("id", articleId)
        .single()

      if (existingArticle?.raw_content && existingArticle.current_step_index > 0) {
        currentDraft = existingArticle.raw_content
        startIndex = existingArticle.current_step_index
        console.log(`[Checkpoint] Resuming from section index ${startIndex}`)
      }

      // 4.1 Write Intro (The Hook) - Separately
      // Only write intro if not resuming (startIndex === 0)
      if (startIndex === 0 && outline.intro) {
        const systemPrompt = generateWritingSystemPrompt(styleDNA, factSheet, brandDetails, internalLinks)
        const introTemplate = getIntroTemplate(articleType)
        const userPrompt = generateWritingUserPrompt(currentDraft, {
          heading: "Introduction / Hook", // Context only
          instruction_note: outline.intro.instruction_note + "\n\nIMPORTANT: Write the introduction/hook only. Do NOT add any headings. Start directly with the text.\n\nAPPLY THESE INTRO RULES:\n" + introTemplate,
          keywords_to_include: outline.intro.keywords_to_include
        })

        const writeConfig = {}
        const writeContents = [
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n" + userPrompt }],
          },
        ]

        const writeStream = await genAI.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: writeConfig,
          contents: writeContents
        })

        let writeText = ""
        for await (const c of writeStream) {
          writeText += (c as any).text || ""
        }

        currentDraft += `${writeText} \n\n`

        // Real-time Save
        await supabase
          .from("articles")
          .update({ raw_content: currentDraft })
          .eq("id", articleId)
      }

      // Start loop from saved index for checkpoint resumption
      for (let i = startIndex; i < outline.sections.length; i++) {
        const section = outline.sections[i]

        // Update UI
        await supabase
          .from("articles")
          .update({ current_step_index: i + 1, status: "writing" })
          .eq("id", articleId)

        const systemPrompt = generateWritingSystemPrompt(styleDNA, factSheet, brandDetails, internalLinks)
        const userPrompt = generateWritingUserPrompt(currentDraft.slice(-3000), section) // Passing last 3000 chars for context to save tokens, or full draft if feasible. Blueprint says "Entire Draft", but context limits apply. Gemini 2.0 Flash has 1M context, so full draft is fine.
        // Actually, let's pass full draft if it's 1M context.
        const userPromptFull = generateWritingUserPrompt(currentDraft, section)

        // Using Gemini 2.0 Flash for Speed & Context
        const writeConfig = {}
        const writeContents = [
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n" + userPromptFull }],
          },
        ]

        const writeStream = await genAI.models.generateContentStream({
          model: "gemini-2.0-flash",
          config: writeConfig,
          contents: writeContents
        })

        let writeText = ""
        for await (const c of writeStream) {
          writeText += (c as any).text || ""
        }

        // Append to Snowball
        const headingHash = "#".repeat(section.level || 2)
        currentDraft += `${headingHash} ${section.heading} \n\n${writeText} \n\n`

        // Real-time Save
        await supabase
          .from("articles")
          .update({ raw_content: currentDraft })
          .eq("id", articleId)

        // Tiny delay to be safe
        await new Promise(r => setTimeout(r, 500))
      }

      // --- PHASE 5: POLISH (The "Humanizer") ---
      await supabase.from("articles").update({ status: "polishing" }).eq("id", articleId)
      phase = "polish"

      const polishPrompt = generatePolishEditorPrompt(currentDraft, styleDNA, brandDetails)
      // Blueprint asks for Gemini 2.5 Pro (Advanced Reasoning).
      const polishConfig = {}
      const polishContents = [
        {
          role: "user",
          parts: [{ text: polishPrompt }],
        },
      ]

      const polishStream = await genAI.models.generateContentStream({
        model: "gemini-3-flash-preview",
        config: polishConfig,
        contents: polishContents
      })

      let polishText = ""
      for await (const c of polishStream) {
        polishText += (c as any).text || ""
      }

      const finalMarkdown = polishText.replace(/```markdown/g, "").replace(/```/g, "")

      // We used to store final_html here, but we are moving to client-side rendering/on-the-fly rendering
      // However, keeping it for now as a cache for the public blog view.
      const finalHtml = await marked.parse(finalMarkdown)

      // --- PHASE 6: SEO META GENERATION ---
      // 1. Generate Slug (Deterministic)
      const slugify = (text: string) => {
        return text
          .toString()
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')     // Replace spaces with -
          .replace(/[^\w\-]+/g, '') // Remove all non-word chars
          .replace(/\-\-+/g, '-')   // Replace multiple - with single -
      }
      const slug = slugify(title || outline.title || keyword)

      // 2. Generate Meta Description (AI)
      const seoSystemPrompt = `You are an expert SEO Specialist.
      Your task is to generate a compelling, natural, Meta Description for a blog post based on given inout outline and keyword.
      INPUT:
      Title: ${finalTitle}
      Keyword: ${keyword}

      REQUIREMENTS:
      - Under 160 characters.
      - Compelling, click-worthy, and includes the target keyword naturally.
      - Direct and to the point.
      - No emojis, No special characters i.e. :,;* or No hashtags.

      OUTPUT SCHEMA (JSON):
      {
        "meta_description": string
      }
      `

      const seoConfig = { responseMimeType: "application/json" }
      const seoContents = [{ role: "user", parts: [{ text: seoSystemPrompt }] }]

      let meta_description = ""
      try {
        const seoResponse = await genAI.models.generateContent({
          model: "gemini-2.0-flash",
          config: seoConfig,
          contents: seoContents
        })
        const seoText = seoResponse.text || ""
        const seoData = cleanAndParse(seoText)

        meta_description = seoData.meta_description
      } catch (e) {
        console.error("SEO Generation failed, using fallback", e)
        // Fallback if AI fails
        meta_description = `Read our guide on ${outline.title}. Learn about ${keyword} and more.`
      }

      // --- PHASE 7: FEATURED IMAGE GENERATION ---
      let featured_image_url = null
      try {
        const imageStyle = brandDetails?.image_style || "stock"

        // 1. Generate Image Prompt
        const imagePromptSystem = `You are an expert AI Art Director.
        Your task is to generate a detailed, creative prompt for an AI image generator to create a featured image for a blog post.
        
        INPUT:
        Title: ${finalTitle}
        Outline Summary: ${outline.sections.map(s => s.heading).join(", ")}
        Style: ${imageStyle}
        
        REQUIREMENTS:
        - The image should be highly relevant to the topic but abstract enough to be a background or hero image.
        - PRIORITIZE LESS TEXT on the image itself (or no text).
        - Make it visually appealing and conveying the essence of the topic.
        - If style is 'stock', go for high-quality realistic photography or clean vector art.
        - If style is 'indo', use vibrant colors and cultural elements if applicable, or specific artistic style associated with the brand.
        - Output ONLY the prompt string. No JSON.
        `

        const imagePromptConfig = { responseMimeType: "text/plain" }
        const imagePromptContents = [{ role: "user", parts: [{ text: imagePromptSystem }] }]

        const imagePromptResponse = await genAI.models.generateContent({
          model: "gemini-2.0-flash",
          config: imagePromptConfig,
          contents: imagePromptContents
        })
        const imagePrompt = imagePromptResponse.text || `A professional featured image for a blog post about ${keyword}`

        // 2. Generate Image using Fal.ai
        const imageResult = await generateImage(imagePrompt) as any
        const imageUrl = imageResult?.images?.[0]?.url

        // 3. Upload to R2
        if (imageUrl) {
          const imageResponse = await fetch(imageUrl)
          const imageBuffer = await imageResponse.arrayBuffer()
          const imageKey = `featured-images/${articleId}/${randomUUID()}.png`

          // Upload to R2
          await putR2Object(imageKey, Buffer.from(imageBuffer), "image/png")

          // 4. Construct Public URL - Prioritize public accessibility for CMS/Editor
          const r2PublicDomain = process.env.R2_PUBLIC_DOMAIN?.replace(/\/$/, '')
          const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
          const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` : null

          if (r2PublicDomain && !r2PublicDomain.includes('localhost')) {
            // Best option: Direct R2 public access
            featured_image_url = `${r2PublicDomain}/${imageKey}`
          } else {
            // Fallback to Proxy route via App URL
            let baseUrl = "http://localhost:3000"

            if (appUrl && !appUrl.includes('localhost')) {
              baseUrl = appUrl
            } else if (vercelUrl) {
              baseUrl = vercelUrl
            } else if (appUrl) {
              baseUrl = appUrl
            }

            featured_image_url = `${baseUrl}/api/images/${imageKey}`
          }

          console.log(`🖼️ Featured image available at: ${featured_image_url}`)
        }

      } catch (e) {
        console.error("Image Generation failed", e)
        // Non-blocking, just continue
      }

      await supabase
        .from("articles")
        .update({
          raw_content: finalMarkdown,
          final_html: finalHtml,
          status: "completed",
          meta_description,
          slug,
          featured_image_url
        })
        .eq("id", articleId)

      // --- PHASE 8: UPDATE CONTENT PLAN IF APPLICABLE ---
      if (payload.planId && payload.itemId) {
        try {
          // 1. Fetch current plan
          const { data: plan } = await (supabase as any)
            .from("content_plans")
            .select("*")
            .eq("id", payload.planId)
            .single()

          if (plan && plan.plan_data) {
            // 2. Update specific item status
            const updatedPlanData = plan.plan_data.map((item: any) => {
              if (item.id === payload.itemId) {
                return { ...item, status: "published" } // Mark as published when generation completes
              }
              return item
            })

            // 3. Save back
            await (supabase as any)
              .from("content_plans")
              .update({ plan_data: updatedPlanData })
              .eq("id", payload.planId)

            console.log(`Updated content plan ${payload.planId} item ${payload.itemId} to published`)
          }
        } catch (e) {
          console.error("Failed to update content plan status", e)
          // Non-blocking
        }
      }

      return { success: true, articleId }

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      await supabase
        .from("articles")
        .update({ status: "failed", error_message: msg, failed_at_phase: phase })
        .eq("id", payload.articleId)
      throw e
    }
  },
})
