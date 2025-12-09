import { StyleDNA } from "@/lib/schemas/style"

export const STYLE_PRESETS: Record<string, StyleDNA> = {
  "linkedin-influencer": {
    tone: "Professional yet conversational, punchy, and slightly provocative",
    perspective: "first-person",
    formality: "casual",
    sentence_structure: {
      avg_length: "short",
      complexity: "simple",
      use_of_questions: true,
    },
    narrative_rules: [
      "Start with a strong hook or controversial statement",
      "Use one-line paragraphs for emphasis",
      "End with a call to action or question",
      "Focus on personal lessons learned",
      "Use 'I' to share personal experiences and opinions",
    ],
    avoid_words: ["leverage", "synergy", "paradigm", "disrupt", "thought leader"],
  },

  "deep-dive-essay": {
    tone: "Analytical, objective, and comprehensive",
    perspective: "third-person",
    formality: "academic",
    sentence_structure: {
      avg_length: "long",
      complexity: "academic",
      use_of_questions: false,
    },
    narrative_rules: [
      "Provide historical context where relevant",
      "Cite sources or studies to back up claims",
      "Use transition words to connect complex ideas",
      "Never use first-person pronouns (I, we)",
      "Present information as objective analysis",
    ],
    avoid_words: ["basically", "honestly", "like", "stuff", "things"],
  },

  "friendly-tutorial": {
    tone: "Encouraging, helpful, and step-by-step",
    perspective: "brand-we",
    formality: "professional",
    sentence_structure: {
      avg_length: "medium",
      complexity: "simple",
      use_of_questions: true,
    },
    narrative_rules: [
      "Address the reader as 'you'",
      "Break down complex steps into simple actions",
      "Use analogies to explain technical concepts",
      "Celebrate small wins throughout the guide",
      "Use 'we' when referring to your company/team",
      "Never use 'I' - you represent the team",
    ],
    avoid_words: ["simply", "just", "easy", "obviously"],
  },

  "tech-news-brief": {
    tone: "Fast-paced, factual, and industry-focused",
    perspective: "neutral",
    formality: "professional",
    sentence_structure: {
      avg_length: "medium",
      complexity: "technical",
      use_of_questions: false,
    },
    narrative_rules: [
      "Lead with the most important news first (BLUF)",
      "Include quotes from industry leaders when available",
      "Focus on the impact and future implications",
      "Keep the word count tight and efficient",
      "Avoid personal pronouns - focus on facts",
    ],
    avoid_words: ["game-changer", "revolutionary", "unprecedented", "exciting"],
  },

  "saas-professional": {
    tone: "Authoritative, data-driven, and solution-oriented",
    perspective: "brand-we",
    formality: "professional",
    sentence_structure: {
      avg_length: "medium",
      complexity: "technical",
      use_of_questions: false,
    },
    narrative_rules: [
      "Focus on business outcomes and ROI",
      "Use data and case studies to support claims",
      "Write as the company voice, not individual",
      "Be confident but not boastful",
      "Address pain points and provide solutions",
    ],
    avoid_words: ["sexy", "game-changer", "unlock", "leverage", "synergy", "disrupt"],
  },
}
