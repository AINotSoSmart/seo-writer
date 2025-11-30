This is a solid, professional architecture. i have effectively designed an "Agentic Chain" where each step handles a specific cognitive task.

The "Authentic AI Blog Writer Agent" Blueprint

## Technical Spec: Phase 1 - Style Acquisition Engine

### 1. Overview
The goal of this phase is to generate a standardized StyleDNA JSON object that dictates how the AI writes. 

We support two input methods:
Tab 1 (Mimic): User provides a URL → Scrape Main Content (Markdown) using Tavily API (include_text) , depth advance → Analyze with Gemini-3-pro-preview model(no chnages to this).

Tab 2 (Preset): User selects a style template  → Load JSON in ui → User Edits.

2. Data Structure (StyleDNA)
This is the schema that will be passed to the writing agent later.

// types/style.ts

export interface StyleDNA {
  tone: string; // e.g., "Authoritative yet conversational"
  sentence_structure: {
    avg_length: "short" | "medium" | "long" | "varied";
    complexity: "simple" | "academic" | "technical";
    use_of_questions: boolean; // Does it ask rhetorical questions?
  };
  formatting: {
    use_bullet_points: "frequent" | "rare" | "never";
    header_style: "declarative" | "clickbaity" | "question-based";
    bold_key_phrases: boolean;
  };
  vocabulary: {
    level: "Grade 8" | "Grade 12" | "PhD";
    jargon_usage: "heavy" | "minimal" | "explained";
    forbidden_words: string[]; // e.g., ["delve", "tapestry", "landscape"]
  };
  narrative_rules: string[]; // Specific instructions like "Always start with a personal anecdote"
}

// zod/styleSchemas.ts
import { z } from 'zod';

export const StyleDNASchema = z.object({
  tone: z.string().min(1).max(100),
  sentence_structure: z.object({
    avg_length: z.enum(["short", "medium", "long", "varied"]),
    complexity: z.enum(["simple", "academic", "technical"]),
    use_of_questions: z.boolean(),
  }),
  formatting: z.object({
    use_bullet_points: z.enum(["frequent", "rare", "never"]),
    header_style: z.enum(["declarative", "clickbaity", "question-based"]),
    bold_key_phrases: z.boolean(),
  }),
  vocabulary: z.object({
    level: z.enum(["Grade 8", "Grade 12", "PhD"]),
    jargon_usage: z.enum(["heavy", "minimal", "explained"]),
    forbidden_words: z.array(z.string()).max(50),
  }),
  narrative_rules: z.array(z.string()).max(50),
});

3. Implementation Logic
A. Tab 1: URL Style Extraction (The "Mimic" Flow)
Step 1: Scrape Content (Cost: ~$0.002)
Tool: Tavily API (Search with include_text)

// lib/scraper.ts
import { tavily } from '@tavily/core'

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })

export async function scrapeStyleUrl(url: string): Promise<string> {
  const response = await tvly.search(url, {
    search_depth: 'advanced',
    include_text: true,
    max_results: 1,
  })
  const first = response.results?.[0]
  if (!first || !first.content) throw new Error('Failed to scrape URL via Tavily')
  return first.content
}

Step 2: Analyze Style (Cost: ~$0.01)
Model: Gemini 3 Pro (Required for high-level reasoning).
Input: The Scraped Markdown.
System Prompt:
Role: You are a Computational Linguist.
Task: Analyze the writing style of the provided text and extract its "Style DNA" into a strict JSON format.
Analysis Requirements:
Tone: Is it snarky? Professional? Empathetic?
Structure: Do they use short punchy sentences? Or long flowing paragraphs?
Formatting: How do they use bolding, headers, and lists?
Vocabulary: Detect AI-sounding words (delve, unlock, unleash) vs human idiosyncrasies.
Signature Moves: Does the author often use parentheses for jokes? Do they start sections with "Look,"?
Output: Return ONLY the JSON object matching the StyleDNA schema. No markdown fencing.
B. Tab 2: Preset Styles (The "Fast" Flow)
Step 1: Hardcoded Presets
Create a file lib/presets.ts with pre-defined JSONs.
Example: "The LinkedIn Influencer"
sentence_structure: { avg_length: "short", complexity: "simple" }
formatting: { use_bullet_points: "frequent", bold_key_phrases: true }
narrative_rules: ["One sentence per line", "Start with a hook"]
Example: "The Deep Dive Essay"
sentence_structure: { avg_length: "long", complexity: "academic" }
vocabulary: { level: "Grade 12" }
Step 2: Client-Side Editing
When a user selects a preset OR scrapes a URL, load the resulting JSON into a Form on the frontend.
Crucial: Allow the user to manually edit the narrative_rules array.
User Action: They might see "Tone: Snarky" and change it to "Professional".
Result: The final JSON is updated in the state before moving to Phase 2.
4. API Route Definition (Next.js)
Route: POST /api/extract-style
Logic:
Receive url from body.
Call scrapeStyleUrl(url).
Call gemini.generateContent() with the Analysis Prompt.
Parse and validate JSON against StyleDNASchema.
Return { success: true, styleDNA: {...} }.
5. Persistence
Once the user clicks "Next" (to go to Keyword Input), save the final StyleDNA JSON to the Postgres Database (Supabase) in the brand_voices table.
Why? This allows the user to reuse this voice later without scraping again.



Here is the Technical Specification for Phase 2, detailed for your AI builder.


Technical Spec: Phase 2 - The Deep Research (The "Gap" Engine)
1. Overview

This phase executes immediately after the user submits a keyword. It runs as a Background Job (via Trigger.dev) to prevent timeouts. It performs two critical actions:

Scrape: Fetches top 5 competitor articles + content using Tavily AI.

Analyze: Uses Gemini 3 Pro to distill a "Fact Sheet" and identify the "Content Gap" (opportunities to outrank).

2. Infrastructure & Database
Database Schema (Supabase)

We are updating the articles table defined in the Master Schema.

Table: articles

Target Column: competitor_data (Type: JSONB)

Status Column: status (Enum)

State Transition:

Start: status: 'queued'

Process: status: 'researching'

End: status: 'outlining' (and competitor_data is populated)

Failure Handling
- On any exception, persist `status: 'failed'`, `error_message`, and `failed_at_phase` (one of `research`, `outline`, `writing`, `polish`, `trigger`).

Background Job (Trigger.dev)

This entire phase runs inside a Trigger.dev task named generate-blog-post.

3. Implementation Logic
Step A: Fetch Competitor Data (Tavily)

We use Tavily to perform Search + Extraction in one API call to save cost and latency.

Tool: Tavily Search API

Cost: 2 Credits per run (approx $0.002).

Parameters: max_results: 5, include_text: true.

code
TypeScript
download
content_copy
expand_less
// jobs/steps/research.ts (Inside Trigger.dev)

export async function fetchCompetitors(keyword: string) {
  const response = await tavily.search(keyword, {
    search_depth: "advanced", // Deep search for better content
    include_raw_content: false, // We don't need HTML
    include_text: true,         // <--- crucial: gets the parsed main text
    max_results: 5,
  });
  
  // Returns array of { url, title, content }
  return response.results;
}
Step B: The Intelligence Layer (Gemini 3 Pro)

We feed the raw text from Tavily into Gemini 3 Pro. We must clean the "noise" (menus, footers) via the System Prompt, not regex.

Model: Gemini 3 Pro (Required for heavy context window and reasoning).

Input: Stringified JSON of the 5 Tavily results.

The Prompt Strategy:

code
TypeScript
download
content_copy
expand_less
// System Prompt for Gemini 3 Pro
const SYSTEM_PROMPT = `
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
  "sources_summary": { url: string, main_topic: string }[]
}
`;
Step C: Persistence (Supabase Update)

Once Gemini returns the JSON, we must save it to the database so the User Interface can show "Research Complete" and the next AI step (Outlining) can access it.

code
TypeScript
download
content_copy
expand_less
// jobs/generate-blog.ts

// ... inside the Trigger.dev run function ...

// 1. Update Status
await supabase.from('articles').update({ status: 'researching' }).eq('id', articleId);

// 2. Fetch Data
const searchResults = await fetchCompetitors(keyword);

// 3. Analyze Data
const analysis = await gemini3Pro.generateObject({
  prompt: JSON.stringify(searchResults),
  system: SYSTEM_PROMPT,
  schema: CompetitorDataSchema // Defined below
});

// 4. Save to DB
const { error } = await supabase.from('articles').update({
  competitor_data: analysis, // <--- Saves the JSONB
  status: 'outlining'        // <--- Triggers next UI state
}).eq('id', articleId);
4. Data Types (TypeScript)

Define this interface to ensure Type Safety across the app.

code
TypeScript
download
content_copy
expand_less
// types/research.ts

export interface CompetitorData {
  fact_sheet: string[];
  content_gap: {
    missing_topics: string[];
    outdated_info: string;
    user_intent_gaps: string[];
  };
  sources_summary: Array<{
    url: string;
    title: string;
  }>;
}

// zod/researchSchemas.ts
import { z } from 'zod';

export const CompetitorDataSchema = z.object({
  fact_sheet: z.array(z.string()),
  content_gap: z.object({
    missing_topics: z.array(z.string()),
    outdated_info: z.string().optional().default(''),
    user_intent_gaps: z.array(z.string()),
  }),
  sources_summary: z
    .array(z.object({ url: z.string().url(), title: z.string() }))
    .optional()
    .default([]),
});
5. Instructions for Builder

"Create a Trigger.dev job that accepts articleId and keyword.

Use the tavily SDK to fetch 5 results with include_text: true.

Pass the results to Gemini 2.5 Pro with the specified 'Gap Analysis' prompt.

Validate the output is valid JSON.

Update the articles table row with the result in competitor_data column.

Handle errors: If Tavily fails or Gemini fails, update articles status to 'failed'."








Here is the Technical Specification for Phase 3, ready for your AI builder.

Copy this into spec-phase-3-outline.md.

Technical Spec: Phase 3 - The Smart Outline (The Blueprint)
1. Overview

This phase runs immediately after the Research phase within the same Trigger.dev job. It acts as the "Architect." It synthesizes the Gap Analysis (what to write) with the Style DNA (how to write it) to create a structured roadmap.

2. Infrastructure & Database
Database Schema (Supabase)

We are updating the articles table.

Table: articles

Target Column: outline (Type: JSONB)

Status Column: status

State Transition: status: 'outlining' 
→
→
 status: 'writing'

Input Data

To run this step, the system needs:

User_Keyword (from job payload).

Style_DNA (Fetched from brand_voices table using the user's selected style ID).

Competitor_Data (The JSON output from Phase 2).

3. Implementation Logic (Trigger.dev)
The Intelligence Layer (Gemini 3 Pro)

We use Gemini 2.5 Pro because this step requires high-level reasoning to merge "Style" with "Strategy."

Model: Gemini 2.5 Pro.

Input: A composite prompt containing the Keyword, Style JSON, and Gap Analysis JSON.

The Prompt Strategy:

code
TypeScript
download
content_copy
expand_less
// System Prompt for Gemini 2.5 Pro
const SYSTEM_PROMPT = `
You are an expert Content Architect.
Your goal is to outline a high-ranking blog post that beats the competition by filling their "Content Gaps" while strictly adhering to a specific "Brand Voice."

INPUT CONTEXT:
1. KEYWORD: "${keyword}"
2. STYLE DNA: ${JSON.stringify(styleDNA)}
3. COMPETITOR & GAP DATA: ${JSON.stringify(competitorData)}

INSTRUCTIONS:
1. **Title:** Generate a catchy H1 based on the Style DNA (e.g., if style is "Clickbaity", make it clickbait).
2. **Structure:** Create a logical flow of H2 headings.
   - **Mandatory:** You MUST create specific sections that address the "missing_topics" identified in the Competitor Data.
   - **Flow:** Ensure the flow makes sense for a reader.
3. **Instruction Notes:** For EACH section, write a "Drafting Note" for the writer AI.
   - The note must explicitly mention *how* to write that section based on Style DNA.
   - Example: If Style DNA says "use bullet points", the Note should say: "List the pros and cons using bullet points."
   - Example: If Gap Analysis says "competitors missed pricing", the Note should say: "Include a detailed pricing table here as competitors missed this."

OUTPUT SCHEMA (Return strict JSON):
{
  "title": string,
  "sections": [
    {
      "id": number (1-based index),
      "heading": string,
      "instruction_note": string,
      "keywords_to_include": string[]
    }
  ]
}
`;
4. Data Types (TypeScript)

This schema is critical because the Snowball Loop (Phase 4) will iterate through this array.

code
TypeScript
download
content_copy
expand_less
// types/outline.ts

export interface OutlineSection {
  id: number;
  heading: string;
  instruction_note: string; // The "prompt" for the next phase
  keywords_to_include: string[];
}

export interface ArticleOutline {
  title: string;
  sections: OutlineSection[];
}

// zod/outlineSchemas.ts
import { z } from 'zod';

export const ArticleOutlineSchema = z.object({
  title: z.string().min(3).max(200),
  sections: z
    .array(
      z.object({
        id: z.number().int().positive(),
        heading: z.string().min(3).max(200),
        instruction_note: z.string().min(10).max(2000),
        keywords_to_include: z.array(z.string()).max(20),
      })
    )
    .min(1),
});
5. Execution Flow (Code Logic)
code
TypeScript
download
content_copy
expand_less
// jobs/steps/outline.ts

// 1. Fetch the Style DNA (if not already passed in payload)
const styleRecord = await supabase
  .from('brand_voices')
  .select('style_dna')
  .eq('id', payload.voiceId)
  .single();

// Fetch competitor data from Phase 2
const { data: articleRow } = await supabase
  .from('articles')
  .select('competitor_data')
  .eq('id', articleId)
  .single();
const competitorData = CompetitorDataSchema.parse(articleRow?.competitor_data);

// 2. Generate Outline
const outline = await gemini3Pro.generateObject({
  prompt: `Generate an outline for "${keyword}"`,
  system: SYSTEM_PROMPT, // Injects the Gap Analysis & Style DNA
  schema: ArticleOutlineSchema
});

// 3. Save to DB & Advance Workflow
await supabase.from('articles').update({
  outline: outline,        // <--- Saves the Roadmap
  status: 'writing',       // <--- Signals UI to show "Writing..."
  current_step_index: 0,   // <--- Resets the Snowball Loop counter
  raw_content: `# ${outline.title}\n\n` // Initialize draft with Title (Markdown)
}).eq('id', articleId);
6. Instructions for Builder

"Fetch brand_voices data first to get the Style_DNA.

Construct a prompt that forces Gemini 2.5 Pro to look at the Content_Gap (from Phase 2) and create H2 headings specifically to solve those gaps.

The output must be a JSON array of sections.

Initialize the raw_content column in Supabase with the H1 Title so the writing loop has a starting point.

Set current_step_index to 0."


Here is the Technical Specification for Phase 4, ready for your AI builder.

Copy this into spec-phase-4-execution.md.

Technical Spec: Phase 4 - The Execution (The "Snowball" Loop)
1. Overview

This is the core production engine. It executes inside the same Trigger.dev job as the previous phases.
It iterates through the Outline generated in Phase 3. For each section, it feeds the Entire Draft Written So Far back into Gemini 2.0 Flash to ensure perfect context and transitions (The "Snowball Method").

Crucial Feature: It performs a database write to Supabase after every single section is generated. This allows the frontend to stream the article creation in real-time to the user (e.g., "Writing Section 2 of 8...").

2. Infrastructure & Models

Runtime: Trigger.dev (Background Job).

Model: Gemini 2.0 Flash (Selected for 1M+ Token Context Window + Low Cost + High Speed).

Database: Supabase (articles table).

3. The "Authentic Rules" Constant

Create a configuration file to store your proprietary writing rules.

code
TypeScript
download
content_copy
expand_less
// config/golden-rules.ts

export const AUTHENTIC_WRITING_RULES = `
1. Never use the word "delve", "unleash", or "landscape".
2. Use short paragraphs (maximum 3 sentences).
3. Start sentences with conjunctions (And, But, So) occasionally to sound human.
4. Avoid passive voice. Use active verbs.
5. If you mention a statistic, cite the source from the Knowledge Base.
6. Write like you are talking to a friend at a bar, not writing a thesis.
7. [ADD YOUR 2 YEARS OF EXPERIENCE RULES HERE]
`;
4. Prompt Engineering
A. The System Prompt (Static)

This sets the persona and boundaries. It is sent with every loop iteration.

code
TypeScript
download
content_copy
expand_less
const generateSystemPrompt = (styleDNA: any, factSheet: any) => `
You are an expert Blog Writer for a high-traffic publication.

### 1. YOUR VOICE (Style DNA)
Adhere strictly to these parameters:
- Tone: ${styleDNA.tone}
- Sentence Length: ${styleDNA.sentence_structure.avg_length}
- Formatting: ${styleDNA.formatting.use_bullet_points}

### 2. GOLDEN RULES (Non-Negotiable)
${AUTHENTIC_WRITING_RULES}

### 3. KNOWLEDGE BASE (Fact Sheet)
Use these facts for accuracy. Do NOT hallucinate data not found here or in common knowledge.
${JSON.stringify(factSheet)}

### 4. OUTPUT FORMAT
Return **Markdown** formatted text. 
Do NOT include the Section Heading (H2) in your output, the system adds it automatically.
Write ONLY the body content for the section.
`;
B. The User Prompt (The Snowball)

This grows larger with every iteration.

code
TypeScript
download
content_copy
expand_less
const generateUserPrompt = (previousFullText: string, currentSection: any) => `
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
`;
5. Execution Logic (The Loop)
code
TypeScript
download
content_copy
expand_less
// jobs/steps/writing-loop.ts

export async function runSnowballLoop(articleId: string, outline: any, styleDNA: any, competitorData: any) {
  
  // 1. Initialize Draft with Title
  let currentDraft = `# ${outline.title}\n\n`;
  const factSheet = competitorData.fact_sheet; // Extracted from Phase 2 data

  // 2. Iterate through sections
  for (let i = 0; i < outline.sections.length; i++) {
    const section = outline.sections[i];

    // A. Update DB Status (UI shows "Writing Section X...")
    await supabase.from('articles').update({
      current_step_index: i + 1,
      status: 'writing'
    }).eq('id', articleId);

    // B. Call Gemini 2.0 Flash
    const sectionContent = await gemini2Flash.generateText({
      system: generateSystemPrompt(styleDNA, factSheet),
      prompt: generateUserPrompt(currentDraft, section)
    });

    // C. Append to Snowball
    // We add the H2 heading manually here to ensure structure
    const newBlock = `## ${section.heading}\n\n${sectionContent}\n\n`;
    currentDraft += newBlock;

    // D. Real-Time Save
    // This allows the user to see the article growing
    await supabase.from('articles').update({
      raw_content: currentDraft
    }).eq('id', articleId);
    
    // Optional: Add a small delay to avoid rate limits if loop is tight
    await new Promise(r => setTimeout(r, 500)); 
  }

  return currentDraft;
}
6. Instructions for Builder

Model Selection: Ensure you are using the flash variant of Gemini 2.0.

Data Handling: Extract fact_sheet from the competitor_data JSONB column (from Phase 2) before starting the loop.

Formatting: The AI should output Markdown. Do not strip newlines.

Error Handling: If Gemini fails on Section 4, Trigger.dev should retry only Section 4. (This is automatic in Trigger.dev if you wrap the generate call in io.runTask).

Transitions: Pay strict attention to the "Transition Requirement" in the user prompt. This is the key to avoiding the "list of disjointed paragraphs" look.



Note: By injecting your "Authentic Writing Rules" into the System Prompt every time, you force the AI to adhere to your specific quality standards (e.g., "Never start sentences with 'In conclusion'", "Use short paragraphs", etc.).




Here is the Technical Specification for the Final Phase, ready for your AI builder.

Copy this into spec-phase-final-polish.md.

Technical Spec: Final Phase - The Polish (The "Humanizer")
1. Overview

This is the final step of the Trigger.dev workflow. It takes the raw, iteratively generated Markdown draft and subjects it to a "Senior Editor" pass using the most advanced model available.

Goal: Ensure the article reads as a cohesive whole, not a collection of sections, and convert it to clean, semantic HTML.

2. Infrastructure & Models

Runtime: Trigger.dev (Background Job).

Model: Gemini 2.5 Pro (Strict Requirement: Must use the "Advanced Reasoning" model from Screenshot 2).

Input: raw_content (The full Markdown draft from the Snowball Loop).

Output: final_html (Saved to Supabase).

3. Implementation Logic
Step A: The Editor's Prompt

We inject the Style_DNA one last time to ensure the editor doesn't "sanitize" the personality out of the text.

code
TypeScript
download
content_copy
expand_less
// jobs/steps/polish.ts

const generateEditorPrompt = (draft: string, styleDNA: any) => `
You are a Senior Editor at a top-tier publication. 
Your goal is to polish a draft without removing its soul.

### 1. THE DRAFT TO EDIT
${draft}

### 2. THE VOICE (Do NOT Violate)
The author's unique style DNA is:
- Tone: ${styleDNA.tone}
- Sentence Structure: ${styleDNA.sentence_structure.avg_length}
- **CRITICAL:** Do NOT make it sound generic or "AI-generated". Preserve the unique flair, idioms, and formatting quirks.

### 3. YOUR EDITING TASKS
1. **Flow Check:** The draft was written section-by-section. Smooth out any jerky transitions between H2 headers.
2. **Repetition Audit:** Remove repetitive phrases (e.g., "In this digital landscape", "Furthermore").
3. **Fact Check:** Ensure the internal logic holds up.
4. **HTML Conversion:** Convert the final text into clean, semantic HTML (<p>, <h2>, <ul>, <strong>). 
   - Do NOT wrap the result in \`\`\`html code blocks. Return raw HTML string.

### 4. OUTPUT
Return ONLY the final HTML.
`;
Step B: Execution Code (Trigger.dev)
code
TypeScript
download
content_copy
expand_less
// jobs/generate-blog.ts

export async function runPolishPhase(articleId: string, currentDraft: string, styleDNA: any) {
  
  // 1. Update Status
  await supabase.from('articles').update({ status: 'polishing' }).eq('id', articleId);

  // 2. The Strict Editor Pass
  const finalHtml = await io.runTask("final-polish-pass", async () => {
    
    // Using Gemini 2.5 Pro for maximum reasoning capability
    const result = await gemini25Pro.generateText({
      system: "You are a strict, world-class editor.",
      prompt: generateEditorPrompt(currentDraft, styleDNA)
    });

    return result;
  });

  // 3. Final Save & Completion
  const { error } = await supabase.from('articles').update({
    final_html: finalHtml,     // <--- The Production Ready Article
    status: 'completed',       // <--- Triggers "Download" button on UI
    completed_at: new Date()
  }).eq('id', articleId);

  if (error) throw new Error("Failed to save final article");
  
  return finalHtml;
}
4. Instructions for Builder

Model Configuration: Ensure the API client is pointing to the gemini-2.5-pro endpoint (or gemini-pro-1.5 if 2.5 is a typo in your dashboard, but use the best reasoning model available).

Timeout Handling: This step processes 2,000+ words. Ensure the specific Trigger.dev task has a timeout setting of at least 120 seconds.

HTML Sanitization: (Optional but recommended) On the frontend, when displaying this HTML, use a library like dompurify to ensure no malicious scripts were hallucinated (rare, but good practice).

Output Verification: The prompt explicitly asks not to use markdown code fences (html). If the model ignores this, add a regex cleaner: `finalHtml.replace(/^html/, '').replace(/```$/, '')`.

Summary of the Full "Heavy Production" Stack

Tab 1: Tavily + Gemini 3 Pro 
→
→
 Style DNA (JSON).

Research: Tavily + Gemini 3 Pro 
→
→
 Fact Sheet (JSON).

Outline: Gemini 3 Pro 
→
→
 Gap-Filling Outline (JSON).

Execution: Gemini 2.0 Flash + Snowball Loop 
→
→
 Raw Draft (Markdown).

Polish: Gemini 2.5 Pro 
→
→
 Final Content (HTML).

Total Cost per Article: ~$0.06 - $0.08.
Quality: Top Tier (Human-like, Data-backed, SEO-optimized).




Why this wins

Your "Secret Sauce": The fact that you inject your own "Authentic Rules" into the writing loop is the differentiator. Most apps just rely on the model's default training.

No "Frankenstein" text: The Snowball method + Fact Sheet ensures flow.

Data Discipline: By using a Fact_Sheet instead of raw competitor text in the loop, you prevent plagiarism and keep the voice pure.
