# FlipAEO Engine Fix — dynamic scope, node folding, drift containment

## Context

Four reported pipeline failures. Measured against a live audit, **they are not
four independent bugs — Step 4 causes Step 1.** The article floor discarded
whole confirmed families, which left too few clusters, which then failed the
fixed six-cluster gate and blocked checkout.

Generalized evidence from one audit (6 confirmed families, 373 queries):

| Family (anonymised) | gap queries | clusters | articles |
|---|---|---|---|
| A | 29 | 1 | 15 |
| B | 28 | 2 | 16 |
| C | 14 | **0** | **0** |
| D | 14 | **0** | **0** |
| E | 27 | 1 | 14 |
| F | **24** | **0** | **0** |

**52 of 156 gap queries (33%) were silently destroyed.** They were not drift —
sampling family F showed high-intent, on-entity commercial queries including the
product's core use case. They died at
`lib/harvest/clusterer.ts:233`, where groups below the floor are filtered into a
`residual` counter and never surface again.

Four clusters then failed `selectQualifiedProgramScope`'s hard six, producing
"Not eligible… No checkout is offered" on an audit that had measured real,
sellable demand.

**Design constraints (founder-set, binding):**

- Domain-agnostic. No niche categories, no per-vertical rules, no tuned constants
  derived from any one test site.
- **The value metric is the graph, not the article count.** $249/cluster buys
  entity mapping, JSON-LD, bidirectional internal linking and CMS deployment.
- **Floor stays 8 nodes** (1 pillar + 7 spokes/targeted FAQs, ≈$31/node).
- Thin domains are **folded, never dropped and never padded**.
- A cluster holds 8–15 nodes; larger domains split into logically distinct
  clusters.

---

## 1. Architectural decisions

### Step 1 — Dynamic scope pricing (Option A), with zero new billing objects

Remove the fixed six. Sell **every qualified cluster the audit finds**.

The key finding: **the three existing velocity products already price per
cluster correctly.** Per-cluster price falls with speed as an ordinary volume
discount:

| Tier | $/period | clusters/period | $/cluster |
|---|---:|---:|---:|
| Close | $249 | 1 | $249.00 |
| Accelerate | $449 | 2 | $224.50 |
| Dominate | $599 | 3 | $199.67 |

So a dynamic count needs **no new Dodo products and no variable-price
subscription**. Only the period count changes:

```
billingPeriods = ceil(qualifiedClusterCount / tier.clustersPerMonth)
programTotal   = billingPeriods × tier.price
```

4 clusters on Close → 4 periods → $996. 9 on Dominate → 3 periods → $1,797.
`cancel_at_next_billing_date` after the final cluster is unchanged, and
`provision_program_from_intent` already iterates `cluster_ids` dynamically —
only the *selection* forces six.

`config/product-truth.ts`'s "cluster counts must divide `programClusters`
exactly" invariant is retired: it existed only because the scope was fixed at 6.
The replacement invariant is that the final period may be partial in *clusters*
but is never partial in *price* — which is why the floor matters.

### Step 2 — Entity-boundary extraction + thin-domain folding (A, reframed)

Option B (immutable parent locking) is already implemented: `audit_scope_families`
are copied immutably per audit and every query/cluster/article carries
`scope_family_id` with same-audit composite FKs. Nothing downstream can rename or
re-cluster a parent. **No change needed.**

Option A as written — replacing capabilities with abstract "problem domains" —
is rejected. Search demand is measurable and traceable; abstract domains are not,
and the product's entire claim is that every gap links to where it was observed.

The real Step 2 defect is **granularity**, not feature-vs-problem: extraction
emits domains at inconsistent depth, so some arrive too thin to sustain a
cluster. Fix at the point of thinness, not by abstracting the taxonomy:

- Extraction keeps returning what the business sells, but is instructed to emit
  **peer-level** domains and to state a `parent_hint` when one domain is a
  sub-intent of another.
- A domain below the node floor is **folded into its nearest parent** (see
  Step 4), never dropped.

### Step 3 — Keep the LLM bouncer (Option B); reject A and C on technical grounds

**Option B already exists** as `classifyQueriesToScope` — a positive
confirmed-family assignment with a bounded, retried, schema-validated call. It
is the correct architecture and stays.

**Option A (seed concatenation) would break harvesting.** Google Autocomplete is
a *prefix-matching* service, not a semantic search. Appending brand context to a
seed (`"database sync" + "for enterprise Postgres teams"`) produces a string
nobody has ever typed, so the endpoint returns **zero** suggestions. Provenance
for autocomplete rows *is* the Suggest request URL, so this would collapse the
harvest rather than focus it.

**Option C (fixed 0.35 cosine gate) has already been disproved on this
codebase.** A prior calibration against hand-labelled positives/negatives found
*no* scoring method separated the populations — that finding is why the two-stage
retrieval+evidence coverage design exists. Reintroducing a single similarity
threshold reintroduces the bug.

The genuine residual leak is **platform-native drift**: queries about a
third-party platform's own feature rather than the customer's product. The
deliverability axis added earlier (`third_party_branded`) already covers named
third parties; it is extended to cover *platform-native capability* intent, which
is the same positive test — "is the job being asked about performed by someone
else's product?"

### Step 4 — Node folding (Option A done safely), never FAQ padding

Option A as "auto-generate FAQ nodes to reach the floor" is rejected: 2026
evidence is that padded, unoriginal content lost ~71% of traffic and is what
`scaled content abuse` targets. Manufacturing nodes to hit a price threshold is
the exact failure mode.

Option B (lower the floor) is rejected by the founder on value grounds: 8 nodes
is what makes the graph — and therefore the $249 — real.

**The synthesis, and the core fix — two passes, not one.**

Folding *every* thin-family query into a sibling's existing articles would bury
genuinely searchable intents inside somebody else's article, where they can
never rank alone, be linked to, or count as a node. That contradicts the value
metric. So the thin family is first triaged, then absorbed:

**Pass 1 — triage inside the thin family.** After collapse, rank its article
units by **demand weight**: how many distinct observed queries merged into each
unit (`sourceQueryIds.length`, already stored).

- A unit backed by **2+ distinct phrasings** has corroborated independent
  demand → **standalone article**.
- A unit backed by exactly **one** query has the weakest evidence of standalone
  demand → **sub-node**, folded into the nearest standalone unit *within its own
  family*.

This is evidential, not a tuned constant: corroboration across independently
observed phrasings is the same standard the rest of the pipeline uses.

**Pass 2 — absorb into the nearest sibling cluster.** The surviving standalone
articles (with their sub-nodes attached) join the semantically nearest
qualifying cluster, which grows — e.g. 8 → 10 nodes. `splitOversized` already
handles a host that would exceed 15.

**Degenerate case:** if *every* unit in a thin family is backed by a single
query, Pass 1 promotes nothing and all of them fold as sub-nodes onto the
nearest article in the nearest sibling cluster. If no cluster qualifies at all,
they surface as measured-but-unsold evidence rather than being deleted.

**A hard database constraint shapes this.** Verified on the live schema:

```
planned_articles_cluster_scope_fkey
  FOREIGN KEY (cluster_id, audit_id, scope_family_id)
  REFERENCES audit_clusters(id, audit_id, scope_family_id)
```

An article's `scope_family_id` **must equal its cluster's**. Cross-family
placement is physically impossible, and that guard is load-bearing — it is what
stops cross-family contamination and it is pinned by a contract test. It must
not be weakened.

Resolution: an absorbed article **adopts the host cluster's `scope_family_id`**
(satisfying the FK and keeping "one cluster = one family" true), while a new
nullable `origin_scope_family_id` records the domain the demand actually came
from. Provenance is preserved, the invariant is untouched, and the audit UI can
honestly show "absorbed from *Domain F*".

Above the ceiling, existing `splitOversized` already divides 25 queries into
balanced 8–15 clusters — that requirement is met today.

### Why this is domain-agnostic

Every rule is expressed over *measured structure*, never over vocabulary:

- Cluster count is whatever the audit measures — 2, 4, 7, or 12.
- Qualification is node count and graph shape, identical for DevTools, Fintech,
  CRM or e-commerce.
- Folding is driven by embedding adjacency between a thin domain and its
  nearest parent, with no category list.
- Relevance is positive membership in a **customer-confirmed** family — the
  customer supplies the taxonomy, so the engine never needs to know the vertical.
- No constant in this plan is derived from any single test site.

---

## 2. Refactored pipeline flowchart

```
URL + optional competitors + founder target searches
        │
        ▼
Tavily crawl  ──► ranked corpus (product/pricing pages first)
        │
        ├──► brand persona call        (voice, audience, pricing facts)
        └──► scope extraction call     (peer-level domains + parent_hint)
        │
        ▼
FOUNDER CONFIRMS SCOPE  ◄── founder searches always become a domain
        │                    (authoritative; never silently merged away)
        ▼
audit_scope_families frozen immutably per audit  ── parent IDs locked
        │
        ▼
HARVEST  autocomplete · SERP questions · competitor corpus
        │   (bare seeds — never concatenated; provenance = request URL)
        ▼
DEMAND VALIDATION  (is this actually searched?)
        │
        ▼
SCOPE + DELIVERABILITY CLASSIFIER   ← the bouncer
        │   direct | adjacent | unrelated
        │        | third_party_branded | platform_native | publisher_specific
        ▼
COVERAGE  (two-stage: semantic retrieval → lexical evidence)
        │
        ▼
GAPS per family
        │
        ▼
COLLAPSE to article units (per family, ARTICLE_MERGE)
        │
        ├── family ≥ floor ──► cluster(s), split to 8–15 nodes
        │
        └── family < floor ──► TWO-PASS ABSORPTION (never dropped, never padded)
              │
              ├─ Pass 1  triage by demand weight, inside the family
              │     unit backed by 2+ observed queries ──► STANDALONE ARTICLE
              │     unit backed by exactly 1 query     ──► SUB-NODE (H2/FAQ)
              │     sub-nodes fold into the nearest standalone unit
              │     of the SAME family
              │
              └─ Pass 2  standalone articles (carrying their sub-nodes) join
                    the nearest qualifying sibling cluster
                    → host grows 8 → 10; splitOversized handles >15
                    → article adopts host scope_family_id (FK requires it)
                    → origin_scope_family_id keeps the true provenance

                    degenerate: nothing promoted → all fold as sub-nodes
                    no cluster qualifies → surfaced as unsold evidence
        │
        ▼
QUALIFIED CLUSTERS = N   (dynamic: 1 .. many)
        │
        ▼
CHECKOUT   price = ceil(N / clustersPerMonth) × tierPrice
        │
        ▼
PURCHASE INTENT freezes N clusters + URLs + link graph
        │
        ▼
provision_program_from_intent  (already N-agnostic)
```

---

## 3. Prompt & code-level specifications

### 3a. Domain-agnostic taxonomy extraction

Modifies the existing prompt in `lib/scope-extraction.ts` — additive, keeping
the current evidence-quote requirement and founder-search authority.

```
Identify every distinct capability this business sells, at PEER level.

A domain is a job a customer would buy or use on its own. Name it as its
customers would name it when searching, not as an engineer would describe the
mechanism.

PEER-LEVEL RULE (critical):
Emit domains at consistent depth. If one candidate is a specific case of
another, do NOT emit it as a peer — emit the broader one and set
`parent_hint` on the narrower.
  - Broad + narrow of the same job  -> one domain
  - Two genuinely different jobs    -> two domains
Do not split a single job into marketing sub-features, and do not merge two
different jobs because the founder listed fewer searches than they sell.

For each domain return:
  name          2-100 chars, customer-facing
  description   one concrete sentence naming the customer job
  parent_hint   name of the broader domain this is a sub-intent of, else null
  seed_keywords 1-8 phrases a stranger would type; no brand names
  evidence      1-3 EXACT sentences copied from the PAGES + that page's URL
```

### 3b. Bouncer — extended deliverability axis

Extends the existing `classifyQueriesToScope` decision enum. `{FAMILIES}` and
`{COMPETITOR_DOMAINS}` are injected per audit; nothing is hardcoded.

```
Classify each observed search against the customer's CONFIRMED domains.

  direct              belongs to exactly one confirmed domain AND we could
                      write it for THIS business
  adjacent            shares vocabulary but is a different product/job
  unrelated           concerns no confirmed domain
  third_party_branded centres on a named company/product that is not this
                      business
  platform_native     asks how to do the job inside someone else's platform's
                      built-in feature, rather than with a product like this
                      one. The job may be identical and still belong here —
                      what disqualifies it is that the asker wants to do it
                      somewhere we do not operate.
  publisher_specific  answerable only from the publishing company's private
                      operational facts

Deliverability outranks relevance. Only `direct` enters the program.
```

### 3c. Dynamic pricing (replaces the divides-6 invariant)

```ts
// config/product-truth.ts — programClusters is no longer a fixed scope size.
export function programPricing(clusterCount: number, tier: ProductTier) {
    const { price, clustersPerMonth } = PRODUCT_TRUTH.tiers[tier]
    const billingPeriods = Math.ceil(clusterCount / clustersPerMonth)
    return {
        billingPeriods,
        total: billingPeriods * price,
        perCluster: (billingPeriods * price) / clusterCount,
    }
}
```

`selectQualifiedProgramScope` (`lib/harvest/program-contract.ts`): delete the
`recommendedClusterCount` cap at :77/:83 and the `< 6` rejection at :97. Keep
portfolio round-robin ordering — with no cap it simply orders *all* qualified
clusters fairly across families. Eligibility becomes:

```ts
eligible = !requiresReaudit && selected.length >= 1
```

### 3d. Thin-domain folding (replaces the silent drop)

`lib/harvest/clusterer.ts:233` currently discards undersized groups. Replace the
filter with a fold that returns them for reassignment:

```ts
const qualified = sized.filter(g => g.length >= TARGET_CLUSTER_MIN)
const thin      = sized.filter(g => g.length <  TARGET_CLUSTER_MIN)

/** Corroborated by 2+ independently observed phrasings = real standalone demand. */
const STANDALONE_MIN_BACKING_QUERIES = 2

for (const group of thin) {
    // Pass 1 — triage inside the thin family.
    const standalone = group.filter(
        u => u.sourceQueryIds.length >= STANDALONE_MIN_BACKING_QUERIES,
    )
    const subNodes = group.filter(
        u => u.sourceQueryIds.length < STANDALONE_MIN_BACKING_QUERIES,
    )

    if (standalone.length === 0) {
        // Degenerate: nothing corroborated. Fold everything onto the nearest
        // article in the nearest qualifying cluster.
        for (const unit of subNodes) attachSubNode(nearestArticleAcross(qualified, unit), unit)
        continue
    }

    // Sub-nodes stay with their own family's articles, not a stranger's.
    for (const unit of subNodes) {
        attachSubNode(nearestArticleAmong(standalone, unit), unit)
    }

    // Pass 2 — absorb the promoted articles into the nearest sibling cluster.
    const host = nearestClusterTo(qualified, centroidOf(standalone))
    if (!host) continue          // nothing qualifies → surfaced as unsold evidence
    for (const unit of standalone) {
        host.articles.push({
            ...unit,
            originScopeFamilyId: unit.scopeFamilyId,  // where the demand came from
            scopeFamilyId: host.scopeFamilyId,        // FK requires host's family
        })
    }
}

// A host pushed past the ceiling is split by the existing helper.
const finalClusters = qualified.flatMap(splitOversized)
```

All four helpers are thin wrappers over the existing `cosineSimilarity`.

Persistence — one additive migration:

- `planned_articles.sub_node_intents TEXT[] DEFAULT '{}'`
- `planned_articles.sub_node_query_ids UUID[] DEFAULT '{}'`
- `planned_articles.origin_scope_family_id UUID NULL`

`finalize_audit_run` writes all three alongside `source_query_ids`, and its
family-ownership validation must compare against `scope_family_id` (the host),
**not** `origin_scope_family_id` — otherwise absorbed articles fail their own
validation. `ship-cluster.ts` forwards the sub-nodes, and the outline prompt
gains a **required FAQ/H2 section** block beside the existing
`MEASURED SEARCH DEMAND` block, reusing the pattern already built.

---

## 4. UI & checkout integration

`components/audit/scope-results.tsx` and `app/(protected)/subscribe/page.tsx`:

- Replace every "six-cluster program" string with the measured count. Copy
  becomes `Your program: {N} clusters · {M} articles`.
- Delete the `!checkoutEligible` ineligibility banner's six-cluster branch. The
  only remaining ineligible states are: legacy audit needing re-audit, stale
  audit past the 30-day window, and **zero** qualified clusters.
- The velocity table becomes a live quote driven by `programPricing(N, tier)`:

```
4 clusters found
  Close       1/period × 4 periods = $996     ($249.00/cluster)
  Accelerate  2/period × 2 periods = $898     ($224.50/cluster)
  Dominate    3/period × 2 periods = $1,198   ($199.67/cluster)
```

- Show folded sub-nodes on their host article so the customer sees the thin
  domain's demand was absorbed, not lost.
- `hasActiveProgram` handling stays exactly as fixed previously — a purchased
  audit must never render as ineligible.
- `app/llms.txt/route.ts` and any public copy stating "six clusters" become
  count-agnostic.

---

## Files to modify

| File | Change |
|---|---|
| `lib/harvest/program-contract.ts` | Remove the six cap and the `<6` rejection; eligibility = ≥1 qualified |
| `lib/harvest/clusterer.ts` | Replace the undersized-group filter with two-pass triage + absorption |
| `lib/harvest/assembly.ts` | Carry sub-nodes and `originScopeFamilyId` through; stop warning-and-discarding thin families |
| `lib/scope-extraction.ts` | Peer-level rule + `parent_hint` |
| `lib/harvest/scope-classifier.ts` | Add `platform_native` decision |
| `config/product-truth.ts` | `programPricing()`; retire the divides-6 invariant |
| `supabase/migrations/` | New migration: `sub_node_intents`, `sub_node_query_ids`, `origin_scope_family_id`; `finalize_audit_run` validates against the host family, never the origin |
| `trigger/ship-cluster.ts`, `trigger/generate-blog.ts` | Forward and render sub-node FAQ requirements |
| `components/audit/scope-results.tsx`, `app/(protected)/subscribe/page.tsx` | Dynamic counts and live quote |

Reuse, do not rebuild: `cosineSimilarity` and `splitOversized`
(`lib/harvest/clusterer.ts`), `roundRobinCap` (`lib/harvest/scope-cap.ts`),
`findThirdPartyBrand` (`lib/harvest/types.ts`), the existing three Dodo velocity
products, and `provision_program_from_intent` (already N-agnostic).

---

## Verification

1. `npm run test:pivot-contract` — extend with:
   - no cluster count is rejected for being ≠ 6;
   - **conservation**: every gap query entering clustering leaves as either an
     article's `sourceQueryIds` or a `sub_node_query_ids` entry — total in ==
     total out, so nothing can be silently discarded again;
   - a thin domain with 2+ corroborated units promotes them to standalone
     articles rather than burying them as sub-nodes;
   - an absorbed article's `scope_family_id` equals its host cluster's, and
     `origin_scope_family_id` still records the true source;
   - `programPricing` per-cluster price falls monotonically with velocity at
     several counts (3, 4, 7, 11);
   - `platform_native` exists as a reject reason.
2. **Replay the failing audit's shape** via `POST /api/harvest/verify` and
   confirm total gap queries in ≥ (articles + sub-nodes) out — i.e. the 33%
   destruction rate becomes 0.
3. `/api/writer/dry-run` on an article that received folded sub-nodes — confirm
   the required FAQ/H2 block reaches the outline prompt.
4. Onboard two structurally different sites (one narrow, one broad) and confirm
   both reach checkout with different cluster counts and correct quotes.
5. Dodo sandbox checkout at a non-6 count; verify period count and that
   cancellation still lands on a whole period.
6. `npx tsc --noEmit` clean on touched paths.

---

## Deliberately out of scope here

Two onboarding defects raised earlier remain open and are **not** fixed by this
plan; they need their own pass:

- **~84s brand analysis with no progress feedback**, and unsaved state lost on
  refresh. The Tavily crawl (`limit: 20`, `extractDepth: "advanced"`, plus
  LLM-guided `instructions`) is the dominant cost in both time and credits.
- **Pricing extraction returns a pricing *model*, not prices.** The persona
  prompt literally asks for "High-level model (Subscription, One-time, Free
  tier)", so it is behaving as written while the writer needs real plan names
  and amounts for comparison tables.