# From a finite article program to a tracked-prompt subscription

> Refactor plan. Not yet built. Written 2026-08-15 against the code as it stands.
> `PIVOT.md` is the record of what exists; this is the shape it needs to become.
> Read §2 before disagreeing with anything else here — it is the one measured
> fact the whole model rests on.

---

## 1. What is actually being changed

Today the product sells **a fixed set of article clusters, delivered on a
schedule, after which the subscription cancels itself**. The measurement — the
part with no substitute — is given away in full before payment and then never
repeated.

The new model sells **continuous measurement of a fixed set of buyer prompts**,
with content as the output of what that measurement finds:

```
20 / 40 / 80 tracked prompts
      ↓  asked monthly of ChatGPT + Google AI Mode
losing prompts
      ↓  content-solvable only
      ↓  collapse duplicates
every remaining gap becomes an article
      ↓  ALL of them written, interlinked, fact-checked, delivered
re-measure the same prompts next month
```

**The measurement is the paid product.** Nothing is probed before payment —
there is no free tier and no sample. The audit that used to be given away in
full is now the thing being bought, and the customer's first run happens after
checkout. See §3.5.

The unit of sale becomes the prompt allowance. Article count is never promised;
it falls out of the measurement and is mathematically capped by it.

**This is a replacement, not an addition.** Every instruction below either
changes a thing or deletes it. There is no compatibility flag, no
`if (program.model === 'legacy')`, and no second delivery path. A repo carrying
two commercial models is a repo where neither is ever fully correct. so that old program based rows from db is to be completely deleted.

---

## 2. The invariant that makes this pricing honest — verified in code

The claim "articles can never exceed tracked prompts" is not a marketing
approximation. It is a property of the existing pipeline:

1. `toGapItems` (`lib/visibility/gap-mapper.ts`) emits **one gap per losing
   prompt**, keyed `queryId: prompt.id`. A prompt cannot produce two gaps.
2. `collapseToArticles` (`lib/harvest/clusterer.ts`) merges near-duplicate gaps
   into single articles. It only ever reduces.
3. Nothing downstream invents an article from nothing — `freezeArticleContracts`
   binds contracts to gaps that already exist.

Therefore, per cycle:

```
articles ≤ unique losing prompts ≤ tracked prompts

Starter   20 prompts  →  ≤ 20 articles
Growth    40 prompts  →  ≤ 40 articles
Scale     80 prompts  →  ≤ 80 articles
```

Real output is normally well below the ceiling. Worked, on Growth:

```
40 tracked prompts
 →  22 losing prompts          (18 already name the brand)
 →   5 overlap with each other
 →  17 unique articles
 →  all 17 written and delivered this cycle
```

The ceiling is what makes the plan safe to sell — it binds cost of goods to
price — not a target to hit. Nothing is held back to make a later month look
busier, and nothing is padded to reach a number.

**Which also answers the tier question.** A Scale customer is not buying more
clusters or a faster cadence; they are buying a wider slice of their buyer
question space, and a wider slice mechanically finds more gaps and therefore
produces more articles. The value ladder needs no separate delivery rule to make
it real.

**Action:** this must become a contract test, because it is now a pricing
promise rather than an implementation detail. If someone later adds a
"related topics" expansion step, the plan silently starts overselling.

A second consequence worth stating plainly to customers: output *should* fall
over time. Month one closes the biggest gaps; month four finds fewer because the
earlier work is winning. That is the product succeeding, and the pricing has to
be framed so it does not read as the product running out.

---

## 3. The five structural changes, in dependency order

### 3.1 The prompt set becomes durable and brand-owned

**The blocker for everything else.** Prompts today live in `ai_probe_prompts`,
which is keyed by `run_id`. They are an artefact *of* a run, created fresh each
time. "Re-run the same 20 prompts next month" has nowhere to read from, and
month-over-month comparison is impossible because there is no stable identity
for "the same question".

New table, `tracked_prompts`, owned by the brand:

| Column | Why |
|---|---|
| `id`, `user_id`, `brand_id` | ownership |
| `scope_family_id` | the topic it belongs to, as today |
| `prompt`, `prompt_norm` | the text, normalised for dedupe |
| `intent`, `article_type`, `source_seed` | unchanged, carried from generation |
| `status` (`active` / `retired`) | a customer can drop a prompt without losing its history |
| `created_at`, `retired_at` | when it entered the tracked set |

`ai_probe_prompts` keeps existing but gains `tracked_prompt_id`. It becomes the
*per-run observation* of a tracked prompt rather than the prompt itself. Every
existing column stays; `answers_total`, `verdict` and the rest are already
per-run values and were always misplaced on a "prompt" record.

That one FK unlocks the entire model: "how did this question move since last
month" becomes a query rather than a fuzzy text match.

**Onboarding change:** the confirm-prompts screen writes `tracked_prompts` once,
at brand save, instead of passing an array into the probe. The probe then reads
the brand's active set. This also removes `bindPromptsToAuditScope` — prompts
will already carry a real `scope_family_id` because they were persisted against
one, and that whole rebinding module exists only because prompts were transient.

### 3.2 The plan becomes a prompt allowance

`programs.tier` is currently `close | accelerate | dominate`, mapped to
`clusters_per_month` of 1 / 2 / 4 by `create_program_from_intent`
(`20260730_closed_pool_v2.sql:1218`). Velocity is the wrong axis now: cadence is
always monthly, and what varies is coverage.

| Plan | Price | Tracked prompts | Per prompt | Content |
|---|---:|---:|---:|---|
| Starter | $99 | 20 | $4.95 | close **all** qualified content gaps |
| Growth | $189 | 40 | $4.73 | close **all** qualified content gaps |
| Scale | $349 | 80 | $4.36 | close **all** qualified content gaps |

Doubling prompts costs 91% then 85% more, so each tier is better value per
prompt than the one below — the upgrade is a discount rather than a penalty, and
the product logic is identical across all three. Nothing about a plan changes
what the system does; it changes only how much of the buyer-question space is
covered.

- `tier` → `starter | growth | scale`
- `clusters_per_month` → **delete**. There is no per-cycle article or cluster quota; a cycle writes everything it finds.
- new `tracked_prompt_allowance` → 20 / 40 / 80
- `clusters_included` (frozen uuid array) → **delete**, see §3.3
- `total_articles` → **delete**. Nothing is promised.

The allowance is enforced at two points and nowhere else: the confirm-prompts
screen refuses to save more than the allowance, and the monthly cycle probes the
active set which cannot exceed it. Enforcing it in a third place is how the
three drift apart.

`grantBillingPeriodOnce(allowance)` already exists in
`lib/harvest/billing-lifecycle.ts` and already thinks in billing periods with an
allowance. It is the natural home for "this period entitles 20 tracked prompts",
and it already has replay protection via `p_source_event_id`.

### 3.3 The finite program dies

This is mostly deletion, and it is the part most likely to be done half-way.

**Delete outright:**

- `scheduleEndOfScopeCancellation` (`lib/harvest/billing-lifecycle.ts:68`) and
  its only caller, the `scope_status === "scope_delivered"` branch at the top of
  `trigger/ship-cluster.ts`. A subscription now ends when the customer cancels
  it, and nothing else.
- `programs.scope_status` and the `scope_delivered` state it exists to express.
- The 25-article floor in `create_program_from_intent`
  (`20260730_closed_pool_v2.sql:1200`, `RAISE EXCEPTION 'Purchase intent contains
  fewer than 25 articles'`). This is the single most direct contradiction of the
  new model: it refuses a sale precisely when the audit found a small, honest
  amount of work.
- `auditCheckoutFreshness` and `HARVEST_POLICY.checkoutFreshnessDays`
  (`lib/harvest/program-contract.ts:18`). "This audit is more than 30 days old"
  is incoherent when measurement is monthly by construction — the newest run is
  always the truth.

**Rewrite:** `program_clusters` rows are today created in one batch at purchase,
one per frozen cluster, with `scheduled_for` offsets computed from the tier. The
monthly cycle instead **appends one row per cycle** when it produces a cluster.
`ship-cluster`'s delivery loop needs no change — it already walks
`program_clusters` by `scheduled_for` and state, which is exactly the behaviour
wanted. This is a change to who writes the rows, not how they are consumed.

### 3.4 Clustering stops being a unit of sale or delivery

The old model sold clusters and delivered them one per period. The new model
sells coverage and delivers **every article the measurement produces**. A cluster
therefore stops being a commercial object entirely and survives only as what it
always was underneath: a group of articles that link to each other.

`HARVEST_POLICY.minQualifiedClusterArticles: 8` currently does three jobs. Two
of them must go.

1. **Interlinking group (keep, demoted).** `clusterer.ts` uses it as
   `TARGET_CLUSTER_MIN` to decide what makes a coherent web of internal links.
   Real, but it becomes a *preference* — prefer 8–15, ship what the cycle found.
2. **Commercial qualification (delete).** `selectQualifiedProgramScope`
   (`program-contract.ts:44`) filters clusters by it before anything can be sold.
   There is no selection at checkout any more; the subscription buys coverage.
3. **Silent discard (delete — this is a defect under the new promise).** See
   below.

#### The `unsold` leak, which the new promise turns into a bug

`groupIntoClusters` emits clusters plus `orphanedUnits` — units in groups too
small to qualify. `absorbOrphanedUnits` then tries to place them, and returns
`{ clusters, unsold }`. When **no cluster qualifies at all** it takes the early
exit at `absorption.ts:145` and returns every unit as `unsold`:

> "Nothing qualifies anywhere. Surface as measured-but-unsold evidence rather
> than deleting demand the customer can still act on."

That comment is correct for a finite program: you may only sell qualified
clusters, so the honest thing is to show the rest as evidence. Under
"we write every content-solvable gap we find" it is a hole in the deliverable.

And it is worst exactly where it matters most. A Starter run tracks 20 prompts.
If those produce, say, 9 articles spread across three topics, no group reaches 8,
`groupIntoClusters` returns **zero** clusters, and every article lands in
`unsold`. The customer paid $99 for "all qualified content gaps closed" and the
pipeline delivers nothing while reporting itself successful.

**Required change:** the cycle must conserve every article. Clustering decides
*how articles are grouped for internal linking*, never *whether an article is
written*. Concretely:

- `absorbOrphanedUnits` returns no `unsold`. Units that cannot join a group
  become their own single-article group.
- A single-article group is legitimate. It has no internal links to make, which
  is a property of that article, not a reason to withhold it.
- The `unsold` concept and every read of it are deleted, not defaulted to empty.

**Contract test:** `articles written this cycle === unique content-solvable gaps
this cycle`. Conservation is now a commercial promise, and the old code has an
explicit, well-reasoned path that breaks it.

### 3.5 The audit moves behind the paywall

Today the entire audit — every prompt, every gap, every citation, the full
article plan — is produced and shown before payment, and `/audit` is explicitly
framed as "inspect the scope before you pay". That was right for a one-off
purchase of a known quantity. It is wrong for a subscription whose value *is*
the measurement: the diagnosis is the product, and it is currently free.

**There is no free tier and no sample.** The probe does not run until there is
an active subscription. A customer who needs convincing by a free measurement is
not going to be convinced by a smaller one, and a partially-redacted report
teaches nobody anything while costing real credits to produce.

#### Where the gate sits

The onboarding flow keeps every screen it has. One is inserted:

```
website → brand → topics → rivals → questions → ★ plan + checkout → probe → report
```

Everything before the gate is free because it costs almost nothing and is the
work that makes the measurement good: a crawl, two model calls, and the
customer's own confirmations. Everything after it spends Cloro credits on their
behalf.

#### The gate is a good upsell moment, and it should be built as one

By the time the customer reaches it they have confirmed a real set of questions —
say 34 of them. The plan screen can then say something specific rather than
generic:

> You confirmed **34 questions**.
> **Starter** tracks 20 of them — we pick the 20 highest-intent.
> **Growth** tracks all 34, with room for six more.

That is an honest comparison built from their own input, and it is far stronger
than three feature columns. It also means the plan choice can come *after*
question confirmation rather than before, which keeps the flow's momentum: the
customer commits to what they want measured before being asked to pay for it.

#### What the allowance does to the confirmed set

Prompt generation is cheap (Gemini, per family); probing is what costs money. So
generate the full confirmed set as today and let the allowance decide how many
are *tracked*:

- `tracked_prompts` stores every confirmed question
- the allowance marks the top N `active`, the rest `retired`
- "top N" reuses `orderByIntentMix` plus the existing family round-robin, so the
  tracked set spans buyer situations and confirmed topics evenly rather than
  taking the first N the model wrote

Upgrading a plan then activates already-confirmed prompts rather than asking the
customer to think again — the upgrade is instant and the history is continuous.

#### What this deletes

`purchase-intent` currently exists to freeze a cluster selection at checkout,
because the customer was buying a specific set of articles. Nothing is frozen
now: the subscription buys coverage, and what gets written is decided monthly by
what the measurement finds. The intent record, its graph snapshot and its
validation collapse into "start a subscription for this brand at this tier".

#### The risk, stated plainly

The customer pays before seeing a single measured answer. That is a real
conversion cost and it is a deliberate trade — the alternative was giving away
the only part of this product that has no substitute.

The named future answer is a **trial**, not a free tier: full measurement, time
boxed, card required. That is a different mechanism with a different failure
mode and it is out of scope here. Nothing in this plan should be built in a way
that makes adding one harder — in particular, the paywall must gate *running a
probe*, not *viewing a report*, so a trial later means changing who may start a
run rather than unpicking a redaction layer.

---

## 4. The monthly cycle

One new scheduled task, `trigger/run-monthly-cycle.ts`, modelled on the existing
`ship-cluster` schedule which already sweeps active programs:

```
for each active subscription whose cycle is due:
  1. probe the brand's active tracked_prompts        (existing runVisibilityProbe)
  2. losing prompts → gaps                           (existing toGapItems)
  3. keep only content-solvable gaps                 (NEW — §5)
  4. drop gaps already closed by a delivered article (NEW — set difference)
  5. collapse duplicates into articles               (existing collapseToArticles)
  6. group for internal linking                      (existing, no longer a gate)
  7. write EVERY article from step 5                 (existing writer + ship path)
```

Steps 1, 2, 5, 6 and the writing in 7 already exist and already work. The
genuinely new logic is steps 3 and 4, and step 4 is a set difference against
`planned_articles` already delivered for this brand.

**There is no per-cycle quota.** Step 7 writes what step 5 produced. If that is
17 articles, 17 are written; if it is 3, three are. The prompt allowance is the
only ceiling, and it binds through step 1.

**If a cycle produces nothing new**, the correct behaviour is to refresh an
existing article whose prompts are *still* losing — not to invent topics to fill
a quota that does not exist. A month where the measurement says "your published
work is holding" is a real outcome and the report should say so.

**Idempotency matters more here than anywhere else.** A cron that double-fires
must not write two sets of articles or charge twice. The cycle keys on
`(program_id, billing_period_start)` with a unique constraint — the same shape
`grantBillingPeriodOnce` already uses.

**Open: delivery pacing.** Writing 17 articles the hour a customer subscribes is
technically fine and editorially questionable — publishing seventeen pages in a
day is a pattern nobody wants on their site. The existing `program_clusters`
scheduling machinery already paces delivery and can keep doing so *within* a
cycle. That is a pacing decision about publication, and it must never quietly
become a quota: everything found in a cycle is written in that cycle, even if it
is published over several weeks.

---

## 5. The one genuinely new piece of judgement: content-solvable gaps

"Ignore PR, outreach, technical, Reddit" is the only requirement here that has
no existing implementation, and it is the one that decides whether the monthly
cluster is worth its price.

A losing prompt is **not** content-solvable when the answer's citations are
dominated by sources the customer cannot publish into — a Reddit thread, a
review aggregator, a journalist's roundup. Writing an article does not win that
question; getting placed does.

The good news is the classifier already exists.
`lib/visibility/citation-classifier.ts` splits citations into
"you can publish this" versus "you have to earn this", and the dashboard already
renders that split. The monthly cycle should use it as the filter: a gap whose
answers were built overwhelmingly from earned sources is recorded as a
**visibility gap that content will not close**, shown on the report as such, and
excluded from the cluster.

Two cautions:

- The last live run reported **81% of citations uncategorised**. The filter is
  worthless until that number is understood — it may be a classifier gap, or it
  may be that Cloro returns citation shapes the classifier has never seen. Fix
  that before trusting this step.
- Do not turn this into a threshold nobody can defend. Follow the repo rule: if
  the two populations do not separate, say so rather than picking a midpoint.

---

## 6. What must be decided before building, not during

**Settled: no free tier, no sample.** The audit runs after checkout. The
conversion cost is accepted deliberately — the alternative was continuing to give
away the only part of this product with no substitute. A **trial** (full
measurement, time boxed, card required) is the named future answer and is out of
scope here. The only design constraint it imposes is in §3.5: gate *running a
probe*, never *viewing a report*, so adding a trial later changes who may start a
run rather than unpicking a redaction layer.

**Settled: pricing.** $99 / $189 / $349 for 20 / 40 / 80 tracked prompts. The
per-prompt price falls at each tier, so upgrading is a discount. Product logic is
identical across plans.

**Settled: what a higher tier actually buys.** Not a faster cadence and not more
clusters — a wider slice of the buyer-question space, which mechanically finds
more gaps and so produces more articles. There is no per-cycle quota anywhere in
the system, which is why `clusters_per_month` is deleted rather than repurposed.

**Open: publication pacing within a cycle.** Everything found in a cycle is
written in that cycle; whether seventeen articles should also be *published* the
same week is a separate editorial question. See §4 — the existing scheduling
machinery can pace it, and it must never quietly become a quota.

**Open: cost of goods at the ceiling.** A Growth cycle can legitimately produce
40 articles, each carrying Tavily research and several writer calls. That is
almost certainly comfortable against $189, but it has never been measured — and
the ceiling is the number to measure at, not the average.

**Open: what happens to existing programs?** There are none in production today.
If that changes before this ships, the answer is a one-way migration and not a
compatibility layer: convert each active program to an allowance sized to its
delivered scope and let it continue on the new machinery.

**Open, and blocking §5: why are 81% of citations uncategorised?** The
content-solvable filter is the difference between selling "we write the content
that closes your gaps" and selling articles against questions no article can
win. It cannot be built on a classifier that is failing on four fifths of its
input. Diagnose first — it may be a classifier gap, or Cloro may be returning
citation shapes it has never seen.

---

## 7. Build order

Each step leaves the system working. Nothing here is a big-bang cutover.

| # | Step | Size | Depends on |
|---|---|---|---|
| 1 | `tracked_prompts` table + onboarding writes it + probe reads it | M | — |
| 2 | Contract test: articles ≤ losing prompts ≤ tracked prompts | S | 1 |
| 3 | Delete the finite program (§3.3) — auto-cancel, 25-article floor, freshness gate, `clusters_included`, `purchase_intent` freezing | M | — |
| 4 | Plan = allowance: tier rename, `tracked_prompt_allowance` at 20/40/80, allowance activates the top N tracked prompts | M | 1, 3 |
| 5 | Clustering demoted to a grouping device; `unsold` deleted so every gap is written (§3.4) | M | 3 |
| 6 | Paywall: probe refuses to run without an active subscription; plan screen inserted after question confirmation | M | 4 |
| 7 | Monthly cycle task (probe → gaps → cluster → append) | L | 1, 3, 4 |
| 8 | Content-solvable filter — **after** the citation-classification problem is understood | M | 7, and a diagnosis |

Two notes on sequencing.

**Steps 1–3 are worth doing regardless of whether this pricing model lands**,
because each removes a contradiction that already exists: transient prompts make
month-over-month comparison impossible, and the auto-cancel contradicts a
subscription the moment anybody renews.

**Step 6 is the revenue switch and it is small.** It is deliberately placed
before the monthly cycle: the first paying customer only needs the paywall and a
first run, and the recurring machinery can land before their second month. Do not
invert this — building the cycle first means carrying it unpaid for weeks.

---

## 8. What deliberately does not change

- The probe: engines, parser, gap mapper, evidence storage. All of it already
  measures the right thing.
- The clusterer, article contracts, the writer, internal linking, publication.
  A cluster is a cluster; only who asks for one changes.
- `ship-cluster`'s delivery loop, which already walks scheduled rows.
- Dodo subscription plumbing and `grantBillingPeriodOnce`.
- The evidence posture. Every number still expands to the answer behind it —
  that is what makes a recurring measurement worth paying for rather than a
  score a customer learns to ignore.
