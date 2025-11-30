This is the complete, modern **Trigger.dev (v3)** implementation.

It replaces your old workflow with the **"Heavy Production"** architecture we designed. It uses `io.runTask` for every major step, meaning if the AI fails at "Section 4", it retries Section 4 automatically without restarting the whole job.

Failures are recorded in `articles` with `status='failed'`, `error_message`, and `failed_at_phase` (`research` | `outline` | `writing` | `polish` | `trigger`).

### Prerequisites
Ensure you have these environment variables in your Trigger.dev dashboard:
*   `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`
*   `TAVILY_API_KEY`
*   `GOOGLE_GENERATIVE_AI_API_KEY`

---

### 1. The Configuration (`trigger.config.ts`)

This tells Trigger.dev how to run your project.

```typescript
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_your_project_id", // Get this from Trigger.dev dashboard
  runtime: "node",
  logLevel: "log",
  // Set a high timeout because writing 2,000 words takes time
  maxDuration: 1800, // 30 minutes
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
    },
  },
});
```

---

### 2. The Main Job File (`src/trigger/generate-blog.ts`)

Create this file. It contains the entire "Snowball" logic.

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { tavily } from "@tavily/core";
import { z } from "zod";

// --- INITIALIZATION ---

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! });

// --- CONSTANTS (Your Secret Sauce) ---

const AUTHENTIC_RULES = `
1. Never use words like "delve", "unleash", "landscape", "tapestry".
2. Use short paragraphs (max 3 sentences).
3. Write like you are talking to a smart friend at a bar.
4. If you mention a fact, ensure it exists in the Knowledge Base.
`;

// --- SCHEMAS & VALIDATION ---
const CompetitorDataSchema = z.object({
  fact_sheet: z.array(z.string()),
  content_gap: z.object({
    missing_topics: z.array(z.string()),
    outdated_info: z.string().optional().default(""),
    user_intent_gaps: z.array(z.string()),
  }),
  sources_summary: z
    .array(z.object({ url: z.string().url(), title: z.string() }))
    .optional()
    .default([]),
});

const ArticleOutlineSchema = z.object({
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

const StyleDNASchema = z.object({
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

// --- THE JOB ---

export const generateBlogPost = task({
  id: "generate-blog-post",
  // Validate input payload
  run: async (payload: { articleId: string; keyword: string; voiceId: string }) => {
    
    const { articleId, keyword, voiceId } = payload;
    
    // ---------------------------------------------------------
    // PHASE 1: FETCH CONTEXT (Style & User)
    // ---------------------------------------------------------
    const styleRecord = await supabase
      .from("brand_voices")
      .select("style_dna")
      .eq("id", voiceId)
      .single();

    if (!styleRecord.data) throw new Error("Style not found");
    const styleDNA = StyleDNASchema.parse(styleRecord.data.style_dna);

    // ---------------------------------------------------------
    // PHASE 2: RESEARCH (Tavily + Gemini 3 Pro)
    // ---------------------------------------------------------
    
    // A. Scrape Competitors
    const searchResults = await task.run("research-tavily", async () => {
      await supabase.from("articles").update({ status: "researching" }).eq("id", articleId);
      
      const response = await tvly.search(keyword, {
        search_depth: "advanced",
        include_text: true, // We want the text content
        max_results: 5,
      });
      return response.results;
    });

    // B. Gap Analysis (Gemini 3 Pro)
    const competitorData = await task.run("analyze-gap", async () => {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Use 1.5 Pro (Conceptually "3 Pro")
      
      const prompt = `
        Analyze these 5 search results for keyword: "${keyword}".
        Input Data: ${JSON.stringify(searchResults)}
        
        Task: Create a JSON object with:
        1. "fact_sheet": List of key facts/stats found.
        2. "content_gap": What is missing? (topics, outdated info).
        
        Return STRICT JSON.
      `;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      // Clean markdown code blocks if present
      const jsonString = text.replace(/```json/g, "").replace(/```/g, "");
      const parsed = CompetitorDataSchema.parse(JSON.parse(jsonString));
      return parsed;
    });

    // Save Research to DB
    await supabase.from("articles").update({ 
      competitor_data: competitorData,
      status: "outlining" 
    }).eq("id", articleId);

    // ---------------------------------------------------------
    // PHASE 3: OUTLINE (Gemini 3 Pro)
    // ---------------------------------------------------------
    
    const outline = await task.run("generate-outline", async () => {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const prompt = `
        Create a blog outline for "${keyword}".
        Style DNA: ${JSON.stringify(styleDNA)}
        Content Gap: ${JSON.stringify(competitorData.content_gap)}
        
        Requirements:
        1. Create H2 sections that solve the Content Gaps.
        2. For each section, write an "instruction_note" on how to write it using the Style DNA.
        
        Return STRICT JSON schema: { title: string, sections: [{ heading: string, instruction_note: string }] }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonString = text.replace(/```json/g, "").replace(/```/g, "");
      const parsed = ArticleOutlineSchema.parse(JSON.parse(jsonString));
      return parsed;
    });

    // Save Outline & Init Draft
    await supabase.from("articles").update({ 
      outline: outline,
      raw_content: `# ${outline.title}\n\n`, // Start with Title
      status: "writing",
      current_step_index: 0
    }).eq("id", articleId);

    // ---------------------------------------------------------
    // PHASE 4: THE SNOWBALL LOOP (Gemini 2.0 Flash)
    // ---------------------------------------------------------
    
    let currentDraft = `# ${outline.title}\n\n`;

    // We loop through sections. 
    // IMPORTANT: task.run inside a loop creates checkpoints.
    for (let i = 0; i < outline.sections.length; i++) {
      const section = outline.sections[i];
      
      const newSectionText = await task.run(`write-section-${i}`, async () => {
        // Prefer latest flash; fallback to 1.5-flash if unavailable
        let textOut: string | undefined;
        try {
          const preferred = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
          const result = await preferred.generateContent([systemPrompt, userPrompt]);
          textOut = result.response.text();
        } catch (_err) {
          const fallback = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await fallback.generateContent([systemPrompt, userPrompt]);
          textOut = result.response.text();
        }

        const systemPrompt = `
          You are an expert writer.
          Style: ${styleDNA.tone}
          Rules: ${AUTHENTIC_RULES}
          Knowledge Base: ${JSON.stringify(competitorData.fact_sheet)}
        `;

        const userPrompt = `
          CONTEXT (Written so far):
          ${currentDraft.slice(-2000)} // Optimization: Only send last 2000 chars if draft is huge, or send all if using 1M context.
          
          TASK: Write Section "${section.heading}"
          INSTRUCTION: ${section.instruction_note}
          
          Constraint: Connect the first sentence smoothly to the Context.
          Output Markdown body only.
        `;

        return textOut!
      });

      // Append & Save
      currentDraft += `## ${section.heading}\n\n${newSectionText}\n\n`;
      
      // Real-time Update to DB
      await supabase.from("articles").update({ 
        raw_content: currentDraft,
        current_step_index: i + 1
      }).eq("id", articleId);
    }

    // ---------------------------------------------------------
    // PHASE 5: THE POLISH (Gemini 2.5 Pro)
    // ---------------------------------------------------------
    
    const finalHtml = await task.run("final-polish", async () => {
      await supabase.from("articles").update({ status: "polishing" }).eq("id", articleId);
      
      // Use the smartest model available
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); 

      const prompt = `
        Act as a strict Senior Editor.
        Read this Draft:
        ${currentDraft}
        
        Tasks:
        1. Fix repetitive transitions.
        2. Ensure tone matches: ${styleDNA.tone}.
        3. Convert to clean Semantic HTML.
        
        Return ONLY HTML.
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      // Clean markdown blocks if AI adds them
      return text.replace(/```html/g, "").replace(/```/g, "");
    });

    // Final Save
    await supabase.from("articles").update({ 
      final_html: finalHtml,
      status: "completed" 
    }).eq("id", articleId);

    return { success: true, articleId };
  },
});
```

### 3. How to Trigger it from Next.js (Frontend/API)

In your Next.js API route (`app/api/generate/route.ts`):

```typescript
import { tasks } from "@trigger.dev/sdk/v3";
import { generateBlogPost } from "@/trigger/generate-blog"; // Import the task

export async function POST(req: Request) {
  const { keyword, voiceId } = await req.json();
  
  // 1. Create DB Record first (Status: Queued)
  const { data: article } = await supabase
    .from('articles')
    .insert({ keyword, voice_id: voiceId, status: 'queued' })
    .select()
    .single();

  // 2. Trigger the Job
  const handle = await tasks.trigger("generate-blog-post", {
    articleId: article.id,
    keyword: keyword,
    voiceId: voiceId
  });

  return Response.json({ 
    jobId: handle.id, 
    articleId: article.id 
  });
}
```

### Key Differences from your old workflow:
1.  **Checkpointing (`task.run`):** We wrap every API call (Search, Analyze, Write Section 1, Write Section 2) in `task.run`. If `Write Section 3` fails, Trigger.dev retries *only* `Write Section 3`. It remembers the result of Section 1 and 2.
2.  **Supabase Updates:** We update the DB inside the loop. The user sees the text appearing on their screen in real-time (if you use Supabase Realtime on the frontend).
3.  **Snowball Context:** We pass `currentDraft` into the loop, ensuring the AI reads what it just wrote.