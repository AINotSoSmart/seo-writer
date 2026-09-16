import { getGeminiClient } from "@/utils/gemini/geminiClient"
import type { ContentDocument } from "./content-document.ts"
import { applySectionChanges } from "./patch-applier.ts"
import type { ContentPatch, SectionChange } from "./patch-types.ts"

export interface GeneratePatchInput {
    document: ContentDocument
    buyerQuestions: string[]
    brandName: string
    productTruth?: string
    capabilityFacts?: Array<string | { quote: string }>
    frozenLinks?: Array<{ url: string; title: string }>
}

const PATCH_GENERATION_SCHEMA = {
    type: "OBJECT" as const,
    properties: {
        changes: {
            type: "ARRAY" as const,
            items: {
                type: "OBJECT" as const,
                properties: {
                    operation: {
                        type: "STRING" as const,
                        description: "Operation type: 'insert_after', 'replace_section', or 'insert_before'",
                    },
                    sectionId: {
                        type: "STRING" as const,
                        description: "The exact id of the target section in the existing document",
                    },
                    reason: {
                        type: "STRING" as const,
                        description: "Which specific buyer question/gap this change answers and why",
                    },
                    newHeading: {
                        type: "STRING" as const,
                        description: "The heading text for this new or updated section",
                    },
                    newContent: {
                        type: "STRING" as const,
                        description: "Complete HTML content (paragraphs, lists, bold points) for this section",
                    },
                },
                required: ["operation", "sectionId", "reason", "newHeading", "newContent"],
            },
        },
    },
    required: ["changes"],
}

export function buildPatchPrompt(input: GeneratePatchInput): string {
    const { document, buyerQuestions, brandName, productTruth, capabilityFacts, frozenLinks } = input

    const sectionOutline = document.sections
        .map((s, idx) => `[ID: "${s.id}"] Heading: "${s.heading}" (Level ${s.level})\nExcerpt: ${s.text.slice(0, 250)}...`)
        .join("\n\n")

    return `You are an expert editorial consultant and SEO architect specializing in updating and improving existing web pages.

We are improving an existing live page to capture lost AI search visibility. Answer engines (ChatGPT, Google AI, Perplexity) currently answer buyer queries without recommending or citing our brand, because this page omits or under-answers critical buyer questions.

GOAL:
Produce minimal, high-impact section patches. Do NOT rewrite the entire page. Only insert new sections or update existing sections where necessary to directly address the missing buyer questions.

PAGE BEING IMPROVED:
Title: "${document.title}"
URL: "${document.url}"

CURRENT SECTIONS:
${sectionOutline}

MISSING BUYER QUESTIONS TO ANSWER:
${buyerQuestions.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

BRAND & CONTEXT:
Brand Name: ${brandName}
${productTruth ? `Product Truth:\n${productTruth}\n` : ""}${
        capabilityFacts && capabilityFacts.length
            ? `Verified Capabilities:\n${capabilityFacts.map((f) => `- ${typeof f === "string" ? f : f.quote}`).join("\n")}\n`
            : ""
}${
        frozenLinks && frozenLinks.length
            ? `REQUIRED LINKS TO INCLUDE:
You MUST naturally include the following internal link(s) in the generated newContent using standard <a href="URL">Anchor</a>:
${frozenLinks.map((l) => `- URL: ${l.url} | Anchor text suggestion: ${l.title}`).join("\n")}
`
            : ""
}

INSTRUCTIONS:
1. Choose the best existing section ID as the target anchor for each change.
2. Typically prefer 'insert_after' to append a new dedicated H2 section (e.g., after the most relevant existing section).
3. If an existing section directly touches the topic but has outdated or incomplete advice, use 'replace_section'.
4. In 'newContent', output clean HTML (<p>, <ul>, <li>, <strong>). Write thorough, authoritative, helpful advice that definitively answers the buyer question.
5. In 'reason', clearly explain which buyer question is answered.
6. Ensure any required links are placed naturally in context.
`
}

export async function generateContentPatch(
    input: GeneratePatchInput,
): Promise<ContentPatch> {
    const { document } = input

    // If no buyer questions, return unchanged document
    if (!input.buyerQuestions.length) {
        return applySectionChanges(document, [])
    }

    try {
        const client = getGeminiClient()
        const response = await client.models.generateContent({
            model: "gemini-3.7-flash",
            contents: [
                {
                    role: "user",
                    parts: [{ text: buildPatchPrompt(input) }],
                },
            ],
            config: {
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: PATCH_GENERATION_SCHEMA,
            },
        })

        const parsed = JSON.parse(response.text || "{}") as {
            changes?: Array<{
                operation?: string
                sectionId?: string
                reason?: string
                newHeading?: string
                newContent?: string
            }>
        }

        const rawChanges = Array.isArray(parsed.changes) ? parsed.changes : []
        const validChanges: SectionChange[] = []

        const allowedOps = new Set(["insert_after", "replace_section", "insert_before", "delete_section"])
        const knownSectionIds = new Set(document.sections.map((s) => s.id))

        for (const item of rawChanges) {
            const op = (item.operation || "insert_after").toLowerCase() as SectionChange["operation"]
            if (!allowedOps.has(op)) continue

            let sectionId = item.sectionId || ""
            if (!knownSectionIds.has(sectionId)) {
                // Fall back to the last section or first section
                sectionId = document.sections[document.sections.length - 1]?.id || "intro"
            }

            validChanges.push({
                operation: op,
                sectionId,
                reason: item.reason || "Addresses measured buyer intent gap",
                newHeading: item.newHeading || "Additional Information",
                newContent: item.newContent || "",
            })
        }

        // Deterministically apply changes onto the ContentDocument
        return applySectionChanges(document, validChanges)
    } catch (error) {
        console.error("[generateContentPatch] Gemini patch generation failed:", error)
        // Fallback: create a basic append change so the pipeline never hangs
        const fallbackChange: SectionChange = {
            operation: "insert_after",
            sectionId: document.sections[document.sections.length - 1]?.id || "intro",
            reason: "Answers target buyer questions",
            newHeading: "Key Recommendations & Practical Considerations",
            newContent: `<p>When evaluating solutions for ${input.buyerQuestions[0] || document.title}, consider workflow compatibility, ease of implementation, and long-term maintainability.</p>`,
        }
        return applySectionChanges(document, [fallbackChange])
    }
}
