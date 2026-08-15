import type { ArticleType } from "../prompts/article-types.ts"

// ---------------------------------------------------------------------------
// INTRO REPERTOIRE
// ---------------------------------------------------------------------------
// INTRO_TEMPLATES above mandated one fixed "GOLDEN ORDER" per article type:
// answer -> bulleted list -> hook -> "By the end of this guide...". Every
// article of a given type therefore opened identically, and a delivered cluster
// of 12 read as obviously machine-produced.
//
// The fix is NOT to loosen the answer-first rule. 2026 research is unambiguous
// that it is the single most valuable property of these templates:
//   - models extract ~44% of citations from the first 30% of a page
//   - AI search prioritises content resolving intent within the first 2 sentences
// So answer-first becomes an invariant, and variety comes from the moves AROUND
// the answer — how the answer is framed, and what immediately follows it.
//
// Nothing from INTRO_TEMPLATES is discarded. Its bolding rules, banned openers,
// paragraph limits and density targets became INTRO_INVARIANTS; its per-type
// framings and "Dynamic Style" options became entries in the two repertoires.
// ---------------------------------------------------------------------------

/** Always true, regardless of which pattern is selected. Per article type. */
const INTRO_INVARIANTS: Record<string, string> = {
  informational: `
**NON-NEGOTIABLE:**
- The FIRST sentence answers the question directly. No preamble, no throat-clearing.
- Opening block is 40-60 words. Dense, objective, zero fluff.
- No paragraph exceeds **3 lines of text**.

**BOLDING (Visual Speed Bumps):** Bold ONLY specific **numbers**, **proper nouns**, or **contrasting states**.
- ❌ Bad: **This tool helps you save time.** (Full-sentence bolding = amateur)
- ✅ Good: This tool reduces latency by **40%** using **Vector Caching**.

**BANNED:** "In this article", "We will explore", "Let's dive in", "It is important to note", "Welcome". Never open with a rhetorical question.`,

  commercial: `
**NON-NEGOTIABLE:**
- The FIRST sentence states the verdict. Do not build suspense.
- Opening block is 40-60 words. Dense.
- No paragraph exceeds **3 lines**.

**BOLDING:** Bold specific **Prices**, **Product Names**, and **Target Audiences**.
- ❌ Bad: **HubSpot is great for small teams.**
- ✅ Good: **HubSpot** is best for **small teams** starting at **$0/mo**.

**BANNED OPENERS:** "Choosing the right tool is a journey", "Top 10 Best [Topic] in 2026", "In today's competitive market".
**BANNED PHRASES:** "Our expert team has evaluated..." (Show, don't tell).`,

  howto: `
**NON-NEGOTIABLE:**
- The FIRST sentence summarises the exact solution method. Do not tease it.
- Opening block is 40-60 words. Dense.
- No paragraph exceeds **3 lines**.

**BOLDING:** Bold specific **Tools**, **Time Estimates**, and **Error Codes**.
- Bad: **This process takes five minutes.**
- Good: This process takes **5 minutes** and requires **Python 3.10+**.

**BANNED OPENERS:** "Have you ever wanted to learn...", "In this guide...", "Getting started is easy."
**BANNED TONE:** No cheerleading. Be an instructor, not a friend.`,
}

/** How the answer itself is phrased. It is always first — only the shape varies. */
const ANSWER_FRAMINGS: Array<{ id: string; brief: string }> = [
  {
    id: "definition",
    brief: `Open with a precise definition that doubles as the answer.
Syntax: "[Topic] is [definition] that [function/outcome]."
Example: "AEO is the process of formatting content for LLM retrieval. Unlike SEO, it prioritises structured data over ranking position."`,
  },
  {
    id: "verdict",
    brief: `Open with the direct recommendation or conclusion, named and specific.
Syntax: "The best [X] for [use case] is **[Answer]**, because [one reason]."
State who it is NOT for in the same breath.`,
  },
  {
    id: "direct-number",
    brief: `Open with the concrete quantity that answers the question — a time, cost, count, or percentage — then say what it means.
Example: "Restoring a torn photo takes **2-4 minutes** and costs nothing if the damage covers under **30%** of the frame. Past that, manual retouching wins."
Only use a number you can actually support. Never invent one.`,
  },
  {
    id: "corrective",
    brief: `Open by correcting the common wrong answer, then give the right one immediately.
Syntax: "Most guides say [common claim]. That is only true when [condition] — otherwise [correct answer]."
The correction IS the answer; do not delay it to build tension.`,
  },
  {
    id: "conditional",
    brief: `Open by naming the one variable the answer depends on, then resolve it.
Syntax: "This depends entirely on [variable]. If [case A], [answer A]. If [case B], [answer B]."
Give both branches concretely in the first block — do not promise to explain later.`,
  },
]

/**
 * What immediately follows the answer. Four options against five framings, so
 * the combination cycle is 20 — longer than the 15-article cluster maximum,
 * which is what guarantees no two articles in a cluster share an opening shape.
 */
const SECOND_MOVES: Array<{ id: string; brief: string }> = [
  {
    id: "attribute-list",
    brief: `Follow with a tight bulleted list of the defining specifics.
Header it "**Key Characteristics:**", "**Prerequisites:**", or "**What You Need:**" as fits.
3-4 atomic facts. No prose bullets.`,
  },
  {
    id: "mechanism",
    brief: `Follow with one or two sentences on HOW it actually works underneath — the
mechanism, not the benefit. Name the real step or component that does the work.
This is where first-hand product knowledge belongs if you were given any.`,
  },
  {
    id: "worked-example",
    brief: `Follow with one concrete worked case: real inputs, real outcome, real numbers.
Not a hypothetical, not "imagine". A specific instance the reader can check against.
A compact Markdown table is ideal if you are comparing more than two things.`,
  },
  {
    id: "common-failure",
    brief: `Follow with the specific way this usually goes wrong, and the tell that it is
happening. Name the error, the symptom, or the wasted effort concretely.
Example: "Most people upload a phone photo of a print. The glare gets baked in and no
model can remove it — scan flat instead."`,
  },
]

/** Stable, order-independent hash so a cluster id yields the same offset forever. */
function stableSeed(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export type IntroPattern = {
  framing: string
  secondMove: string
  brief: string
}

/**
 * Deterministically selects an opening shape for an article from its position
 * within its cluster. Same inputs always give the same pattern, so a retry
 * cannot change an article's opening, and two articles in one cluster cannot
 * collide.
 */
export function selectIntroPattern(
  articleType: ArticleType,
  clusterPosition: number = 0,
  clusterId: string = "",
): IntroPattern {
  const seed = clusterId ? stableSeed(clusterId) : 0
  const position = Math.max(0, clusterPosition)
  const framing = ANSWER_FRAMINGS[(position + seed) % ANSWER_FRAMINGS.length]
  const secondMove = SECOND_MOVES[(position + seed) % SECOND_MOVES.length]
  const invariants = INTRO_INVARIANTS[articleType] || INTRO_INVARIANTS.informational

  // The "value promise" ("By the end of this guide you will...") was mandatory
  // in all three old templates and is the single most recognisable tell of a
  // generated article. No evidence requires it, so it is now the exception:
  // only genuinely multi-step how-tos, where a roadmap earns its place.
  const closing =
    articleType === "howto"
      ? `
**3. CLOSE (only if this is a genuinely multi-step process):**
One sentence naming the end state. Otherwise stop after step 2 — do NOT add a
value promise, and never use the phrase "by the end of this guide".`
      : `
**3. CLOSE:** Do not write one. Stop once the answer and its support are delivered.
Do NOT add a roadmap, a value promise, or any "by the end of this guide" sentence.`

  return {
    framing: framing.id,
    secondMove: secondMove.id,
    brief: `
GOAL: Open by answering the question, then earn the reader's next 30 seconds.
${invariants}

**1. THE ANSWER (first, always) — framing: ${framing.id}**
${framing.brief}

**2. THE SUPPORT — move: ${secondMove.id}**
${secondMove.brief}
${closing}

**WHY THIS SHAPE:** Search and LLM systems extract most citations from the top of
the page, so the answer cannot wait. The framing above is assigned to this
specific article so that no two articles in its cluster open the same way — do
not substitute a different opening shape.`,
  }
}

/**
 * Which links the outline assigned to a section but the draft left out.
 *
 * Only checks the destination URL, not the anchor wording — the anchor is
 * deliberately the writer's choice so the link reads naturally in the sentence.
 */
export function requiredLinksMissingFrom(
  draft: string,
  section: { external_link?: { url?: string } | null; internal_link?: { url?: string } | null },
): string[] {
  const required = [section.external_link?.url, section.internal_link?.url].filter(
    (url): url is string => Boolean(url),
  )
  return required.filter((url) => !draft.includes(url))
}


/**
 * NOTE: `INTRO_TEMPLATES` and `getIntroTemplate` remain in trigger/generate-blog.ts
 * intentionally. They are no longer called — `selectIntroPattern` replaced them —
 * but they are the provenance of every invariant above and were kept rather than
 * deleted so the reasoning behind each rule stays auditable.
 */
