import { task } from "@trigger.dev/sdk/v3"
import { tavily } from "@tavily/core"
import { createAdminClient } from "@/utils/supabase/admin"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { CompetitorDataSchema } from "@/lib/schemas/research"
import { ArticleOutlineSchema } from "@/lib/schemas/outline"
import { StyleDNASchema } from "@/lib/schemas/style"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
import { marked } from "marked"


// Clients will be initialized inside the task


// --- Prompts & Rules from Blueprint ---

const AUTHENTIC_WRITING_RULES = `
### 1. CONTENT FORMATTING & STYLE
- **PRIORITIZE SCANNABILITY:** Assume the user will not read full paragraphs. The core message must be understandable at a glance.
- **USE SHORT SENTENCES:** One idea per line. Break up walls of text mercilessly. Keep paragraphs under 3 sentences.
- **EMBRACE BOLD TEXT & LISTS:** Use **bolding** for the most important takeaway in any paragraph. Use bullet points (or emojis as bullets) to break up concepts and processes.
- **EVERY LINE MUST EARN ITS PLACE:** If a sentence doesn't serve a critical purpose, delete it. Be ruthless.
- **NO "AI" WORDS:** Never use "delve", "unleash", "landscape", "tapestry", or "game-changer".

### 2. TARGET USER INTENT & ACCURACY
- **TARGET INTENT:** Understand the user's true goal. AI search engines prioritize intent match. Don't just stuff keywords; answer the question.
- **BE SPECIFIC, NO JARGON:** Avoid vague text or industry jargon. Use clear, simple language.
- **NO HALLUCINATIONS:** Utilize provided research data only. Do not invent facts or statistics.
`

const INTRO_GOLDEN_RULES = `
GOAL: The introduction must hook the reader, make them feel deeply understood, and create an urgent need to read the solution in the main body of the post. 

STRUCTURE:
1. Acknowledge the struggle is real and frustrating, but do it with confidence.
2. Describe the reader's own experience back to them in vivid detail. Paint a picture of the hard work they've put in, and the disappointing result they've achieved.
3. Directly state the common excuse they tell themselves being in context.
4. Conclude by clearly stating that the solution is not complex or expensive. Frame the rest of the blog post as the simple, actionable fix to the major problem you've just outlined.
`

const RESEARCH_SYSTEM_PROMPT = `
You are an expert SEO Strategist and Data Analyst. 
I will provide you with the raw text content of the Top 5 Google Search results for a specific keyword.

YOUR GOAL:
Analyze this data to create a "Research Brief" that allows us to write a better article than all of them combined.

DATA CLEANING RULES:
1. The input contains raw web scrapes. Ignore UI elements like "Login", "Sign Up", "Footer", "Cookie Policy", "Alt tags".
2. Focus ONLY on the educational content, tutorials, and facts.

OUTPUT REQUIREMENTS (Return strict JSON):
1. "fact_sheet": Extract hard facts, statistics, dates, and specific steps that are mentioned across multiple sources. (e.g., "70% of users prefer X").
2. "content_gap": Identify what is MISSING. 
   - Are the articles outdated (e.g., mentioning 2023)?
   - Do they lack specific code examples?
   - Do they fail to answer a specific "why"?
   - Is the tone too robotic?
   - Note: If one source has a Transcript (like a YouTube video), extract unique tips from it that text blogs missed.

JSON SCHEMA:
{
  "fact_sheet": string[], 
  "content_gap": {
    "missing_topics": string[],
    "outdated_info": string,
    "user_intent_gaps": string[]
  },
  "sources_summary": { url: string, title: string }[]
}
`

const generateOutlineSystemPrompt = (keyword: string, styleDNA: any, competitorData: any, brandDetails: any = null, title?: string) => `
You are an expert Content Architect.
Your goal is to outline a high-ranking blog post that beats the competition by filling their "Content Gaps" while strictly adhering to a specific "Brand Voice."

INPUT CONTEXT:
1. KEYWORD: "${keyword}"
2. STYLE DNA: ${JSON.stringify(styleDNA)}
3. COMPETITOR & GAP DATA: ${JSON.stringify(competitorData)}
${brandDetails ? `4. BRAND DETAILS: ${JSON.stringify(brandDetails)}` : ""}

INSTRUCTIONS:
1. **Title:** ${title ? `Use the provided title: "${title}".` : 'Generate a catchy H1 based on the Style DNA (e.g., if style is "Clickbaity", make it clickbait).'}
2. **Intro/Hook:** Plan a strong introduction that hooks the reader.
   - This should NOT be listed in the "sections" array.
   - It does not have a heading.
   - It must explicitly mention *how* to hook the reader based on Style DNA.
   - **Apply these Golden Rules for the Intro:**
     ${INTRO_GOLDEN_RULES}
3. **Structure:** Create a logical flow of H2 and H3 headings. Use H3s for sub-sections under broad H2 topics.
   - **Mandatory:** You MUST create specific sections that address the "missing_topics" identified in the Competitor Data.
   - **Flow:** Ensure the flow makes sense for a reader.
   - **Brand Integration:** Ensure the outline reflects the Brand's Mission and speaks to the Brand's Audience (from Brand Details).
   - **Important:** Do NOT include an "Introduction" or "Intro" in this sections list. The intro is handled separately. Start with the first substantive H2.
4. **Instruction Notes:** For EACH section, write a "Drafting Note" for the writer AI.
   - The note must explicitly mention *how* to write that section based on Style DNA.
   - Example: If Style DNA says "use bullet points", the Note should say: "List the pros and cons using bullet points."
   - Example: If Gap Analysis says "competitors missed pricing", the Note should say: "Include a detailed pricing table here as competitors missed this."

OUTPUT SCHEMA (Return strict JSON):
{
  "title": string,
  "intro": {
    "instruction_note": string,
    "keywords_to_include": string[]
  },
  "sections": [
    {
      "id": number (1-based index),
      "heading": string,
      "level": number (2 for H2, 3 for H3, etc.),
      "instruction_note": string,
      "keywords_to_include": string[]
    }
  ]
}
`

const generateWritingSystemPrompt = (styleDNA: any, factSheet: any, brandDetails: any = null) => `
You are an expert Blog Writer for a high-traffic publication.

### 1. YOUR VOICE (Style DNA)
Adhere strictly to these parameters:
- Tone: ${styleDNA.tone}
- Sentence Length: ${styleDNA.sentence_structure?.avg_length || "short"}
- Formatting: ${styleDNA.formatting?.use_bullet_points ? "Use bullet points often" : "Standard formatting"}

${brandDetails ? `
### 2. BRAND IDENTITY
Represent this brand in your writing:
- Product: ${brandDetails.product_name}
- Identity: ${JSON.stringify(brandDetails.product_identity)}
- Mission: ${brandDetails.mission}
- Audience: ${JSON.stringify(brandDetails.audience)}
- Voice & Tone: ${JSON.stringify(brandDetails.voice_tone)}
- Pricing: ${JSON.stringify(brandDetails.pricing || [])}
- How it Works: ${JSON.stringify(brandDetails.how_it_works || [])}
` : ""}

### 3. GOLDEN RULES (Non-Negotiable)
${AUTHENTIC_WRITING_RULES}

### 4. KNOWLEDGE BASE (Fact Sheet)
Use these facts for accuracy. Do NOT hallucinate data not found here or in common knowledge.
${JSON.stringify(factSheet)}

### 5. OUTPUT FORMAT
Return **Markdown** formatted text. 
Do NOT include the Section Heading (H2/H3) in your output, the system adds it automatically.
Write ONLY the body content for the section.
`

const generateWritingUserPrompt = (previousFullText: string, currentSection: any) => `
### CONTEXT (What you have written so far)
${previousFullText}

### TASK
Write the next section based on the Outline.
- **Section Heading:** "${currentSection.heading}"
- **Specific Instruction:** "${currentSection.instruction_note}"
- **Keywords to Include:** ${currentSection.keywords_to_include.join(", ")}

### TRANSITION REQUIREMENT
Read the very last sentence of the "CONTEXT" above.
Ensure the first sentence of your new output connects smoothly to it. 
Do not start abruptly. Use a bridging phrase if necessary.
`

const generatePolishEditorPrompt = (draft: string, styleDNA: any) => `
You are a Senior Editor at a top-tier publication. 
Your goal is to polish a draft without removing its soul.

### 1. THE DRAFT TO EDIT
${draft}

### 2. THE VOICE (Do NOT Violate)
The author's unique style DNA is:
- Tone: ${styleDNA.tone}
- Sentence Structure: ${styleDNA.sentence_structure?.avg_length || "varied"}
- **CRITICAL:** Do NOT make it sound generic or "AI-generated". Preserve the unique flair, idioms, and formatting quirks.

### 3. YOUR EDITING TASKS
1. **Flow Check:** The draft was written section-by-section. Smooth out any jerky transitions between H2 headers.
2. **Repetition Audit:** Remove repetitive phrases (e.g., "In this digital landscape", "Furthermore").
3. **Fact Check:** Ensure the internal logic holds up.
4. **Formatting:** Ensure the final text is in clean, standard Markdown.
   - Do NOT wrap the result in \`\`\`markdown code blocks. Return raw Markdown string.

### 4. OUTPUT
Return ONLY the raw Markdown.
`

export const generateBlogPost = task({
  id: "generate-blog-post",
  run: async (payload: { articleId: string; keyword: string; voiceId: string; brandId?: string; title?: string }) => {
    const { articleId, keyword, voiceId, brandId, title } = payload
    const supabase = createAdminClient()
    let phase: "research" | "outline" | "writing" | "polish" = "research"

    // Initialize clients inside the task to avoid build-time errors
    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })
    const genAI = getGeminiClient()

    try {
      // 0. Fetch Style DNA
      const { data: styleRec } = await supabase
        .from("brand_voices")
        .select("style_dna")
        .eq("id", voiceId)
        .single()
      if (!styleRec) throw new Error("Style not found")
      const styleDNA = StyleDNASchema.parse(styleRec.style_dna)

      // 0.1 Fetch Brand Details if brandId is present
      let brandDetails = null
      if (brandId) {
        const { data: brandRec } = await supabase
          .from("brand_details")
          .select("brand_data")
          .eq("id", brandId)
          .single()

        if (brandRec) {
          brandDetails = BrandDetailsSchema.parse(brandRec.brand_data)
        }
      }

      // --- PHASE 2: RESEARCH (The "Gap" Engine) ---
      await supabase.from("articles").update({ status: "researching" }).eq("id", articleId)
      phase = "research"

      const searchResults = await tvly.search(keyword, {
        search_depth: "advanced",
        include_text: true,
        max_results: 5,
      })

      // Using Gemini 3 Pro for Research
      const analyzeConfig = { tools: [{ googleSearch: {} }] }
      const analyzeContents = [
        {
          role: "user",
          parts: [
            {
              text: RESEARCH_SYSTEM_PROMPT + `\n\nINPUT DATA (Search Results for "${keyword}"):\n` + JSON.stringify(searchResults.results)
            },
          ],
        },
      ]

      const analyzeStream = await genAI.models.generateContentStream({
        model: "gemini-2.5-flash",
        config: analyzeConfig,
        contents: analyzeContents
      })

      let analyzeText = ""
      for await (const c of analyzeStream) {
        analyzeText += (c as any).text || ""
      }

      const cleanAnalyze = analyzeText.replace(/```json/g, "").replace(/```/g, "")
      const competitorData = CompetitorDataSchema.parse(JSON.parse(cleanAnalyze))

      await supabase
        .from("articles")
        .update({ competitor_data: competitorData, status: "outlining" })
        .eq("id", articleId)

      // --- PHASE 3: OUTLINE (The "Architect") ---
      phase = "outline"

      const outlinePrompt = generateOutlineSystemPrompt(keyword, styleDNA, competitorData, brandDetails, title)
      const outlineConfig = {}
      const outlineContents = [
        {
          role: "user",
          parts: [{ text: outlinePrompt }],
        },
      ]

      const outlineStream = await genAI.models.generateContentStream({
        model: "gemini-2.0-flash",
        config: outlineConfig,
        contents: outlineContents
      })

      let outlineText = ""
      for await (const c of outlineStream) {
        outlineText += (c as any).text || ""
      }

      const cleanOutline = outlineText.replace(/```json/g, "").replace(/```/g, "")
      const outline = ArticleOutlineSchema.parse(JSON.parse(cleanOutline))

      // Initialize draft with Title
      const initialDraft = `# ${outline.title}\n\n`

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
        const userPrompt = generateWritingUserPrompt(currentDraft, {
          heading: "Introduction / Hook", // Context only
          instruction_note: outline.intro.instruction_note + "\n\nIMPORTANT: Write the introduction/hook only. Do NOT add any headings. Start directly with the text.\n\nAPPLY THESE INTRO GOLDEN RULES:\n" + INTRO_GOLDEN_RULES,
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

        currentDraft += `${writeText}\n\n`

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
        currentDraft += `${headingHash} ${section.heading}\n\n${writeText}\n\n`

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

      const polishPrompt = generatePolishEditorPrompt(currentDraft, styleDNA)
      // Blueprint asks for Gemini 2.5 Pro (Advanced Reasoning). Using Gemini 3 Pro Preview as closest powerful model.
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

      await supabase
        .from("articles")
        .update({ raw_content: finalMarkdown, final_html: finalHtml, status: "completed" })
        .eq("id", articleId)

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
