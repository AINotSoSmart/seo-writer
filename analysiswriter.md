**This is a current production-grade writer failure. Do not generate or deliver more articles until it is fixed.** The old audit contributed weak evidence, but it did not cause the article to be chopped apart.

The landing-page work was stopped; no files were changed.

## What the database proves

The generated article:

- Article ID: `76c594c6-5885-494a-a493-c8df9a4a7325`
- Status: `completed`
- Step index: `4`—the system believed all four sections succeeded.
- Actual length: **176 words**
- Contract length: `medium`, meaning **1,600–2,200 words**
- Planned source: an older `capability-bound-writer-v4.0.0` audit from August 1.
- Generation path: the current founder test writer, running today.

It produced barely **11% of the minimum required length**, yet was marked completed.

## The primary current bug

The recent repair introduced very small output-token limits:

- Introduction: `700` tokens.
- Each section: approximately `word_budget × 1.8`.
- This article had 425-word section budgets, producing only `765` maximum output tokens per section.

See [generate-blog.ts](/D:/tutorial/2026/apr2026/seo-writer/trigger/generate-blog.ts:2201) and [generate-blog.ts](/D:/tutorial/2026/apr2026/seo-writer/trigger/generate-blog.ts:2252).

The active model is `gemini-3-flash-preview`, which uses thinking by default. Google recommends explicitly controlling its thinking level; thinking tokens are also counted as output usage. This makes a 700–765-token ceiling unsafe for long-form writing. [Google’s Gemini thinking documentation](https://ai.google.dev/gemini-api/docs/generate-content/thinking) confirms Gemini 3’s default reasoning behaviour, while [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) confirms output usage includes thinking tokens.

The exact `finishReason` was never recorded or checked, so I cannot prove from stored logs that it was `MAX_TOKENS`. But the evidence is extremely strong:

- Every call ends after roughly 20–35 visible words.
- Multiple responses end mid-sentence.
- This began after the token caps were added.
- The earlier writer used no such small cap.

## Why the sentences cross headings

Each section receives the previous 500 characters and this instruction:

> “Continue naturally from this final prose context…”

See [generate-blog.ts](/D:/tutorial/2026/apr2026/seo-writer/trigger/generate-blog.ts:2247).

Because every response was truncated, the next section continued the unfinished sentence:

- “You need a”
- → “solution that…flat”
- → “sticker. We designed…group”
- → “portrait results…and”
- → “shadows align…”

The headings were inserted mechanically between those fragments. This is why the output reads like one paragraph cut into five pieces.

## The system never checks whether generation succeeded

The pipeline collects whatever text the stream returns and continues. It does not inspect:

- Finish reason.
- Per-section word count.
- Whether the final sentence is complete.
- Whether the section meaningfully answers its assigned intent.
- Whether total length is dramatically below the contract.

The only length check warns when an article is too long. There is no corresponding under-length failure at [generate-blog.ts](/D:/tutorial/2026/apr2026/seo-writer/trigger/generate-blog.ts:2361).

It then unconditionally writes `status: "completed"` at [generate-blog.ts](/D:/tutorial/2026/apr2026/seo-writer/trigger/generate-blog.ts:2674).

That is the core operational failure: **a broken response is treated as successful work.**

## The outline packet is also structurally broken

The article had four H2 sections, but only the first section received the article’s intent.

Database result:

| Section | Intent | Product facts | Research |
|---|---:|---:|---:|
| Search for Seamless AI Compositing | 1 | 1 | 2 |
| How to Use AI… | 0 | 0 | 0 |
| BringBack: Your Solution… | 0 | 0 | 0 |
| Complete Your Digital Legacy | 0 | 0 | 0 |

The normalization code assigns each intent to one section, but it does not remove, merge or adequately equip the remaining empty sections. See [section-packet.ts](/D:/tutorial/2026/apr2026/seo-writer/lib/writer/section-packet.ts:35).

Worse, the contract-bound section writer does not receive the outline’s `instruction_note`. Therefore, those three empty sections received:

- A heading.
- A purpose label.
- No intent.
- No capability facts.
- No research evidence.
- The previous unfinished paragraph.

Continuing that paragraph was effectively the only usable instruction left.

## Product claims were still fabricated

The only permitted BringBack capability fact attached to this article was:

> “Exact credit costs: restore 1, family portrait / add person 2…”

It did not support any of these generated claims:

- “We designed BringBack to eliminate this visual disconnect.”
- “We ensure that skin tones, lighting direction, and shadows align perfectly.”
- “Advanced compositing within your browser.”
- “A unified legacy.”
- “Every face in the frame.”

The lighting, shadows, perspective and “sticker” language came from one external Overchat article. The writer converted that third-party selection criterion into first-party BringBack capability claims.

So the evidence boundary still failed—even before considering the truncation.

## The required citation also failed

The first section was assigned an external citation to Overchat. The final article contains no citation.

The pipeline retries once, but if the rewritten section still omits the URL, it explicitly keeps the original uncited text and continues at [generate-blog.ts](/D:/tutorial/2026/apr2026/seo-writer/trigger/generate-blog.ts:2306).

Therefore, “required citation” currently means “try once, then silently ignore.”

## It also failed the commercial intent

The keyword was:

> `best ai app to add person to photo`

This is commercial comparison intent. But the outline:

- Compared no products.
- Had `is_comparison: false`.
- Used only one external page.
- Provided no evaluation criteria beyond paraphrasing that page.
- Turned into a BringBack advertisement.

Even if every section had been fully generated, this outline would still not satisfy “best AI tool” intent.

## How much the old audit matters

The old audit did cause two problems:

1. It was created under writer policy v4, not the current v5.
2. Its capability contract was weak: the operation said “insert and blend the person,” but the only attached evidence fact was a credit-cost sentence.

However, that old contract correctly identified:

- BringBack as browser software.
- The exact add-person operation.
- The two photo inputs.
- A composited-photo output.
- Product-led intent.

Therefore, the old audit did **not** cause the 176-word truncation, sentence splitting or false completion. Those are current writer problems.

The founder test route also allows an old planned article to be hydrated without checking its audit policy version. It deliberately removes `plannedArticleId` while retaining the writer contract at [test-article/route.ts](/D:/tutorial/2026/apr2026/seo-writer/app/api/founder/test-article/route.ts:18). That explains why this row has no planned article ID, but the dangerous token limits and section prompts are shared with real program generation.

## Verdict

There are four release-blocking failures:

1. **Gemini output is being starved by unsafe token limits.**
2. **Truncated responses are accepted without checking completion.**
3. **Most outline sections can receive empty evidence packets.**
4. **External evidence can still become unsupported first-party product claims.**

The old audit made the test weaker, but **the current writer turned that weakness into a catastrophic completed article**. This article must not be published, and cluster generation should remain stopped until these failures are repaired.