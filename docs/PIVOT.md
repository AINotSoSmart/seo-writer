# FlipAEO Pivot — Closed-Pool Harvest

> **Working doc.** Any agent picking this up cold should read this file end to end
> before touching `lib/harvest/`, `lib/audit/`, or `trigger/run-audit.ts`.
> **Update the Status Board and Changelog at the bottom of this file with every
> change you make.** That instruction is load-bearing — this doc is the only
> continuity between sessions.

Branch: `pivot/closed-pool-harvest` · Started 2026-07-28 · Status: **Engine + product complete; Dodo IDs and end-to-end validation remain**

---

## 1. Read this first

FlipAEO is being rebuilt around one principle:

> **Nothing enters the system that was not observed somewhere real, and nothing is
> reported as covered unless a specific page demonstrably answers it.**

Everything below is downstream of that sentence. The old system invented its own
inputs with an LLM and then measured itself against them. The new one harvests
real search queries, records where each was seen, and verifies coverage against
actual page text.

---

## 2. Why — the business diagnosis

Numbers as of 2026-07: ~75 signups, **2 paying customers**, $420 lifetime revenue,
100% churn at months 2 / 4 / 5. GSC: 19,986 impressions → 127 clicks over six months.

Three findings drove the pivot:

**a) The topical audit was fabricated.** `lib/audit/niche-blueprint.ts` generated
the "niche topical map" — the denominator of the Authority Score — from a single
Gemini Flash Lite call seeded only by the brand's own onboarding form. No SERP, no
competitor data, no volume. `authority-scorer.ts` then did exact 3x/2x/1x weighted
maths against that imagined denominator, and `projectScoreAfterPlan()` guaranteed
the "after" number looked good. That number was on the sales screen.

**b) The engine shipped duplicates to hit a quota.** `lib/plans/generator.ts:531`
re-added posts already rejected as duplicates whenever fewer than 20 survived
dedup, to reach 30. Months 1–2 looked fine; by month 3–4 customers received
rewrites of their own articles. **That `if` statement is the churn mechanism.**

**c) Pricing sat in the dead zone.** [AI-native SaaS retention](https://getspike.ai/blog/saas-churn-rate-benchmarks/)
splits sharply on price: sub-$50 tools show 23% gross revenue retention (~9 month
lifetime), >$250 tools show 70% (~34 months). FlipAEO was $79 — priced like a
budget tool, so it attracted tourists and got tourist retention.
[SEO industry data](https://arvow.com/blog/seo-agency-statistics-2026) also shows
retainer engagements lose ~8% of clients in months 1–6 vs 28% for project
engagements, which rules out a one-off "sprint pack" model.

---

## 3. What we're building

**Same product. Same subscription. Fixed engine. Different buyer. Higher price.**

- **Sell scope, not quantity.** The audit shows the whole map on day one
  ("140 articles across 11 clusters"), then a burn-down. Monthly article count
  varies; the *total* is fixed and visible, so variance stops mattering.
- **Price velocity, not scope.** $249 / $449 / $799 for 1 / 2 / 4 clusters per
  month. A bigger niche becomes an upsell, not a liability, and margin stays flat
  because COGS scales with articles.
- **Ship complete clusters, not daily drips.** A cluster's internal link graph is
  only valid when every member exists.
- **Tell customers when they're finished.** Running out is a feature. It is the
  only version where the audit number is trustworthy.

**Target: 3 paying customers at $249+ from 30 outreach audits. Below that, the
hypothesis is rejected and the asset gets listed.**

### Explicitly NOT doing until three people have paid
Multi-site management, white-label, client reporting, onboarding rebuild,
AppSumo, Product Hunt, WordPress plugin.

---

## 4. Architecture

```
seeds ─┬─▶ autocomplete  ─┐
       ├─▶ SERP questions ─┼─▶ dedupe ─▶ demand filter ─▶ niche filter ─▶ query_pool
       └─▶ competitor pages ┘                                                  │
                                                                               ▼
                                              coverage (2 stages) ◀── user + competitor sites
                                                                               │
                                                    gaps = pool − covered ◀─────┘
                                                                               │
                                       article units ─▶ clusters ─▶ planned_articles
```

### 4.1 Harvest — provenance is mandatory
Every row carries `source`, `source_url`, `observed_value`, `observed_at`.
`source_url` is `NOT NULL` and always re-openable:

| Source | `source_url` is |
|---|---|
| `autocomplete` | the exact Google Suggest request URL |
| `paa` | the page whose visible text contains the question |
| `competitor_sitemap` | the page whose title/h1 contains the topic |

`harvestQueryPool()` **throws** if any row lacks one. A `HarvestIntegrityError`
also aborts the run if any source hard-fails (every request errored) — a bad
Tavily key once produced zero SERP questions while the pipeline reported success.

### 4.2 Coverage — two stages, and one is not enough
1. **Retrieval (recall)** — page embedded as a document (title + description +
   h1 + H2s), asymmetric `RETRIEVAL_QUERY` / `RETRIEVAL_DOCUMENT` task types,
   scored as `similarity + margin` where `margin = best − medianAcrossPages`.
2. **Evidence (precision)** — does the matched page actually contain the query's
   *defining terms*? Defining = low document frequency across that site, so it is
   decided per site rather than by a word list. Checked across the **top 3**
   candidates, not just the top hit.

**Why stage 2 is non-negotiable:** calibrated against pixreunion.com, none of the
three candidate scorers separated hand-labelled positives from negatives
(gaps of −0.031, −0.069, −0.064 — all overlapping). Embedding similarity measures
subject adjacency. A restoration page sits close to "animate old photos with ai"
whether or not it mentions animation.

### 4.3 Gaps — pure set difference
`gaps = query_pool − user_covered`. No LLM. Each gap carries its `source_url` and
the competitor URLs answering it. **The audit is falsifiable** — every claim
links to the page that proves it.

### 4.4 Clustering — the LLM only names things
Queries collapse into article units (main + supporting keywords), units group
into clusters of 8–15. The LLM receives N units and must return N titles. If it
returns any other count the response is discarded and deterministic titles are
used. **It never invents a topic. There is no article quota.**

---

## 5. Code map

| Path | Role |
|---|---|
| `lib/harvest/types.ts` | Shared types, `isPlausibleQuery`, `capProportionally`, brand helpers |
| `lib/harvest/autocomplete.ts` | Recursive a–z + question-prefix expansion |
| `lib/harvest/serp-questions.ts` | Question headings off ranking pages (**not** Google's PAA box — Tavily has no such endpoint) |
| `lib/harvest/competitor-corpus.ts` | Competitor page titles/h1s via real fetches |
| `lib/harvest/query-validation.ts` | Search-demand filter (autocomplete as oracle) |
| `lib/harvest/niche-filter.ts` | Niche centroid + drift centroid relevance gate |
| `lib/harvest/pool.ts` | Orchestrates harvest, enforces integrity, persists |
| `lib/harvest/page-document.ts` | Page fetch + structural/body extraction |
| `lib/harvest/coverage.ts` | Stage 1 retrieval + thresholds |
| `lib/harvest/evidence.ts` | Stage 2 lexical verification |
| `lib/harvest/gap-engine.ts` | Set difference + competitor evidence |
| `lib/harvest/clusterer.ts` | Collapse, group, constrained titler |
| `lib/harvest/run-harvest.ts` | Full pipeline orchestrator |
| `actions/harvest.ts` | Read side: `getAuditScope`, `getGapEvidence`, `getPlannedArticles` |
| `app/api/harvest/verify/` | Dev-only end-to-end dry run (no DB writes) |
| `app/api/harvest/calibrate/` | Dev-only threshold calibration harness |
| `supabase/migrations/20260728_harvest_pool.sql` | `query_pool`, `audit_clusters`, `planned_articles`, `programs` |

### Deleted (do not resurrect)
`lib/audit/niche-blueprint.ts`, `lib/audit/gap-matrix.ts`,
`lib/audit/authority-scorer.ts`, `lib/plans/generator.ts`,
`lib/plans/gap-analysis.ts`, `lib/plans/serp-intelligence.ts`,
`lib/plans/topic-hierarchy.ts`, `lib/plans/similarity-agent.ts`,
`scripts/verify-agent-deduplication.ts`, `app/api/generate-content-plan/`.

---

## 6. Calibrated constants — derived, not guessed

**Never hand-tune these. Re-derive with `/api/harvest/calibrate`.**

| Constant | Value | Where | Basis |
|---|---|---|---|
| `COVERAGE_THRESHOLDS.COVERED` | 0.78 | `coverage.ts` | Below lowest labelled positive across both sites (0.789, 0.863). Deliberately permissive — evidence supplies precision. |
| `COVERAGE_THRESHOLDS.PARTIAL` | 0.74 | `coverage.ts` | **Uncalibrated** — neither labelled set has a partial class. |
| `NICHE_RELEVANCE_FLOOR` | 0.50 | `niche-filter.ts` | Pharmacology drift from "topical" formed a population at 0.42–0.46; legitimate queries began ~p25 (0.539). |
| `PAGE_DERIVED_RELEVANCE_FLOOR` | 0.38 | `niche-filter.ts` | Page-derived rows are contextually grounded; the full floor cut real product questions. |
| `MIN_RAREST_TERM_OCCURRENCES` | 2 | `evidence.ts` | A term mentioned once in passing is not coverage. |
| `MAX_WORDS_FOR_DEMAND_CHECK` | 7 | `query-validation.ts` | Autocomplete does not suggest 8+ word strings; testing them measures the oracle, not demand. |
| `CLUSTER_THRESHOLDS.*` | 0.78 / 0.62 | `clusterer.ts` | **Provisional.** Guarded by `assertCollapseRatio()`. |

### Calibration results (2026-07-29)

| Site | Pages | Labels | Result |
|---|---|---|---|
| bringback.pro | 70 | 10 pos / 6 neg | **16/16** |
| pixreunion.com | 11 | 10 pos / 10 neg | **19/20** (0 FN, 1 arguable FP) |

Scoring-function comparison on bringback.pro:

| Scorer | minPos | maxNeg | gap |
|---|---|---|---|
| margin only | 0.131 | 0.135 | **−0.004** (overlaps) |
| similarity only | 0.711 | 0.704 | +0.007 |
| **similarity + margin** | **0.864** | **0.817** | **+0.047** |

---

## 7. Verification protocol

Dev server: `npm run dev`. **Use `127.0.0.1`, not `localhost`** — `localhost`
resolves to IPv6 on this machine and hangs. Both endpoints are exempted from auth
in `proxy.ts` by **exact path match only**, and return 404 when
`NODE_ENV === "production"`.

```bash
curl -X POST http://127.0.0.1:3000/api/harvest/verify -H 'content-type: application/json' -d '{"url":"https://example.com","seeds":["seed one"],"brandContext":"one sentence describing the product","excludeContext":"what the seeds must NOT mean","competitors":["https://rival.com"],"maxQueries":300}'
```

```bash
curl -X POST http://127.0.0.1:3000/api/harvest/calibrate -H 'content-type: application/json' -d '{"url":"https://example.com","positives":["query the site answers"],"negatives":["query it does not"]}'
```

**Deriving honest labels:** fetch the site's sitemap and map positives to
dedicated pages. Negatives must include the hard controls — competitor-branded
queries, location-specific searches, rival-tool tutorials. Those are what the
broken version got wrong.

### Acceptance checks (enforced by `/verify`)
| Check | Requirement |
|---|---|
| `provenance` | 100% of gaps carry a `source_url` |
| `sources_healthy` | no source hard-failed |
| `all_sources_represented` | capping did not zero out a source |
| `cluster_size` | largest cluster ≤ 15 |
| `collapse_ratio` | 25–40% — **disputed, see §8** |

`INCONCLUSIVE` is not a pass. A run that cannot measure something must not claim
it verified it.

---

## 8. Status board

### Done and verified
- [x] Closed-pool harvest with mandatory provenance (100% traceable, 3 runs)
- [x] Source failure surfacing — hard failures abort instead of reporting success
- [x] Competitor topics from visible page text, not slug inference
- [x] Niche filter with niche + drift centroids (kills ambiguous-seed drift)
- [x] Search-demand filter for page furniture (structural, replaced regex blocklists)
- [x] **Two-stage coverage** — 35/36 across two sites, 0 false negatives
- [x] Cluster oversize bug (was producing 18 and 40 against a max of 15)
- [x] Intra-batch dedup in `plan-deduplication.ts` (items were never compared to each other)
- [x] `autoReplace` removed from `keyword-validator.ts` (silently rewrote article targets)
- [x] `run-audit.ts` rewired to the closed-pool pipeline

### Open
- [ ] **`collapse_ratio` target is disputed.** Evidence says it tracks source mix,
      not clustering quality: same code gave 27.7% on a 90%-autocomplete pool and
      42.3% on a healthy 63% one. Four runs across two sites cluster at 40–46%.
      **Recommendation: re-base to 35–50%.** Needs a human decision — do not
      silently move it, and do not tune the clusterer to satisfy the old number.
- [ ] **Session-token leak in dev logs.** Not reproduced statically (no
      `getSession()` calls, no debug flags). `lib/safe-log.ts` exists and is
      applied to signout handlers as precaution only. **Needs the actual log
      line.** Rotate the exposed session regardless.
- [ ] `COVERAGE_THRESHOLDS.PARTIAL` uncalibrated — no partial class in either label set.
- [ ] One arguable false positive: `restore old photos in photoshop` on
      pixreunion.com, whose page genuinely discusses Photoshop.

### Phase B — mostly done
- [x] **Cadence: cluster batches.** `trigger/ship-cluster.ts` (`clusterShipper`) ships
      one complete cluster at a time from `planned_articles`, pillar first, with a
      batch credit preflight and per-article deduction. It only marks the sold
      cluster subset complete after generation finishes, and pauses on failures.
- [x] **Legacy watchman guarded.** `dailyContentWatchman` skips any brand with an
      active program, so the two schedulers never double-charge.
- [x] **`generate-plan.ts` rewired.** Runs `runHarvestAudit` and mirrors
      `planned_articles` into `content_plans.plan_data` for the existing dashboard.
      The five-stage LLM chain and `targetCount: 30` are gone.
- [x] **Audit UI:** `components/audit/scope-results.tsx` — scope headline, velocity
      tiers, recommended program, burn-down, and a clickable evidence table.
- [x] **Public audit route:** `app/audit/[token]/page.tsx`, no auth, `noindex`.
- [x] **Program lifecycle:** `startProgram()` / `getProgramProgress()` in `actions/harvest.ts`.
- [x] **Archived:** SEO Health + Action Board removed from the sidebar; Webflow and
      Shopify gated behind `SHOW_ARCHIVED_INTEGRATIONS = false`. Code and tables intact.
- [ ] **Pricing rows — needs you.** `supabase/migrations/20260729_velocity_pricing.sql`
      is written but **deliberately fails until the three Dodo product IDs are filled in**.
      Create the products, replace the placeholders, verify `credits` against measured COGS.
- [x] **Onboarding uses `ScopeResults`.** The console follows the seven real
      harvest phases; completion loads `getAuditScope`, `getGapEvidence`, and
      `getProgramProgress`. Refresh recovery no longer depends on a legacy JSON blob.
- [x] **Plan handoff reuses the audit.** `/api/content-plan/start-background`
      mirrors existing `planned_articles` and does not run the Tavily-heavy
      harvest twice.
- [x] **Commerce lifecycle is connected.** Active Dodo velocity subscriptions
      provision/reschedule the latest audited brand; cancellations pause it.
- [x] **Content-plan dashboard reads clusters.** The retired 12/8/6/4 categories
      made harvested plans render empty. It now groups the authoritative rows by
      harvested cluster and shows unscheduled work honestly before purchase.
- [x] Landing and pricing copy now sell finite scope + delivery velocity. GSC,
      quota-of-30, Shopify, and Webflow promises are removed from active surfaces.
- [x] Deprecated `topical_audits` columns are dropped by
      `20260729_drop_legacy_audit_columns.sql`; the old result component and action
      are deleted.
- [x] Archived routes redirect out of SEO Health / Action Board; comparison pages
      for the retired quota product are `noindex` and excluded from the sitemap.

---

## 9. Rules for whoever works on this next

1. **Update this doc.** Status board and changelog, every change. No exceptions.
2. **Never hand-tune a threshold.** Run `/api/harvest/calibrate` with labelled
   data. If populations overlap, the *method* is wrong — say so rather than
   picking a number that splits the difference.
3. **Never reintroduce absolute-threshold-only coverage.** It produced a 99%
   authority score on a site covering almost nothing. Two stages or nothing.
4. **Do not add regex blocklists for content quality.** That was tried twice; each
   round caught the previous examples and missed the next. Prefer evidential
   tests (does anyone search it? is the term actually on the page?).
5. **The legacy audit shape is gone.** Do not re-add `niche_blueprint`,
   `projected_score`, `gap_matrix`, or the retired `actions/audit.ts` read path.
6. **Provenance is the product.** A gap without a working `source_url` is a bug,
   not a tuning issue. This is the only thing separating FlipAEO from a $19
   competitor.
7. **Report failures plainly.** Several rounds of this work found that a proposed
   fix was wrong. Saying so early is cheaper than defending it.

---

## 10. Changelog

### 2026-07-29 — Phase B/C completion: product seam and commerce
- Replaced the legacy onboarding result and four fictional progress phases with
  `ScopeResults` and the seven closed-pool phases emitted by `run-audit.ts`.
- `/api/topical-audit` now returns only scope fields. Deleted `actions/audit.ts`
  and `components/audit/audit-results.tsx`; added the legacy-column drop migration.
- `/api/content-plan/start-background` now mirrors the completed harvest instead
  of paying for a duplicate crawl, competitor scan, and Tavily harvest.
- Replaced the dashboard's fixed 12/8/6/4 categories with dynamic harvested
  clusters. Added an explicit cluster-delivery marker and honest pre-purchase
  scheduling state.
- Connected subscription activation, renewal, plan change, and cancellation to
  program provisioning. Scheduling is idempotent, restricted to the sold
  clusters, and synchronized into the compatibility `content_plans` read model.
- Corrected delivery state: `planned_articles` reaches `published` only when the
  generation task succeeds; failures pause the program; burn-down is derived
  from finished rows; the legacy watchman skips active, paused, and completed
  closed-pool programs.
- Rebuilt active landing/pricing/checkout copy around finite scope and velocity;
  checkout renders all DB-driven tiers instead of `plans[0]`.
- Archived old GSC routes by redirect, stopped loading hidden CMS integrations,
  and removed stale comparison pages from the sitemap while keeping their code.

### 2026-07-29 — Phase B: delivery, UI, and archiving
- **`trigger/ship-cluster.ts`** — new `clusterShipper` scheduled task. Ships a whole
  cluster per run (pillar first), preflights the cluster credit requirement, marks the program
  complete when the niche is closed instead of re-shipping.
- **`trigger/scheduler.ts`** — legacy `dailyContentWatchman` now skips brands with a
  closed-pool program, preventing double-charging and quota refills after completion.
- **`trigger/generate-plan.ts`** — rewired to `runHarvestAudit`. Removed the five-stage
  LLM chain and `deduplicateWithReplacementLoop(..., { targetCount: 30 })`; mirrors
  `planned_articles` into `content_plans.plan_data` for the existing dashboard.
- **Deleted the last of the LLM-invents-topics chain** (no remaining callers):
  `lib/plans/strategic-planner.ts`, `lib/plans/plan-deduplication.ts`,
  `lib/plans/cluster-scheduler.ts`, `lib/plans/keyword-validator.ts`.
  Deduplication is now structural — the pool's `UNIQUE (brand_id, query_norm)` plus
  clustering collapse — rather than a post-hoc filter with a quota to refill.
- **`actions/harvest.ts`** — added `startProgram()` (commits a tier, schedules one
  date per cluster) and `getProgramProgress()` (burn-down).
- **`components/audit/scope-results.tsx`** — new scope view. No Authority Score against
  an invented denominator, no projected-score simulation. Scope, velocity tiers,
  burn-down, and an evidence table where every gap links to its source URL.
- **`app/audit/[token]/page.tsx`** — public read-only audit, `noindex`, no signup wall.
- **Archived:** SEO Health and Action Board removed from the sidebar; Webflow and
  Shopify gated behind `SHOW_ARCHIVED_INTEGRATIONS`. Nothing deleted.
- **`supabase/migrations/20260729_velocity_pricing.sql`** — $249 / $449 / $799 tiers,
  deactivates the $79 plan. Guarded: raises an exception until real Dodo product IDs
  replace the placeholders.


### 2026-07-29 — Coverage rewrite (two-stage) and pool cleanup
- **Replaced absolute-threshold coverage with retrieval + evidence.** Absolute
  cutoff of 0.62 had reported 390/392 queries covered (99% authority) on a site
  whose pages contained almost none of them.
- Added `lib/harvest/evidence.ts`: per-site document frequency, defining-term
  extraction, occurrence-counted verification across the top 3 candidates.
- Added `app/api/harvest/calibrate/`: labelled-data harness that compares
  scoring functions and reports separability instead of assuming one works.
- Fixed bidirectional prefix match (`"photoshop".startsWith("photo")`).
- Fixed nav contamination of document frequency (prefer `<main>`, strip chrome).
- Raised page read budget 120KB → 400KB; a 747KB page was truncated before
  `</main>`, losing the body text the evidence check needed.
- Lowered semantic gate 0.84 → 0.78 once evidence supplied precision.
- Demand filter: separated empty-but-successful autocomplete responses from
  failed requests (72 inconclusive → 0); scoped to ≤7-word queries after it was
  found cutting legitimate long-tail questions (110 dropped → 21).
- Rejected first-person-plural strings (`our`/`we`/`us`) as site self-description.
- Auto-excluded each source page's own brand via its domain.
- Stripped UI artifacts (`expand collapse`) at extraction.
- Page-derived rows given a lower niche floor (0.38) than autocomplete (0.50).
- Added `lib/safe-log.ts` and applied to signout handlers.

### 2026-07-29 — Provenance repair
- Autocomplete rows now carry the exact Suggest request URL as `source_url`,
  plus `observed_value`/`observed_at`. Previously null — 86% of gaps were
  unverifiable and the provenance test failed outright.
- `SourceReport` per harvester; hard failures abort the run.
- Competitor topics read from real page titles/h1s; slug-only pages dropped.
- Added niche drift centroid (`excludeContext` / `product_identity.not`).
- Fixed cluster oversize (`large.length === 0` branch skipped splitting).
- Fixed `capProportionally` zeroing out whole sources on a tail slice.
- `proxy.ts`: dev-only exemption for harvest endpoints, exact path match.

### 2026-07-28 — Engine replacement
- Deleted the fabricated pipeline (9 files, ~1,970 lines) including
  `generator.ts:531`, the branch that re-shipped rejected duplicates to hit a
  quota of 30.
- Built `lib/harvest/` closed-pool architecture; rewired `trigger/run-audit.ts`.
- Migration `20260728_harvest_pool.sql`.
- Removed the LLM YES/NO dedup gate; added intra-batch comparison.
- Removed `autoReplace` from `keyword-validator.ts`.
