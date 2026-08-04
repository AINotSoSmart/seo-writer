/**
 * Evidential tests for a generated draft.
 *
 * Every function here answers a question about text that was actually produced,
 * never about text we expect to be produced. That distinction matters: the two
 * previous attempts to police writing quality used regex blocklists of banned
 * phrases, and each round caught the previous batch of examples and missed the
 * next one. Nothing below asks "does this phrase look bad" — each test asks
 * "did the model finish the sentence", "did it reach the length it was asked
 * for", "does this first-party claim have a fact behind it".
 *
 * The functions are pure and side-effect free so `npm run test:pivot-contract`
 * can exercise them without a model, a network, or a database.
 */

/** Markdown constructs that carry no prose and must not count toward a budget. */
const NON_PROSE_LINE = /^\s*(?:!\[[^\]]*\]\([^)]*\)|<!--.*?-->|\|[\s:|-]+\||#{1,6}\s)/

export function countProseWords(markdown: string): number {
  return markdown
    .split("\n")
    .filter((line) => !NON_PROSE_LINE.test(line))
    .join(" ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>|]/g, " ")
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/i.test(word)).length
}

export type TruncationReason =
  | "max_tokens"
  | "empty"
  | "unterminated_sentence"
  | "unterminated_emphasis"
  | "dangling_heading"
  | "dangling_table"
  | "dangling_list_marker"

/**
 * Why a draft looks unfinished, or null when it looks complete.
 *
 * `finishReason` is authoritative when the provider supplies it. The textual
 * checks exist because it is not always supplied on a streamed response, and
 * because the exact `finishReason` of the 176-word article was never recorded —
 * the pipeline had no way to tell a finished section from a severed one.
 */
export function truncationReason(
  text: string,
  finishReason?: string | null,
): TruncationReason | null {
  if (finishReason && finishReason.toUpperCase() === "MAX_TOKENS") return "max_tokens"

  const body = text.replace(/```[\s\S]*?```/g, " ").trim()
  if (!body) return "empty"

  // An odd number of bold/italic delimiters means the model stopped inside one.
  if ((body.match(/\*\*/g) || []).length % 2 !== 0) return "unterminated_emphasis"

  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean)
  const last = lines[lines.length - 1] || ""

  if (/^#{1,6}\s/.test(last)) return "dangling_heading"
  if (/^(?:[-*+]|\d+\.)\s*$/.test(last)) return "dangling_list_marker"

  // A table header with a separator row but no data row was cut mid-table.
  if (/^\|.*\|$/.test(last)) {
    const isSeparator = /^\|[\s:|-]+\|$/.test(last)
    return isSeparator ? "dangling_table" : null
  }

  // Prose must land on a terminator. Closing markdown (quote, emphasis, bracket)
  // is allowed to trail the terminator.
  if (!/[.!?:;"'’”)\]*`_]$/.test(last)) return "unterminated_sentence"
  if (/[.!?][)"'’”*`_\]]*$/.test(last)) return null
  if (/[:;]$/.test(last)) return "unterminated_sentence"
  return null
}

/** Sentence split that keeps abbreviations, decimals and URLs in one piece. */
export function splitSentences(text: string): string[] {
  const prose = text
    .split("\n")
    .filter((line) => !NON_PROSE_LINE.test(line))
    .join("\n")
  return prose
    .replace(/\b(e\.g|i\.e|etc|vs|approx|Dr|Mr|Mrs|Ms|St|Inc|Ltd|Co)\./gi, "$1<DOT>")
    .replace(/(\d)\.(\d)/g, "$1<DOT>$2")
    .replace(/(https?:\/\/\S+)/g, (match) => match.replace(/\./g, "<DOT>"))
    .split(/(?<=[.!?])\s+(?=[A-Z"'“(\[*])/)
    .map((sentence) => sentence.replace(/<DOT>/g, ".").trim())
    .filter(Boolean)
}

/**
 * Sentences that assert something about the customer's own product.
 *
 * This is a *candidate filter*, not a verdict. Its only job is to narrow a
 * section down to the sentences worth spending an entailment check on, so a
 * false positive here costs one extra sentence in a judge prompt and a false
 * negative is the thing to avoid. Nothing is rejected on the strength of this
 * function alone.
 */
export function firstPartyClaimCandidates(markdown: string, entityName: string): string[] {
  const entity = entityName.trim().toLowerCase()
  const entityPattern = entity
    ? new RegExp(`\\b${entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    : null

  return splitSentences(markdown).filter((sentence) => {
    const plain = sentence.replace(/[*_`]/g, "")
    const lower = plain.toLowerCase()
    if (entityPattern?.test(plain)) return true
    return /\b(we|our|ours|us)\b/i.test(lower) && /[a-z]/i.test(lower)
  })
}

/** Removes exact sentences from a draft, leaving the surrounding prose intact. */
export function removeSentences(markdown: string, sentences: string[]): string {
  let result = markdown
  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    const index = result.indexOf(trimmed)
    if (index < 0) continue
    result = result.slice(0, index) + result.slice(index + trimmed.length)
  }
  return result
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Minimum acceptable article length per contract length.
 *
 * The floor is the bottom of the published word range, less a 10% tolerance.
 * `medium` is 1,600-2,200, so a medium article that lands under 1,440 words is
 * not "a bit short" — it is a failed generation, and the 176-word article that
 * shipped as `completed` was at 11% of this floor.
 */
export const ARTICLE_WORD_FLOOR: Record<"short" | "medium" | "long", number> = {
  short: 1080,
  medium: 1440,
  long: 2160,
}

export type SectionDefect = {
  heading: string
  kind: "truncated" | "under_length" | "missing_citation" | "unsupported_claim"
  detail: string
}

/**
 * The article-level verdict. A non-empty `blocking` list must prevent the
 * article from ever reaching `status: "completed"`.
 */
export function articleQualityVerdict(input: {
  wordCount: number
  articleLength: "short" | "medium" | "long"
  defects: SectionDefect[]
}): { ok: boolean; blocking: string[] } {
  const blocking: string[] = []
  const floor = ARTICLE_WORD_FLOOR[input.articleLength]

  if (input.wordCount < floor) {
    blocking.push(
      `Article is ${input.wordCount} words; the ${input.articleLength} contract floor is ${floor}.`,
    )
  }
  for (const defect of input.defects) {
    if (defect.kind === "truncated") {
      blocking.push(`Section "${defect.heading}" was truncated: ${defect.detail}`)
    }
    if (defect.kind === "missing_citation") {
      blocking.push(`Section "${defect.heading}" omitted a required citation: ${defect.detail}`)
    }
  }
  return { ok: blocking.length === 0, blocking }
}
