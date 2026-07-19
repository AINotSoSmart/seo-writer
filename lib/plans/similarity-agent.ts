
import { getGeminiClient } from "@/utils/gemini/geminiClient"

const GEMINI_MODEL = "gemini-3.1-flash-lite"

/**
 * Check if two topics are semantically identical using Gemini
 */
export async function checkSimilarityWithAgent(newTopic: string, existingTopic: string): Promise<boolean> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_KEY

    if (!apiKey) {
        console.warn("[Deduplication] ⚠️ GEMINI_API_KEY not found, skipping agent check")
        return false // Fail open
    }

    try {
        const client = getGeminiClient()

        const prompt = `
        You represent a semantic deduplication system for an SEO content writer.
        Determine if the following two article topics are semantically the SAME intent and cover the SAME core subject matter.
        
        Topic A (New): "${newTopic}"
        Topic B (Existing): "${existingTopic}"
        
        GUIDELINES:
        1. Focus on the USER GOAL. If a user searching for Topic A would be satisfied by an article about Topic B, they are duplicates.
        2. Ignore minor wording differences (e.g., "How to get cited" vs "How to get mentioned").
        3. Ignore title structures (e.g., "Top 10" vs "Best").
        4. Distinguish intent: "What is CRM?" (Definition) is DIFFERENT from "Best CRM Software" (Commercial).
        
        If they are effectively the same article and writing Topic A would be redundant keyword cannibalization, answer YES.
        If they target distinct intents or audiences, answer NO.
        
        Answer ONLY with "YES" or "NO".
        `

        const response = await client.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        })

        const text = response.text ? response.text.trim().toUpperCase() : ""

        console.log(`[Deduplication] 🤖 Agent Check: "${newTopic}" vs "${existingTopic}" -> ${text}`)

        return text.includes("YES")
    } catch (error) {
        console.error("[Deduplication] ❌ Agent check failed:", error)
        return false // Fail open
    }
}
