# From a finite article program to a tracked-question subscription

> Product contract and implementation ledger. Revised 2026-08-21 against the
> repository and the completed BringBack visibility run. The original phases
> remain below as history. The current contract in §§1-2 and §9, the 2026-08-17
> correction in §7, and `PROMPT_QUALITY_PLAN.md` §11 onward are authoritative.
> Their forward migrations must ship with the matching application deployment
> before another paid measurement is started.
>
> Commercial decisions are labelled separately from launch hypotheses. Nothing
> becomes validated merely because it appears in this document.

---

## 1. The product contract

The retired product sold a fixed set of article clusters, delivered them on a
schedule, and then cancelled its own subscription. Measurement was performed
once, shown before payment, and never repeated.

The replacement product sells continuous measurement of a stable set of buyer
questions, followed by a bounded batch of work against what that measurement
finds.

It makes three separate guarantees:

1. **Findings are conserved.** Within the customer's 1–25 reviewed tracked questions,
   every losing result and its classification is preserved and shown. Nothing is
   silently discarded because it failed a cluster-size rule.
2. **Production is capped.** Up to eight eligible create or refresh actions are
   completed per billing cycle. Report-only findings do not consume a production
   slot. The remaining eligible opportunities stay visible and are reconsidered
   while the subscription is active.
3. **Delivery is one batch.** All drafts completed in a cycle are released
   together. There is no drip-feeding or intra-month delivery schedule.

```
1–25 stable buyer questions
      ↓ asked monthly of ChatGPT + Google AI Mode
per-question results and evidence
      ↓ reconcile with prior cycles
owned-content / earned-placement / report-only / founder review
      ↓ crawl an immutable, bounded sitemap inventory
group duplicate questions into create/refresh proposals
      ↓ customer confirms up to 8 genuine actions
freeze links only within the selected batch
      ↓ generate and QA
founder reviews the complete founding-beta batch
      ↓ one release
one complete batch of drafts and patches
```

The sentence **“we close all qualified content gaps” must not appear in product
copy**. The honest promise is:

> We track 40 buyer questions, show every finding, check the existing site first,
> and let the customer confirm up to eight genuine create or refresh actions for
> one complete cycle batch.

If a cycle has five eligible actions, no more than five are produced. Never
invent three more to fill the cap. If it has seventeen, the customer confirms up
to eight from an evidence-ordered list and the rest remain visible for
reconciliation next cycle.

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
losing findings ≤ active tracked questions ≤ 25
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
| `position` | stable order inside the confirmed 40-question set |
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
active set instead of regenerating it or accepting a replacement set from the
browser.

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
| `created_at`, `updated_at`, lifecycle timestamps | action history |

Create `cycle_action_opportunities` as the junction between one selected action
and the one or more tracked-question opportunities it resolves.

`planned_articles` remains a generation and delivery record. It is created only
for a selected create/refresh action and gains a unique `cycle_action_id`. That
column is the single authoritative action/output link; do not also store a
`planned_article_id` on `cycle_actions`, because two directional foreign keys
can disagree. The action resolves its output through the unique relation. A
planned article is not the opportunity backlog and does not represent
report-only work.

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
> One site · up to 25 reviewed buyer questions · ChatGPT + Google AI Mode · up to 8
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
        → paid probe → report → grouped proposal review → production → founder-approved batch
```

No free probe and no redacted sample are built initially. Customers can see the
questions they confirmed before checkout, and founder-led sales can use an
existing demonstration report. Site inventory and target-page matching happen
after measurement, before the customer confirms a production batch; see §5.2.

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
5. Each result with at least one usable answer reconciles its durable
   `content_opportunities` row. A question whose providers all failed is not an
   “absent” observation and keeps its prior opportunity state.

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

1. classify the stored citations as owned-content, earned-placement,
   report-only or founder-review evidence
2. exclude report-only and unresolved findings from production capacity
3. freeze a bounded same-host sitemap inventory with canonical URL, extracted
   title, page kind, content excerpt and content hash
4. require strong title/slug evidence, strengthened by body evidence, before a
   losing question can match an existing page; category overlap alone is not a
   match
5. combine questions by exact target page for refresh work, or by confirmed
   scope plus evidenced product operation/source topic for create work
6. present every grouped proposal and its source questions to the customer
7. let the customer confirm no more than the cycle allowance of eight

Backlog is reconsidered, not blindly FIFO. A carried-over finding may resolve,
become report-only, or fall below newer evidence. Preserve its history and show
why its state changed.

`scoreVisibilityGap` may seed the proposal ordering because it combines verdict,
cross-engine agreement, commercial intent and rivals named. It is hand-weighted,
so never present its integer as a scientific customer score. Show the evidence
reason instead: “absent from 4 of 4 answers; three rivals named.”

### 4.4 Freeze links after selection

The selected actions define the delivery boundary:

1. the customer confirms up to eight grouped actions
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

Everything completed in the cycle remains withheld until a founder reviews the
whole batch during the founding beta. One explicit approval then makes it
visible in FlipAEO together, with export and a recommended publishing order.

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
| **create** | citation evidence permits owned content and no existing page survives the strong sitemap match | 1 | full evidence-bound article |
| **refresh** | citation evidence permits owned content and one existing page survives the strong sitemap match | 1 | full replacement for editorial/blog pages; section patch for product, feature and comparison pages |
| **report-only** | stored citations point to earned placement or third-party reference material | 0 | shown with its measured questions; cannot be selected as content |
| **unknown** | citation type remains unresolved | 0 | founder review; never assume “create” |

### 5.1 Content-solvable classification

A losing question is not automatically solved by an owned article. Answers may
depend on Reddit, review marketplaces, journalist roundups, directories or other
surfaces the customer cannot publish into directly.

`lib/visibility/citation-classifier.ts` separates publishable, earned,
report-only and unresolved evidence. The Phase 0b replay used all 373 citations
from the completed Drawgle run. The old host-list classifier left 302/373 (81%)
uncategorised. It was already computing the exact cited page's URL shape, but
never used that evidence to decide the source type.

The conservative structural classifier now uses the stored URL and citation
title. It recognises explicit best-of/list/comparison/review pages as earned
placements and explicit documentation/help/reference pages as report-only. It
does not infer a category from an unfamiliar hostname and does not fetch or
guess the page's contents. On the same immutable evidence it produced:

- 16 citations (4.3%) that imply owned publishing work
- 160 citations (42.9%) that imply earned-placement work, including 121
  structurally identified recommendation pages
- 41 citations (11.0%) that are report-only documentation/reference evidence
- 156 citations (41.8%) still unresolved and requiring founder review

That residual 41.8% is visible, not relabelled as a confident catch-all. Future
run summaries freeze the exact unresolved URLs in a founder-review queue and
the dashboard says explicitly that they cannot enter production automatically.
Historical completed summaries remain immutable; their old unclassified share
is displayed as founder-review work, but no review queue is fabricated after
the fact.

For the founding beta, ambiguous findings may be founder-reviewed. Unknown or
unreviewed findings remain report-only/unknown and never enter production merely
to keep the batch full. This manual safety valve prevents the classifier from
becoming another months-long pre-revenue project while preserving honesty.

### 5.2 Target URLs come from a reviewable site inventory

Do not ask for a URL beside every question during onboarding. After measurement,
crawl the site's bounded same-host sitemap and freeze the exact URLs, titles and
page excerpts used by planning. Match against that inventory conservatively.

- strong match → propose refresh against the exact canonical URL
- no strong match → propose create, but say only that no supported match was
  found in the bounded inventory
- truncated or failed crawl → expose that limitation and keep the measurement
  safe for a zero-credit planning retry
- delivered create without a confirmed publication URL → require publication
  input; never propose a second create

This is not permission to claim complete site coverage. The inventory records
its bound and truncation status, and the customer confirms the grouped result
before anything enters production.

### 5.3 Refresh scope

The inventory solves target identification; it does not make every page type the
same deliverable. Editorial/blog pages receive a complete replacement draft.
Product, feature and comparison pages receive a section patch so the product is
not accidentally replaced by a blog article. Both remain founder-reviewed in the
founding beta and must never be sent to WordPress as a new post at the target URL.

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

### Phase status

**2026-08-17 production correction — implemented in the repository; deployment
and a fresh paid-run validation remain open.** The completed BringBack run showed
that the old Phase 5/6 bridge could conserve measured questions yet still turn
near-duplicate questions into duplicate articles, classify coverage from manual
per-question input, and auto-select work the customer had never confirmed. That
is not the launch product.

The correction has five boundaries:

1. `VisibilitySummaryV2` derives question and answer outcomes separately from
   stored facts. It exposes directly checkable equations plus two distinct
   competitor views: natural names (prompt-induced mentions excluded) and cited
   tracked domains (prompt-induced citations retained). Exactly four confirmed
   competitors disables discovery.
2. `subscription.renewed` is the only event that can mint a billing-period cycle.
   Dodo's exact start/end timestamps are required; payment events record money
   but create no capacity. `begin_subscription_cycle_measurement` atomically
   claims one current paid cycle and one 40-question run.
3. A completed run freezes an immutable sitemap inventory, binds every question
   to evidenced capability mechanics, conservatively classifies citation remedy,
   and builds grouped `action_proposals`. The legacy visibility cluster/article
   adapter now persists no commercial cluster or article rows.
4. `/content-plan` shows the grouped source questions and target-page evidence.
   The customer confirms up to eight create/refresh proposals. One authenticated
   transaction freezes only those proposals into cycle actions and output
   contracts; extras remain counted backlog. Report-only/founder-review cards
   consume no production slot.
5. Create outputs are full articles. Blog refreshes are full-page replacements;
   product, feature and comparison refreshes are section patches. Completion
   stops at `ready`; only the founder batch-approval surface can release the
   complete batch during beta.

The forward migrations, in required order, are:

1. `20260817_bind_subscription_cycle_measurement.sql`
2. `20260817_grouped_action_proposals.sql`
3. `20260817_confirm_grouped_action_proposals.sql`

They must be deployed with the matching application code. Applying the prompt
binding wrapper before deploying its caller would make the old caller invalid.
The historical BringBack audit stays immutable; validate the correction with a
fresh run after deployment.

Repository verification at this checkpoint: TypeScript is clean and all 120
pivot contracts pass. This proves the local contracts, not the deployed Dodo →
Supabase → Trigger.dev → Cloro → generation journey.

**0a completed 2026-08-16.** The buyer-question generator was exercised through
the real authenticated onboarding flow against FlipAEO at the launch contract
of 40 questions. The final live gate returned 40/40 exact-unique questions, zero
near-duplicate pairs under the production selector, zero calendar-year prompts,
and three named-rival questions (7.5%, below the 15% ceiling). Intent labels were
reviewed question by question after deterministic classification replaced the
model's unreliable batch labels.

Implementation: the exact production instruction now lives in a pure
`prompt-template.ts`; the prompt route no longer manufactures fake mechanics;
competitor suggestions are reduced to validated hostnames before entering the
prompt; the shared live date/time context is supplied to Gemini while durable
questions reject calendar years; per-family regeneration preserves the 40-item
total and excludes retained questions; and advisory scope-role refinement fails
open after 45 seconds instead of trapping the founder on Topics. Contract
coverage was 100/100 at phase close. The live test was stopped on the Questions screen, before
any paid visibility probe.

**0b completed 2026-08-16.** All 373 stored citations from the completed Drawgle
run were replayed through the classifier. Structural URL/title evidence reduced
the unresolved share from 81.0% to 41.8% without growing the curated domain
lists: 4.3% publish, 42.9% earn, 11.0% report-only and 41.8% founder review.
Recommendation pages and third-party documentation are now distinct source
types; unresolved evidence has explicit `review` actionability, is frozen into
the run summary's review queue, and is prohibited from automatic production.
The dashboard and methodology panel expose the four-way split and the exact
review pages. Historical summaries degrade safely without being recomputed.
Contract coverage is now 101/101.

**Phase 1 implementation completed 2026-08-16; deployed-run smoke test open.** The forward-only
`20260816_subscription_tracked_prompts.sql` migration creates durable
`tracked_prompts`, the active-question allowance, coverage/retirement states,
stable ordering, RLS, atomic confirmation, and
`ai_probe_prompts.tracked_prompt_id`. The confirmation screen now requires
exactly 40 questions and commits them only after the brand and confirmed scope
exist. The server recalculates normalization, intent and article type, and
rejects duplicate, near-duplicate, dated and self-naming questions before the
atomic database call.

The probe endpoint no longer accepts `prompts` or `maxPrompts` from the browser.
It loads the brand's 40 active durable rows, rebinds their brand-scope family to
the immutable audit-scope snapshot, passes `trackedPromptId` through Trigger,
and writes it on every new `ai_probe_prompts` observation. Historical prompt
observations remain nullable and unchanged.

The hosted migration was applied successfully. The authenticated Questions
screen then committed the FlipAEO set without starting a probe: the database
contained exactly 40 active rows, 40 unique ids, 40 unique normalized questions
and the complete position range 0–39. No Cloro tasks were queued and no credits
were spent.

Saving questions and spending measurement credits are separate actions.
Phase 8 now sends the confirmed 40-question set to the plan and checkout screen.
Only an account with an active Dodo subscription can open the probe API. Its
empty visibility screen then waits for an explicit **Start visibility
measurement** click, so checkout activation, Continue and page refresh cannot
silently purchase 80 consumer-app requests.

All 106 pivot contracts pass. The new Phase 7 surfaces pass targeted lint, and
Phase 7 introduces no new TypeScript errors; the full check still
reports the same seven pre-existing generated-database-type errors in billing
and the legacy blog trigger. The
remaining release smoke test is one deployed run verifying 40 non-null
`ai_probe_prompts.tracked_prompt_id` links. It is intentionally deferred until
Trigger.dev and the external-provider keys are deployed; do not fabricate a
successful local run or spend credits merely to unblock schema work.

**Phase 2 deployed 2026-08-16.** The forward-only
`20260816_subscription_state_model.sql` migration adds durable opportunities,
billing-period cycles, selected create/refresh actions and their many-to-one
opportunity junction. It enforces one opportunity per tracked question, one
cycle per program period, one action per opportunity per cycle, a frozen maximum
of eight actions, same-target refresh grouping, cross-table ownership and RLS.
Generated outputs gain the single authoritative unique `cycle_action_id` link.
The hosted migration was applied successfully before Phase 3 began.

**Phase 3 deployed 2026-08-16.** The forward-only
`20260816_recurring_commercial_state.sql` migration retires the finite
commercial state without deleting its history. Purchase intents, cluster
schedules and article-credit consumptions become read-only `legacy_*` tables;
fixed-audit, tier, velocity and completion fields become explicitly historical.
One live `founding_beta` program owns a website, a paid period idempotently
creates one `subscription_cycle`, selected actions are claimed with a
three-attempt lease, costs and frozen links carry cycle/action ownership, and
all selected outputs become visible in one atomic batch. The webhook no longer
provisions from a purchase intent or automatically cancels completed work.
Checkout returns 503 until the Phase 8 sandbox gate. The hosted migration was
applied successfully before Phase 4 began.

**Phase 4 deployed 2026-08-16.** The forward-only
`20260816_opportunity_reconciliation.sql` migration adds the service-role-only,
atomic `reconcile_content_opportunities` boundary. It validates that the payload
accounts for every run prompt with a usable answer, matches each stable tracked
question and persisted verdict, serialises updates per brand, and upserts on
`(brand_id, tracked_prompt_id)`. Replaying a run therefore updates the same row
without replacing `first_seen_run_id`; partial provider failure cannot become a
fabricated absence.

The observation policy is frozen at 21 days in code and SQL. A fresh `present`
verdict is the only event that resolves visibility. A still-losing delivered
action remains `monitoring` inside the window. After the window, a prior refresh
may reopen as refresh against its explicit URL; a delivered create draft becomes
`needs_input` until publication and target URL are confirmed, so delivery can
never silently create a second page. Inactive questions and explicit dismissals
retain their evidence but stay production-ineligible. The hosted migration was
applied successfully before Phase 5 began.

**Phase 5 deployed 2026-08-16.** The forward-only
`20260816_target_page_triage.sql` migration backfills missing opportunities from
the latest completed durable-question observations without calling any answer
provider or overwriting rows already reconciled by the live worker. Its
authenticated atomic RPC saves both the tracked question's explicit coverage
decision and the matching losing opportunity. `has_page` requires an HTTPS URL
on the measured website and becomes refresh; `no_page` becomes create only when
no create draft was already delivered; `unknown` remains production-ineligible.

The owner dashboard asks the target-page question inside each losing evidence
row, ordered by internal evidence priority without displaying the hand-weighted
integer as a customer score. The public share report receives no mutable target
state. A target confirmed after a delivered create survives future
reconciliation as refresh, preventing another create for the same durable
question. The hosted migration was applied successfully before Phase 6 began.

The per-question dashboard control described above was removed by the
2026-08-17 correction. Its stored state remains historical; the site-inventory
proposal review is now the only customer confirmation surface.

**Phase 6 deployed 2026-08-16.** The forward-only
`20260816_cycle_action_selection.sql` migration adds one service-role-only,
atomic selection boundary. It considers only open create/refresh opportunities
from the cycle's latest completed measurement, requires matching explicit
target-page triage, excludes already delivered creates and unfinished prior
actions, and ranks the remaining compatible action groups deterministically.
Create work sharing one frozen audit blueprint becomes one action; refresh work
groups only by the exact confirmed target URL. At most the cycle allowance of
eight is selected, while eligible and leftover backlog counts are frozen on the
cycle rather than discarded.

Selection creates a separate `cycle_output` article contract for every selected
action; it never mutates the immutable audit plan. The visibility adapter now
promotes every otherwise-unsold losing prompt to a standalone audit-plan article,
so the legacy editorial cluster floor cannot delete subscription work. The
legacy Google-audit cluster rules remain unchanged. Links are frozen only among
selected outputs in the same scope family, with zero links explicitly valid for
a singleton batch. A clean same-host HTTPS publication pattern is frozen for
create URLs, and replay returns the already selected batch instead of selecting
again. The hosted migration was applied successfully before Phase 7 began.

This automatic selector and the visibility cluster adapter are superseded by
the 2026-08-17 grouped-proposal confirmation transaction. That migration drops
the old selector and per-question target-triage functions after replacing their
production responsibility; neither has an active application caller.

**Phase 7 deployed 2026-08-16.** The forward-only
`20260816_phase7_batch_delivery.sql` migration makes action claiming explicitly
create-only, adds an audited founder-assisted refresh completion boundary, and
releases the cycle through the existing atomic batch transaction only after
every selected action is ready. The existing evidence-bound writer and QA path
continues to produce create drafts. A selected refresh remains waiting until a
founder reviews the confirmed existing page and attaches a complete replacement
draft; required selected-graph links are validated before it becomes ready.
Refresh outputs are blocked from WordPress post creation so the system cannot
silently create a second page at the target slug.

The last ready writer or refresh completion now stops the cycle at `ready`.
Generated articles remain hidden by RLS until the founder approves the complete
batch. After that serialized release,
the customer can review and safely edit each draft, download the complete cycle
as one ZIP containing Markdown, HTML and a manifest, optionally create WordPress
drafts for create actions, or confirm that a refresh was applied to its existing
URL. There is no live generation or delivery smoke result yet because the paid
AI probe has intentionally not run and the deployment-only provider keys are not
available locally. Phase 7 verification is contract/static only and spent no
provider credits. The migration was applied successfully before Phase 8 began.

**Phase 8 code-complete 2026-08-16; migration and sandbox gates open.** The
one-plan checkout is implemented behind `FOUNDING_CHECKOUT_ENABLED`. The server,
not the browser, owns the Dodo product, discount, plan id, brand, customer and
return URLs. It refuses checkout unless the account has exactly one live brand,
exactly 40 active tracked prompts, no active/pending subscription and a clean
same-host HTTPS publication pattern containing `{slug}` once. Onboarding now
stops at the plan instead of exposing the pre-payment probe. The probe API also
enforces an active subscription, so an old tab cannot bypass the paywall.
Immediately before creating a hosted checkout, the server reads the configured
Dodo objects back and fails closed unless they are a no-trial $189 USD product
charging every one month, with a total subscription term long enough to reach
the continuing phase, plus a product-restricted $90 USD flat discount limited
to three subscription cycles. Dodo's `subscription_period_*` fields describe
the maximum total term, not the monthly charge cadence.

`20260816_phase8_checkout_contract.sql` creates the stable
`founding_beta` pricing row at the $189 recurring price, deactivates rather than
deletes the three historical velocity rows, stores the publication pattern on
the recurring program and carries it through signed Dodo metadata into webhook
provisioning. The $99 periods 1–3 price is a Dodo-managed $90 flat discount with
a three-subscription-cycle limit; the app never counts webhook deliveries to
decide when to reprice.

The required sandbox configuration is:

1. Create one monthly Dodo test product at **$189 USD**.
2. Create one **$90 USD flat discount**, restrict it to that product, and set
   **Subscription Cycle Limit = 3**.
3. Deploy `DODO_FOUNDING_PRODUCT_ID` and `DODO_FOUNDING_DISCOUNT_CODE` with those
   test values while `DODO_ENVIRONMENT=test_mode`.
4. Apply `20260816_phase8_checkout_contract.sql`, deploy the code, then set
   `FOUNDING_CHECKOUT_ENABLED=true` only for the sandbox journey.
5. For the first credit-bounded pipeline test only, deploy
   `CLORO_SANDBOX_ENGINE=google-aimode`. The server will still measure the full
   reviewed set of up to 25 durable questions, but on one 4-credit surface (100
   credits at the cap) instead of the 11-credit production pair (275 credits at
   the cap). Browser requests cannot
   choose their own engines. This one-engine result proves orchestration only;
   it is not a customer baseline. Remove the variable before live billing.
6. Complete checkout → activation → paid probe → sitemap inventory → grouped
   customer confirmation → generation/founder refresh → founder-approved atomic
   batch release. Keep production payments
   closed until the whole journey passes.

Live verification on 2026-08-16 confirmed that customer evidence now redirects
anonymous visitors to login, privileged RPCs no longer accept caller-supplied
user ids, anonymous function execution is closed, and the intended owner/service
RLS boundaries are present. Supabase Auth leaked-password protection is deferred
because it requires a paid Supabase plan; it is hardening, not a launch gate.

The test Dodo product is a valid $189 USD recurring product charged monthly, and
the FlipAEO webhook is enabled with the required subscription/payment events and
the deployed secret. Live verification confirmed that the $90 discount is
restricted to the founding product and the early `FOUNDINGBETA` database plan
code has been repaired to canonical `founding_beta`. An older Drawgle test
webhook is also enabled in the same Dodo business; preserve it unless that
separate product no longer needs it.

Dodo requires `feature_flags.allow_discount_code=true` whenever a checkout
session supplies pre-applied `discount_codes`. The founding checkout enables
that flag while continuing to validate and pre-apply only the product-restricted
`FOUNDINGBETA` code owned by the server.

The first deployed sandbox pass also exposed a Phase 3 schema-drift bug before
checkout: `confirm_brand_scope` and its atomic onboarding wrapper still queried
the removed finite-program `programs.audit_id` column. The forward-only
`20260817_fix_onboarding_program_audit_reference.sql` migration removes both
obsolete exceptions. Completed audits remain immutable and are marked stale when
scope, website or rivals change; recurring programs remain brand-owned and their
cycles keep their frozen measurement identities.

The live Supabase schema is now the source of the checked-in TypeScript database
types. This removed the stale billing/writer type errors: `tsc --noEmit` is clean,
and all 112 pivot contracts pass.

The same phase audited live Supabase state before proposing cleanup. The three
`legacy_*` commercial tables, `programs` legacy columns and the old cost-event
FK were empty and had no runtime callers. Two maintenance functions still
named them, so `20260816_legacy_pivot_cleanup.sql` rewrites those functions
first and aborts if any legacy row appears before dropping the objects.
`internal_links` is **not legacy**: the manual/non-cycle writer and sitemap
duplication checks still call its RPCs. Its empty IVFFlat index had nevertheless
grown to 183 MB, so the cleanup reindexes it instead of deleting live
capability. `answer_coverage`, billing history and inactive Dodo plan rows are
also preserved. The protected finite-audit sales page was removed from dashboard
navigation and now redirects to AI Visibility; public founder/demo audit links
remain readable.

| # | Step | Why here |
|---|---|---|
| 0a ✅ | Verify the actual buyer-question contract in the live funnel; remove fake mechanics input and harden topic/rival prerequisites | Completed 2026-08-16. `ROADMAP.md` §7c records why mechanics were a stale dependency and what the live run found |
| 0b ✅ | Inspect the uncategorised citation shapes and define a conservative classifier plus founder-review fallback | Completed 2026-08-16 against 373 stored citations; unresolved evidence is visible and production-ineligible |
| 1 ✅ | Add `tracked_prompts`; make onboarding write them and the probe observe them through `tracked_prompt_id` | Migration applied and authenticated 40-row persistence gate passed 2026-08-16; deployed observation-link smoke test remains a release gate |
| 2 ✅ | Add `content_opportunities`, `subscription_cycles`, `cycle_actions` and their junction; link generated outputs to actions | Migration applied successfully 2026-08-16 |
| 3 ✅ | Remove finite-program purchase intent, cluster scheduling, auto-cancel and fixed-audit ownership; re-home cost/link/claim/delivery foreign keys; rewrite billing grants to authorise one cycle | Migration applied successfully 2026-08-16 |
| 4 ✅ | Implement per-cycle reconciliation and contract tests | Migration applied successfully 2026-08-16 |
| 5 ↺ | Retain explicit coverage history but replace per-question triage with immutable sitemap inventory and grouped review | Replacement code/migration ready 2026-08-17; deployment open |
| 6 ↺ | Replace automatic ranking/cluster selection with customer-confirmed grouped proposals, capped at eight | Replacement code/migration ready 2026-08-17; deployment open |
| 7 ↺ | Generate/QA full articles, full-page replacements or section patches, then stop at a founder release gate | Replacement code/migration ready 2026-08-17; fresh-run validation open |
| 8 ◐ | Keep the one-plan checkout and introductory price phases; validate checkout through the corrected payment-to-batch path | Checkout configuration complete; deploy the three 2026-08-17 migrations with code and pass a fresh sandbox journey before enabling revenue |
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

1. A brand must have 1–25 active tracked questions on the launch plan; the set is
   never padded to its ceiling.
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
