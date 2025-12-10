// Paragraph-based style presets for writing voice
// Each preset is a comprehensive paragraph describing the writing style

export const STYLE_PRESETS: Record<string, string> = {

  "deep-dive-essay": `Write in an analytical, objective, and comprehensive tone. Use third-person perspective exclusively - never use "I" or "we". Maintain academic formality with longer, complex sentences. Provide historical context where relevant. Cite sources or studies to back up claims. Use transition words to connect complex ideas. Present information as objective analysis. Avoid casual language like "basically", "honestly", "like", "stuff", and "things".`,

  "friendly-tutorial": `Write in an encouraging, helpful, and step-by-step tone. Use "we" when referring to your company/team and address the reader as "you". Never use "I" - you represent the team. Keep sentences medium length with simple complexity. Ask occasional questions to check understanding. Break down complex steps into simple actions. Use analogies to explain technical concepts. Celebrate small wins throughout the guide. Avoid dismissive words like "simply", "just", "easy", and "obviously".`,

  "tech-news-brief": `Write in a fast-paced, factual, and industry-focused tone. Use neutral perspective - avoid personal pronouns and focus on facts. Maintain professional formality with medium-length technical sentences. Lead with the most important news first (BLUF - Bottom Line Up Front). Include quotes from industry leaders when available. Focus on the impact and future implications. Keep the word count tight and efficient. Avoid hype words like "game-changer", "revolutionary", "unprecedented", and "exciting".`,

  "saas-professional": `Write in an authoritative, data-driven, and solution-oriented tone. Use "we" when referring to the company - write as the company voice, not individual. Maintain professional formality with medium-length technical sentences. Focus on business outcomes and ROI. Use data and case studies to support claims. Be confident but not boastful. Address pain points and provide solutions. Avoid buzzwords like "sexy", "game-changer", "unlock", "leverage", "synergy", and "disrupt".`,
}
