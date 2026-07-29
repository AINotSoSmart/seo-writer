# FlipAEO Pivot: Closed-Pool Architecture + Velocity Pricing

## Context

FlipAEO has run since Jan 2026: ~75 signups, 2 paying customers, $420 total revenue, 100% churn at months 2/4/5. GSC shows 19,986 impressions → 127 clicks over six months.

Two root causes were identified, and they are the same cause:

**1. The topical audit is fabricated.** `lib/audit/niche-blueprint.ts` generates the "niche topical map" — the denominator of the Authority Score — from a single Gemini Flash Lite call seeded only by the brand's own onboarding form. No SERP, no PAA, no competitor data, no volume. `lib/audit/authority-scorer.ts` then computes exact 3x/2x/1x weighted math against that imagined denominator, and `projectScoreAfterPlan()` guarantees the "after" number looks good. Similarly, `lib/plans/serp-intelligence.ts:99` asks an LLM "what topics are NOT covered but SHOULD be?" — pure invention — and that output flows into `blueOceanTopics`, which the planner is told to prioritize. **Real data enters the prompt as context; the LLM is never constrained to it.**

**2. The engine ships duplicates to hit a quota.** `lib/plans/generator.ts:531` re-adds posts already rejected as duplicates whenever fewer than 20 survive dedup, in order to reach 30. That is the churn mechanism in code: months 1–2 look good, month 3–4 the customer receives rewrites of their own articles.

**Business model correction.** [AI-native SaaS retention](https://getspike.ai/blog/saas-churn-rate-benchmarks/) splits on price: sub-$50 tools show 23% GRR (~9 month lifetime), >$250 tools show 70% GRR (~34 months). $79 sat in the tourist tier and produced tourist retention. [SEO industry data](https://arvow.com/blog/seo-agency-statistics-2026) shows retainer engagements lose ~8% of clients in months 1–6 vs 28% for project engagements — which rules out the one-off "sprint pack" model.

**Intended outcome:** a falsifiable audit where every claimed gap links to the competitor URL proving it; a finite, disclosed scope sold as *velocity* (clusters per month) rather than article quantity; complete interlinked clusters shipped monthly instead of daily drips; and a shareable public audit that doubles as the cold-outreach artifact.

Target: 3 paying customers at $249+ from 30 outreach audits. Below that, the hypothesis is rejected.

---

## Step 0 — Measure COGS before finalizing prices

`trigger/generate-blog.ts` makes ~10 Gemini calls (`gemini-3.1-flash-lite` + `gemini-3-flash-preview`), 2+ Tavily searches (broad + "sniper" fan-out, lines 604/674), and 2+ `fal.ai` image generations per article.

Pull last month's Gemini, Tavily, and fal.ai bills, divide by articles generated. **Every tier price below is a placeholder until this number exists.** If it exceeds $10/article, tiers move up rather than margins down.

---

## Part 1 — The harvest (new: `lib/harvest/`)

Replaces the invented blueprint with an observed, sourced query universe. Nothing enters the system that was not seen in the wild.

| File | Job | Reuses |
|---|---|---|
| `autocomplete.ts` | Recursive expansion: seeds × `a–z` × question prefixes (`how/what/why/best/is/vs/for`), 2 levels | `expandKeyword()` in `lib/plans/keyword-validator.ts` |
| `paa.ts` | People Also Ask harvest, 3 levels deep | `buildTavilySearchOptions()`, `extractSearchPrefs()` in `lib/tavily-search.ts` |
| `competitor-corpus.ts` | Competitor sitemap slugs + titles → query candidates | `fetchSitemapUrls()`, `extractTitlesFromUrls()` in `lib/sitemap.ts`; competitor discovery in `lib/audit/competitor-scanner.ts` |
| `pool.ts` | Normalize, dedup, embed, persist with provenance | `generateEmbedding()` in `lib/gemini-embedding.ts` |

Seeds come from `brandData.product_identity.literally`, `category`, and `core_features` — the existing logic in `strategic-planner.ts:35-105`, extracted and expanded.

**Every row carries `source` (`autocomplete` | `paa` | `competitor_sitemap`) and `source_url`.** This is what makes the audit falsifiable and is the single most important property of the rewrite.

Expected yield: 250–600 unique queries per brand.

---

## Part 2 — Coverage measurement (upgrade `lib/audit/site-scanner.ts`)

Three defects to fix in `mapSiteToBlueprint` / `scanSite`:

1. **Title-only embedding** (`site-scanner.ts:338`, `batch.map(p => generateEmbedding(p.title))`). A 3,000-word article is currently represented by its `<title>`. Change to embed `title + h1 + meta description + first two H2s`. The HTML is already fetched in the same function — extend the existing regex block at `site-scanner.ts:126-160`.
2. **Missing `taskType`** (`site-scanner.ts:277` and `:338`). Pass `RETRIEVAL_QUERY` for queries and `RETRIEVAL_DOCUMENT` for pages. `generateEmbedding()` already accepts the parameter and it is used correctly in `plan-deduplication.ts` — apply it here.
3. **Absolute thresholds** (`site-scanner.ts:376`, hardcoded `0.72`/`0.82`, with a doc comment three lines above claiming `0.60`/`0.78`). Replace with per-site relative ranking plus one calibrated cutoff. Calibrate once against ~20 hand-labelled pages and record the number in a constant with a comment explaining its provenance.

Keep `cosineSimilarity()` and the crawl/fetch logic — both are fine.

---

## Part 3 — Gaps by set difference (new: `lib/harvest/gap-engine.ts`)

```
gaps = query_pool − user_covered
competitor_owned = per-query map of which competitors cover it (same coverage fn)
```

Pure computation. No LLM. Each gap row carries the query, its `source_url`, the competitor URLs covering it, and the user's best-matching page + similarity if partially covered.

**Delete:** `lib/audit/niche-blueprint.ts`, `lib/plans/gap-analysis.ts` (entire `missingAngles` → `blueOceanTopics` path including the `:116` fallback), and the `missingAngles` extraction in `lib/plans/serp-intelligence.ts:99`. Keep `extractCompetitorBrands()` from that file — it is real domain-based logic.

`lib/audit/authority-scorer.ts` survives but its denominator changes from the fabricated blueprint to the harvested pool. `projectScoreAfterPlan()` is deleted — the burn-down replaces it.

---

## Part 4 — Clustering and article collapse (new: `lib/harvest/clusterer.ts`)

550 harvested queries ≠ 550 articles. Same-intent variants must collapse.

1. Embed all gap queries (already done in `pool.ts`).
2. Agglomerative grouping at a calibrated cosine threshold → **article units** (one primary query + 3–5 supporting queries → `main_keyword` + `supporting_keywords`, matching the existing `ContentPlanItem` shape).
3. Second-level grouping of article units → **clusters** (8–15 articles each).
4. LLM step, tightly constrained: given N article units, write N titles and name each cluster. **Output length must equal input length.** It never invents a topic.

QA assertion: if article count ≈ query count, clustering is broken — fail the job loudly rather than shipping.

Reuse `consolidateClusters()` from `lib/plans/cluster-scheduler.ts:134` for min/max cluster sizing.

**Delete `lib/plans/generator.ts` entirely** (789 lines, including the duplicate-shipping branch at `:531` and the three `console.warn` validators at `:554+` that detect failure and ship anyway). Rewire `app/api/generate-content-plan/route.ts` to the new pipeline. `lib/plans/strategic-planner.ts` keeps `generateReplacementArticles` but loses its topic-invention prompt.

**Delete `lib/plans/similarity-agent.ts`** — a non-deterministic LLM YES/NO with `return false // fail open` is not a correctness gate. Calibrated thresholds replace it. Simplify `lib/plans/plan-deduplication.ts` accordingly, and add the missing intra-batch comparison (currently items are checked against sitemap and saved articles but never against each other).

**Fix `lib/plans/keyword-validator.ts`:** remove `autoReplace` entirely (called with `true` at `generator.ts:777`, `strategic-planner.ts:475`, `:708`, and it silently overwrites the article's target keyword with a word-overlap match). Harvested queries are real by construction — validation is now redundant. Keep `expandKeyword()` for the harvest.

---

## Part 5 — Scope, program, and burn-down

New schema (migration `supabase/migrations/20260728_harvest_pool.sql`):

| Table | Columns |
|---|---|
| `query_pool` | `id, brand_id, query, source, source_url, embedding vector(768), covered_by_url, coverage_similarity, status, harvested_at` |
| `audit_clusters` | `id, brand_id, name, priority, article_count, competitor_urls jsonb` |
| `planned_articles` | `id, brand_id, cluster_id, title, main_keyword, supporting_keywords[], status, shipped_at, article_id` |
| `programs` | `id, brand_id, tier, clusters_included[], total_articles, completed_count, started_at` |

Alter `topical_audits`: drop `niche_blueprint`, `projected_score`; add `pool_size`, `article_count`, `cluster_count`, `public_token`.

Audit screen (`components/audit/audit-results.tsx`) changes from a score + projection to:

> **Your niche: 140 articles across 11 clusters**
> *(harvested from 550 real queries — every one sourced)*
>
> At 1 cluster/month → 11 months · 2 → 6 months · **4 → 3 months**
>
> **Recommended program: 6 clusters, 78 articles.** Remaining 5 clusters shown greyed out.

Then a persistent burn-down: `Month 3 of 7 — 34 of 78 closed (44%)`.

**Show articles, never raw query counts.** Remove the `projected_score_after_plan` block at `audit-results.tsx:260-262`.

**Small-niche guard:** if the harvest yields under ~25 articles, the UI says so and offers a one-off instead of a subscription. Turning away niches too small to sustain a retainer is deliberate.

---

## Part 6 — Delivery cadence: cluster batches, not daily drip

`lib/plans/cluster-scheduler.ts:47` currently does `dayOffset++` per article — a daily drip that leaves the internal link graph broken for a month while later articles in a cluster don't exist yet.

Change: **every article in a cluster gets the same scheduled date**; `dayOffset` advances per *cluster*. `trigger/scheduler.ts` (`dailyContentWatchman`, hourly cron with a 1-article/hour "gradual catch-up" at `:178`) becomes a cluster-batch runner — generate all articles in the cluster, freeze the internal link graph across them via `lib/internal-linking.ts`, then publish together.

Credit deduction moves from per-article to per-cluster.

---

## Part 7 — Pricing (data change, not code)

Plans are DB-driven via `dodo_pricing_plans` (`name, price, credits, dodo_product_id, metadata`), so this is new rows plus new Dodo products — no billing code changes.

| Tier | Clusters/mo | ~Articles/mo | Price |
|---|---|---|---|
| Close | 1 | ~12 | $249 |
| Accelerate | 2 | ~24 | $449 |
| Dominate | 4 | ~48 | $799 |

Deactivate the $79 plan (`is_active = false`). Margin stays roughly flat across tiers because COGS scales with articles — confirm against Step 0.

---

## Part 8 — Public shareable audit (new route)

`app/audit/[token]/page.tsx` — public, no auth, read-only. Renders scope, cluster list, the gap table with clickable competitor source URLs, and the velocity projection. One CTA to claim it.

This is the artifact pasted into all 30 outreach DMs, and later becomes the un-gated top-of-funnel that removes the signup wall.

---

## Part 9 — Archive (hide, keep code)

Remove from nav (`components/dashboard/nav-main.tsx`, `app-sidebar.tsx`), routes, and marketing copy. **No deletions, no dropped tables** — reversible if an agency asks:

- `app/(protected)/action-board/`, `app/(protected)/seo-health/`
- `trigger/gsc-sync.ts`, `trigger/seo-health.ts`, `lib/plans/gsc-processor.ts`, `lib/moz.ts`
- Shopify + Webflow: `actions/shopify.ts`, `actions/webflow.ts`, integration cards in `app/(protected)/integrations/page.tsx`. **WordPress stays.**

Landing page (`components/landing/`): drop "GSC Strategic Action Board", "1-Click CMS Publishing → WordPress, Webflow, Shopify" → WordPress only, and replace the "30 Citation-Optimized Authority Articles" line with the scope/velocity model.

Also fix the site's own coverage debt found in GSC: 36 pages "Crawled – currently not indexed" (validation failed), 2 soft 404s, 1 404. The 25 thin `/compare/*` pages driven by `app/compare/data.ts` are the likely cluster — noindex or consolidate them.

---

## Part 10 — Explicitly NOT doing

Multi-site management, white-label, client reporting, onboarding rebuild, AppSumo, Product Hunt, WordPress plugin. **None of these until three people have paid.** They are the classic trap of building for a customer who does not exist yet.

---

## Verification

1. **Provenance test (the critical one).** Run the harvest on `flipaeo.com` and on two unrelated sites (an e-commerce store, a local service business). For a random sample of 20 gap rows, open `source_url` and confirm the query genuinely appears there. **Any gap that cannot be traced to a source is a bug**, not a tuning issue.
2. **Collapse test.** Assert `article_count` is roughly 25–40% of `pool_size`. If it approaches 100%, clustering is broken.
3. **Coverage test.** Run against `flipaeo.com`, whose 30 indexed blog posts are known. Confirm those topics come back `COVERED` and that the previously-hallucinated gaps no longer appear.
4. **Exhaustion test (proves the churn fix).** Run the pipeline repeatedly against a small brand until the pool empties. It must report "niche complete" and refuse to generate — never re-emit a prior article. This is the direct regression test for the deleted `generator.ts:531` branch.
5. **Cadence test.** Trigger one cluster; confirm all articles share a scheduled date, are generated in one batch, and that internal links resolve across all of them at publish time (no links to not-yet-existing articles).
6. **Cost test.** Record actual API spend for one full cluster. Compare against Step 0 and confirm the tier margins.
7. **End-to-end.** Fresh brand → harvest → public audit URL loads for a logged-out visitor with working competitor links → subscribe at a new tier → first cluster ships → burn-down increments.

---

## Sequence

**A. Engine** — Parts 1–4 + schema from Part 5. The only real build.
**B. Product** — Part 5 UI, Part 6 cadence, Part 8 public audit.
**C. Commerce** — Part 7 pricing rows, Part 9 archive + landing page.
**D. Test** — 30 harvests on real agency prospects' client sites, 30 async DMs with the public link, self-serve checkout. **3 paid = continue. 0–2 = list on Acquire.**

Waitlist signups, praise, and free-account requests do not count. Money or nothing.