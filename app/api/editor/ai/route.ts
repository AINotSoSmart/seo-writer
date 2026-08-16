import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { createClient } from "@/utils/supabase/server"

const GEMINI_MODEL = "gemini-3.1-flash-lite"

const PROMPTS: Record<string, (text: string) => string> = {
    rewrite: (text) => `Rewrite this text to be clearer and more engaging. Keep the same general meaning but significantly improve the writing quality. Output ONLY the rewritten text, no explanations:

${text}`,

    rephrase: (text) => `Rephrase this text using different words while keeping the exact same meaning. Output ONLY the rephrased text, no explanations:

${text}`,

    improve: (text) => `Improve this text for grammar, clarity, and flow. Fix any errors and make it read more smoothly. Output ONLY the improved text, no explanations:

${text}`,

    simplify: (text) => `Simplify this text for a general audience. Use simpler words and shorter sentences while keeping the meaning. Output ONLY the simplified text, no explanations:

${text}`,

    concise: (text) => `Make this text more concise without losing any key information. Remove unnecessary words and redundant phrases. Output ONLY the concise version, no explanations:

${text}`,

    engaging: (text) => `Make this text more engaging and compelling. Add energy, interest, and make it more captivating to read. Output ONLY the engaging version, no explanations:

${text}`,

    expand: (text) => `Expand this text with more detail, examples, and explanations. Make it more comprehensive while staying on topic. Output ONLY the expanded text, no explanations:

${text}`
}

export async function POST(req: NextRequest) {
    try {
        // 1. Auth check
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            )
        }

        const { text, action } = await req.json()

        if (!text || typeof text !== "string") {
            return NextResponse.json(
                { error: "Text is required" },
                { status: 400 }
            )
        }

        if (!action || !PROMPTS[action]) {
            return NextResponse.json(
                { error: `Invalid action. Valid actions: ${Object.keys(PROMPTS).join(", ")}` },
                { status: 400 }
            )
        }

        // 2. Check token quota (pre-flight).
        // No user id is passed: the RPC reads auth.uid() from the caller's own
        // session. It used to take `p_user_id`, which meant anyone — including
        // an anonymous caller — could name any user.
        const { data: quotaCheck, error: quotaError } = await supabase.rpc(
            'consume_ai_tokens'
        )

        if (quotaError) {
            console.error("Quota check error:", quotaError)
            return NextResponse.json(
                { error: "Failed to check AI quota" },
                { status: 500 }
            )
        }

        if (!quotaCheck?.allowed) {
            const isSubscriptionIssue = quotaCheck?.reason === 'subscription_required'
            return NextResponse.json({
                error: isSubscriptionIssue
                    ? "AI features require an active subscription"
                    : "Monthly AI token quota exceeded",
                reason: quotaCheck?.reason,
                tokens_remaining: quotaCheck?.tokens_remaining ?? 0,
                tokens_used: quotaCheck?.tokens_used ?? 0,
                tokens_limit: quotaCheck?.tokens_limit ?? 200000,
                cycle_resets_at: quotaCheck?.cycle_resets_at
            }, { status: isSubscriptionIssue ? 403 : 402 })
        }

        // 3. Make Gemini API call
        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY!,
        })

        const prompt = PROMPTS[action](text)

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ]
        })

        const resultText = response.text || ""

        // 4. Record actual token usage
        const tokensUsed = response.usageMetadata?.totalTokenCount ?? 0

        const { data: usageResult, error: usageError } = await supabase.rpc(
            'record_ai_usage',
            { p_tokens_used: tokensUsed }
        )

        if (usageError) {
            console.error("Usage recording error:", usageError)
            // Don't fail the request, just log the error
        }

        return NextResponse.json({
            result: resultText.trim(),
            tokens_used: tokensUsed,
            tokens_remaining: usageResult?.tokens_remaining ?? (quotaCheck.tokens_remaining - tokensUsed),
            tokens_limit: usageResult?.tokens_limit ?? quotaCheck.tokens_limit
        })
    } catch (error: any) {
        console.error("AI Editor API Error:", error)
        return NextResponse.json(
            { error: error.message || "Failed to process AI request" },
            { status: 500 }
        )
    }
}
