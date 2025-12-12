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
6. Infuse genuine emotional undertones appropriate to the content
7. Start sentences with different elements: adverbs, prepositional phrases, dependent clauses, questions
8. Occasional sentence fragments are OK if they add punch. "Not always. But often."

**ACTIVE VOICE & DIRECTNESS:**
9. USE ACTIVE VOICE. "Management canceled the meeting" NOT "The meeting was canceled by management."
10. Be direct. "Call me at 3pm." NOT "I was wondering if you might be available for a call."
11. Use certainty when you ARE certain. "This approach improves results." NOT "This approach might improve results."
12. Add personal opinions, hesitations, or qualifiers ("I believe," "perhaps," "it seems")
13. Use contractions and colloquialisms when appropriate

**NO AI-FILLER PHRASES (CRITICAL):**
12. **BANNED STARTERS:** "Let's dive in", "Let's be honest", "here's the truth", "Let's explore", "In today's digital age", "You know that gut-wrenching feeling", "In this article we will", "It goes without saying", "As we navigate"
14. **BANNED PHRASES:** "cutting-edge", "leverage", "streamline", "take your X to the next level", "unparalleled", "revolutionize"
15. **BANNED WORDS:** "delve", "unleash", "landscape", "tapestry", "game-changer", "realm", "bustling", "elevate", "harness", "robust"
16. Instead of: "Let's explore this fascinating opportunity" → Say: "Here's what we know."

**SPECIFICITY & AUTHENTICITY:**
17. Use SPECIFIC, CONCRETE details. "Saves 2 hours per week" NOT "saves time."
18. Avoid generic statements. "The project failed because the API timed out" NOT "The project had issues."
19. If something has problems, SAY IT. "This approach has problems." Be real.

**STRUCTURAL PATTERN DISRUPTION:**
20. Don't always follow intro → body → conclusion. Sometimes start mid-thought.
21. Include natural digressions if they add value. "(this also works for X.)"
22. Use varied paragraph lengths. Some can be one sentence. Others 3.
23. Break conventional grammar rules occasionally in natural ways

**PERSPECTIVE REMINDER:**
24. **AUTHENTIC PERSPECTIVE:** Write with authority. Avoid passive voice ("It is said that..."). Use the perspective (I/We/Brand) defined in the Narrative Rules.
`

// Type-specific intro templates
const INTRO_TEMPLATES: Record<string, string> = {
  informational: `
GOAL: Explain the core concept immediately by contrasting the "Old Understanding" vs. the "New Reality." You need to switch from "Emotional Storytelling" to "Contextual Utility.

NEGATIVE CONSTRAINTS (STRICTLY ENFORCED):
- NO Narrative Openers ("In a world...", "Picture this...").
- NO Rhetorical Questions ("Have you ever wondered...?").
- NO Dictionary Definitions ("SEO stands for...").

APPROACH OPTIONS:
A) **The "Hidden Mechanic" Angle** - Start with the technical reason why this topic is complex/important. (e.g., "The reason X fails isn't bad luck; it's a specific algorithm change in Y.")
B) **The "Scale" Contrast** - Contrast how this concept worked 5 years ago vs. today. (e.g., "Ten years ago, X required a server farm. Today, it runs in the browser via WebASM.")
C) **The "Counter-Intuitive" Truth** - State a hard truth that contradicts popular belief. (e.g., "More megapixels do not mean better photos. Sensor size is the only metric that matters for low light.")

STRUCTURE:
1. Sentence 1: A direct statement of fact, a technical observation, or a contrast.
2. Sentence 2: The implication of that fact for the reader.
3. Sentence 3: The scope of this article (what we are covering).
`,

  commercial: `
GOAL: Establish immediate trust by acting as an Auditor, not a Salesman. You need to switch from "Emotional Storytelling" to "Contextual Utility.

NEGATIVE CONSTRAINTS (STRICTLY ENFORCED):
- NO "Paradox of Choice" fluff ("There are so many options...").
- NO Generic Pain ("We know it's hard to choose...").
- NO "Perfect for everyone" claims.

APPROACH OPTIONS:
A) **The "Hard Filter"** - Immediately state the one feature that disqualifies 90% of tools. (e.g., "If an AI generator doesn't offer 'Identity Lock,' it is useless for professional portfolios.")
B) **The "Benchmark" Opener** - Mention the specific stress test used for this review. (e.g., "We ran the same 4K video file through 10 different enhancers to see which ones crashed.")
C) **The "Price-Performance" Ratio** - Start with the blunt financial truth. (e.g., "You can pay $50/month for X, or get 90% of the same functionality with Y for $10. The difference is only in export speed.")

STRUCTURE:
1. Sentence 1: A specific criteria or industry standard that matters most for this product category.
2. Sentence 2: A preview of the verdict (e.g., "Most tools failed this test, but two stood out").
3. Sentence 3: Transition to the list/comparison.
`,

  howto: `
GOAL: Focus entirely on the "Efficiency" of the solution. You need to switch from "Emotional Storytelling" to "Contextual Utility.

NEGATIVE CONSTRAINTS (STRICTLY ENFORCED):
- NO Emotional scene-setting ("It's so frustrating when...").
- NO "Imagine" scenarios.
- NO Rhetorical Questions ("Have you ever...?").
- NO False reassurance ("Don't worry, it's easy..., We know it's frustrating...").

INSTRUCTION: Choose ONE of the following 3 angles and write the intro. Do not label the angle.

- Angle A (The Friction Fix):
"Start immediately with the technical challenge of the task. State why this specific task is usually hard (e.g., requires Photoshop skills, takes hours), and then immediately state how the new AI workflow solves that specific friction point."
- Angle B (The Output Anchor):
"Start by describing the final technical result first. Tell the user exactly what the finished product looks like (e.g., resolution, fps, realism) to hook them with the outcome, then work backward to the tool."
- Angle C (The Accessibility Shift):
"Start by stating the prerequisite that is NO LONGER needed. (e.g., 'You no longer need a green screen to do X'). Contrast the old requirement with the new ease of use."

STRUCTURE:
1. Sentence 1: Define the specific task or the technical obstacle (The "Hard Way").
2. Sentence 2: Introduce the tool or method as the efficiency mechanism (The "Smart Way").
3. Sentence 3: Immediate call to action / start of steps.
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
  "prerequisites": string[]
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
    model: "gemini-2.0-flash",
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
    model: "gemini-2.5-flash",
    config: {},
    contents: [{ role: "user", parts: [{ text: synthesisPrompt + "\n\n" + combinedData }] }]
  })

  let synthesisText = ""
  for await (const c of synthesisStream) {
    synthesisText += (c as any).text || ""
  }

  console.log(`[Deep Research] Complete! Synthesized comprehensive research brief.`)
  return CompetitorDataSchema.parse(cleanAndParse(synthesisText))
}

const generateOutlineSystemPrompt = (keyword: string, styleDNA: any, competitorData: any, articleType: ArticleType, brandDetails: any = null, title?: string) => {
  const strategy = getArticleStrategy(articleType)

  return `
You are an expert Content Architect and SEO Strategist.
Your goal is to outline a high-ranking blog post that beats the competition by filling their "Content Gaps".

**CRITICAL RULE: RELEVANCE OVER LENGTH.**
Do not fluff the outline. Only include sections that are really necessary to answer the user's search intent and satisfy modern ai search.

**ARTICLE TYPE: ${articleType.toUpperCase()}**

INPUT CONTEXT:
1. KEYWORD: "${keyword}"
2. COMPETITOR & GAP DATA: ${JSON.stringify(competitorData)}
${brandDetails ? `3. BRAND DETAILS: ${JSON.stringify(brandDetails)}` : ""}

TYPE-SPECIFIC STRATEGY:
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
      "keywords_to_include": string[]
    }
  ]
}

**FINAL CHECK:** Before outputting, verify that:
- You have H2, H3, AND H4 levels in your outline
- Does this outline solve the specific intent of "${keyword}"?
- Did you remove unnecessary fluff sections?
`
}


const generateWritingSystemPrompt = (styleDNA: string, factSheet: any, brandDetails: any = null) => {
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
### 4. KNOWLEDGE BASE (Facts to use)
${JSON.stringify(factSheet)}

### 5. OUTPUT FORMAT
Return **Markdown** formatted text. 
- Make use of proper H2, H3, and H4 headers for SEO appropriately.
- Do NOT include the main H2 Section Heading (system adds it).
- Start directly with the body content.
`
}

const generateWritingUserPrompt = (previousFullText: string, currentSection: any) => `
### CONTEXT(What you have written so far)
${previousFullText}

### YOUR CURRENT TASK
    ** Write Section:** "${currentSection.heading}"

      ** CONTENT FOCUS(What to cover):**
        ${currentSection.instruction_note}

** SEO KEYWORDS:** ${currentSection.keywords_to_include.join(", ")}
### INSTRUCTIONS
  1. Read the last sentence of the Context.Ensure your first sentence flows naturally from it.
2. ** Apply the Golden Rules:** BOLD the key takeaways.Keep sentences short.
3. ** Simulate Experience:** If the content note asks for a review / opinion, write confidently as if you have tested it.
`

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

      const outlinePrompt = generateOutlineSystemPrompt(keyword, styleDNA, competitorData, articleType, brandDetails, title)
      const outlineConfig = {}
      const outlineContents = [
        {
          role: "user",
          parts: [{ text: outlinePrompt }],
        },
      ]

      const outlineStream = await genAI.models.generateContentStream({
        model: "gemini-2.5-pro",
        config: outlineConfig,
        contents: outlineContents
      })

      let outlineText = ""
      for await (const c of outlineStream) {
        outlineText += (c as any).text || ""
      }

      const outline = ArticleOutlineSchema.parse(cleanAndParse(outlineText))

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
      const factSheet = competitorData.fact_sheet

      // 4.1 Write Intro (The Hook) - Separately
      // Check if intro data exists (it should with new schema, but safe check)
      if (outline.intro) {
        const systemPrompt = generateWritingSystemPrompt(styleDNA, factSheet, brandDetails)
        const introTemplate = getIntroTemplate(articleType)
        const userPrompt = generateWritingUserPrompt(currentDraft, {
          heading: "Introduction / Hook", // Context only
          instruction_note: outline.intro.instruction_note + "\n\nIMPORTANT: Write the introduction/hook only. Do NOT add any headings. Start directly with the text.\n\nAPPLY THESE INTRO RULES:\n" + introTemplate,
          keywords_to_include: outline.intro.keywords_to_include
        })

        const writeConfig = { tools: [{ googleSearch: {} }] }
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

      for (let i = 0; i < outline.sections.length; i++) {
        const section = outline.sections[i]

        // Update UI
        await supabase
          .from("articles")
          .update({ current_step_index: i + 1, status: "writing" })
          .eq("id", articleId)

        const systemPrompt = generateWritingSystemPrompt(styleDNA, factSheet, brandDetails)
        const userPrompt = generateWritingUserPrompt(currentDraft.slice(-3000), section) // Passing last 3000 chars for context to save tokens, or full draft if feasible. Blueprint says "Entire Draft", but context limits apply. Gemini 2.0 Flash has 1M context, so full draft is fine.
        // Actually, let's pass full draft if it's 1M context.
        const userPromptFull = generateWritingUserPrompt(currentDraft, section)

        // Using Gemini 2.0 Flash for Speed & Context
        const writeConfig = { tools: [{ googleSearch: {} }] } // Flash doesn't support thinking config usually, or it does? Keeping simple.
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
        model: "gemini-2.5-pro",
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
        Your task is to generate a detailed, creative prompt for an AI image generator (like Midjourney or Flux) to create a featured image for a blog post.
        
        INPUT:
        Title: ${finalTitle}
        Outline Summary: ${outline.sections.map(s => s.heading).join(", ")}
        Style: ${imageStyle}
        
        REQUIREMENTS:
        - The image should be relevant to the topic but abstract enough to be a background or hero image.
        - PRIORITIZE LESS TEXT on the image itself (or no text).
        - Make it visually appealing and suitable for a blog header.
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

          // Construct Public URL with proper priority and null checks
          const publicDomain = process.env.R2_PUBLIC_DOMAIN
          const nextAppUrl = process.env.NEXT_PUBLIC_APP_URL
          const vercelUrl = process.env.VERCEL_URL

          if (publicDomain) {
            // Use R2 public domain if configured (e.g., via Cloudflare custom domain)
            featured_image_url = `${publicDomain}/${imageKey}`
          } else if (nextAppUrl) {
            // Use the app's configured URL
            featured_image_url = `${nextAppUrl}/api/images/${imageKey}`
          } else if (vercelUrl) {
            // Use Vercel's auto-generated URL
            featured_image_url = `https://${vercelUrl}/api/images/${imageKey}`
          } else {
            // Local development fallback
            featured_image_url = `http://localhost:3000/api/images/${imageKey}`
          }
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
