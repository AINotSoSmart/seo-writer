import { StyleDNA } from "@/lib/schemas/style"

export const STYLE_PRESETS: Record<string, StyleDNA> = {
  "linkedin-influencer": {
    tone: "Professional yet conversational, punchy, and slightly provocative",
    sentence_structure: {
      avg_length: "short",
      complexity: "simple",
      use_of_questions: true,
    },
    formatting: {
      use_bullet_points: "frequent",
      header_style: "clickbaity",
      bold_key_phrases: true,
    },
    vocabulary: {
      level: "Grade 8",
      jargon_usage: "minimal",
      forbidden_words: ["delve", "tapestry", "landscape", "moreover", "furthermore"],
    },
    narrative_rules: [
      "Start with a strong hook or controversial statement",
      "Use one-line paragraphs for emphasis",
      "End with a call to action or question",
      "Focus on personal lessons learned",
    ],
  },
  "deep-dive-essay": {
    tone: "Analytical, objective, and comprehensive",
    sentence_structure: {
      avg_length: "long",
      complexity: "academic",
      use_of_questions: false,
    },
    formatting: {
      use_bullet_points: "rare",
      header_style: "declarative",
      bold_key_phrases: false,
    },
    vocabulary: {
      level: "Grade 12",
      jargon_usage: "explained",
      forbidden_words: ["literally", "basically", "stuff", "things", "amazing"],
    },
    narrative_rules: [
      "Provide historical context where relevant",
      "Cite sources or studies to back up claims",
      "Use transition words to connect complex ideas",
      "Avoid first-person pronouns unless necessary",
    ],
  },
  "friendly-tutorial": {
    tone: "Encouraging, helpful, and step-by-step",
    sentence_structure: {
      avg_length: "medium",
      complexity: "simple",
      use_of_questions: true,
    },
    formatting: {
      use_bullet_points: "frequent",
      header_style: "question-based",
      bold_key_phrases: true,
    },
    vocabulary: {
      level: "Grade 8",
      jargon_usage: "minimal",
      forbidden_words: ["complicated", "difficult", "impossible", "expert-only"],
    },
    narrative_rules: [
      "Address the reader as 'you'",
      "Break down complex steps into simple actions",
      "Use analogies to explain technical concepts",
      "Celebrate small wins throughout the guide",
    ],
  },
  "tech-news-brief": {
    tone: "Fast-paced, factual, and industry-focused",
    sentence_structure: {
      avg_length: "medium",
      complexity: "technical",
      use_of_questions: false,
    },
    formatting: {
      use_bullet_points: "rare",
      header_style: "declarative",
      bold_key_phrases: true,
    },
    vocabulary: {
      level: "Grade 12",
      jargon_usage: "heavy",
      forbidden_words: ["I think", "maybe", "probably", "sort of"],
    },
    narrative_rules: [
      "Lead with the most important news first (BLUF)",
      "Include quotes from industry leaders",
      "Focus on the impact and future implications",
      "Keep the word count tight and efficient",
    ],
  },
}
