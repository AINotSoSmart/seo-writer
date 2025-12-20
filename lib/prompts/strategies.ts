/**
 * Article Strategy Map
 * 
 * Context-aware prompts for research, outline generation, and title creation.
 * Each article type has its own "strategy brain" that guides the AI.
 */

import { ArticleType } from './article-types'

interface ArticleStrategy {
        research_focus: string
        outline_instruction: string
        title_prompt: string
}

export const ARTICLE_STRATEGIES: Record<ArticleType, ArticleStrategy> = {
        // --- TYPE 1: INFORMATIONAL / DEEP DIVE ---
        informational: {
                research_focus: `
**ARTICLE TYPE: INFORMATIONAL / DEEP DIVE**

RESEARCH FOCUS:
- Focus on Definitions, History, Core Concepts, and "Why" it matters.
- Extract expert quotes, statistics, academic context, and authoritative sources.
- Look for common misconceptions to address.
- Find real-world use cases and examples.
- Do NOT focus heavily on pricing or product specs unless directly relevant to understanding the concept.

DATA EXTRACTION PRIORITY:
1. Core definitions and explanations
2. Historical context and evolution
3. Key statistics and facts
4. Expert opinions and quotes
5. Related concepts and how they connect
`,
                outline_instruction: `
**STRUCTURE FOR INFORMATIONAL ARTICLE:**
- **Definition/Introduction:** Clear explanation of what it is
- **Context/History:** Background, evolution, why it exists
- **Core Concepts:** Main ideas broken into digestible sections (2-4 H2s)
- **Advanced Angles:** Deeper insights, edge cases, nuances
- **Practical Applications:** Real-world use cases
- **FAQ:** Address common questions and misconceptions

GOAL: Total topical authority. Reader should not need another article.

INSTRUCTION NOTES GUIDANCE:
- Ask writer to explain complex terms simply (ELI5 technique)
- Include analogies and real-world examples
- Focus on the "why" behind concepts, not just the "what"
`,
                title_prompt: `Generate 5 SEO-optimized blog titles for an Informational article about '{keyword}'.

TITLE RULES (MANDATORY):
1. Include '{keyword}' or very close variant in the title
2. NO colons, semicolons, parentheses, or single quotes
3. Keep under 60 characters
4. Front-load the keyword when possible
5. Write as a single flowing sentence

GOOD EXAMPLES:
- "How to Restore Old Photos with AI in 2024"
- "What Is AI Photo Restoration and How It Works"
- "AI Photo Restoration Explained for Beginners"
- "Complete Guide to AI Photo Restoration"

BAD EXAMPLES (DO NOT USE):
- "Restoration Magic: How AI Brings Photos Back" (colon)
- "Is AI Photo Restoration Worth It? (Tested)" (parentheses)
- "The 'Secret' to Perfect Photo Restoration" (single quotes)
- "Here's Why AI Photo Restoration Changes Everything" (clickbait)
`
        },

        // --- TYPE 2: COMMERCIAL / COMPARISON ---
        commercial: {
                research_focus: `
**ARTICLE TYPE: COMMERCIAL / COMPARISON**

RESEARCH FOCUS:
- **CRITICAL:** Extract a "Product Matrix" for the top 3-7 products/tools mentioned.
- For EACH product, find: Exact Price (or pricing tiers), Top 3 Pros, Top 3 Cons, Unique Selling Point, Target Audience.
- Ignore generic definitions. Focus on **Differences** between options and **Verdicts**.
- Look for user reviews, Reddit discussions, and real user experiences.
- Find pricing pages, feature comparison tables, and changelog for recent updates.

DATA EXTRACTION PRIORITY:
1. Product names and exact pricing
2. Feature lists and limitations
3. Pros and cons from real users
4. Who each product is best for
5. Recent updates or changes (shows freshness)
6. Discount codes or deals if available

MANDATORY: If you cannot find exact pricing, note it in sources_summary but attempt to find tier names (e.g., "Free, Pro, Enterprise").
`,
                outline_instruction: `
**STRUCTURE FOR COMMERCIAL/COMPARISON ARTICLE:**
- **Buying Criteria:** What to look for (3-5 key factors explained)
- **Quick Summary Table:** Comparison matrix with product, price, best for
- **Deep Dive Reviews:** Individual sections for each product (Product 1, Product 2, etc.)
  - Each review: Overview, Key Features, Pricing, Pros, Cons, Best For
- **Head-to-Head Comparison:** Direct comparison on key features
- **Final Verdict:** Opinionated recommendation with context
- **FAQ:** Address common buying questions

MANDATORY SECTIONS:
- You MUST create a "Best for X" section (e.g., "Best for Beginners", "Best for Enterprise")
- You MUST include a comparison table in some form

INSTRUCTION NOTES GUIDANCE:
- Instruct writer to be opinionated - reviewers have opinions!
- Use the "Reviewer" persona - write like someone who has tested all options
- Compare tools AGAINST each other, not in isolation
- Include specific examples: "ShipFast's auth setup takes 10 minutes vs Supastarter's 30 minutes"
`,
                title_prompt: `Generate 5 SEO-optimized blog titles for a Comparison/Review article about '{keyword}'.

TITLE RULES (MANDATORY):
1. Include '{keyword}' or very close variant in the title
2. NO colons, semicolons, parentheses, or single quotes
3. Keep under 60 characters
4. Numbers work well for listicles when relevant
5. Write as a single flowing sentence

GOOD EXAMPLES:
- "Best Free AI Photo Restoration Tools in 2024"
- "7 AI Photo Restoration Apps Compared and Reviewed"
- "Top AI Tools for Old Photo Restoration"
- "AI Photo Restoration Tools Worth Trying in 2024"

BAD EXAMPLES (DO NOT USE):
- "AI Tools Tested: Here's The Winner" (colon)
- "The Best AI Tool (And It's Not What You Think)" (parentheses)
- "I Tested 7 Tools. Here's The Only One Worth It" (overly clickbait)
- "Tool A vs Tool B: One Clear Winner" (colon)
`
        },

        // --- TYPE 3: HOW-TO / TUTORIAL ---
        howto: {
                research_focus: `
**ARTICLE TYPE: HOW-TO / TUTORIAL**

RESEARCH FOCUS:
- Extract the **Exact Step Sequence** - the precise order of operations.
- Identify **Prerequisites** - what is needed before starting (tools, accounts, knowledge).
- Find common **Pitfalls/Errors** users face during this process and how to fix them.
- Look for specific commands, code snippets, or UI paths.
- Find alternative methods if they exist.

DATA EXTRACTION PRIORITY:
1. Prerequisites and requirements
2. Step-by-step sequence with exact actions
3. Common errors and troubleshooting tips
4. Time estimates for each step or total process
5. Tools, dependencies, or accounts needed
6. Screenshots or diagrams descriptions

NOTE: Tutorials should be completable. If research shows missing steps, flag it in content_gap.
`,
                outline_instruction: `
**STRUCTURE FOR HOW-TO/TUTORIAL ARTICLE:**
- **Prerequisites/Tools Needed:** What reader needs before starting
- **Brief Overview:** What we're building/achieving (with outcome preview)
- **Step 1, Step 2, Step 3, etc.:** Chronological steps (each as H2)
  - Each step: Clear action, expected result, screenshot opportunities
- **Troubleshooting:** Common errors and fixes
- **Final Result/Verification:** How to confirm success
- **Next Steps:** Optional advanced tips or related tutorials

FLOW: Chronological order is NON-NEGOTIABLE. Steps must follow logical sequence.

INSTRUCTION NOTES GUIDANCE:
- Instruct writer to use bolding for UI elements (e.g., **Click Save**)
- Ask for "Pro Tips" or warnings in every step to prevent errors
- Include what the reader should SEE after each step (verification)
- Keep steps atomic - one action per step when possible
`,
                title_prompt: `Generate 5 SEO-optimized blog titles for a How-To/Tutorial article about '{keyword}'.

TITLE RULES (MANDATORY):
1. Start with "How to" when the keyword allows it
2. Include '{keyword}' or very close variant in the title
3. NO colons, semicolons, parentheses, or single quotes
4. Keep under 60 characters
5. Promise a clear outcome in the title

GOOD EXAMPLES:
- "How to Remove Scratches from Old Photos Using AI"
- "How to Colorize Black and White Photos with AI"
- "Step by Step Guide to AI Photo Restoration"
- "How to Restore Faded Color Photos at Home"

BAD EXAMPLES (DO NOT USE):
- "Fix Photos: A Complete Guide" (colon)
- "Restore Photos (The Easy Way)" (parentheses)
- "The Method Nobody Teaches You" (clickbait, no keyword)
- "Deploy in 5 Minutes (No BS Guide)" (parentheses)
`
        }
}

/**
 * Get strategy for a specific article type
 */
export const getArticleStrategy = (type: ArticleType): ArticleStrategy => {
        return ARTICLE_STRATEGIES[type] || ARTICLE_STRATEGIES.informational
}

/**
 * Get the title generation prompt for an article type
 */
export const getTitlePrompt = (type: ArticleType, keyword: string): string => {
        const strategy = getArticleStrategy(type)
        return strategy.title_prompt.replace('{keyword}', keyword)
}
