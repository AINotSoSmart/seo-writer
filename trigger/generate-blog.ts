import { task } from "@trigger.dev/sdk/v3"
import { tavily } from "@tavily/core"
import { createAdminClient } from "@/utils/supabase/admin"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { CompetitorDataSchema } from "@/lib/schemas/research"
import { ArticleOutlineSchema } from "@/lib/schemas/outline"
import { StyleDNASchema } from "@/lib/schemas/style"
import { BrandDetailsSchema } from "@/lib/schemas/brand"
import { marked } from "marked"
import { generateImage } from "@/lib/fal"
import { putR2Object } from "@/lib/r2"
import { randomUUID } from "crypto"


// Clients will be initialized inside the task


// --- Prompts & Rules from Blueprint ---

const AUTHENTIC_WRITING_RULES = `
### CORE FORMATTING & STYLE (STRICT ENFORCEMENT)
1. **PRIORITIZE SCANNABILITY:** Assume the user will not read full paragraphs. The core message must be understandable at a glance.
2. **USE SHORT SENTENCES:** One idea per line. Break up walls of text mercilessly. Keep paragraphs under 3 sentences.
3. **EMBRACE BOLD TEXT & LISTS:** Use **bolding** for the most important takeaway in any paragraph. Use bullet points (or emojis as bullets) to break up concepts and processes.
4. **EVERY LINE MUST EARN ITS PLACE:** If a sentence doesn't serve a critical purpose, delete it. Be ruthless.
5. **NO GENERIC "AI" JARGON:** Banned words: "delve", "unleash", "landscape", "tapestry", "game-changer", "realm", "bustling".
6. **AUTHENTIC PERSPECTIVE:** Write with authority. Avoid passive voice ("It is said that..."). Use the perspective (I/We/Brand) defined in the Narrative Rules.
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
Your goal is to outline a high-ranking blog post that beats the competition by filling their "Content Gaps".

INPUT CONTEXT:
1. KEYWORD: "${keyword}"
2. COMPETITOR & GAP DATA: ${JSON.stringify(competitorData)}
${brandDetails ? `3. BRAND DETAILS: ${JSON.stringify(brandDetails)}` : ""}

INSTRUCTIONS:
1. **Title:** ${title ? `Use the provided title: "${title}".` : 'Generate a catchy H1 based on the Keyword and Content Gap.'}
2. **Intro/Hook:** Plan a strong introduction.
   - Do NOT list this in the "sections" array.
   - It needs to hook the reader immediately.
3. **Structure (H2/H3):** Create a logical flow.
   - **MANDATORY:** You MUST create specific sections that address the "missing_topics" identified in the Competitor Data.
   - **USER INTENT:** Ensure the structure answers the specific questions users are asking.
4. **Instruction Notes (CRITICAL CHANGE):** 
   - For EACH section, write a "Content Focus" note.
   - **Tell the writer WHAT data points, facts, or specific "Gap" concepts to cover.**
- For EACH section, write a "Content Focus" note.
   - **Tell the writer WHAT data points, facts, or specific "Gap" concepts to cover.**
   - **DO NOT** write style instructions (e.g., "Use bullets", "Be professional"). The writer already knows the style. Only focus on the **Substance**.
   - Example GOOD Note: "Explain the pricing tier differences. Mention that the Pro plan is required for API access (Gap found in research)."
   - Example BAD Note: "Write this section using bullet points and a professional tone."
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
      "level": number (2 for H2, 3 for H3),
      "instruction_note": string, 
      "keywords_to_include": string[]
    }
  ]
}
`

const generateWritingSystemPrompt = (styleDNA: any, factSheet: any, brandDetails: any = null) => `
You are an expert Blog Writer. You are NOT an AI assistant. You are a subject matter expert.

### 1. USER INTENT & STRATEGY
- **Goal:** Rank #1 on Google by being more specific, helpful, and "human" than the competition.
- **Mindset:** The user is frustrated and wants a quick answer. Do not fluff. Get to the point.
- **Voice:** ${styleDNA.tone} (But prioritize clarity over fancy writing).
- **Narrative Rules:**
${styleDNA.narrative_rules?.map((r: string) => `- ${r}`).join("\n") || "- No specific narrative rules."}

### 2. GOLDEN RULES (THE LAW)
${AUTHENTIC_WRITING_RULES}

${brandDetails ? `
### 3. BRAND CONTEXT
- We are writing as: ${brandDetails.product_name}. You are a core team member/founder of ${brandDetails.product_name}.
- Audience: ${JSON.stringify(brandDetails.audience)}

**You are writing on behalf of ${brandDetails.product_name}.** 
- **When discussing Competitors:** Act as an Expert Reviewer. Use "I" or "We". (e.g., "I tested Tool X and found it slow.") 
- **When discussing ${brandDetails.product_name} (Our Product):** Act as the **Creator/Builder**. 
  - **DO NOT SAY:** "I tested ${brandDetails.product_name}..." or "I reviewed ${brandDetails.product_name}..." (This is cringe). 
  - **INSTEAD SAY:** "We built ${brandDetails.product_name} to fix this..." or "This is why we designed ${brandDetails.product_name} to..." or "Our tool handles this by..."
` : ""}

### 4. KNOWLEDGE BASE (Facts to use)
${JSON.stringify(factSheet)}

### 5. OUTPUT FORMAT
Return **Markdown** formatted text. 
- Make use of proper H2, H3, and H4 headers for SEO appropriately.
- Do NOT include the main H2 Section Heading (system adds it).
- Start directly with the body content.
`

const generateWritingUserPrompt = (previousFullText: string, currentSection: any) => `
### CONTEXT (What you have written so far)
${previousFullText}

### YOUR CURRENT TASK
**Write Section:** "${currentSection.heading}"

**CONTENT FOCUS (What to cover):** 
${currentSection.instruction_note}

**SEO KEYWORDS:** ${currentSection.keywords_to_include.join(", ")}
### INSTRUCTIONS
1. Read the last sentence of the Context. Ensure your first sentence flows naturally from it.
2. **Apply the Golden Rules:** BOLD the key takeaways. Keep sentences short.
3. **Simulate Experience:** If the content note asks for a review/opinion, write confidently as if you have tested it.
`

const generatePolishEditorPrompt = (draft: string, styleDNA: any, brandDetails: any = null) => `
You are a Ruthless Direct-Response Copyeditor. 
Your goal is to maximize **Readability** and **Emotional Impact**.
You hate "Walls of Text" and "AI Clichés".

### 1. THE DRAFT TO EDIT
${draft}

### 2. STRICT FORMATTING RULES (The Law)
1. **DESTROY WALLS OF TEXT:** If a paragraph has more than 3 sentences, BREAK IT. 
2. **ONE IDEA PER LINE:** Use single-sentence paragraphs frequently to create rhythm.
3. **SCANNABILITY:** Ensure key takeaways are **bolded**.
4. **NO "GLUE" WORDS:** Remove fluff transitions like "In conclusion," "Furthermore," "It is important to note." Just say what you mean.

### 3. BANNED "AI" PHRASES (Instant Deletion)
If you see these patterns or anything from this vibe, rewrite the sentence immediately:
- ❌ "That's where [X] comes in..."
- ❌ "Whether you are [X] or [Y]..."
- ❌ "In this digital landscape..."
- ❌ "Unlock / Unleash / Elevate..."
- ❌ "It sounds counterintuitive, but..."
- ❌ "Let's dive in..."
- ❌ "Magic happens..." / "Game-changer..."

### 2. THE VOICE (Do NOT Violate)
The author's unique style DNA is:
- Tone: ${styleDNA.tone}
- Sentence Structure: ${styleDNA.sentence_structure?.avg_length || "varied"}
- **CRITICAL:** Do NOT make it sound generic or "AI-generated". Preserve the unique flair, idioms, and formatting quirks.
### 4. TONE CHECK
- **Voice:** ${styleDNA.tone}
- **Perspective & Rules:**
${styleDNA.narrative_rules?.map((r: string) => `- ${r}`).join("\n") || "- Follow brand guidelines."}
- **Vibe:** Write like a human talking to a friend. Be punchy. Be specific.

${brandDetails ? `
### 6. BRAND PERSPECTIVE CHECK (CRITICAL)
You MUST fix any "cringe" self-reviews.
- **When discussing Competitors:** It is OK to say "I tested X".
- **When discussing ${brandDetails.product_name} (Our Product):**
  - **BAD:** "I tested ${brandDetails.product_name} and it was fast." (Sounds fake/cringe).
  - **GOOD:** "We built ${brandDetails.product_name} to be fast." or "Our tool excels at..."
  - **FIX:** Change any "I tested [Our Product]" to "We designed [Our Product]" or "Our tool".
` : ""}

### 5. OUTPUT
Return the polished content in **Raw Markdown**. Do NOT use code blocks.
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

      const polishPrompt = generatePolishEditorPrompt(currentDraft, styleDNA, brandDetails)
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
      const slug = slugify(outline.title || keyword)

      // 2. Generate Meta Description (AI)
      const seoSystemPrompt = `You are an expert SEO Specialist.
      Your task is to generate a compelling, natural, Meta Description for a blog post based on given inout outline and keyword.
      INPUT:
      Title: ${outline.title}
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
        const seoData = JSON.parse(seoText)
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
        Title: ${outline.title}
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
           
           // Construct Public URL
           const publicDomain = process.env.R2_PUBLIC_DOMAIN
           if (publicDomain) {
             featured_image_url = `${publicDomain}/${imageKey}`
           } else {
             featured_image_url = `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${imageKey}`
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
