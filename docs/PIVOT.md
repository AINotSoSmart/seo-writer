# FlipAEO Closed-Pool Pivot

> This is the authoritative implementation handoff. Read it before changing the
> audit, purchase, delivery, billing, publication, or prospect-audit paths.
> Update this document whenever the product contract or release status changes.

Branch: `pivot/closed-pool-harvest`

Start here if you are the founder: [`HOW_IT_WORKS.md`](HOW_IT_WORKS.md) for a
plain-language explanation, then [`SOLO_LAUNCH_GATE.md`](SOLO_LAUNCH_GATE.md)
for what to do next.

Last implementation update: 2026-07-30

Status: **application contract implemented and locally validated; checkout remains
disabled pending the staging/external release gate**

## 1. Locked product contract

FlipAEO now has one finite contract:

> **Immutable evidence audit -> six qualified priority clusters -> frozen URLs
> and internal-link graph -> cluster-level generation and delivery -> optional
> publication -> automatic cancellation at the end of the paid scope.**

Locked decisions:

- Every audit is a new immutable run.
- A program contains the six highest-priority unsold qualified clusters.
- A qualified cluster has 3-15 unique articles.
- The selected six clusters must contain at least 25 articles in total.
- Small niches are rejected. There is no one-off fallback product.
- The customer confirms an absolute, HTTPS, same-host URL pattern containing
  exactly one `{slug}` before checkout.
- Every selected article receives a deterministic slug and absolute target URL.
- The complete pillar/leaf/sibling link graph is frozen before payment.
- Clusters are delivered atomically; partially generated clusters stay withheld.
- Delivery is distinct from optional WordPress/manual publication.
- The subscription requests cancellation at the end of the current billing
  period after all six clusters are delivered.
- Prospect claims are bound to one normalized email address.
- Public checkout remains fail-closed until the external release gate passes.

The three velocity tiers are defined once in `config/product-truth.ts`:

| Tier | Price | Delivery cadence |
|---|---:|---|
| Close | $249 | One cluster per 30-day period |
| Accelerate | $449 | Two clusters per 30-day period, 15 days apart |
| Dominate | $599 | Three clusters per 30-day period, spaced ~10 days apart |

These are delivery speeds for the same finite six-cluster scope. They are not
article quotas and do not promise rankings, traffic, citations, or domination.

### 1.1 Locked buyer

The primary customer is a **founder-led B2B SaaS company with an existing
product and website, a lean growth team, and no dedicated content strategy
function**.

- In the smallest companies, the buyer is the founder or CEO.
- In a slightly larger lean team, the buyer may be the Head of Growth or
  content lead, but the public page speaks to the founder-led company rather
  than changing personas mid-page.
- Agencies are not the primary customer. The product does not provide
  multi-client workspaces, white-label reporting, or agency approvals.
- Enterprise content teams are not the primary customer. The product does not
  provide procurement, complex roles, or multi-stage editorial governance.
- Pre-launch projects and generic bloggers are poor fits: they often cannot
  qualify for six evidence-backed clusters and are disproportionately seeking
  free or individual articles.

This choice matches the actual contract: one website, one source-linked audit,
one fixed six-cluster scope, and a $249+ delivery decision. Public positioning
must say “founder-led B2B SaaS”; it must not alternate between founders,
agencies, marketers, and bloggers.

The old “two free articles/credits” offer is retired. The free product is the
evidence audit. Paid article generation begins only after an eligible audit and
purchase intent. `subscription_period_grants` is the authoritative paid
allowance; any `credits` balance is an internal compatibility mirror, never a
customer-facing wallet. A completed free audit is reused for 30 days, matching
the checkout-validity window; the public endpoint cannot create unlimited
same-site reruns during that period.

## 2. Implementation status

### 2.0 Why the v2 SQL migration is long

`supabase/migrations/20260730_closed_pool_v2.sql` is about 1,700 lines because
the old product already has live users, audits, generated articles, payments,
and program records. This is not a blank-schema migration and it is not 1,700
lines of unrelated feature tables. It has to change the data model without
deleting history, then make the new contract impossible to violate through a
race, webhook replay, browser request, or re-audit.

The migration deliberately keeps the transition in one ordered unit so the
schema changes, legacy backfill, constraints, guards, RLS, and transactional RPCs
land together. Splitting those steps across partially deployed states could
leave programs pointing at mutable/latest data or make old articles disappear.

Guided migration map:

| Approx. lines | What it does | Why it belongs in the database |
|---|---|---|
| 19-173 | Turns `topical_audits` into run records, backfills legacy audits, and adds `brand_details.current_audit_id` | An audit must remain an historical snapshot while a later audit runs. A brand pointer is switched only after success. |
| 174-380 | Adds mandatory `audit_id` ownership, restrictive foreign keys, scoped uniqueness, and immutable-row triggers | Application-only checks can be bypassed or race. The database must reject edits/deletes of completed evidence. |
| 381-489 | Splits article generation/delivery/publication fields and tightens RLS | A generated article is not delivered or published. Browser clients must not advance paid lifecycle state. |
| 490-685 | Adds frozen purchase intents, finite program fields, brand-subject guards, normalized `program_clusters`, and legacy backfill | Checkout must buy a known audit/scope/graph, not whatever happens to be latest when a webhook arrives. Arrays cannot safely hold per-cluster state and timestamps. |
| 686-750 | Stores the frozen link graph, period grants, idempotent consumptions, and provider cost events | Graph edges, billing entitlement, retries, and real margin all need durable, queryable ledgers. |
| 751-948 | Adds hashed email-bound audit claims, atomic prospect creation/transfer, and read-only RLS for new tables | A public report token must not grant ownership, and a claim must never overwrite another customer website. |
| 949-1132 | `finalize_audit_run` validates and commits the complete evidence snapshot in one transaction | Hundreds of separate inserts followed by a pointer update can expose partial audits. One RPC rolls everything back on any invariant failure. |
| 1133-1288 | `provision_program_from_intent` creates the exact program, six cluster rows, frozen URLs, and graph | Duplicate/out-of-order Dodo events must still create exactly one program from exactly one frozen purchase. |
| 1289-1403 | Period grant and per-article consumption RPCs | Concurrent retries must not double-spend entitlement or grant the same billing period twice. |
| 1404-1487 | Pause/resume RPCs with exact schedule shifting and legacy graph guard | Pausing must stop delivery without silently changing billing or compressing future cadence. |
| 1488-end | Atomic cluster delivery and HTML graph validation | Successful siblings must remain hidden until every member exists and every frozen target is an actual anchor. Cluster six also closes scope atomically. |

Why the logic is not only in TypeScript:

- **Transactions:** audit finalization, claim transfer, provisioning, allowance
  consumption, schedule shifting, and cluster release change multiple tables.
  Supabase HTTP calls cannot make a multi-call sequence atomic.
- **Concurrency:** Dodo webhooks, Trigger.dev workers, retries, and users can act
  at the same time. Unique indexes and row locks are the final authority.
- **Security:** RLS and triggers stop a browser/API client from marking an
  article delivered/published or rewriting purchased evidence.
- **History preservation:** restrictive foreign keys and immutable guards protect
  previously generated, delivered, and published work during re-audits.
- **Legacy conversion:** the backfill translates existing rows into the new
  model instead of asking the founder to delete the database or abandon users.

### 2.0.1 Why and how each new subsystem exists

| Subsystem | Why it was needed | How it works |
|---|---|---|
| Immutable audit runs | The old brand pool could be deleted/replaced by a re-audit, cascading into plans and purchased work. | Every run gets a new ID; completed evidence is guarded; `current_audit_id` switches only inside atomic finalization; programs retain their purchased audit ID. |
| Shared harvest assembly | `/verify` and production previously could disagree, making the provenance test unable to predict real data. | Both call `assembleHarvest`; one policy controls filtering/caps/invariants/hash; only production calls the persistence RPC. |
| Bounded source policy | Tavily/sitemap work could vary too widely and create unknown cost/time. | Competitor, query, page, sitemap, and cluster caps are centralized; all discovery is bounded and recorded in an internal source ledger. |
| Purchase intent | A delayed webhook could otherwise provision the newest audit or changed URL settings instead of what the customer saw. | The intent freezes user, brand, audit, tier, six clusters, pattern, slugs, graph, and expiry before checkout; webhook consumes it once. |
| Frozen link graph | "Fully interlinked" was previously copy, not a verified product property. | Deterministic pillar/leaf/sibling edges and target URLs are stored before purchase, injected into generation, then validated again before delivery. |
| Cluster withholding | Shipping articles one at a time exposes broken internal links and incomplete topical units. | All cluster members generate behind `withheld`; only the atomic delivery RPC makes the complete validated batch visible. |
| Billing-period ledger | Generic subscription events and retries could reset credits or grant work twice. | Each subscription/period has one grant and each planned article one consumption; unique keys and locks make replay harmless. |
| Finite cancellation state | A delivered six-cluster scope must not renew into unpromised work, and a failed cancellation API call must not be hidden. | Cluster six marks scope delivered; a worker requests end-period cancellation; local state distinguishes pending, confirmed scheduled, ended, and error/retry. |
| Separate article states | `completed` had been used as generated, delivered, and published at different points. | Three independent state machines and timestamps track generation, customer delivery, and optional publication. |
| WordPress permalink guard | WordPress can rewrite a slug, breaking every frozen incoming link. | Draft/publish responses are compared to `target_url`; mismatch stops publication and returns the post to draft. |
| Founder prospect claims | Outreach audits must scale without occupying/overwriting the founder's own brand or being claimable by anyone with a public link. | Prospect audits store their own site snapshot; public and hashed claim tokens are separate; an exact-email atomic transfer attaches only to a matching/new brand. |
| Small-niche rejection | Selling six clusters where six qualified clusters do not exist would recreate quota-filling and duplicate content. | The same eligibility function gates UI and purchase intent creation; ineligible reports show evidence but no offers or checkout. |
| Product-truth config | Prices, quotas, promises, and integrations had drifted across pages/schema/dashboard. | `config/product-truth.ts` is the source for tier/scope wording; contract tests scan active surfaces for forbidden legacy claims. |
| Retired runtime routes/jobs | Hidden navigation alone leaves old mutation endpoints and schedulers able to create conflicting work. | Unsupported APIs return 410, old workers/modules are removed, and only `program-lifecycle` is deployed as the replacement schedule. |
| Consent gating | GA, Clarity, and support tools should not start before the visitor chooses optional categories. | `CookieConsent` records categories and loads analytics/support scripts only after consent. |
| Focused onboarding shell | The dashboard sidebar, delivery controls, account menu, and support widget compete with the only decision a new user should make: completing setup. | `/onboarding` lives in its own authenticated route-group layout with lightweight floating brand/back/logout controls rather than a second header shell; dashboard navigation is absent and the optional chat/settings launchers are hidden during the flow. |
| Provider cost events | Revenue can look healthy while article COGS is unknown or retries are double-counted. | Each Gemini/Tavily/FAL call records provider/model/units/request cost and whether usage measurement was complete; unknown cost remains null, never fake zero. |
| Checkout feature flag | Local tests cannot prove Dodo, WordPress, Trigger.dev, or production database behavior. | Checkout defaults off and can be enabled only after the documented staging/manual evidence gate passes. |

### 2.1 Immutable audit lifecycle - implemented

`supabase/migrations/20260730_closed_pool_v2.sql` converts the mutable
brand-scoped pool into immutable audit snapshots:

- `topical_audits` is a run record with subject/input/brand snapshots, policy
  version, kind, owner/creator, result hash, source ledger, failure details, and
  `requires_reaudit`.
- `brand_details.current_audit_id` changes only after successful atomic
  finalization.
- `query_pool`, `audit_clusters`, `planned_articles`, and `programs` require an
  `audit_id`.
- Query uniqueness is `(audit_id, query_norm)`.
- Completed audit evidence is protected by database triggers.
- Existing records are backfilled into synthetic `legacy-import` runs.
- Programs and program clusters use restrictive foreign keys, so a re-audit
  cannot cascade into purchased/generated/delivered/published history.
- `finalize_audit_run` validates and commits all evidence, clusters, articles,
  statistics, completion state, and the current pointer atomically.
- A website host cannot change or be archived while its program is active or
  paused. Changing a completed website subject clears its current audit.
- A `current_audit_id` must point to a completed audit owned by that exact brand
  and user.
- Customer RLS is read-only for closed-pool evidence/program state. Program
  article mutation remains server-controlled.

### 2.2 Shared bounded harvest - implemented

`lib/harvest/assembly.ts` is the authoritative no-write pipeline used by both
production and `/api/harvest/verify`.

Production adds only progress reporting and the immutable finalization RPC.
`/verify` remains development-only and writes nothing.

Current centralized policy (`lib/harvest/policy.ts`, version
`closed-pool-v2.2.0`):

- Maximum 4 competitors.
- Maximum 400 post-demand-filter queries.
- Maximum 120 fetched competitor-corpus pages in total.
- Maximum 250 coverage pages per site.
- Maximum 15 articles per cluster.
- Maximum 20 sitemap files and 5,000 sitemap URLs per site.
- Collapse target 25-40% when at least 60 gaps exist.
- No recursive or open-ended Tavily discovery.

The pipeline hard-fails on configured source failure, all-demand-check failure,
missing provenance, empty/niche-empty pools, unreadable subject/competitor
coverage, embedding failure, cluster oversize, or invalid collapse. It emits an
internal attempted/succeeded/failed/cached source-call ledger and a stable result
hash. Customer copy does not expose source-call counts, query-pool language,
collapse ratio, credits, or COGS.

### 2.3 Frozen link graph and atomic cluster delivery - implemented

Key files:

- `lib/harvest/link-graph.ts`
- `lib/harvest/purchase-intent.ts`
- `lib/harvest/program-provisioning.ts`
- `trigger/ship-cluster.ts`
- `trigger/generate-blog.ts`

The purchase intent freezes the user, brand, audit, tier, exact six clusters,
URL pattern, deterministic slugs, absolute URLs, and graph snapshot. Dodo
provisions from that intent, never from the latest audit.

Graph rules are enforced:

- One pillar and 2-14 leaves per cluster.
- Pillar -> every leaf.
- Every leaf -> pillar.
- Every leaf -> two most similar siblings where available.
- No self-links, duplicate directed edges, unresolved targets, or external-host
  targets.
- Frozen anchors are 2-8 words and unique per source where practical.
- Up to two frozen existing-site links may supplement the cluster graph.
- The writer deterministically appends any missing exact anchor/destination.
- SQL delivery validation confirms the frozen URLs exist as actual HTML anchors.

The hourly `program-lifecycle` worker is the only new recurring delivery worker.
It claims article state before spawning generation, uses idempotent child task
keys, retries only failed members, withholds successful siblings, validates the
complete graph, and atomically releases the cluster. A terminal writer failure
marks the article failed and cluster blocked.

### 2.4 Finite billing lifecycle - implemented

Billing is bound one-to-one across purchase intent, subscription, and program:

- One Dodo subscription can provision at most one finite program.
- Period grants are unique on `(subscription_id, period_start)`.
- Article entitlement consumption is atomic and idempotent per planned article.
- Duplicate and out-of-order payment/activation webhooks are harmless.
- Payment-before-activation is recovered from the frozen purchase intent.
- `subscription.updated` synchronizes status/dates only; it does not grant,
  reschedule, reactivate, or create work.
- Plan changes apply as next-period metadata without moving frozen schedules.
- Pause operates on `programs`; billing continues and delivery stops.
- Resume shifts all unstarted dates by the exact pause duration.
- Delivering cluster six atomically sets `scope_status=scope_delivered`.
- Cancellation requests use
  `cancel_at_next_billing_date=true`, retry on failure, and alert the founder.
- The UI never says cancellation is scheduled until Dodo/webhook state confirms
  it.
- Renewal/update events cannot reopen a delivered scope.
- A second six-cluster program requires a fresh checkout.

### 2.5 Generation, delivery, and publication states - implemented

`planned_articles` independently tracks:

- Generation: `planned`, `queued`, `generating`, `generated`, `failed`.
- Delivery: `withheld`, `delivered`.
- Publication: `unpublished`, `draft`, `published`.

`articles.status=completed` means generation completed, never publication.
WordPress draft creation records `draft`; publish records `published` only after
the returned permalink matches the frozen URL. A missing or changed permalink
fails closed and returns the post to draft. Manual publication requires a final
public URL and confirmation.

Program completion depends on delivered clusters, not customer publication.
Approved completion wording is:

- "Program scope delivered."
- "All six clusters in this program have been delivered."
- "Additional qualified clusters remain available for a future program."

### 2.6 Founder prospect path - implemented

`/founder/prospect-audits` is protected by `FOUNDER_USER_IDS`.

- Prospect runs use the shared harvest and do not consume/overwrite the
  founder's customer brand slot.
- Runs are queued with progress, source ledger, bounded retry, and terminal
  failure handling.
- Public and claim tokens are separate, unguessable, revocable, and `noindex`.
- Claim tokens are hashed, one-time, email-bound, and expire after 30 days.
- Login/password/OAuth preserve `next=/claim/{token}`.
- Claiming requires the exact normalized email.
- It creates a brand only when the claimant has none; an existing brand is used
  only when its canonical host matches.
- Ownership of all audit-scoped rows transfers atomically while founder
  attribution remains.
- Checkout eligibility expires 30 days after audit completion; stale reports
  remain viewable but require a new immutable audit before purchase.

### 2.7 Eligibility and public truth - implemented

Both UI and server reject checkout unless the audit has:

- Six qualified unsold clusters.
- 3-15 articles in every selected cluster.
- At least 25 articles across the six.
- Complete provenance.
- A valid frozen graph.
- A current, non-legacy, non-stale audit.

Ineligible audit pages show measured evidence but no prices, tiers, checkout
buttons, or subscription Offer schema. They do not advertise a one-off.

Public/product cleanup completed:

- Product truth is centralized in `config/product-truth.ts`.
- Landing, pricing, features, metadata, schema, Open Graph, generated
  `llms.txt`, privacy, terms, refund, and billing copy use the finite contract.
- Analytics/support scripts require cookie consent.
- The seven feature pages now represent audit evidence, competitor gaps,
  complete cluster delivery, frozen graph, WordPress/manual delivery, and
  burn-down.
- Relevant legacy feature slugs redirect; unsupported writer claims return 410.
- `/compare` and `/compare/*` return 410 and are absent from sitemap/internal
  navigation. Other retired public tool/solution paths are also blocked in
  `proxy.ts`.
- Dashboard reads normalized audits/programs and separates generated, delivered,
  and published progress.
- Onboarding is outside the dashboard sidebar layout and uses a minimal,
  authenticated, distraction-free shell while preserving the existing flow.
- Active integrations are WordPress and manual delivery only.
- Action Board, SEO Health, GSC, Shopify, Webflow, credit APIs, ad-hoc
  generation, pillar generation, and link-sync runtime paths are removed or
  explicit 410 responses.
- Dead credit/GSC/Shopify/Webflow modules and legacy content-plan views were
  removed; do not re-import or rebuild them.

## 3. Database and deployment order

Do not enable checkout while applying this work.

**Apply migrations by pasting them into the Supabase SQL editor, one file at a
time. Do not run `supabase db push`.** `supabase_migrations.schema_migrations`
on the live project has nothing recorded after `20260404014829`, so every pivot
migration is untracked: `db push` would treat all of them as pending and replay
the whole set against a database that already has them. Every migration is now
re-runnable (enforced by `npm run test:pivot-contract`), so a replay should be
survivable — but it is not a thing to find out during an incident. Repairing the
migration history with `supabase migration repair` is a separate task, listed in
§5.

1. Back up the staging database.
2. Apply `supabase/migrations/20260729_velocity_pricing.sql`.
3. Apply `supabase/migrations/20260730_closed_pool_v2.sql`.
4. Apply `supabase/migrations/20260730_reconcile_harvest_columns.sql`.
   Required on any database created before 2026-07-30 — see the changelog entry
   below. It is idempotent, so applying it to a fresh database is a no-op.
5. Deploy application and Trigger.dev source with
   `CLOSED_POOL_CHECKOUT_ENABLED=false`.
6. Confirm `program-lifecycle` is healthy.
7. Only then archive these Trigger.dev schedules:
   - `daily-content-watchman`
   - `seo-health-auto-refresh`
   - `sitemap-sync-scheduler`
   - `gsc-daily-auto-refresh`
   - `ship-cluster`
8. Run and record every gate in `docs/CLOSED_POOL_RELEASE_GATE.md`.
9. Enable checkout only on the exact commit that passed all gates.

Required server environment:

```text
CLOSED_POOL_CHECKOUT_ENABLED=false
FOUNDER_USER_IDS=<comma-separated Supabase user UUIDs>
FOUNDER_ALERT_EMAIL=<founder operations email>
PROGRAM_COST_RATES_JSON=<real provider rates; no placeholder zeroes>
```

## 4. Current verification record

Local verification completed on 2026-07-30:

- `npm run test:pivot-contract`: **20/20 test groups passed**.
- `tsc --noEmit --pretty false`: **passed**.
- `npm run build`: **passed** before the instruction to skip further builds.
- Public checkout remains disabled by default in code.

The contract suite is `tests/pivot-contract.test.mjs`. It covers:

- URL-pattern and deterministic graph invariants.
- Six-cluster selection and stale-audit rejection.
- Prospect retry semantics.
- Shared verify/production assembly and bounded policy.
- Immutable SQL, RLS, billing, claim, state, and brand-subject guards.
- Webhook/scheduler finite-scope behavior.
- Retired routes/jobs and stale active copy.
- Consent/checkout fail-closed defaults.
- WordPress permalink protection.
- Provider usage/cost recording.
- Migration reconciliation (no base column without a matching `ALTER`).
- Migration replay safety (no statement that aborts on a second run).

No further build should be run merely for documentation or small copy changes.
Follow `AGENTS.md`: lint/typecheck/build only after a meaningful code batch or at
the final release boundary.

## 5. External release gate - not yet completed

Local code cannot certify external behavior. The following remain deliberately
open and must be performed against staging/Dodo sandbox/WordPress:

- Apply and verify the new migrations on a staging copy.
- Open 20 sampled provenance URLs and confirm every observed query.
- Run verify/production parity with identical mocked or cached source responses.
- Exercise one eligible audit and one intentionally small niche.
- Complete Dodo sandbox checkout and replay duplicate/out-of-order webhooks.
- Re-audit during an active program and confirm the program remains pinned.
- Force one article failure and verify cluster withholding/retry/atomic delivery.
- Exercise WordPress draft, publish, and permalink mismatch behavior.
- Exercise pause/resume date shifting.
- Deliver all six clusters and verify Dodo end-of-period cancellation, including
  an initial cancellation API failure and retry.
- Exercise the complete founder public-report/login/email-bound-claim flow.
- Crawl public routes and confirm redirects/410s/canonicals/schema/sitemap.
- Set real `PROGRAM_COST_RATES_JSON`, complete a cluster, and verify every
  `program_cost_events` row has complete usage and a non-null cost.
- Archive the retired Trigger.dev schedules only after the replacement is live.
- Repair `supabase_migrations.schema_migrations`, which records nothing after
  `20260404014829`. Every pivot migration was applied by hand, so the CLI
  believes none of them exist. Until `supabase migration repair` backfills them,
  `supabase db push` must not be run against this project.

See `docs/CLOSED_POOL_RELEASE_GATE.md` for the numbered 24-step evidence record.
Until it passes, `CLOSED_POOL_CHECKOUT_ENABLED` must remain `false`.

## 6. Rules for the next agent

1. Do not replace immutable audit runs with a mutable brand pool.
2. Do not provision from "latest audit"; provision only from a frozen purchase
   intent.
3. Do not expose a cluster until every member is generated and its graph passes.
4. Do not equate generated, delivered, and published.
5. Do not reset allowance or reschedule work from generic subscription updates.
6. Do not reopen a `scope_delivered` program.
7. Do not claim cancellation is scheduled before Dodo confirms it.
8. Do not advertise or create a one-off fallback for small niches.
9. Do not expose query-pool/collapse/Tavily/credit/COGS/founder language to
   customers.
10. Do not resurrect Action Board, SEO Health, GSC, Shopify, Webflow, credit
    quotas, daily article shipping, quota refills, or the legacy planner.
11. A provenance gap, unresolved graph edge, permalink mismatch, billing replay
    failure, or unknown provider cost is a release blocker.
12. Keep checkout disabled until the manual external gate passes.
13. **Never edit a migration that has already been applied.** Every table in
    `20260728_harvest_pool.sql` uses `CREATE TABLE IF NOT EXISTS`, so an edit to
    it is a silent no-op against any database that already has those tables —
    the change lands in the repo, passes review, and never reaches Postgres. Add
    a new migration with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` instead, and
    extend `20260730_reconcile_harvest_columns.sql` so the contract test passes.

## 7. Changelog

### 2026-07-30 - persistent inspect-before-pay audit

The first successful production-shaped audit exposed a product-contract hole:
the completed result appeared briefly inside onboarding, then
`canAccessOnboarding()` noticed `brand_details.current_audit_id` and redirected
the customer to `/content-plan`. That page rendered only the aggregate
“articles across six clusters” count. The immutable evidence existed in the
database, but the customer could not inspect the proposed articles or trace
them back to their observed sources before paying.

Fixed:

- Onboarding access now allows the active `audit` and `audit-results` steps to
  finish after finalization. Later attempts to reopen setup go to `/audit`,
  never directly to a checkout-shaped summary.
- `/audit` is now a permanent authenticated evidence view linked from the
  dashboard sidebar. It reloads the brand's `current_audit_id`, its complete
  gap evidence, planned articles, and optional program progress.
- The six selected program clusters are expanded by default. Each cluster shows
  every proposed article, its pillar role, primary/supporting searches, and
  source-query links. Additional measured clusters remain inspectable but are
  clearly outside the current six-cluster program.
- The evidence table can expand from the first 40 rows to the complete
  post-filter pool. Missing article rows or unresolved source evidence are
  displayed as data bugs instead of being hidden.
- `/content-plan` now renders the same complete inspector before purchase. Once
  purchased, it continues to render the frozen delivery program.
- Public read-only audit links now load planned articles and the complete
  capped evidence set, so a shared report supports the same claims as the
  authenticated view.
- Subscription empty states and the sidebar now link back to the saved audit.
  The customer therefore always has a route from evidence to URL confirmation
  and pricing, and back again.

This closes the UX side of “inspect and weigh before you pay.” It does not alter
the immutable audit, qualification, purchase-intent, graph, or billing
contracts.

### 2026-07-30 - pgvector finalization repair and preflight

An audit completed harvesting and clustering but failed inside
`finalize_audit_run` with `type "vector" does not exist`. The vector extension
and `query_pool.embedding` column existed. The function was pinned to
`search_path = public`, while Supabase had installed pgvector in its extension
schema, so the unqualified JSON-to-vector cast could not resolve the type.

`20260730_fix_finalize_vector_search_path.sql` discovers the extension's real
schema and adds it to the finalizer's function-level search path. It also adds
`assert_harvest_schema_ready()`, a read-only service-role RPC that checks all
columns required by finalization, pgvector installation/type ownership, the
finalizer function, and its vector visibility.

`POST /api/topical-audit` now calls that readiness RPC before inserting a new
run or queueing Trigger.dev. Missing migrations therefore return a user-safe
503 before Tavily, crawling, embeddings, or clustering incur cost. Existing
running or still-fresh completed audits are recovered/reused before the
preflight.

### 2026-07-30 - schema drift from an edited migration

`observed_value` and `observed_at` were added to `query_pool` by editing
`20260728_harvest_pool.sql` **after it had already been applied**. Because that
table is created with `CREATE TABLE IF NOT EXISTS`, re-running the file did
nothing at all, and `20260730_closed_pool_v2.sql` went on to *reference*
`observed_value` in a trigger and in `finalize_audit_run` without ever adding it.

The result was the worst possible failure shape: the mismatch was invisible in
the repo, invisible at deploy, and only surfaced at the very last step of a
completed audit run.

```
[Audit Task] Fatal error: Error: Audit finalization failed:
column "observed_value" of relation "query_pool" does not exist
```

Confirmed against the live schema — those two columns were the only ones
missing across all four closed-pool tables, and `query_pool.source_url` was
nullable when the design requires `NOT NULL`.

Fixed:

- `supabase/migrations/20260730_reconcile_harvest_columns.sql` — idempotent
  `ADD COLUMN IF NOT EXISTS` for every non-identity column across `query_pool`,
  `audit_clusters`, `planned_articles` and `programs`; backfill then `SET NOT
  NULL` for `observed_value` and `source_url` (a bare `ADD COLUMN ... NOT NULL`
  fails on a populated table); and a closing `DO` block that raises if anything
  the writer needs is still absent.
- `supabase/migrations/20260728_harvest_pool.sql` — a do-not-edit header
  explaining why editing it does nothing.
- `tests/pivot-contract.test.mjs` — new test parses every `CREATE TABLE` in the
  base migration and asserts each non-identity column has a matching
  `ADD COLUMN IF NOT EXISTS` in the reconciliation. **It caught a real gap on
  first run**: `source_url` was being `SET NOT NULL` without ever being added,
  which would have failed on a database old enough to lack it.

18/18 contract tests pass.

Two structural lessons, in the same spirit as replacing the collapse ratio with
a direct duplicate check: the guard belongs on the *class* of mistake, not the
instance, and a schema referenced by one migration but defined by another must
be reconciled somewhere that runs.

**Confirmed applied.** `query_pool.observed_value`, `observed_at` and
`source_url` are all present and `NOT NULL` on the live project. The table held
zero rows, so no backfill ran and no data was touched.

### 2026-07-30 - migrations must survive a replay

Re-running `20260728_harvest_pool.sql` aborted the whole script:

```
ERROR: 42703: column "niche_blueprint" of relation "topical_audits" does not exist
```

Nothing was broken. That file carried a bare `COMMENT ON COLUMN` documenting
`niche_blueprint` as deprecated, and `20260730_closed_pool_v2.sql` has since
dropped the column — so the earlier migration could no longer run against a
database that had moved past it. A migration is not write-once: it gets pasted
into the SQL editor twice, replayed onto a branch, or run against a database
that is ahead of it, and it must survive all three.

Fixed:

- `20260728_harvest_pool.sql` — both `COMMENT ON COLUMN` statements moved inside
  an `information_schema` existence check. Comments are documentation; they must
  never be able to abort a script. Nothing else in that file was at risk: every
  other statement is already `IF NOT EXISTS`, `CREATE OR REPLACE`, or
  `DROP POLICY IF EXISTS`.
- `20260729_velocity_pricing.sql` — same guard on `COMMENT ON TABLE
  dodo_pricing_plans`. Not a live hazard (nothing drops that table), but keeping
  the rule exception-free is worth more than deciding per-object which
  identifiers are permanent.
- `20260730_closed_pool_v2.sql` — audited, no change needed. Every
  `CREATE TRIGGER` already has a matching `DROP TRIGGER IF EXISTS`.
- `tests/pivot-contract.test.mjs` — new test asserts every pivot migration is
  replay-safe: no unguarded `COMMENT ON`, no `CREATE TABLE`/`INDEX`/`TYPE`
  without `IF NOT EXISTS`, and no `CREATE TRIGGER` without a preceding drop.
  **It found the `velocity_pricing` comment on first run.**

Also recorded in §3: `supabase db push` must not be used on this project. The
CLI's migration history stops at `20260404014829`, so it considers every pivot
migration pending and would replay all of them.

Two follow-ons the replay test dragged out, both real:

- The test's first version used a hardcoded file list and so skipped
  `20260730_fix_dominate_tier.sql` — the same shape of hole as the bug it exists
  to catch. It now scans the migrations directory, and immediately found an
  unguarded `COMMENT ON TABLE` in that file.
- That tier-fix migration is **superseded and now a no-op**. The $599/3-cluster
  correction was applied to the 07-29 seed before it ran, so its retirement
  clause matches nothing and its INSERT would have added a second active
  Dominate row, making plan lookup ambiguous at checkout.

Added alongside: a test asserting
`clustersPerMonth x billingPeriods == programClusters` for every tier in
`config/product-truth.ts`. The invariant was documented in a header comment
there and had already been violated once in shipped pricing; a comment did not
stop it.

20/20 contract tests pass.

### 2026-07-30 - duplicate-article gate caught two real bugs

The `duplicate_articles` invariant added earlier did its job on its first
production run and failed the audit with 13 unmerged pairs:

```
"Alte Fotos animieren" ~ "O Animowaniu Starych Zdjęć"                (0.904)
"ai powered generator" ~ "ai-powered generation"                     (0.899)
"Alte Fotos animieren" ~ "As últimas novidades sobre como animar..." (0.867)
```

Two independent defects, both real.

**1. The merge loop stopped early.** `collapseToArticles` had
`if (supporting.length >= MAX_SUPPORTING_KEYWORDS) break`. Once a unit collected
five supporting keywords the loop stopped scanning, so every remaining
near-duplicate stayed unassigned — and an unassigned query goes on to become its
own article unit. Eight identical phrasings shipped as one article plus three
duplicates of it.

The cap belongs on what the writer is shown, never on what the merge step
consumes. Overflow duplicates are now absorbed: marked assigned and recorded in
`sourceQueryIds` for traceability, just not listed in `supportingKeywords`.

**2. Foreign-language queries in an English plan.** German, Polish and
Portuguese titles harvested from a competitor's localised sitemap. The niche
filter cannot catch these — multilingual embeddings place translations *close
to* the English centroid by design, which is also exactly why they scored 0.9
against each other and tripped the duplicate detector.

Relevance and language are orthogonal, so `lib/harvest/language-filter.ts` adds
a separate gate running before the demand filter (saving a request per foreign
string). Detection is non-Latin script, foreign function words, and systematic
morphological suffixes (`-ieren`, `-ção`, `-ość`, `-ement`). Suffixes matter:
"Alte Fotos animieren" contains no German function word at all, but `-ieren` is
unambiguous — morphology generalises where a word list only catches the case in
front of you.

Verified 16/16 against the exact production strings plus English controls,
including "café website design" which must survive its single loan diacritic.
Drops are reported as `languageFilter` in `/api/harvest/verify`.

Contract suite pins both: the merge loop must not `break` on the cap, and
assembly must run `filterByLanguage` before `filterToSearchedQueries`.


### 2026-07-30 - abandoned audit runs self-heal

**Reported from production.** Opening the audit page created a `topical_audits`
row and showed a running loader, but no run appeared in Trigger.dev.

`tasks.trigger()` did not throw — that path is caught and marks the row failed.
It returned a handle, so the run was accepted somewhere the dashboard was not
showing. **The most likely cause is environmental, not code:** a
`TRIGGER_SECRET_KEY` in the deployed app that belongs to a different Trigger
environment than the one being viewed, or a Trigger deploy that never shipped
`run-topical-audit`, leaving runs queued against a version no worker serves.
Application deploys and Trigger deploys are separate commands.

**The application bug that made it unrecoverable is fixed regardless of cause.**
A row is only ever advanced by the task itself, so when the task never executes
the row stays `running` forever:

- `GET` reported `running`, so the console rendered an endless loader.
- `POST` answered "Audit already running", so retry was impossible.

There was no timeout anywhere. The state was permanent and needed manual
database editing to clear.

`reclaimStaleRuns()` now runs at the start of both handlers. Any `running` row
whose `started_at` is older than `AUDIT_STALE_AFTER_MINUTES` (20, against the
task's `maxDuration` of 900s) is marked failed with
`failure_code: "worker_never_ran"` and a message stating no work was completed
and nothing was charged. The stuck state becomes an ordinary retryable failure,
so the retry panel handles it with no intervention.

Pinned in the contract suite: both GET and POST must call `reclaimStaleRuns`
before reading status or triggering.

**Still to verify in the deployment (not a code fix):**

1. `TRIGGER_SECRET_KEY` in Vercel production belongs to the **prod** Trigger
   environment, not dev.
2. `npx trigger.dev@latest deploy` has been run since the task files changed —
   deploying the Next app does not deploy Trigger tasks.
3. The Trigger dashboard is being viewed on the same environment the key targets.


### 2026-07-30 - refreshing a failed audit no longer re-runs it

**Reported from production.** An audit failed, the page was left open, and a
single refresh from another device started a brand new `run-topical-audit`. Every
refresh would have done the same, without limit.

Chain:

1. `finalize_audit_run` sets `brand_details.current_audit_id` **only on success**.
2. After a failure there is no `running` row and no `current_audit_id`, so
   `GET /api/topical-audit` returned `status: "not_found"`.
3. `recoverOrStart` in `components/audit/audit-console.tsx` reads `not_found` as
   "never ran" and POSTs.
4. `POST` guarded only `running` and `completed` runs — a `failed` run matched
   neither, so it inserted a new audit row and triggered the full pipeline.

One refresh = a complete crawl, search, embedding and clustering run.

Fixed in three layers, because any one alone still leaks:

- **GET** now falls back to the most recent `failed` run, so the status is
  reported instead of looking like a fresh brand.
- **POST** enforces `AUDIT_RETRY_COOLDOWN_MINUTES` (15) and
  `MAX_FAILURES_PER_COOLDOWN` (3), returning 429 with `Retry-After`. After three
  failures in the window, automatic retries stop and the response says so.
- **The console** auto-starts only for `status === "not_found"`. A failed run,
  a non-OK response, and a thrown fetch all surface an error now; previously all
  three called `startAudit()`, so a transient network blip also paid for a run.

**Retry UX.** The failure state now owns the whole console surface:

- Leads with what did *not* happen — nothing charged, nothing saved, brand
  details intact — because the old handler bounced the customer back to the
  brand step, implying they had mistyped something.
- Shows the actual error, a live `mm:ss` countdown, and attempts remaining.
- The retry button is disabled until the server would genuinely accept it. GET
  and POST both derive from one `retryState()` helper so the countdown shown is
  the rule enforced — a button that offers a retry the API refuses is worse than
  no button.
- After `MAX_FAILURES_PER_COOLDOWN` it switches to a support mailto instead.
- States plainly: "Refreshing this page will not start a new audit."

Copy is truthful about the alert: `trigger/run-audit.ts` really does email on
failure, so the panel says "our team has been alerted automatically". What it no
longer claims is that the *customer* will be emailed back — that address is the
founder's, and nothing automated replies to the customer. That alert now reads
`FOUNDER_ALERT_EMAIL` (falling back to the previous hardcoded address) so it
matches the release-gate variable already used by `billing-lifecycle.ts`.

Contract suite pins all of it: `recoverOrStart` must contain exactly one
`await startAudit()` call reachable only from the `not_found` branch, both
handlers must call the shared `retryState()`, the retry button must stay
disabled behind `canRetry`, and the dead error callback must not return.

**Correction to the previous entry.** It said the fixed collapse-ratio audit
could simply be "re-run". There is no deliberate re-run path — the only reason a
re-run happened at all was this bug. A proper retry affordance on the failure
state is still outstanding.


### 2026-07-30 - collapse ratio demoted; duplicate articles gated directly

A production audit failed on a healthy result:

```
[GapEngine] Pool 354: 50 covered, 2 partial, 304 gaps. Authority 14%
[Clusterer] 147 articles grouped into 13 clusters (sizes: 15,15,12,12,11,8,8,12,10,10,9,13,12)
HarvestAssemblyError: Collapse ratio 48.4% is outside 25-40%.
```

Everything about that run was correct — 13 clusters all sized 8-15, oversized
clusters split properly, zero source failures, 304 gaps, easily enough to
qualify six clusters. It was rejected by a number invented in a planning
document and then hard-wired as an invariant.

**Root cause.** Collapse ratio measures how much *phrasing redundancy* a niche
contains, not whether clustering worked:

| Run | paa | competitor | autocomplete | page-derived | queries/article | ratio |
|---|---|---|---|---|---|---|
| bringback | 44 | 9 | 340 | 13% | 3.57 | 28.3% PASS |
| pixreunion | 25 | 3 | 267 | 9% | 3.62 | 27.7% PASS |
| **failing run** | **141** | **79** | **180** | **55%** | **2.07** | **48.4% FAIL** |

Page-derived strings are distinct page titles and questions, so they do not
merge. Autocomplete strings are phrasing variants that merge roughly 4:1.
`capProportionally` takes page-backed sources whole before autocomplete, so a
subject whose competitors publish rich FAQ/blog content gets a pool dominated by
unmergeable strings — and the ratio rises mechanically. **The gate was rejecting
audits based on a property of someone else's website.** It would recur on any
such niche, unpredictably from the URL alone.

**Fix — test the actual risk instead of a proxy for it.** The reason to care
about collapse is "don't ship two articles about the same thing", so that is now
tested directly. `findDuplicateArticlePairs` (lib/harvest/clusterer.ts) compares
every article-unit pair; since `collapseToArticles` folds anything within
`ARTICLE_MERGE` into an existing unit, a surviving pair above that threshold is a
genuine merge failure. `assembly.ts` throws `duplicate_articles` on any such pair.

Collapse ratio is now:
- **hard failure only above `collapseCeiling` (0.80)** — catastrophic non-merging
- **a `console.warn` outside `collapseExpectedMin/Max` (0.25-0.55)**, with pool
  composition logged, because that band tracks source mix
- reported by `/api/harvest/verify` with an explicit "check source mix" note

Policy version -> `closed-pool-v2.4.0`. `collapseMin`/`collapseMax` removed;
the contract suite now pins their absence plus the new invariant, so the gate
cannot be reintroduced.


### 2026-07-30 - buyer lock, CTA cleanup, and free-credit retirement

- Locked the public buyer to founder-led B2B SaaS teams with an existing
  product/site and no dedicated content strategy function.
- Standardized the result-led call to action as “Find My Content Gaps” (with the
  compact navbar variant “Find my gaps”). All routes preserve the onboarding
  destination through login.
- Replaced the founder’s obsolete “two free articles” promise with the actual
  free evidence audit: customers can verify source-linked gaps before paying.
  Removed unprovable citation/autopilot language from the final and blog CTAs.
- Replaced the active delivery illustration’s stale Shopify/Webflow destinations
  with the supported WordPress, manual-review, and export paths.
- Corrected public scope from 48-90 articles to 25-90: each selected cluster has
  3-15 articles and the six-cluster program has a minimum of 25.
- Added `20260730_retire_free_signup_credits.sql`. It sets both legacy signup
  defaults to zero, removes only unbacked historical two-credit grants, and
  guards the compatibility balance against future free grants while continuing
  to allow balances backed by a paid `subscription_period_grants` row.
- Added a server-side 30-day reuse guard for completed customer audits. The free
  audit is a deliberate risk-reversal offer, not an unlimited external-API
  allowance.
- Extended the pivot contract suite so retired offers, stale promises, unnamed
  positioning, and a reintroduced free-credit default fail validation.

### 2026-07-30 - pricing coherence, landing restore, positioning

**Pricing — Dominate 4x$799 -> 3x$599.** Every tier's cluster count must divide
`programClusters` (6) exactly. Four does not, so Dominate's second period shipped
2 clusters at a full $799 charge, totalling $1,598 — making the fastest tier the
most expensive and leaving Close strictly dominated by Accelerate. Now:

| Tier | Clusters/mo | Periods | Monthly | Total | Per cluster |
|---|---|---|---|---|---|
| Close | 1 | 6 | $249 | $1,494 | $249.00 |
| Accelerate | 2 | 3 | $449 | $1,347 | $224.50 |
| Dominate | 3 | 2 | $599 | $1,198 | $199.67 |

Per-cluster price now falls monotonically with speed. Changed in
`config/product-truth.ts`, `actions/harvest.ts`, `app/audit/[token]/page.tsx`,
and the seed in `supabase/migrations/20260729_velocity_pricing.sql`.

**Applied and confirmed live** — `dodo_pricing_plans` holds exactly these three
active rows with matching `billing_periods` and `clusters_per_month` metadata.
`npm run test:pivot-contract` now asserts
`clustersPerMonth x billingPeriods == programClusters` for every tier, so the
half-empty-final-period bug cannot return.

`supabase/migrations/20260730_fix_dominate_tier.sql` is **superseded and now a
no-op.** The correction was applied to the 07-29 seed before it was run, so that
migration's retirement clause matches nothing and its INSERT would add a second
active Dominate row. Its body was removed; the pricing rationale is retained
there as comments.

**Still open:** confirm the Dodo product behind `pdt_0NkDO0sMN9Lu8VQKdhM7I`
actually charges $599. That id previously belonged to the $799 Dominate product.
If it was not repriced in the Dodo dashboard, the site advertises $599 while
checkout charges $799.

**Dodo capability check.** Verified against the API docs: subscription creation
has **no** billing-cycle-limit field, so programs must end via
`cancel_at_next_billing_date` on a whole period boundary. Discounts *do* support
`subscription_cycles` (set to 1 for a first-period-only discount) and
`trial_period_days` exists — so an intro offer is technically possible, but was
rejected: the discount applies per *period* while value accrues per *cluster*, so
the same $99 would buy 1 cluster on Close and 3 on Dominate.

**Unit economics settled.** ~$0.13–0.33 per article at current provider rates;
~95% margin at $249/cluster even assuming $1/article. Cost does not constrain
price. See §10 of `HOW_IT_WORKS.md`.

**Landing page restored.** Commits `4cafa1b`–`b71db31` had reduced `app/page.tsx`
from 11 rendered sections to 3, replacing the design system with inline JSX while
leaving the component files orphaned on disk. All 8 files restored from `2378a11`
with **zero structural drift** — only text differs.

**Positioning rewritten** around topical authority (the outcome) rather than
content-gap analysis (the mechanism), after the earlier framing proved to be a
diagnosis nobody pays for. Title, meta and keywords now target searched terms.
AI-search relevance is stated as *how retrieval systems behave*, never as a
promise about the customer's site.

**Pricing section rebuilt for comprehension** — three tiers, and each card shows
payments, total, and derived per-cluster price so no visitor has to do arithmetic.
A three-panel strip above states what you buy (6 clusters), how many articles
(25–90, exact count from the free audit) and when it ends (after cluster 6).

**Hero mobile fixes.** Decorative crosshairs were colliding with the badge below
`md`; now desktop-only. Sub-headline cut from 7 rendered lines to 4. Navbar CTA
"Start Ranking in AI" -> "Free site audit" (unprovable claim removed).


### 2026-07-30 - scale hardening (autocomplete resilience, IO bounds, solo gate)

- **`lib/harvest/suggest-client.ts`** (new). The harvester and the demand filter
  now share one Google Suggest client with retry, exponential backoff + jitter,
  explicit 429/5xx handling honouring `retry-after`, and a process cache (1h TTL,
  5k entries). Each module previously had a bare `fetch` with no retry, and ~300
  requests per audit go to an undocumented endpoint that the entire provenance
  claim depends on. Provenance is unchanged: `requestUrl` is still the exact URL
  that produced each string.
  - For context, measured load is ~200 requests/day at 20 customers. Throttling
    is a customer-50 concern, not a customer-1 concern. This is insurance.
- **Bounded worst-case IO.** `maxCoveragePages` 250 -> 150, new
  `maxCompetitorCoveragePages: 80`, and `scanCoverage` now takes a `role`
  argument. Worst case per audit drops from 1,370 page fetches to 590 (~74s of
  fetching against a 900s task budget). Competitors need only enough depth to
  establish who owns a gap. Policy version -> `closed-pool-v2.3.0`.
- **`tests/pivot-contract.test.mjs`** updated. The policy-value pin caught this
  change, which is the pin doing its job. It now also asserts the competitor
  coverage cap and that `assembly.ts` passes the `"competitor"` role.
- **`docs/SOLO_LAUNCH_GATE.md`** (new). Six-item gate for customers 1-3 with an
  explicit trigger condition for each deferred item from the 24-item gate. The
  full gate is right for a product with revenue at risk; it is the wrong
  sequencing for a solo founder with zero paying customers and an untested
  distribution channel. Selling does not require checkout to be enabled — the
  public audit route works today and the first three can pay by invoice.
- Verified after all changes: `tsc` clean, 14/14 contract tests, and a live
  `/api/harvest/verify` run passing all four checks (395 pool, 225 gaps, 28.4%
  collapse, 105s).


### 2026-07-30 - final local contract pass

- Moved onboarding out of the dashboard/sidebar layout into a focused
  authenticated shell and hid optional chat/cookie-settings launchers there.
- Added the active-program brand-host/current-audit database guard.
- Tightened writer enforcement from "destination exists" to the exact frozen
  anchor plus destination.
- Removed remaining unreachable credit/GSC/Shopify/Webflow and legacy
  content-plan modules.
- Expanded the contract suite to 13 passing invariant groups.
- Confirmed TypeScript and the production build pass.
- Replaced the previous mixed Phase B notes with this authoritative handoff.

### 2026-07-30 - closed-pool v2 implementation

- Implemented immutable audit snapshots, atomic finalization, normalized
  programs/program clusters, restrictive history ownership, and legacy import.
- Unified bounded harvest computation and provenance/source-call accounting.
- Added frozen purchase intents, URL graph, cluster withholding, and atomic
  delivery.
- Added period grants, idempotent consumption, pause/resume, finite-scope
  cancellation, and replay-safe webhooks.
- Separated generation/delivery/publication state and protected WordPress
  permalinks.
- Added founder prospect audits, public/claim tokens, and exact-email ownership
  transfer.
- Enforced six-cluster eligibility and stale/legacy audit rejection.
- Rebuilt active product truth/public copy and retired legacy product surfaces.
- Added provider cost accounting and the closed-pool release gate.

### 2026-07-28 to 2026-07-29 - evidence engine and first pivot

- Replaced the fabricated LLM topical blueprint with observed autocomplete,
  search-page question, and competitor-page evidence.
- Added mandatory provenance, hard source failures, demand/niche filters,
  bounded site coverage, evidence verification, gap computation, and constrained
  clustering.
- Removed quota-refill duplicate generation and the old LLM planning chain.
- Calibrated two-stage retrieval/evidence coverage against BringBack and
  PixReunion test sets.
