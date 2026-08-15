import { getGeminiClient } from "@/utils/gemini/geminiClient"

/**
 * Generates an embedding for a piece of text using Gemini.
 * Enforces 768 dimensions to match the Postgres vector(768) columns.
 */
export async function generateEmbedding(text: string, taskType?: string): Promise<number[]> {
    try {
        const genAI = getGeminiClient()
        const result = await genAI.models.embedContent({
            model: "gemini-embedding-001",
            config: {
                outputDimensionality: 768,
            },
            contents: [{ parts: [{ text }] }],
            taskType: taskType
        } as any)

        const embedding = result.embeddings?.[0]?.values || []

        if (!embedding || embedding.length === 0) {
            throw new Error("Failed to get embedding values from Gemini response")
        }

        return embedding
    } catch (error) {
        console.error("❌ Error generating embedding:", error)
        throw error
    }
}
