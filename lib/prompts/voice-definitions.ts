/**
 * Voice Definitions Library
 * 
 * Descriptive definitions for formality levels and perspectives.
 * These provide explicit, actionable rules for the AI instead of vague labels.
 */

export const FORMALITY_DEFINITIONS: Record<string, string> = {
    casual: `
**CASUAL TONE RULES:**
- Use contractions freely (you're, it's, don't, can't)
- Short, punchy sentences. One idea per line.
- Rhetorical questions to engage the reader
- Okay to use: "honestly", "basically", "here's the thing"
- Conversational transitions: "So,", "Now,", "Look,"
- Avoid: Corporate jargon, passive voice, long complex sentences
- Example: "Here's the thing—most people overthink this."
- Example: "Honestly? This tool just works."
`,

    professional: `
**PROFESSIONAL TONE RULES:**
- Use contractions sparingly and naturally (it's, don't are fine; ain't is not)
- Clear, direct sentences. No fluff or filler words.
- Active voice. Subject-verb-object structure.
- Data and evidence over opinions
- Confident but not arrogant
- Avoid: Slang, overly casual phrases, emojis, exclamation marks
- Avoid: "sexy", "game-changer", "unlock", "leverage", "synergy"
- Example: "The data shows a 40% improvement in conversion rates."
- Example: "This approach reduces deployment time by half."
`,

    formal: `
**FORMAL TONE RULES:**
- No contractions (do not, it is, cannot, will not)
- Complete, structured sentences with proper grammar
- Third-person perspective preferred
- Use industry-standard terminology precisely
- Measured, objective statements
- Avoid: Colloquialisms, first-person pronouns, rhetorical questions
- Avoid: Casual expressions, humor, informal transitions
- Example: "This analysis demonstrates the efficacy of the proposed solution."
- Example: "The organization has implemented measures to ensure compliance."
`,

    academic: `
**ACADEMIC TONE RULES:**
- No contractions. Precise, technical vocabulary.
- Passive voice acceptable for objectivity ("It was observed that...")
- Cite evidence, research, and authoritative sources
- Hedge statements appropriately ("suggests", "indicates", "may")
- Avoid absolute claims without evidence
- Avoid: Absolutes, subjective claims, informal language, personal anecdotes
- Example: "The findings suggest a significant correlation between X and Y."
- Example: "Previous research indicates that this approach may yield improved outcomes."
`
}

export const PERSPECTIVE_DEFINITIONS: Record<string, string> = {
    "first-person": `
**PERSPECTIVE: FIRST-PERSON (I)**
- Write as an individual expert sharing personal experiences
- Use "I" for opinions and experiences: "I recommend...", "I've tested...", "In my experience..."
- Share personal anecdotes and lessons learned when relevant
- Be opinionated but always back it up with facts or reasoning
- Okay to admit uncertainty: "I'm not 100% sure, but..."
- Creates intimacy and trust with the reader
`,

    "third-person": `
**PERSPECTIVE: THIRD-PERSON (Objective Observer)**
- Never use "I" or "We" pronouns
- Write as an objective, external observer
- Use "users", "developers", "companies", "teams" as subjects
- Present information as facts, not personal opinions
- Example: "Developers often find that..." NOT "I find that..."
- Example: "Users report improved performance..." NOT "We've seen..."
- Creates authority and objectivity
`,

    "brand-we": `
**PERSPECTIVE: BRAND-WE (Company/Team Voice)**
- Use "We" to represent the company, team, or brand
- Never use "I" (you are not speaking as an individual)
- Use phrases like: "Our team", "We recommend", "Our solution", "We've built"
- When discussing your own product: "We designed X to...", "Our tool handles..."
- When discussing competitors: Be fair and factual, but highlight your strengths
- Creates sense of team/community behind the content
`,

    neutral: `
**PERSPECTIVE: NEUTRAL (Minimal Pronouns)**
- Minimize personal pronouns entirely
- Focus on the subject matter, not the narrator
- Use passive voice or imperative mood
- Example: "This guide covers..." NOT "I'll show you..."
- Example: "Consider using..." NOT "We recommend..."
- Example: "The tool provides..." NOT "Our tool provides..."
- Creates maximum objectivity and focus on content
`
}

/**
 * Get formality definition, with fallback to professional
 */
export const getFormalityDefinition = (formality: string): string => {
    return FORMALITY_DEFINITIONS[formality] || FORMALITY_DEFINITIONS.professional
}

/**
 * Get perspective definition, with fallback to neutral
 */
export const getPerspectiveDefinition = (perspective: string): string => {
    return PERSPECTIVE_DEFINITIONS[perspective] || PERSPECTIVE_DEFINITIONS.neutral
}
