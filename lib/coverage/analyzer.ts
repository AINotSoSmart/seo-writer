import { createAdminClient } from "@/utils/supabase/admin"
import { getGeminiClient } from "@/utils/gemini/geminiClient"
import { generateEmbedding } from "@/lib/gemini-embedding"

// Type for admin Supabase client
type AdminSupabaseClient = ReturnType<typeof createAdminClient>

// The 6 Intent Roles for content strategy
export const INTENT_ROLES = [
    "Core Answer",      // What is X? How does X work?
    "Decision",         // Should I use X? Is X worth it?
    "Comparison",       // X vs Y, Best X tools
    "Problem-Specific", // Fix [specific issue] with X
    "Emotional/Use-Case", // Bringing grandparents photos back to life
    "Authority/Edge"    // How X actually works, why some X fail
] as const

export type IntentRole = typeof INTENT_ROLES[number]

export interface AnswerUnit {
    cluster: string       // e.g., "AI Photo Restoration"
    question: string      // Full user question, e.g., "How much does AI restoration cost?"
    intentRole: IntentRole
}

export interface CoverageData {
    id: string
    cluster: string
    answer_unit: string
    coverage_state: "partial" | "strong" | "dominant"
    first_covered_by: string | null
}

/**
 * Article outline type for coverage analysis
 */
export interface ArticleOutline {
    title: string;
    intro?: {
        instruction_note: string;
        keywords_to_include?: string[];
    };
    sections: Array<{
        id?: number;
        level?: number;
        heading: string;
        instruction_note?: string;
        keywords_to_include?: string[];
        needs_image?: boolean | null;
        image_type?: string | null;
        external_link?: { url: string; anchor_context: string } | null;
        internal_link?: { url: string; title: string; anchor_context: string } | null;
    }>;
}

/**
 * Analyzes the article outline to extract "Answer Units" —
 * the distinct user questions the article meaningfully answers.
 * Uses the structured outline (headings + instruction_notes) instead of 
 * full article content to reduce token costs by ~80%.
 * Then upserts this data into the `answer_coverage` table.
 */
export async function analyzeArticleCoverage(
    articleId: string,
    outline: ArticleOutline,
    keyword: string,
    cluster: string,
    userId: string,
    brandId: string | null,
    adminClient?: AdminSupabaseClient
) {
    const genAI = getGeminiClient()
    const supabase = adminClient ?? createAdminClient()

    // Format outline for the prompt - compact but informative
    const outlineSummary = [
        `TITLE: ${outline.title}`,
        outline.intro ? `\nINTRO: ${outline.intro.instruction_note}` : '',
        '\nSECTIONS:',
        ...outline.sections.map(s => {
            const parts = [`- H${s.level || 2}: ${s.heading}`]
            if (s.instruction_note) parts.push(`  Coverage: ${s.instruction_note}`)
            if (s.keywords_to_include?.length) parts.push(`  Keywords: ${s.keywords_to_include.join(', ')}`)
            return parts.join('\n')
        })
    ].join('\n')

    const prompt = `
You are an expert SEO analyst. Analyze the following blog article OUTLINE and extract the distinct USER QUESTIONS that this article meaningfully answers.

ARTICLE KEYWORD: "${keyword}"
CLUSTER: "${cluster}"

ARTICLE OUTLINE:
${outlineSummary}

YOUR TASK:
1. Identify 3-7 distinct user questions that this article answers well based on the outline.
2. For each question, classify its "Intent Role" from these options:
   - "Core Answer" (What is X? How does X work?)
   - "Decision" (Should I use X? Is X worth it?)
   - "Comparison" (X vs Y, Best X tools)
   - "Problem-Specific" (Fix [specific issue] with X)
   - "Emotional/Use-Case" (Personal stories, emotional connection)
   - "Authority/Edge" (Deep expertise, edge cases, why things fail)

RULES:
- Each question must be a FULL user question, not a tag/label.
  ✅ "How much does AI photo restoration cost?"
  ❌ "cost"
- Derive questions from what each section's heading and instruction_note says it covers.
- Only include questions that are MEANINGFULLY covered (have dedicated sections or substantial coverage).
- Assign a coverage strength:
  - "partial": Mentioned but not deeply covered
  - "strong": Dedicated section or comprehensive answer
  - "dominant": THE authoritative answer on this question

OUTPUT (Strict JSON Array):
[
  {
    "question": "How much does AI photo restoration cost?",
    "intent_role": "Decision",
    "coverage_strength": "strong"
  }
]
`

    try {
        const response = await genAI.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        })

        const text = response.text || "[]"
        let answerUnits: Array<{
            question: string
            intent_role: string
            coverage_strength: "partial" | "strong" | "dominant"
        }> = []

        try {
            answerUnits = JSON.parse(text.replace(/```json/g, "").replace(/```/g, ""))
        } catch (parseError) {
            console.error("[Coverage Analyzer] Failed to parse LLM response:", parseError)
            return
        }

        if (!Array.isArray(answerUnits) || answerUnits.length === 0) {
            return
        }

        // Upsert each answer unit into the database
        for (const unit of answerUnits) {
            // Generate embedding for the answer unit
            let embeddingForDb: string | null = null
            try {
                const embedding = await generateEmbedding(unit.question)
                embeddingForDb = JSON.stringify(embedding)
            } catch (e) {
                console.warn(`[Coverage Analyzer] Failed to generate embedding for "${unit.question}"`)
            }

            // Cast to any to bypass type checking until migration runs and types are regenerated
            const { error } = await (supabase as any)
                .from("answer_coverage")
                .upsert({
                    user_id: userId,
                    brand_id: brandId,
                    cluster: cluster,
                    answer_unit: unit.question,
                    coverage_state: unit.coverage_strength,
                    first_covered_by: articleId,
                    last_updated_at: new Date().toISOString(),
                    answer_embedding: embeddingForDb
                }, {
                    onConflict: "user_id,brand_id,cluster,answer_unit"
                })

            if (error) {
                console.error(`[Coverage Analyzer] Failed to upsert answer unit "${unit.question}":`, error.message)
            }
        }

    } catch (error: any) {
        console.error("[Coverage Analyzer] Error analyzing article:", error.message)
    }
}

/**
 * Fetches existing coverage data for a user/brand to inform strategic planning.
 */
export async function getCoverageContext(
    userId: string,
    brandId: string | null,
    cluster?: string
): Promise<CoverageData[]> {
    const supabase = createAdminClient()

    // Cast to any to bypass type checking until migration runs and types are regenerated
    let query = (supabase as any)
        .from("answer_coverage")
        .select("id, cluster, answer_unit, coverage_state, first_covered_by")
        .eq("user_id", userId)

    if (brandId) {
        query = query.eq("brand_id", brandId)
    }

    if (cluster) {
        query = query.eq("cluster", cluster)
    }

    const { data, error } = await query

    if (error) {
        console.error("[Coverage Context] Failed to fetch coverage:", error.message)
        return []
    }

    return (data || []) as CoverageData[]
}

/**
 * Summarizes coverage by state for strategic planning prompts.
 */
export function summarizeCoverage(coverageData: CoverageData[]): {
    stronglyAnswered: string[]
    partiallyAnswered: string[]
    totalCoverage: number
} {
    const stronglyAnswered = coverageData
        .filter(c => c.coverage_state === "strong" || c.coverage_state === "dominant")
        .map(c => c.answer_unit)

    const partiallyAnswered = coverageData
        .filter(c => c.coverage_state === "partial")
        .map(c => c.answer_unit)

    return {
        stronglyAnswered,
        partiallyAnswered,
        totalCoverage: coverageData.length
    }
}
