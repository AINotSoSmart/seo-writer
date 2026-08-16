# From a finite article program to a tracked-question subscription

> Refactor and launch plan. Not yet built. Revised 2026-08-16 against the code
> as it stands. `PIVOT.md` records what exists; this document defines the next
> product contract and the minimum architecture needed to support it.
>
> Commercial decisions are labelled separately from launch hypotheses. Nothing
> becomes validated merely because it appears in this document.

---

## 1. The product contract

Today the product sells a fixed set of article clusters, delivers them on a
schedule, and then cancels its own subscription. Measurement is performed once,
shown before payment, and never repeated.

The replacement product sells continuous measurement of a stable set of buyer
questions, followed by a bounded batch of work against what that measurement
finds.

It makes three separate guarantees:

1. **Findings are conserved.** Within the customer's 40 tracked questions,
   every losing result and its classification is preserved and shown. Nothing is
   silently discarded because it failed a cluster-size rule.
2. **Production is capped.** Up to eight eligible create or refresh actions are
   completed per billing cycle. Report-only findings do not consume a production
   slot. The remaining eligible opportunities stay visible and are reconsidered
   while the subscription is active.
3. **Delivery is one batch.** All drafts completed in a cycle are released
   together. There is no drip-feeding or intra-month delivery schedule.

```
40 stable buyer questions
      ↓ asked monthly of ChatGPT + Google AI Mode
per-question results and evidence
      ↓ reconcile with prior cycles
create / refresh / report-only / needs customer input
      ↓ collapse duplicate create/refresh work
rank all eligible actions and retain all findings
      ↓ select up to 8 actions
freeze links only within the selected batch
      ↓ generate and QA
one complete batch of drafts
```

The sentence **“we close all qualified content gaps” must not appear in product
copy**. The honest promise is:

> We track 40 buyer questions, show every opportunity we find, and complete the
> eight highest-priority eligible content actions each cycle.

If a cycle has five eligible actions, five are produced. Never invent three more
to fill the cap. If it has seventeen, the highest-priority eight are selected and
the rest remain visible for reconciliation next cycle.

The backlog is not a debt owed after cancellation. Cancellation stops future
production cycles; completed reports and historical findings remain readable.

**The measurement is the paid product.** For the launch test, the probe runs only
after checkout. That paywall is a hypothesis with a review trigger in §6, not a
permanent truth.

This is a replacement, not a parallel commercial path. There is no legacy
feature flag and no second delivery model. There are no production programs to
migrate today, but historical measurement evidence must not be deleted merely
because the finite sales model is removed.

---

## 2. The bounded invariants

### 2.1 Measurement ceiling

The first ceiling is already a property of the visibility pipeline:

1. `toGapItems` (`lib/visibility/gap-mapper.ts`) emits at most one gap for each
   losing per-run prompt.
2. Each per-run prompt points back to one durable tracked question.
3. Duplicate gaps may collapse into one production action; collapse only
   reduces the number of actions.
4. No topic-expansion step may invent an action that has no measured source
   question.

Therefore:

```
losing findings ≤ active tracked questions ≤ 40
candidate create/refresh actions ≤ losing findings
```

This must become a contract test. A future “related topics” feature must create
a separate out-of-plan recommendation, not silently expand paid production.

### 2.2 Production ceiling

The second ceiling is a product rule:

```
produced actions ≤ min(8, eligible candidate actions)
```

One action may resolve several duplicate buyer questions. A report-only finding
is measurement, not production, and consumes no slot. A create action consumes
one slot. A founder-assisted or automated refresh consumes one slot.

Eight is a launch hypothesis chosen to bound cost and give a customer a
manageable monthly batch. It is not derived from
`HARVEST_POLICY.minQualifiedClusterArticles`. Re-evaluate it after ten customers
have completed one cycle and after cost at the cap has been measured.

---

## 3. The state model

The old schema makes an immutable audit, a cluster, a sold program and a
generated article carry several meanings at once. A recurring product needs to
separate four things:

```
tracked question → measured finding → selected cycle action → generated output
```

### 3.1 Durable tracked questions

Prompts currently live in `ai_probe_prompts`, keyed by `run_id`. They are an
artefact of a run, so there is no stable identity for “the same question next
month”.

Create `tracked_prompts`, owned by a brand:

| Column | Purpose |
|---|---|
| `id`, `user_id`, `brand_id` | ownership |
| `scope_family_id` | confirmed product area |
| `prompt`, `prompt_norm` | stable question and dedupe form |
| `intent`, `article_type`, `source_seed` | generation provenance |
| `tracking_status` (`active` / `inactive` / `retired`) | entitlement and customer choice |
| `coverage_state` (`unknown` / `no_page` / `has_page`) | explicit customer answer, never inferred |
| `target_url` | optional existing page supplied after a losing result |
| `created_at`, `retired_at` | history |

`inactive` and `retired` are different. Questions outside an allowance are
inactive and may later be activated. Retired means the customer deliberately
stopped tracking the question.

`ai_probe_prompts` remains the per-run observation and gains
`tracked_prompt_id`. Its verdict, counts and answers remain run-scoped. The
confirm-questions screen writes the durable set once; every probe reads the
active set instead of regenerating it.

### 3.2 Persistent findings, not backlog-shaped articles

Do **not** use `planned_articles.delivery_status = 'withheld'` as the backlog.
That field currently means generated work is hidden until its delivery group is
ready, and its check constraint accepts only `withheld | delivered`. `queued`
belongs to `generation_status`.

Create `content_opportunities`, with one durable record per tracked question:

| Column | Purpose |
|---|---|
| `id`, `user_id`, `brand_id`, `tracked_prompt_id` | stable identity and ownership |
| `state` (`open` / `needs_input` / `monitoring` / `resolved` / `dismissed`) | lifecycle across runs |
| `resolution_type` (`create` / `refresh` / `report_only` / `unknown`) | current actionability |
| `first_seen_run_id`, `last_seen_run_id` | observation history |
| `last_verdict`, `last_priority`, `last_reason` | current measured state |
| `target_url` | copied from the explicit customer choice when present |
| `resolved_at`, `updated_at` | lifecycle |

Use a unique constraint on `(brand_id, tracked_prompt_id)`. When a question wins,
the opportunity becomes resolved. If it loses again later, the same opportunity
reopens; a second backlog row is not created.

Duplicate questions are conserved as separate measured findings but may be
resolved by one production action. This keeps measurement traceable without
charging production capacity twice for one page.

### 3.3 Billing cycles and selected actions

Create `subscription_cycles`, one per paid billing period:

| Column | Purpose |
|---|---|
| `id`, `program_id`, `brand_id`, `billing_grant_id` | ownership and entitlement |
| `period_start`, `period_end` | cycle boundary |
| `measurement_run_id` | immutable run for this cycle |
| `state` (`pending` / `measuring` / `awaiting_input` / `producing` / `ready` / `delivered` / `failed`) | orchestration |
| `action_allowance` | frozen at 8 for this cycle |
| `delivered_at`, `failure_code` | outcome |

Enforce one cycle with a unique constraint on `(program_id, period_start)`.

Create `cycle_actions`, representing the create/refresh units selected after
deduplication:

| Column | Purpose |
|---|---|
| `id`, `cycle_id`, `brand_id` | ownership |
| `resolution_type` (`create` / `refresh`) | production path |
| `state` (`selected` / `generating` / `ready` / `delivered` / `failed`) | production lifecycle |
| `rank`, `selection_reason` | why this action entered the batch |
| `target_url` | existing URL for refresh, proposed URL for create |
| `planned_article_id` | generated output, when created |

Create `cycle_action_opportunities` as the junction between one selected action
and the one or more tracked-question opportunities it resolves.

`planned_articles` remains a generation and delivery record. It is created only
for a selected create/refresh action and gains `cycle_action_id`. It is not the
opportunity backlog and does not represent report-only work.

`programs` becomes the long-lived subscription for one brand. Its single
`audit_id` is no longer authoritative; each cycle points to its own immutable
measurement run. `program_clusters` cannot be the recurring scheduler: it is
limited to six sequence positions and delivers cluster by cluster. Replace that
commercial role with `subscription_cycles` and `cycle_actions`.

Removing `program_clusters` has hard dependants and cannot be treated as a table
rename:

- `program_cost_events.program_cluster_id` must be replaced by a cycle/action
  reference so per-output cost accounting survives
- `planned_article_links` must be scoped to the selected cycle batch, not the
  deleted sold cluster
- `consume_program_credit`, cluster claim/delivery RPCs and `ship-cluster` must
  be replaced by cycle-action claiming and one batch-release transaction
- writer retries must continue to reuse the same `planned_article_id` and
  `cycle_action_id`

The batch-release transaction marks all ready selected outputs delivered and the
cycle delivered together. It must not expose half a cycle if a worker fails.

### 3.4 One launch plan and an explicit introductory price

Launch one plan:

> **Founding beta**
> One site · 40 tracked buyer questions · ChatGPT + Google AI Mode · up to 8
> prioritised create/refresh actions per cycle · one complete batch · visible
> findings and backlog · cancel anytime.

The billing contract is explicit:

- billing periods 1–3: **$99/month**
- billing period 4 onward: **$189/month** while the subscription remains active
- both phases are displayed before checkout
- send a reminder before the first $189 charge

This is introductory pricing, not a surprise future repricing. Implement it as a
provider-supported expiring discount or scheduled price phase. If Dodo cannot do
that idempotently, do not simulate it with a fragile webhook counter; choose one
fixed launch price before enabling checkout.

Schema changes:

- collapse `tier` to one launch plan value, while retaining a plan identifier for
  future expansion
- delete `clusters_per_month`, `clusters_included` and `total_articles`
- add `tracked_prompt_allowance = 40`
- freeze `action_allowance = 8` onto each paid cycle

`subscription_period_grants` may remain the immutable billing-event ledger, but
`grant_subscription_period` must be rewritten. Today it resets generic article
credits and is consumed per `planned_article`. In the new model, one successful
billing grant authorises exactly one `subscription_cycles` row with an action
allowance of eight. `subscription_credit_consumptions` and compatibility credit
resets must not remain the source of truth for cycle capacity.

### 3.5 Retire the finite sales model

Delete through new migrations and code changes; never edit an applied migration:

- `scheduleEndOfScopeCancellation` and the `scope_delivered` auto-cancel path
- the 25-article purchase floor
- checkout freshness rules tied to a one-time audit
- `program_purchase_intents` and the frozen cluster selection/graph snapshot
- `program_clusters` as a sold scope and delivery scheduler
- finite-program tier velocity and completion counters

Preserve completed visibility runs, evidence, answers and delivered content.
“Delete the finite program” does not mean delete the facts already measured.

### 3.6 Paywall and launch funnel

For the launch test:

```
website → brand → topics → rivals → questions → plan + checkout
        → paid probe → report and target-page triage → production → batch
```

No free probe and no redacted sample are built initially. Customers can see the
questions they confirmed before checkout, and founder-led sales can use an
existing demonstration report. Target-page questions do not belong before the
probe; see §5.2.

The paywall is enabled only after a complete paid first cycle can be fulfilled,
including founder-assisted refreshes. Building the checkout screen earlier is
fine; accepting money before the batch path works is not.

Review the gate after 30 qualified founder-led prospects have reached the offer:

- if at least two buy, keep testing the paid-first path
- if prospects repeatedly refuse specifically because they need proof before
  payment, test a card-required trial or refundable first measurement
- do not add a permanent free tier merely because generic landing-page traffic
  did not convert

---

## 4. The cycle lifecycle

### 4.1 Start and measure

On a successful initial payment or renewal:

1. `grant_subscription_period` records the provider event idempotently.
2. It creates one `subscription_cycles` row for the billing period.
3. The cycle probes the brand's active durable questions.
4. Per-run prompt rows and verbatim evidence are stored exactly as today.
5. Each result reconciles its durable `content_opportunities` row.

The first paid cycle may be started manually from a founder control. The cron is
required before the first renewal, not before the first sale.

### 4.2 Reconcile, do not subtract delivered articles

“An article was delivered” does not prove a visibility gap was closed. The new
measurement decides what happened:

| Current result | Prior action | Opportunity state |
|---|---|---|
| brand now wins | any | `resolved` |
| still losing | no delivered action | `open` or `needs_input` |
| still losing | delivered create/refresh, too soon to evaluate | `monitoring` |
| still losing | delivered create/refresh, observation window elapsed | eligible refresh or report-only review |
| question retired | any | retain history; exclude from production |

Never drop a losing result merely because a related draft was delivered. Never
write a second new page when the tracked question already has a delivered target
URL. The exact observation window is a policy value to validate; it must prevent
rewriting a page before engines had a reasonable chance to recrawl it.

### 4.3 Triage and select

After measurement:

1. classify every losing finding as create, refresh, report-only or unknown
2. surface unknown/high-priority findings for target-page input on the report
3. exclude report-only and unknown findings from production capacity
4. combine eligible findings only when one content action can honestly address
   all of them
5. never combine create and refresh, or two different refresh target URLs
6. rank the eligible actions, including carried-over backlog and new findings
7. select at most eight

Backlog is reconsidered, not blindly FIFO. A carried-over finding may resolve,
become report-only, or fall below newer evidence. Preserve its history and show
why its state changed.

`scoreVisibilityGap` may seed the internal ordering because it combines verdict,
cross-engine agreement, commercial intent and rivals named. It is hand-weighted,
so never present its integer as a scientific customer score. Show the evidence
reason instead: “absent from 4 of 4 answers; three rivals named.”

### 4.4 Freeze links after selection

The selected actions define the delivery boundary:

1. select up to eight actions
2. group only those selected actions for useful internal linking
3. freeze slugs, target URLs and links for that selected batch
4. create `planned_articles` rows and writer contracts
5. generate and QA every selected output
6. release the cycle only when its selected outputs are ready

No selected draft may require an internal link to an unselected backlog item.
Clustering remains an editorial grouping mechanism, never a commercial gate.
Single-article groups are legitimate.

The `unsold` path is deleted from commercial persistence. Every losing finding
has a durable opportunity row even when it is not selected for production.

### 4.5 Deliver one batch

Everything completed in the cycle becomes visible in FlipAEO together, with
export and a recommended publishing order.

WordPress behaviour must be described precisely:

- without a connection, the customer receives in-app/exportable drafts
- with a connection, the customer may opt to push the completed batch as
  WordPress drafts
- immediate automatic publication is not part of the launch promise

Sending eight WordPress drafts is delivery, not publication pacing. The customer
decides when to publish them.

If no production action is eligible, deliver the measurement report honestly.
Refresh only when an explicit target URL exists, the question is still losing,
and the observation window has elapsed. Never invent work to fill eight slots.

### 4.6 Idempotency and cancellation

- one billing period creates at most one cycle
- one cycle selects at most eight actions
- one opportunity may be linked to only one selected action in a cycle
- retries reuse the same cycle and action ids
- a duplicate cron or webhook cannot generate a second batch
- cancellation prevents future cycles but does not erase reports or delivered
  drafts

---

## 5. Resolution types and their dependencies

| Type | When | Production slot | Launch status |
|---|---|---:|---|
| **create** | customer explicitly says no suitable page exists | 1 | existing writer path, after selected-batch refactor |
| **refresh** | customer supplies the page meant to win and it still loses | 1 | founder-assisted initially; automation not yet built |
| **report-only** | publishing owned content is not the appropriate remedy | 0 | requires reliable classification or founder review |
| **unknown** | coverage or citation type is unresolved | 0 | ask or review; never assume “create” |

### 5.1 Content-solvable classification

A losing question is not automatically solved by an owned article. Answers may
depend on Reddit, review marketplaces, journalist roundups, directories or other
surfaces the customer cannot publish into directly.

`lib/visibility/citation-classifier.ts` already attempts to separate publishable
and earned sources, but the last live run reported 81% of citations as
uncategorised. Diagnose the returned citation shapes before automating this
decision.

For the founding beta, ambiguous findings may be founder-reviewed. Unknown or
unreviewed findings remain report-only/unknown and never enter production merely
to keep the batch full. This manual safety valve prevents the classifier from
becoming another months-long pre-revenue project while preserving honesty.

### 5.2 Target URLs belong on the report

Do not ask for a URL beside every question during onboarding. Before the customer
has seen a result, that is maximum friction with minimum motivation and directly
contradicts `ROADMAP.md` §1.

After a question loses, ask on its report row:

> Do you already have a page meant to answer this question?

- URL supplied → `coverage_state = has_page`, save `target_url`, classify refresh
- explicit “no” → `coverage_state = no_page`, classify create
- skipped → `coverage_state = unknown`, make no coverage claim and do not
  automatically produce a new page

Ask first on the highest-priority candidates rather than forcing answers for all
40. Stored citations allow the URL to be matched retroactively at zero probe
cost.

Do not reintroduce the partial full-site coverage scanner. Sampling 150 pages of
a large site cannot support a confident “you have no page” claim.

### 5.3 Refresh scope

Target-page input solves the classification dependency; it does not magically
build the refresh writer. For initial customers, a supplied page can be fetched
and the revised draft can be founder-assisted. Do not market automated refreshing
until the single-page analysis and rewrite path has been built and verified.

Track how often paid findings have an existing target URL. That rate is the build
trigger for automated refresh—not intuition alone.

---

## 6. Decisions, hypotheses and validation

### Settled product contract

- one site and 40 active tracked buyer questions
- ChatGPT and Google AI Mode measured monthly
- every finding conserved and visible
- up to eight eligible create/refresh actions per cycle
- report-only findings consume no action slots
- no padding and no silent discard
- one complete batch of drafts
- no automatic publication
- one launch plan rather than three speculative tiers

### Launch hypotheses

- eight is the right action cap
- paid measurement can convert without a free probe
- $99 for three introductory billing periods can acquire founding customers
- $189 is an acceptable continuing price
- monthly measurement plus create/refresh work is sufficient for retention

Treat these as experiments. They become decisions only after customer behaviour
supports them.

### Cost validation

Measure one worst-case cycle with eight outputs, including:

- both-engine probe cost for 40 questions
- embeddings, clustering and title calls
- Tavily research
- all writer, repair and QA calls
- image generation/storage if included
- founder time spent classifying or refreshing

Founder time is cost of goods during the beta even if no invoice records it.

### First-customer validation

Run founder-led outreach while implementation is underway. Do not wait for the
monthly cron before speaking to prospects.

Initial evidence threshold:

- 30 qualified prospects receive the specific offer
- at least five seriously inspect the confirmed-question offer/demo
- at least two pay
- at least one publishes three or more delivered drafts
- at least one wants a second cycle at the disclosed price path

Interpret the failure stage correctly:

- nobody reaches the offer → targeting or acquisition problem
- they reach it but will not pay without evidence → paywall/proof problem
- they pay but do not publish → deliverable or quality problem
- they publish but do not want cycle two → recurring measurement/refresh problem

Do not answer any of those failures with another wholesale product pivot before
identifying the stage that actually failed.

---

## 7. Build and launch order

Each migration is new and forward-only. Do not edit applied migrations.

| # | Step | Why here |
|---|---|---|
| 0a | Fix buyer-question generation and verify it by hand on several real businesses | Persisting weak prompts makes weak prompts durable. `ROADMAP.md` §7c shows mechanics are currently manufactured from repeated descriptions |
| 0b | Inspect the uncategorised citation shapes and define a conservative classifier plus founder-review fallback | Production must not be selected from evidence nobody understands |
| 1 | Add `tracked_prompts`; make onboarding write them and the probe observe them through `tracked_prompt_id` | Stable identity is required for every recurring comparison |
| 2 | Add `content_opportunities`, `subscription_cycles`, `cycle_actions` and their junction; link generated outputs to actions | Establish the recurring state model before adapting delivery |
| 3 | Remove finite-program purchase intent, cluster scheduling, auto-cancel and fixed-audit ownership; re-home cost/link/claim/delivery foreign keys; rewrite billing grants to authorise one cycle | The old commercial state machine cannot renew safely, and deleting only its top-level tables would break the writer |
| 4 | Implement per-cycle reconciliation and contract tests | Prevent duplicate backlog and false “closed” claims |
| 5 | Put target-page triage on losing report rows; add explicit unknown/no-page/has-page states | Never infer create versus refresh from an incomplete crawl |
| 6 | Rank eligible actions, select at most eight, then freeze the selected-only link graph | Prevent links to undelivered backlog work |
| 7 | Generate/QA selected create actions, support founder-assisted refreshes, and release one in-app/exportable batch; optionally push the batch to WordPress drafts | Complete the deliverable before accepting money |
| 8 | Implement the one-plan checkout and explicit introductory price phases; run a full sandbox payment-to-batch test | This is the revenue switch |
| 9 | Enable checkout and fulfil the first customers with founder oversight | Learn before automating edge cases |
| 10 | Add the automated renewal scheduler and retry/alerting path | Required before the first customer's second billing period |

Step 8—not the existence of a checkout component—is the revenue switch. Enable
payments only after the payment-to-batch path passes end to end.

Steps 0a and 0b are bounded diagnosis and verification work. Founder review is
an acceptable beta fallback; neither step is permission to spend another month
building a perfect universal classifier before asking anyone to pay.

---

## 8. Reused components and deliberate rewrites

### Reuse

- engine adapters, parser, evidence storage and run summaries
- the durable evidence posture: every number expands to the answer behind it
- gap mapping and internal scoring as inputs to reconciliation/ranking
- article collapse, research, writer and QA machinery for create actions
- WordPress and export integrations
- Dodo webhook verification and billing-period parsing

### Rewrite or replace

- prompt ownership: run-scoped prompts become durable tracked questions plus
  per-run observations
- billing entitlement: generic article credits become one cycle with an action
  allowance
- commercial state: finite `program_clusters` become recurring cycles/actions
- backlog: a persistent opportunity lifecycle replaces `withheld` articles
- selection: choose the action batch before freezing links and contracts
- delivery: release one cross-topic cycle batch rather than one sold cluster at a
  time
- refresh: explicit target page and founder-assisted path first; automation later

---

## 9. Acceptance tests before launch

The refactor is not complete until these behaviours are verified:

1. A brand cannot have more than 40 active tracked questions on the launch plan.
2. Re-running a tracked question creates a new observation, not a new tracked
   question.
3. Every losing observation reconciles one durable opportunity; no cluster floor
   can delete it.
4. Present questions resolve existing opportunities without deleting history.
5. A delivered draft does not mark a still-losing question resolved.
6. Unknown and report-only findings consume zero production slots.
7. Duplicate findings may map to one action, and the cycle selects no more than
   eight actions.
8. All frozen internal links target selected outputs or already-live pages,
   never unselected backlog items.
9. A cycle is released as one batch only after every selected output is ready.
10. Duplicate billing events and cron retries cannot create duplicate cycles,
    actions or drafts.
11. Cancellation stops future cycles without deleting prior reports or content.
12. The introductory-to-standard price transition is displayed, billed and
    retried exactly as promised.
13. A full sandbox journey succeeds from checkout through probe, report triage,
    generation, batch delivery and optional WordPress draft push.
