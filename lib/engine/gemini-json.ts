import "server-only"

import { getGeminiClient } from "@/utils/gemini/geminiClient"

/** The model every other planning step in this repo already runs on. */
export const ENGINE_MODEL = "gemini-3.7-flash"

/**
 * One structured Gemini call. Retries once, then throws: an engine decision
 * with no model answer must fail visibly, never fall back to filler.
 */
export async function generateJson<T>(
    prompt: string,
    schema: Record<string, unknown>,
    options: { temperature?: number; model?: string } = {},
): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await getGeminiClient().models.generateContent({
                model: options.model ?? ENGINE_MODEL,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    temperature: options.temperature ?? 0.2,
                    responseMimeType: "application/json",
                    responseSchema: schema,
                },
            })
            const text = response.text
            if (!text) throw new Error("empty model response")
            return JSON.parse(text) as T
        } catch (error) {
            lastError = error
        }
    }
    throw new Error(`Model call failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}
