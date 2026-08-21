# Buyer questions must create a selection event

Status: **implemented and measured on 2026-08-21.** Sections 1-2 are the
diagnosis and still hold. Sections 3-7 were the first design; the calibration in
section 9 invalidated most of it. **Section 11 onward remains the source of
truth.** It was written after a live BringBack set came back as 32 tutorials out
of 40. Section 14 records the implementation result.

## 1. The failure, stated precisely

The product's claim is "when a buyer asks, does an assistant recommend you?"
That claim needs the assistant to **choose between products**. If a question can
be answered completely without naming any product, then the brand not appearing
is not a loss — there was no selection event to lose.

Three from the live set:

| Generated question | What an assistant actually answers |
|---|---|
| how do I remove scratches and dust from scanned family pictures | scan high-res, healing brush, Neural Filters |
| how do I fix the perspective when adding a person from a different photo | an editing tutorial |
| what technology allows you to animate faces in old family pictures | an explanation of the technique |

BringBack is absent from all three answers and that fact carries **no
information**. 32 of the 40 were `HOW-TO`. The denominator is mostly noise, so
"named in 4 of 40" is not 10% visibility — it is 4 hits over an unknown number
of real chances.

## 2. Three causes, all in code

**(a) The instruction steers at the wrong funnel stage.**
`lib/visibility/prompt-template.ts` opens with:

> "Write the questions real people actually type into ChatGPT when they have the
> problem it solves — **before they know this product, or any product, exists**."

That clause explicitly targets pre-product-awareness — the exact half of the
funnel where an assistant answers with technique instead of tools. Probably the
single largest contributor.

**(b) Nothing rejects a tutorial.** `isPlausiblePrompt`
(`lib/visibility/prompt-builder.ts:100`) is mechanical only — length, word
count, no URLs, letter ratio. Its own docblock says *"Mechanical sanitation
only — no opinion about words or industries."* The only semantic rule in the
entire pipeline is the subject-brand ban. A tutorial passes every check.

**(c) The taxonomy has no selection axis, and neither does the metric.**
`PROMPT_INTENTS` lists `recommendation`, `alternatives`, `comparison`,
`problem`, `howto` as five peers. `inferPromptIntent` labels a finished question
but never rejects one. Then `visibility-summary.ts:373` pools them all into a
single `questionsTotal`. A founder reading "4/40" cannot tell whether the other
36 were competitive losses or Photoshop tutorials.

## 3. The reframe

Stop classifying by SEO intent. Classify by **entity-selection probability** —
how likely a good answer is to name products at all.

| Class | Example | Counts toward |
|---|---|---|
| `knowledge` | how does AI photo restoration work | organic mention |
| `instruction` | how do I repair scratches in an old photo | organic mention |
| `exploration` | can a torn photo be restored | organic mention |
| `solution` | what can I use to restore a damaged family photo | **recommendation** |
| `discovery` | best AI tools for restoring old family photos | **recommendation** |
| `recommendation` | best tool for combining separate photos into one portrait | **recommendation** |
| `constrained` | good AI tool to add my deceased father to a wedding photo realistically | **recommendation** |

`constrained` is the strongest and the one to bias toward: situation +
constraint + selection intent. It is also where the capability contract earns
its keep, because we hold verified facts about what the product does.

These are not keyword-research phrases. Nobody types "best AI family portrait
generator 2026" into a chat box. They type context + problem + selection intent.

## 4. The acceptance test

Three model-judged questions per candidate, batched:

1. Can this be answered satisfactorily **without** naming an external product?
   → want **no**
2. Would a high-quality answer **naturally benefit** from naming products?
   → want **yes**
3. Is the tracked brand **genuinely capable** of satisfying the underlying need?
   → want **yes**

Accept on `benefits-from-entities x commercial-relevance x brand-capability x
naturalness`, not on "question is about a topic the brand touches."

Two standing repo rules constrain the implementation, and both point the same
way:

- **No regex blocklists for content quality** (CLAUDE.md — tried twice; each
  round caught the previous examples and missed the next). So this must be a
  classifier, not a `/^how do i/` filter.
- **Never hand-tune a threshold** — calibrate via `POST /api/harvest/calibrate`
  with hand-labelled positives and negatives. If the populations overlap, report
  that rather than picking a midpoint.

The calibration set already exists: the 40 rejected questions are labelled
negatives and the 16 worked examples in the founder's brief are labelled
positives. Enough to calibrate honestly on day one.

Cost: one batched classification call per family (~3-6 per brand), not one per
candidate.

## 5. Two metrics, because they measure different things

- **Recommendation Visibility (headline)** — over `solution` / `discovery` /
  `recommendation` / `constrained` only. "When a buyer is choosing, how often
  are you chosen?"
- **Organic Mention Visibility (secondary)** — over `knowledge` / `instruction`
  / `exploration`. An unprompted mention there is real earned awareness and
  worth keeping; a miss there is not a competitive loss and must not be counted
  as one.

Then the per-cluster cut, which is what makes it actionable:

```
Add Person to Photo      BringBack 2/12   Remini 9/12
Old Photo Restoration    BringBack 1/14   Remini 11/14
Photo Animation          BringBack 0/9    MyHeritage 7/9
Family Portraits         BringBack 0/7
```

That is the bridge to the content system: build clusters where rivals are
repeatedly selected and the brand is not — not merely where a question exists.

## 6. Phases

**Phase 1 — generation.** Delete the pre-awareness clause. Rewrite the
instruction around the selection moment, with the class table and worked
examples. Bias toward `constrained`. No schema change; testable immediately by
regenerating one brand and reading the output.

**Phase 2 — classifier + calibration.** Batched three-question classifier.
Calibrate against the 40 negatives and 16 positives before any threshold is
committed. Report overlap rather than splitting the difference.

**Phase 3 — persistence.** Forward-only migration: `selection_class` on
`tracked_prompts` and `ai_probe_prompts` (`ADD COLUMN IF NOT EXISTS`). Existing
rows classify on next confirm.

**Phase 4 — the split metric.** Two denominators in `visibility-summary.ts`,
Recommendation Visibility as the headline, per-cluster breakdown. The existing
verdict and `adjustedBrandRank` logic is reused unchanged.

Phase 1 alone should move the needle most. Phases 2-4 make it measurable and
durable.

## 7. Decisions needed before building

**(a) Competitor names — a real tension with the brief.** It lists
`Remini vs BringBack` and `alternative to MyHeritage Deep Nostalgia` as top-tier
prompts. Two passes ago rival names were banned in questions, because we hold no
verified facts about a rival's feature set and these questions are durable.

Recommendation: **keep the ban.** Seven of the eight classes above are reachable
without naming a rival — only `product comparison` needs one. And
`adjustedBrandRank` now discounts prompt-induced competitor mentions, so a
comparison prompt buys a measurement we then refuse to count. Founder's call.

**(b) The existing 40 confirmed prompts.** They are durable and re-run monthly.
Most of the current set would fail the new test. Regenerate now, while exactly
one run of history exists and there is no baseline worth preserving?
Recommendation: **yes, now.**

**(c) Set size.** If only selection-intent questions are accepted, a narrow
brand may yield fewer than 40. Recommendation: **let the set be smaller and say
so**, rather than padding the denominator with tutorials — padding is the bug
being fixed.

## 8. Calibration result — 2026-08-17, first live run

Run: `POST /api/visibility/calibrate-prompts` against 16 hand-written positives
and the 36 real rejected questions.

**Verdict: OVERLAP.** Reported rather than split, per CLAUDE.md. The diagnosis
matters more than the verdict.

### It caught a bug in the acceptance rule immediately

Negatives the judge had labelled `instruction` and `exploration` were scoring
0.90 and passing. `selectionScore` multiplies three booleans by naturalness and
never looked at the class, while `selectionRejections` did — the rule was
enforced in one function and forgotten in its sibling. `acceptsSelectionPrompt`
now requires an empty rejection list AND the score. This is the fourth defect of
that exact shape in this codebase.

### After the fix

| | kept | rejected |
|---|---|---|
| positives (16) | **16** | 0 |
| negatives (36) | 12 | **24** |

Every good question survives; two thirds of the tutorials are gone.

### The 12 survivors are a labelling disagreement, not a classifier failure

They were labelled negative because the whole generated set was rejected
wholesale, but several are genuinely strong:

- *"what tools do people use to fix damaged heirloom photos"* — explicitly asks
  for tools. This is a `discovery` question and belongs in the positives.
- *"how can I put my whole family into one picture if we were never all
  together"* — a real constrained situation. Compare the accepted positive *"my
  grandparents died before my children were born, is there an AI service…"*:
  same situation, different phrasing. An assistant answers both by naming tools.
- *"what is the best way to restore old faded black and white photos"* —
  genuinely ambiguous between technique and tools.

The remaining boundary is "how do I / what is the best way to" phrasing over a
constrained situation. That is a real judgement call about whether phrasing or
situation decides, and it is the founder's to make.

**Next calibration needs a cleaner boundary**: re-label the unambiguous
tutorials as negatives and move the tool-seeking ones to positives, then re-run.
Nothing in code should change until that produces a separation — picking a
threshold against contested labels is precisely what the rule forbids.

---

# FINAL PLAN — supersedes sections 3-7 above

Written 2026-08-17 after measuring the classifier against the labelled set. The
measurement invalidated most of my own design. What follows is what the data
supports, not what I built first.

## 9. What the calibration data proved

Run over all 52 labelled questions, counting how often each judge actually
rejected anything:

| Judge | Fired | Verdict |
|---|---|---|
| `answerableWithoutProduct` | 8 | real signal |
| `benefitsFromNamingProducts` | 8, **agreeing with the above on 52/52** | redundant |
| `brandCanSatisfy` | **0** | dead |
| `naturalness` | **0** | dead |

The two "product" judges disagreed **zero times out of 52**. They are one
signal wearing two hats. `brandCanSatisfy` never fired because generation is
already scoped to a confirmed product area — every candidate is about something
the brand does, by construction. `naturalness` never dropped below its floor.

So `selectionScore` — four numbers multiplied — reduces to **one** boolean.
The arithmetic was decoration.

**What actually rejected the 24 tutorials was `selectionClass`**: 14
`instruction` + 8 `exploration` + 2 `knowledge`. The model's own one-word label
did all the work, and the scoring apparatus I wrapped around it did none.

## 10. Three more findings

**The quota is a garbage generator.** `prompt-template.ts` hardcodes *"Write 40
questions"* per product area. BringBack has five areas, so the model was asked
for **200** questions about a photo tool and 40 were kept. The first ten per
area are fine; after that it is padding a quota, which is precisely where *"what
is the secret to making a family photo look like everyone was together when
they weren't"* comes from.

**Equal per-area quotas are wrong.** Splitting the call by area forces the same
count from a broad area and a narrow one, whether or not that many real
situations exist.

**No mining feeds this path.** Autocomplete/PAA/Reddit are the legacy Google
harvest, which has no UI caller. Buyer questions are already pure LLM
generation, so there is nothing to remove here.

## 11. The plan

### Delete

- `selectionScore` and the multiplication — one real signal does not need four.
- `benefitsFromNamingProducts`, `brandCanSatisfy`, `naturalness` — measured dead.
- `PROMPTS_PER_FAMILY = 40` as an instruction quota.
- The per-area generation split as the *allocation* mechanism.

### Move the intelligence upstream, into one generation call

One call for the **whole company**, not one per area, carrying:

1. **The real objective**, stated as the job: *simulate the messages people type
   into an AI assistant when they have a problem this company solves and want
   help finding or choosing a solution.*
2. **The 52 labelled examples** as few-shot — the founder's own calls, which are
   better teaching material than any abstract criterion.
3. **No quota.** "Generate up to 25. Stop when another question would only
   paraphrase a situation already covered." A narrow business returning 9 is a
   correct answer.
4. **Variety instruction**, so it does not convert everything into "best tool
   for X": some users describe a situation, some name a constraint, some ask
   what others use, some ask whether a thing exists at all.
5. **Structured output at generation time** — the model states what it intended:

```json
{
  "question": "my grandfather died before my kids were born, is there an AI tool that could make a realistic picture of them together",
  "scopeFamilyId": "…",
  "selectionClass": "constrained",
  "scenario": "family members never photographed together"
}
```

Asking the generator what it meant is free. Asking a second model to
reverse-engineer the intention afterwards is what we were doing.

### Keep family ownership — but as validation, not allocation

This is the one place I will not follow the critique wholesale, because
downstream depends on it. `tracked_prompts.scope_family_id` is `NOT NULL` and
feeds `intent_binding`, the capability contract check, cluster grouping and the
action proposals. A prompt that belongs to no confirmed area breaks all of it.

The current design guarantees ownership by scoping each call to one family. The
fix keeps the guarantee and drops the quota: **the model proposes the area, code
validates it against the confirmed family ids and rejects anything
unassignable.** Allocation floats — restoration 7, portraits 5, animation 3 —
while ownership stays structural.

### Reduce the second call to a dataset critic

Not four per-question booleans. One review of the whole set:

> Remove questions that (1) an assistant answers completely from general
> knowledge, (2) do not plausibly lead to naming an external solution,
> (3) read as synthetic SEO strings, (4) duplicate another question's underlying
> situation. Do not rewrite good questions. Return accepted, rejected,
> rejection_reason.

Two calls total, not six.

### Then re-measure, and delete the critic if it stops earning its place

The critic exists to compensate for a generator we did not trust. After the
generator is fixed, re-run the calibration harness. If a well-instructed
generator produces a set the critic barely touches, the critic goes too. That
decision is made from data, not taste.

## 12. What survives untouched

- **The two-metric split.** Recommendation Visibility over selection questions,
  organic mentions counted separately. This is what makes the number mean
  something and no part of the critique touches it.
- **`selection_class` and its migration.** Still the column; it is now emitted
  at generation rather than inferred afterwards.
- **The competitor-name ban**, per §7(a).
- **The calibration harness.** It is what caught all of this. It stays as the
  way any future change to generation is judged.

## 13. Order of work

1. Rewrite the generator: one whole-company call, objective, few-shot examples,
   no quota, structured output.
2. **Regenerate BringBack and read the output before writing anything else.**
   That is the test of the whole theory and it costs one call.
3. Delete the dead judges and `selectionScore`; reduce the classifier to the
   dataset critic.
4. Re-run calibration. Keep or delete the critic on the result.

Step 2 gates the rest. If a single well-instructed call produces questions the
founder recognises, most of the remaining machinery should not be rebuilt.

## 14. Implementation result — 2026-08-21

The work followed §13 in order.

1. Generation is now one whole-company Gemini call. It receives the objective,
   all confirmed product areas, verified company context, the 52 labelled
   BringBack examples, and a ceiling of 25 with an explicit instruction to stop
   before padding. It returns `question`, `scopeFamilyId`, `selectionClass` and
   `scenario`.
2. BringBack was regenerated before the classifier was rewritten. Two raw
   generator checks each returned nine selection-oriented questions across all
   five confirmed areas instead of another tutorial-heavy set. The complete
   production path then produced seven mechanically valid candidates; the
   whole-set critic removed two (one duplicate situation and one
   general-knowledge question), leaving five strong questions across all five
   areas.
3. `selectionScore`, its three dead model judgements, the threshold/separation
   machinery, the per-family allocation loop and `PROMPTS_PER_FAMILY` were
   deleted. The remaining critic accepts or rejects the complete set for only
   the four reasons in §11. It does not score, rank, rewrite or reclassify.
4. The critic stays for launch. It removed 2/7 BringBack candidates and, in an
   unrelated invoicing-product smoke test, removed four duplicate situations
   from eight candidates. That is material work, not a ceremonial second call.

The unrelated-brand check also covered the multi-tenant risk created by using a
photo-product calibration set. The surviving invoicing questions covered all
four supplied invoicing areas and contained no photo, restoration, family-member
or BringBack vocabulary. One first pass bundled several product areas into an
all-in-one request; generation was tightened to require one primary problem per
question, and the repeat returned four clean single-area questions.

The product contract is now **1–25 reviewed, distinct questions**, not exactly
40 and not exactly 25. Confirmation stores the exact reviewed set, checkout and
measurement accept that set, and the UI states “up to 25.” The forward migration
is `20260821_variable_prompt_sets.sql`; it must be applied with this deployment.

The development calibration harness still reports its raw disagreements. When
the 16 positive examples are reviewed together, it correctly prunes repeated
buyer situations but also rejects three polished questions as synthetic; it
accepts three of the 36 historical negatives. That overlap is recorded rather
than hidden or converted into another threshold. The live generated-set checks
above are why the critic remains, and the founder review screen remains the last
gate before prompts become durable.

Per-area regeneration is not a customer feature. It would create another paid
model-and-critic run without adding a new measurement capability. Customers can
edit, remove, or write a replacement question themselves before confirmation;
the UI and generation endpoint expose no family-regeneration path.
