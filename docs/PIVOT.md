# FlipAEO Closed-Pool Pivot

> This is the authoritative implementation handoff. Read it before changing the
> audit, purchase, delivery, billing, publication, or prospect-audit paths.
> Update this document whenever the product contract or release status changes.

Branch: `pivot/closed-pool-harvest`

Start here if you are the founder: [`HOW_IT_WORKS.md`](HOW_IT_WORKS.md) for a
plain-language explanation, then [`SOLO_LAUNCH_GATE.md`](SOLO_LAUNCH_GATE.md)
for what to do next.

Last implementation update: 2026-08-15

Status: **AI-visibility probing added as a second, parallel gap source** (§8),
measuring the **real consumer surfaces** — ChatGPT and Google AI Mode via Cloro,
not the provider APIs. Buyer prompts built from the confirmed families are asked
of those surfaces; absence from an answer becomes a `GapItem` and feeds the
existing clusterer unchanged. Runs on Trigger.dev. Ships with a dashboard whose
every claim expands to the verbatim answer behind it. Nothing in the Google
harvest path was altered — the two sources coexist and neither is yet the
default. **Not run against a live audit**: no `CLORO_API_KEY` exists in this
repo, so this is code-complete and entirely unmeasured.

Previously: **scope finder no longer times out into a blank keyword form.** Thin SPA
crawls fall back to unpaid HTML snapshots (meta/JSON-LD/body) then titles;
extraction is a small families-only Gemini call with a 90s timeout and lexical
seed filter; grounding slices overflow instead of wiping; last resort is one
family from the confirmed brand card. Domain-agnostic writer contracts, crawl
checkpoint, and scope role refinement remain. Checkout remains disabled pending
the staging and external release gate

## 0. 2026-08-04 (second pass) writer completion gate

### Failure that triggered this work

The first repair (§0.1) shipped output-token ceilings small enough to starve the
model, and the pipeline had no way to notice. One article was written to the
database as `completed` at **176 words against a 1,600–2,200 word contract** —
11% of its minimum — with `current_step_index: 4`, meaning the system believed
all four sections had succeeded.

Two independently generated articles from the two preceding commits were
reviewed alongside it. Both were the same shape of failure: fabricated
first-party mechanics (architecture names, accuracy percentages, DPI, ray
tracing, storage media), category research restated as verified product
capability, and — in the 176-word case — one severed paragraph with headings
wedged between the fragments.

### Root causes and implemented repairs

1. **Gemini output was starved by unsafe token limits.** The intro was capped at
   `700` output tokens and each section at `word_budget × 1.8` — 765 tokens for a
   425-word section. `gemini-3-flash-preview` reasons by default and thinking
   tokens are billed against `maxOutputTokens`, so most of that ceiling was spent
   before a word of prose was emitted. Thinking is now set explicitly
   (`thinkingLevel: "LOW"`, with a graceful retry if the model rejects the
   field), and the ceiling is `wordBudget × 5 + 3,000` reserve, capped at 16k.

2. **Truncated responses were accepted as finished work.** The stream was
   consumed for `.text` alone, so a response that stopped at `MAX_TOKENS` was
   indistinguishable from one that finished. `callWriterModel` now preserves
   `finishReason`, and `lib/writer/draft-quality.ts` adds evidential completion
   tests — unterminated sentence, unbalanced emphasis, dangling heading, dangling
   table, empty — for the streamed responses where the provider omits it. Every
   writing call goes through `writeContractProse`, which retries up to three
   times with a doubling ceiling and a correction naming the actual word count.

3. **Most outline sections could receive empty evidence packets.** Each intent
   was assigned to exactly one section and every surplus section kept
   `intent_ids: []`, cascading into no capability facts and no research. Combined
   with a writer prompt that deliberately ignored `instruction_note`, those
   sections were handed a heading, a purpose label and the tail of the previous
   paragraph — so "continue the previous sentence" was the only executable
   instruction left, which is exactly what the model did. Now: intent ownership
   stays exclusive, surplus sections receive `supporting_intent_ids` granting
   read access to that intent's evidence, research evidence falls back to sharing
   rather than leaving a section blind, the intro carries the primary intent's
   facts (it previously carried none while being asked for the direct answer),
   and `instruction_note` is restored as the load-bearing per-section brief.

4. **External evidence still became first-party product claims.** A competitor's
   selection criteria were rewritten as "we ensure shadows align perfectly". Per
   the standing rule against regex blocklists, this is enforced as an evidential
   test: candidate sentences (first-person or entity-naming) are extracted
   deterministically, a model judges each one for entailment against that
   section's capability facts, the section is rewritten once naming the offending
   sentences, and anything still unbacked is deleted sentence-by-sentence.

5. **A required citation meant "try once, then silently ignore".** The link
   retry kept the uncited draft on failure. It now retries twice, re-checks after
   sentence deletion (a removed sentence can take the citation with it), and
   records a blocking defect if the citation never lands.

6. **Commercial intent produced an advertisement.** A "best AI app to…" keyword
   yielded an outline with `is_comparison: false` and no evaluated alternatives.
   The contract outline prompt now requires at least one comparison section with
   criteria drawn from supplied research whenever `articleType` is commercial.

7. **Section count was untethered from target length.** The outline prompt said
   "no minimum section quota" while the section budget is the target divided by
   the section count, so a thin outline gave each section an unwritable budget.
   The prompt now states the workable section range for the contract length.

### The gate itself

`articleQualityVerdict` runs before the completed write. It blocks on: total
prose below the contract floor (short 1,080 / medium 1,440 / long 2,160 — the
published minimum less 10%), any section still truncated after its retries, and
any required citation that never landed. A blocked article throws, which the
existing handler turns into `status: "failed"` with the reason recorded — no
migration required. Deleted fabrications are deliberately non-blocking on their
own; if enough is removed to drop the article under the word floor, the floor
fails it.

## 0.1 2026-08-04 writer repair handoff (first pass)

### Failure that triggered this work

A short BringBack article about adding pets to a digital family portrait drifted
into physical photography: cameras, shutter speeds, parks, permits and an
invented photographer persona. A later article retained some improvement but
still ran past the frozen short contract, mixed unsupported product details
with category research, and used research-derived prose as if it were verified
brand truth. BringBack was only the regression fixture; every change below is
domain-agnostic and applies equally to developer tools, fintech, ecommerce
infrastructure, agencies and consumer software.

### Root causes and implemented repairs

1. **The correct capability page was absent from brand DNA.** The eight-page
   Tavily crawl could spend its budget on one arbitrary branch. Brand analysis
   now discovers sitemap URLs, deterministically selects at most eight
   representative first-party pages, and extracts them in one basic Tavily
   batch. Homepage and pricing lead; founder seed overlap and direct
   product/feature/tool/service/solution/docs/use-case pages outrank comparison
   pages; blog/legal/auth noise is excluded; catalogue route families contribute
   at most two pages. If fewer than three usable pages are extracted, one bounded
   basic crawl is merged in. There is no recursive or advanced-depth loop. Both
   persona and scope extraction read the same corpus, and onboarding review
   remains the correction point.

2. **Research could reopen the article's scope.** The old chain was broad search
   -> LLM critic -> model-invented sniper queries -> synthesis. The active
   contract path now performs one advanced search using the frozen
   `researchQuery`, plus zero to two basic searches copied exactly from distinct
   required intent queries. One synthesis call selects at most twelve exact
   quotes. Each quote is normalized and verified as a substring of the fetched
   source before it survives. Evidence retains URL, source title, supported
   intent IDs, evidence kind and whether the source is a known competitor.
   Competitor claims remain attributed; they are never rewritten as generic
   industry truth. This removes one model call and bounds Tavily at 1-3 searches
   per article.

3. **Free-form outline notes controlled the section writer.** Program outlines
   now carry `intent_ids`, `capability_fact_ids`,
   `research_evidence_ids` and a deterministic word budget. After the outline
   call, code makes every frozen intent belong to exactly one section and derives
   that section's first-party and external evidence from the ownership itself.
   Invalid references and invented URLs are removed without another model call.
   The writer receives only this compact section packet, previous headings and
   the last 500 characters of prose for continuity. It does not receive the full
   research dump or free-form founder instructions on the paid program path.
   **Superseded by §0 item 3:** the packet withheld `instruction_note` as well,
   which left surplus sections with no instruction at all. It is now included.

4. **Prompts manufactured authority.** The active contract prompt no longer
   asks for rankings/citations, fake testing, teams, customers, physical work,
   measurements, UI paths, timing, history, mandatory tables, hierarchy quotas,
   competitor laundering or forced brand mentions. It writes as an informed
   brand editor: product claims require supplied capability facts; external
   specifics require supplied quote evidence and citations; the frozen entity
   and delivery mode may not change.

5. **Length and images were advisory.** A supplied article contract now controls
   length even in the founder single-article test, where `plannedArticleId` is
   intentionally absent. Planning targets are 1,500 / 1,900 / 2,800 words for
   the existing short / medium / long ranges. Maxima are 5 / 7 / 10. Each
   section gets a word budget and bounded output tokens. **Superseded by §0
   items 1 and 7:** those output-token bounds were far too small for a thinking
   model, and "no minimum section quota" left the per-section budget unwritable.
   In-content image caps are 0 / 1 / 2 respectively; prompts use only
   the section evidence packet, and Markdown is normalized around injected
   images. Featured-image behaviour is unchanged.

6. **Program articles repeated legacy work.** Paid planned articles skip the
   old embedding link enrichment, topic-memory save and post-write coverage
   analysis. Their audit and frozen graph already own those decisions. Legacy
   and manual articles retain those paths for compatibility. There is still no
   post-generation semantic judge over the whole article; §0 item 4 added a
   bounded **per-section** entailment check for first-party claims only.

### Compatibility and release behaviour

- `capability-v1` and `article-contract-v1` remain unchanged; no SQL migration
  was needed for this repair. The evidence/outline shapes live in the existing
  article JSON fields.
- Harvest policy is now `evidence-bound-writer-v5.0.0`. Old completed audits
  remain viewable, and active programs remain pinned and untouched, but a new
  purchase intent requires the current policy version and therefore a fresh
  audit.
- The founder dry-run explains the new bounded research path and displays the
  frozen word range. The real founder generation path now respects the contract
  length without mutating program state.
- Contract verification on 2026-08-04 (second pass): 68/68 pivot tests pass and
  TypeScript is clean on every touched path. `npm build` was deliberately
  skipped per the founder's standing instruction. **No article has yet been
  generated end-to-end against the repaired writer** — that run is the next
  action and the only thing that can confirm the gate holds in production.

## 1. Locked product contract

FlipAEO now has one finite contract:

> **Immutable evidence audit -> six qualified priority clusters -> frozen URLs
> and internal-link graph -> cluster-level generation and delivery -> optional
> publication -> automatic cancellation at the end of the paid scope.**

Locked decisions:

- Every audit is a new immutable run.
- Before research, the customer confirms distinct business/product families,
  their direct search directions, priorities, and the exact site evidence used
  to extract them.
- Every query, cluster, and planned article belongs to exactly one confirmed
  family frozen into that audit. Relevance is positive ownership, not a growing
  blacklist of words learned from previous failures.
- A program contains six portfolio-balanced unsold qualified clusters: take
  one priority cluster from each represented confirmed business family before
  taking additional depth from any family.
- A qualified cluster has 8-15 unique articles.
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

### 2.0.2 Why the confirmed-business-scope SQL is substantial

`supabase/migrations/20260731_confirmed_business_scope.sql` is the database half
of the fix for the BringBack audit that produced technically valid but
commercially absurd clusters. The bug was not one bad keyword. The old model
flattened a multi-product business into one blended topic, then asked whether
each query was merely near that blend. A generic phrase could therefore
authorize an unrelated content universe while provenance, demand, cluster
size, and collapse checks all passed.

The migration enforces the replacement contract at every relational boundary:

| Area | What it changes | Why |
|---|---|---|
| Mutable brand scope | Adds `brand_scope_families`, an atomic confirmation RPC, an atomic onboarding create/update wrapper, and a semantic scope hash | Website, competitors, brand profile, and confirmed scope either save together or all roll back; there is no half-configured brand after a constraint or network-facing action fails. |
| Immutable audit scope | Adds `audit_scope_families` and atomically copies confirmed scope when a customer/prospect audit is created | A later settings edit must never rewrite a completed audit or active program. |
| Row ownership | Makes `scope_family_id` mandatory on `query_pool`, `audit_clusters`, and `planned_articles`, with same-audit composite foreign keys | The database rejects cross-family/cross-audit relationships even during retries, future callers, or manual operations. |
| Legacy preservation | Backfills old audits under `Legacy unverified scope` and marks unpurchased pre-scope audits for re-audit | History remains visible without pretending the old flat plan was scope-verified. |
| Atomic finalization | Replaces `finalize_audit_run` and validates query → cluster → article family ownership plus source-query ownership | Any mismatch rolls the entire run back instead of exposing a partial plan. |
| Prospect creation/claim | Creates audit, claim, and scope snapshot together; claim transfers scope as well as evidence/articles | A claimed report becomes the claimant’s actual current brand contract instead of an orphan. |
| Deployment preflight | Extends `assert_harvest_schema_ready` for scope columns, tables, atomic creation, and pgvector resolution | Schema drift fails before external research calls spend money. |

The corresponding application behavior is:

- Onboarding collects website, optional competitors, and up to 12
  founder-provided direct searches.
- Brand analysis extracts distinct commercial families and must cite an exact
  quote from an exact crawled page. Unverifiable extracted families are removed.
- The customer can confirm, rename, remove, add, and reprioritize family cards.
  No research starts until every founder search belongs to a family.
- Production and `/api/harvest/verify` call the same positive classifier. A
  query enters only when it directly belongs to exactly one confirmed family.
  There is no generic-word, industry-word, or language-word blacklist.
- Pre-classification is bounded at 600 rows and final coverage at 400; both caps
  round-robin across family and evidence source. Search-page seeds also take one
  from each family before taking a second from any family.
- Customer-confirmed families, searches, and competitors are rejected with a
  visible validation error when they exceed policy; they are never truncated
  with `slice()`. Machine-harvested rows alone are fairly capped.
- Collapse, clustering, and duplicate validation happen inside each family.
- Program selection takes one qualified cluster per represented family before
  taking additional depth from any family.

The old `lib/harvest/pool.ts`, blended-centroid `niche-filter.ts`, heuristic
`language-filter.ts`, and semantic query word lists were deleted. Do not restore
them as a fallback.

Scope extraction itself lives in `lib/scope-extraction.ts` as a dedicated call —
never as a field on the brand-persona prompt. Failing quote verification marks a
family unverified for founder review; it must never delete one. See the
2026-07-30 scope-extraction changelog entry.

### 2.0.3 Domain-agnostic writer repair (2026-08-01)

#### Failure that forced this change

A real planned BringBack article for the query â€œCan I include pets in my family
portrait?â€ had clean headings and extractable formatting, but most of the body
became a physical-photography tutorial: cameras, lenses, shutter speed, leads,
parks and permits. BringBack is browser software for restoration, animation and
digital compositing. The article also invented product functions, processing
times, output resolution, a physical team and first-hand testing.

This was **not a BringBack wording bug**. The same failure could occur for a
developer tool, fintech product, e-commerce platform, agency or any other tenant:

1. Brand analysis saved broad prose, not a verified input/action/output contract.
2. Harvest rows preserved the question but discarded the source answer context.
3. Semantic collapse could merge similar language across different operations.
4. The writer re-opened the topic through broad research, then saw too much brand
   and competitor context with no hard distinction between first-party and
   category evidence.
5. Prompt instructions explicitly encouraged invented founder/team experience.

The repaired pipeline is:

> **Verified business mechanics -> query intent binding -> frozen article
> contract -> contract-bound research -> focused outline -> evidence-bound
> section writing.**

#### Capability contracts

The existing scope-extraction call now also returns `capability-v1` for every
confirmed family. It contains delivery mode, operations, inputs, action, outputs,
limits and exact evidence references. It is not another model call. The existing
scope-review card has an expandable â€œHow we understand this worksâ€ editor, so a
founder can correct mechanics without another onboarding page. A correction is
stored as founder-confirmed evidence; extracted claims still have to match copied
site text.

Fact IDs are namespaced by scope-family ID. This is essential: every extracted
family naturally starts with names such as `fact1`; without namespacing, an
absorbed intent from another family could resolve `fact1` to the wrong product
claim.

`query_pool.intent_binding` records one family, operation, capability fit
(`explicit`, `mechanically_entailed`, or `educational`) and solution mode
(`product_led` or `category_educational`). Mechanics-bound inference may
generalize only when verified inputs + action + output entail the variant. It
never generalizes performance, quality, compatibility, timing, staff or results.
There is no industry keyword blacklist.

#### Article contracts and collapse

Assembly deterministically creates `article-contract-v1`; no new reasoning call
was added. The contract freezes entity/delivery mode, primary and absorbed
intents, source URL/context, operation and fit, allowed capability fact IDs,
research query and length. Contracts participate in the immutable result hash.

Collapse now requires compatible operation, solution mode and article intent.
Absorbed subnodes keep their original query bindings and fact IDs instead of
inheriting every fact from their host cluster. The existing batched title call
receives the original query, source context, delivery mode, operation and
solution mode, and may improve wording without changing modality.

Program article lengths are intent-sized:

| Class | Range | Selection |
|---|---:|---|
| Short | 1,200â€“1,800 | Narrow informational intent with no absorbed subnode |
| Medium | 1,600â€“2,200 | How-to, commercial, or one absorbed intent |
| Long | 2,400â€“3,200 | Pillar or two-plus absorbed intents |

Program generation never selects `very_long` or `extra_long`. The customer-facing
fixed-length setting was removed; founder/manual test payloads retain an override.
Section/H2 requirements are ranges, and planned articles can use a smaller
intent-sized minimum instead of manufacturing sections to satisfy a quota.

#### Research and writing behavior

Broad research uses the frozen query + delivery mode + operation. It no longer
automatically appends pricing, Reddit, reviews or comparison modifiers. The
LLM critic and its model-invented sniper queries are retired from the active
program path. Zero to two additional searches come directly from distinct
frozen required intents. Synthesis keeps at most 12 exact source quotes and
three limitations; every quote is verified against fetched source text. The
separate Angle Architect call is not run for program articles, so provider cost
is lower.

Outline sections now declare `intent_ids`, `capability_fact_ids`,
`research_evidence_ids`, a section purpose and a word budget. Each section
writer receives only the deterministic evidence packet for its owned intents:

- capability facts may support first-party product statements;
- research facts may support category statements and retain attribution;
- research can never be rewritten as proof of customer product behavior;
- educational articles cannot pretend the customer product directly solves the
  query;
- first-person plural is allowed only for supplied first-party facts.

The fabricated-experience instructions (founder persona, â€œour teamâ€, â€œafter
testingâ€, subjective tool opinions) were removed. The useful answer-first,
short-paragraph, active-voice, definitions, lists/tables, citation, frozen-link,
regional-spelling and anti-fluff rules remain.

There is deliberately **no post-generation semantic judge over the whole
article**. Drift is prevented before generation by constraining the decisions,
research and evidence each downstream stage receives. The one exception, added
2026-08-04 (§0 item 4), is a bounded per-section entailment check: only sentences
that make a first-party claim are judged, and only against that section's own
capability facts. Constraining inputs did not stop external research being
rewritten as verified product truth, and a regex blocklist is ruled out by the
standing rule in `CLAUDE.md`.

#### Persistence and migration

`supabase/migrations/20260807_writer_intent_contracts.sql` adds:

- `brand_scope_families.capability_contract`
- `audit_scope_families.capability_contract`
- `query_pool.source_context` and `intent_binding`
- `planned_articles.article_contract` and `contract_version`

Why this SQL is substantial: these values are part of an immutable paid scope,
so saving them through later independent HTTP updates would create a partial-run
window. The migration copies contracts through every customer and prospect
snapshot path, validates recognized JSON versions, and guards completed rows
against later contract edits. The finalizer is defined explicitly with the later
subnode, origin-family and parent-rollup ownership behavior included.

The mutable brand-scope copy is synchronized at database table boundaries. A
`BEFORE INSERT` trigger hydrates a missing contract from the exact confirmed
`brand_data.scope_families` payload; an `AFTER UPDATE OF brand_data` trigger
synchronizes rows after onboarding replaces that payload; and an idempotent
backfill repairs existing split-brain rows. The audit endpoint performs the same
non-generative reconciliation from the confirmed payload as a deployment-safety
fallback. This is deliberate: an earlier migration used textual replacement on
`pg_get_functiondef(confirm_brand_scope)`. It added the validation clause but,
on one valid production function format, failed to add the contract to the
INSERT. Its check merely found the word `capability_contract` in the validation
clause and reported success. Never restore function-text patching here.

Production databases that already applied `20260807` receive the trigger and
backfill through `20260808_repair_scope_capability_sync.sql`; clean databases get
the safe definitions in `20260807` and harmlessly replace them again in
`20260808`. The affected BringBack production brand was repaired from its own
confirmed snapshot: 7 scope rows now contain `capability-v1`, 0 remain missing.

Historical source context is honestly backfilled from `observed_value`. No old
capability or article contract is fabricated. Historical articles remain
viewable and generated/delivered work is untouched, but old audits are marked
`requires_reaudit` and checkout/server generation reject them.

Founder dry-run output now shows entity/delivery mode, primary and required
intents, source context, intent bindings, allowed first-party facts, research
query, selected length and the real outline prompt. `ship-cluster` also refuses
an audit that lacks `article-contract-v1` before consuming a paid allowance.

Verification on this implementation:

- final `npx tsc --noEmit`: passed;
- all 61 groups in `tests/pivot-contract.test.mjs` pass, including writer
  contracts, persistence, modality, research-call and five-industry fixtures;
- the local user edit in `components/audit/audit-console.tsx` was deliberately
  preserved; its test now checks retry behavior rather than requiring deleted UI
  copy;
- `npm build` and repeated lint were intentionally not run.

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
- 8-15 articles in every selected cluster.
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
  The profile step confirms name / what-it-is / category, then optionally
  expands the full brand-DNA editor before scope and audit — Settings is not
  the first place to correct extracted voice, audience, or features. After
  grounding, scope role refinement classifies each area/seed as an acquisition
  job vs delivery/workflow mechanism and folds mechanisms into their parent
  job so harvest never searches packaging/export/handoff markets.
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
5. Apply `supabase/migrations/20260730_fix_finalize_vector_search_path.sql`.
6. Apply `supabase/migrations/20260730_retire_free_signup_credits.sql`.
7. Apply `supabase/migrations/20260731_confirmed_business_scope.sql` **last**.
   It owns the final scope-aware `finalize_audit_run` and
   `assert_harvest_schema_ready` definitions. Do not deploy the application
   changes before this succeeds.
8. Apply `supabase/migrations/20260801_discard_unpurchased_audit.sql`. Adds the
   `discard_unpurchased_audit(uuid)` operation; safe to skip only if no audit
   ever needs discarding, which is not a bet worth making.
9. Apply `supabase/migrations/20260802_purge_brand.sql` (founder escape
   hatch; safe to apply any time).
10. Deploy application and Trigger.dev source with
   `CLOSED_POOL_CHECKOUT_ENABLED=false`.
11. Confirm `program-lifecycle` is healthy.
12. Only then archive these Trigger.dev schedules:
   - `daily-content-watchman`
   - `seo-health-auto-refresh`
   - `sitemap-sync-scheduler`
   - `gsc-daily-auto-refresh`
   - `ship-cluster`
13. Run and record every gate in `docs/CLOSED_POOL_RELEASE_GATE.md`.
14. Enable checkout only on the exact commit that passed all gates.

Required server environment:

```text
CLOSED_POOL_CHECKOUT_ENABLED=false
FOUNDER_USER_IDS=<comma-separated Supabase user UUIDs>
FOUNDER_ALERT_EMAIL=<founder operations email>
PROGRAM_COST_RATES_JSON=<real provider rates; no placeholder zeroes>
```

## 4. Current verification record

Local verification completed on 2026-07-30:

- `npm run test:pivot-contract`: **52/52 test groups passed**.
- `tsc --noEmit --pretty false`: **passed**.
- `npm run build`: **not rerun for this scope change, per founder instruction**.
- Public checkout remains disabled by default in code.

The contract suite is `tests/pivot-contract.test.mjs`. It covers:

- URL-pattern and deterministic graph invariants.
- Six-cluster selection and stale-audit rejection.
- Prospect retry semantics.
- Shared verify/production assembly and bounded policy.
- Evidence-backed confirmed families, family/source-fair caps, family-contained
  clustering, and portfolio-balanced six-cluster selection.
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
- Generate one article end-to-end against the repaired writer and confirm the
  quality gate holds: it must land inside its contract word range, every section
  must end on a complete sentence, and every assigned citation must be present.
  Then generate one deliberately starved case (a contract with a single intent
  and no capability facts) and confirm it fails rather than completing.
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
14. Do not repair relevance incidents with domain-word, generic-word, or
    language-word blacklists. A query must positively belong to one confirmed
    business family; malformed strings may still receive structural sanitation.
15. The writer's inputs are a contract. `brandDetails` is typed `any` in every
    prompt builder, so a renamed field returns `undefined` silently and reaches
    the model as the string "undefined". Verify writer inputs with
    `/api/writer/dry-run` before trusting a paid run, and never add a
    `brandDetails.X` read without a matching field on `BrandDetailsSchema`.
16. The writer's intro shape is assigned, not chosen. Answer-first is an
    invariant (44% of AI citations come from the first 30% of a page); variety
    comes from rotating framing/second-move by cluster position. Never
    reintroduce a fixed "GOLDEN ORDER" or a mandatory "by the end of this
    guide" promise.
17. A section gets product knowledge only when the outline flags it
    (`needs_product_detail`). Never inject the whole brand blob into every
    section, and never leave a How-To section unflagged — the writer receives
    nothing otherwise.
18. "Unsold" is not "unqualified". Cluster selection filters out sold clusters
    to answer "can they buy another program" — it returns zero for a healthy
    audit that has simply been purchased. Never render that result as the
    audit's own quality; check `hasActiveProgram` first.
19. Relevance is not sufficiency. A query must also be *deliverable*: not
    centred on a third party's product, and not dependent on the publishing
    company's private operational facts. `direct` means both. Do not widen it.
20. **Never cap writer output tokens from a word budget alone.** The active
    model reasons by default and bills thinking against `maxOutputTokens`, so a
    ceiling sized for the prose alone starves the prose. Set thinking
    explicitly and keep a reserve on top of the prose estimate.
21. **A generated article must prove it finished before it can be completed.**
    Read `finishReason`, test the text for truncation, count the words, and
    fail the article rather than writing a broken response as successful work.
    An under-length warning is not a gate.
22. **No section may leave `normalizeContractOutline` empty.** There will be
    more sections than intents. A section with no intent, no facts, no evidence
    and no brief has only the previous paragraph to continue — and it will
    continue it, straight across the heading.
23. **The audited site is never a gap source.** Filtering brand *tokens* out of
    question text does not stop a generic FAQ line being lifted off the
    customer's own page and sold back to them as a gap. Check the source host.
    The subject's pages belong to the coverage stage, not the harvest stage.
24. **A rescue path must be asserted against the gate it feeds.** A test that
    proves `validateGroundedScope` creates families, without proving
    `validateConfirmedScope` accepts them, proves nothing — that exact gap put a
    founder in an unescapable onboarding screen. Whenever one function exists to
    stop data being lost and another decides whether it is acceptable, one test
    must span both.
25. **Never ship placeholder prose as a field's VALUE.** Guidance belongs in the
    `placeholder` attribute. `action: "Describe what…"` was simultaneously the
    default and the rejection condition, and `scope-classifier.ts` inlines that
    string as the definition of the business.
26. **Never ask onboarding for something the next call does not need.**
    `/api/analyze-brand` destructures exactly `{ url, targetSeeds }` — yet the
    first screen also collected competitors, which that endpoint never reads.
    Before adding a field, find the line that consumes it; if the consumer runs
    three screens later, ask three screens later.
27. **One waiting treatment, and it must be honest.** Onboarding has exactly one
    loader: stacked phase lines, running one lit, rest dimmed. No spinners. Every
    line corresponds to a real stream event — if a stretch of work is silent,
    emit a phase for it rather than padding the list with a timed fake.
28. **A test that greps one file blocks the refactor it should survive.** Before
    extracting anything out of a file the contract suite reads, change the
    assertion to read the *surface* — see `onboardingSurface()`. Otherwise the
    extraction either breaks the suite or, worse, passes while the assertion
    quietly looks at a file the string no longer lives in. Test the behaviour,
    not the filename.
29. **Tightening a demand gate has failed three times; measure first.** The
    8-article floor destroyed 33% of real demand once and returned 0 clusters
    from 123 real gaps another time. Before adding any threshold that can
    shrink scope, re-run a real audit and diff the plan. A fix that is correct
    in isolation can still be the fourth pivot on the same bug.

## 7. Changelog

### 2026-08-15 (third pass) - citations became actions, and the numbers explain themselves

Two additions, both aimed at the same problem: a founder reading this report for
the first time has no reason to believe it.

**1. Citation source classification** (`lib/visibility/citation-classifier.ts`).

The report already listed the hosts the engines cited. A host list is trivia; a
host list that says *what kind of place that is and what you can do about it* is
a content brief. Every citation now carries a `sourceType`, a `pageShape` read
off the URL, and an `actionability` of publish / earn / neither.

The design was set by studying how upstream's version decays. Ansvisor
classifies against curated domain lists, and the lists carry their history:
`motortrend.com`, `caranddriver.com` and `jalopnik.com` sit in `editorial`;
`bimmerpost.com`, `rennlist.com` and `teslamotorsclub.com` sit in `forum`. That
is one automotive customer's report patched host by host, and the next customer
in fintech starts from zero. This repo has already lost that argument twice with
content-quality regex lists.

So rules are ordered by how well they age — facts from the audit, then
structural signals (TLD, URL path shape), then deliberately tiny lists, then an
honest `unclassified` whose share is reported as a first-class number. A
contract test caps each curated list at 15 entries so the sixteenth host forces
a real decision instead of a quiet append.

The most useful output is the new "lists the engines read" section: the best-of
pages, comparisons and reviews the answers were assembled from. That is the
mechanism by which an engine produces a recommendation, and it is directly
actionable in a way a visibility percentage is not.

**The claim there is carefully bounded.** We do not fetch cited pages, so "this
listicle omits you" is unsupported. What is supported — and what is shown — is
how many of the *answers* citing that page named the brand. The UI states the
distinction underneath the list rather than letting the reader infer the
stronger claim.

**2. The method panel** (`components/visibility/method-panel.tsx`).

Lifted from Ansvisor's `_formula-dialog.tsx`, whose good idea is structural: the
weights in their dialog are imported from the scoring module, so the explanation
cannot drift from the implementation. Ours imports `PROMPT_INTENTS` and the
classifier's labels for the same reason, enforced by a contract test.

It spends its space differently, because there is nothing to audit — every
number on this report is already a count or a plain proportion. Instead it
states what each verdict means precisely, how questions are generated, where the
classifier stops being able to tell, and four things the measurement cannot do
at all (including why there is no trend line).

**A correction to my earlier position.** I refused to port upstream's weighted
0-100 visibility score on the grounds that a composite is unfalsifiable. That
was half right. The composite is unfalsifiable *on its own* — but Ansvisor pairs
it with a formula dialog and a per-metric breakdown sheet, which is a legitimate
answer I dismissed too quickly. The plain proportions stay, because they are
simpler and equally checkable; the transparency mechanism was worth taking.

Still unmeasured: no `CLORO_API_KEY`, so the classifier has never seen a real
citation. The curated lists in particular are guesses until a real run tells us
what share lands in `unclassified`.

### 2026-08-15 (second pass) - the probe was measuring the wrong surface

**The bug.** The first pass called the OpenAI Responses API and Gemini with
`googleSearch` grounding, and treated those answers as "what ChatGPT says". They
are not. The provider API is a different surface from the consumer app —
different system prompt, model routing, retrieval stack, memory, personalisation.

Two independent sources say the gap is severe:

- **Petra Labs**, 900 trials across paid ChatGPT, free ChatGPT and the API, same
  prompts, same day: the same brand's visibility moved **32 percentage points**
  across the three. One brand appeared in 15-18% of chat trials and **zero** API
  trials. An API-only tool reports that brand at 0% — indistinguishable from a
  brand with no AI presence at all.
- **Ansvisor ships `allowedModels: []` on every paid tier**, Enterprise
  included. Its commercial product is scraper-only. The people who wrote both
  code paths decided the API path was not good enough to sell.

Shipping the first pass would have meant telling a founder "you are invisible on
ChatGPT" while they could open ChatGPT and see themselves. That is the single
most expensive way this product can be wrong, and it would have been discovered
by a customer rather than by us.

**The fix.** `lib/visibility/engines.ts` now drives Cloro — `chatgpt-web` and
`google-aimode`, the real consumer surfaces, submit-and-poll. Every stored
answer carries `surface` (`consumer_app` | `api`) and no read path may average
across the two. The API adapters survive behind `allowApiSurface` for
self-hosters with no Cloro key, off by default: a silent fallback would replace
the measurement the customer is paying for with a materially different one.

Cloro also turned out to be **~10x cheaper** (~$0.14 vs ~$1.50-2.00 per
40-prompt two-engine probe), so the accuracy fix and the cost fix were the same
change. Credit figures are unverified against an invoice;
`ai_probe_runs.credits_used` records actual consumption for reconciliation.

**Consequences that were not optional.**

- *Trigger.dev.* A Cloro task is queued work and can take minutes. The old API
  route would have timed out mid-run and stranded a `running` row with no
  writer — the same shape as the audit's abandoned-run bug. `trigger/run-probe.ts`
  owns the run; the route enqueues and returns a `runId` to poll.
- *Two-phase submit/poll.* Submitting all 80 tasks first puts the whole run into
  Cloro's queue at once. Submit-and-wait per prompt would have serialised it
  into hours.
- *`maxAttempts: 1`.* A retry re-submits every task and bills the credits twice
  for a run whose partial answers are already stored.

**Surface selection.** ChatGPT (~63% of B2B AI referrals) and Google AI Mode —
the highest-reach Google surface, since it sits inside Search rather than in the
Gemini app. **Claude is a known blind spot**: ~18.5% of B2B referrals, second
only to ChatGPT for this ICP, but Cloro has no Claude scraper and an API number
beside two consumer numbers would corrupt the comparison.

**The dashboard.** `components/visibility/` — six sections in claim -> evidence
order, every question expanding to the verbatim answer with brands marked in
place. Rendered and inspected in both themes before shipping; the palette was
run through the data-viz validator rather than chosen by eye.

**Still unmeasured.** No `CLORO_API_KEY` here, so not one prompt has been asked.
Everything above is a defensible design and zero evidence.

### 2026-08-15 - AI-visibility probing as a second gap source

**Why.** The Google harvest answers "is this searched, and does your site cover
it?" through a chain of proxies — autocomplete, SERP questions, competitor
headlines, demand re-validation, scope classification. Most of this document is
that chain being repaired. An answer engine that recommends three competitors
and not the customer collapses the chain to one observation, and it is an
observation the founder can put in a cold email.

**What was built.** `lib/visibility/`, five modules, ~1,100 lines:

| Module | Job |
|---|---|
| `prompt-builder.ts` | Buyer prompts from confirmed families. One model call per family, so ownership is structural rather than requested. Fixed intent mix, weighted to commercial. |
| `engines.ts` | ChatGPT / Claude / Google AI / Perplexity, each one `fetch`. No SDKs, no scraper vendor. |
| `answer-parser.ts` | Ported from Ansvisor (MIT, Empler AI Inc.). Mention counts on URL-stripped text, first-mention rank, own-domain citations. |
| `gap-mapper.ts` | Verdicts and `GapItem[]`. |
| `run-probe.ts` | Orchestration, persistence, and the call into the existing clusterer. |

Plus `20260815_ai_visibility_probe.sql`, `POST /api/visibility/probe`,
`/visibility/[runId]`, and `/evidence/ai-answer/[runId]/[promptId]`.

**The design decision that matters.** A visibility gap is emitted as a `GapItem`
— the exact shape `computeGaps` already returns. `collapseToArticles`,
`groupIntoClusters`, `absorbOrphanedUnits`, `titleArticles` and `nameClusters`
run byte-for-byte unchanged. There is one definition of a cluster in this repo
and there must stay one; a second implementation would drift from the first and
the plan and the report would stop agreeing about what was sold. A contract test
asserts the reuse.

**Three rules this respects, and how.**

1. *Never hand-tune a threshold.* There is no visibility-score cut-off anywhere.
   A prompt is `absent` (named in no answer), `outranked` (named, never first)
   or `present` (named first at least once). All three are counts of stored
   answers. Upstream's weighted 0-100 composite of mentions, citations, ratio
   and sentiment was deliberately not ported: a customer cannot check it, and a
   movement in it cannot be attributed to anything.
2. *Provenance is mandatory.* Weakened honestly rather than faked. An AI answer
   has no re-openable public URL — it is a private, non-reproducible generation.
   So every answer is stored verbatim in `ai_probe_results` and `source_url`
   points at `/evidence/ai-answer/…`, which renders it. The claim stays
   falsifiable against our record. **This is genuinely weaker than a SERP URL**
   and both the evidence page and the report footer say so.
3. *A broken source must never look like an empty one.* Per-engine ledger; all
   engines failing on every attempt throws `all_engines_failed` rather than
   reporting the brand invisible. A missing API key reading as "you are absent
   everywhere" is the most expensive way this product can be wrong.

**What is deliberately NOT built.** No daily tracking, no trend line, no
"visibility went 12% → 31%". A probe is a sample of a non-deterministic system;
a delta between two samples is mostly noise, and attributing that delta to
published articles is a causal claim the data cannot support. Sell the gap —
which is stable — and treat movement as directional. Revisit only with repeated
same-day sampling to establish the variance first.

**Status: code-complete, unmeasured.** No engine key exists in this repo, so not
one prompt has been asked. Nothing here is calibrated. Before this is shown to
anyone: run it against two real sites, read fifty stored answers by hand, and
check that the prompts are questions a buyer would plausibly type. If they are
not, the gaps are noise no matter how clean the plumbing is.

**Cost, unverified.** ~60 prompts × 4 engines = 240 web-search-grounded calls per
probe. That is the first recurring per-customer variable cost in this product,
against a ~$0.20 audit. Measure it on the first real run before pricing anything
around it.

### 2026-08-14 - one-category collapse was a silent brand-card fallback

Every live onboarding run was landing on a single family named after the
confirmed Category, with the product name as a keyword and
"Product or service described by the customer" as delivery. That is
`familyFromConfirmedBrand`, not extraction: Gemini returned empty/unparsed JSON
(or threw), we swallowed it, and the brand card filled the hole.

Repair: recover JSON via `jsonrepair` and candidate parts; copy site quotes
into capability facts so Continue is not blocked by an empty contract; use the
brand-card family only when the corpus is actually thin. A failed extract on
real page text asks to retry instead of faking one category. Prompt no longer
tells the model a single-product business must be one family.

### 2026-08-14 - site-step wait replaces the URL form

Step 1 matches steps 2–3: as soon as Analyze starts, the sparkle header, URL
field, and button are gone. The numbered phase list is the screen, not a strip
under a form that looks like it is still waiting for input.

### 2026-08-14 - scope finder fails open without inventing markets

Empty markdown, a heavy capability-contract extract, and grounding that wiped
all families were sending founders to a blank "add your whole search scope"
form. Repair:

- Thin corpus now reads unpaid HTML snapshots (title, meta, JSON-LD, bounded
  body) before titles. Still no Tavily search credit.
- `extractScopeFamilies` asks only for name / description / seeds / evidence,
  90s timeout, attaches `fallbackCapabilityContract` in code, and lexically
  filters seeds against the corpus + confirmed brand card.
- `validateGroundedScope` slices overflow to 12, salvages invalid rows, and
  seeds a nameless-keyword family from its name. Never returns `[]` for overflow.
- Zero families after that become one `source: "founder"` family from the
  already-confirmed brand card. The empty Add-category grid is not the recovery
  path.

Re-run Drawgle from a clean analyze (no manual one-category rescue) before
judging cluster count.

### 2026-08-13 - brand crawl checkpoint (refresh-safe, spend-safe)

**Founder evidence.** Refresh during Analyze or Find areas aborted the NDJSON
`fetch`. `crawledPages` lived only in React state; `crawl_done` sent URLs
without content; the next Analyze paid Tavily again; scope with `pages: []`
walked the sitemap and ran an advanced Tavily search. Free onboarding would
double-bill on retry.

**Repair.** `brand_analyze_corpus` stores the 8-page crawl as soon as extract
finishes (before the persona LLM). A 24h cache hit skips Tavily. A fresh
overlapping `running` row is refused. Cache hits do not count toward a cap of
3 Tavily-touching analyzes per user per day. Scope reads that corpus when the
client body is thin; empty-markdown fallback is unpaid HTML titles only — no
`tvly.search` advanced path. The client persists/restores `CRAWL_PAGES` and
sets `SCOPE_STARTED_AT` like the analyze interrupt, without auto-retry.

Apply `supabase/migrations/20260813_brand_analyze_corpus.sql` in the Supabase
SQL editor (never `supabase db push`).

### 2026-08-08 - scope role refinement keeps delivery out of harvest

**Founder evidence.** Drawgle onboarding emitted a peer family "AI Design to
Code Handoff" with seeds like `tailwind html export` and `cursor ai design
context`. Those are how the product packages output, not what strangers Google
to find an AI mobile UI generator. Searching them would pull generic
design-to-code / Tailwind / Cursor SERPs and waste the audit.

**Root cause.** `parent_hint` already marked the area as a sub-area, but child
families still carried independent `seed_keywords` into harvest. Prompt rules
in `extractScopeFamilies` already banned "Design Handoff" as a peer family and
still failed. Autocomplete demand-check cannot help: popular wrong phrases look
"real."

**Fix.** After `validateGroundedScope`, `refineScopeRoles` classifies each
family and seed against the founder-confirmed brand profile
(`acquisition_job` | `delivery_artifact` | `workflow_step`), then
`applyScopeRoleRefinement` folds mechanisms into their parent job, strips
mechanism seeds from harvest directions, and preserves founder target seeds.
The scope API now accepts `brandProfile` from onboarding/Settings. Extraction
gets an optional brand-job preamble; the refine stage is the invariant.

**Contract.** Pure apply fixtures cover Drawgle-shaped fold, real sibling jobs,
seed scrub, and founder-seed exemption. No token denylist.

### 2026-08-08 - pre-audit brand DNA editing restored on profile step

**Founder verdict.** Deferring the twelve writer-facing brand fields to Settings
after the audit was wrong: an audit (and later articles) consume the brand blob
confirmed during onboarding. Correcting voice, audience, features, or UVP only
after that run has no effect on the evidence just purchased.

**What changed.** Step 2 still opens as a compact card (name, what it is,
category, voice teaser). A collapsed **Edit full brand details** disclosure now
mounts the shared `BrandDetailsEditor` — the same form Settings uses via
`BrandOnboarding` — so the founder can fix or add anything before scope/audit.
Copy no longer points people at Settings for first review.

**Shared surface.** The old fifteen-field accordion in `brand-onboarding.tsx`
moved to `components/brand-details-editor.tsx`. Onboarding passes
`skipAuditCoreFields` so the three audit-critical inputs are not duplicated
above the disclosure; Settings keeps the full form.

### 2026-08-05 - onboarding asks one question at a time

**Founder verdict on the flow as a whole**, after the dead-end fix landed:

> "why the search areas are not automatically generated if user dont provide
> anything… why the search area generation and brand dna/details generation are
> not in seperate steps and forms… currently half things come first, half things
> come later… a long list of inputs just for finding search scope areas, and you
> left it all on users"

All three were correct, and the previous pass had made one of them worse: it
surfaced a five-field mechanics editor on every category so a *broken*
extraction could be repaired, which taxed the ~90% of runs where extraction
worked. Optimising the failure path is not free.

**What the code actually said.**

- Scope areas *are* auto-generated. `extractScopeFamilies` builds from the
  crawled pages and its prompt has an explicit "the founder supplied no target
  searches, discover from the PAGES alone" branch. It returned `[]` only when the
  corpus was blank — a JS-rendered SPA — and we then handed over a blank form.
  Note the asymmetry that made this obvious: the **persona** call already had a
  `JSON.stringify(crawlResponse)` fallback; scope extraction had none.
- Step 1 asked for three things the endpoint does not need. It destructures
  exactly `{ url, targetSeeds }`; `competitors` is never read there.
- "Half things come first" was literal: persona (`flash-lite`) and scope
  (`flash-preview` + grounding) ran concurrently into one screen, tracked by
  three separate readiness flags.
- Of the 15 fields in "Brand voice & details", only `product_name`,
  `product_identity.literally` and `category` are read by the audit. Twelve are
  writer-only; `mission` and `enemy` have **no reader anywhere in the repo**.

**The flow now.** One screen, one question, each waiting only on its own data:

```
1 URL          one field
  ↓ step loader
2 Brand        compact card — name, what it is, category — confirm
  ↓ step loader
3 Scope        product areas, confirm
4 Extras       competitors / country / topic  ·  skippable
5 Audit
```

**Two calls, one crawl.** `POST /api/analyze-brand` now returns persona **and
its crawl**; the new `POST /api/analyze-brand/scope` runs extraction over that
supplied corpus. Sequential screens without a second sitemap walk — the second
call is one LLM call, not another 20-60s of crawling. `pagesFromCrawl` keeps
`title` now; it was dropped twice before.

**Scope generates itself, in three tiers.** Crawled markdown → page titles via
`batchExtractTitles` (raw HTML, so it works on the SPA that was failing) →
`tvly.search` cached content. Only if all three are empty does it ask, and then
it is one question, never a grid.

**One loader, everywhere.** `AnalyzePhaseList` renders both waits — stacked
lines, running line lit and breathing, completed dimmed with a `✓`, upcoming
faint. Only the phase list differs. Every `Loader2` spinner is gone from
onboarding; `CustomSpinner` remains for the pre-auth check, which precedes any
step. Phases are real NDJSON events — a loader that lies is worse than a spinner.

**Also.** The mechanics editor renders only when `mechanicsGaps(...)` is
non-empty, so the happy path never sees it. The 15-field accordion is gone from
onboarding (still extracted, still saved, still editable in Settings).
`brandFieldsReady` was dead state and is removed. `brand-onboarding.tsx` chains
the two calls — without that, re-analysing from Settings would have silently
wiped a brand's product areas.

**Four deliberate test edits.** `extractScopeFamilies`, `scope_ready` and
`trimFamiliesToSearchCap` assertions were *redirected* to the scope endpoint —
the invariants hold, they moved. `"Brand voice still loading"` was **deleted**:
it was copy apologising for a race between persona and scope, and sequential
steps remove the race. It is replaced by stronger assertions — each screen has
its own step value, its own event, and its own phase list — plus a new test
pinning that step 1 takes a URL alone and that all three scope tiers exist.

70/70 contract groups pass; `tsc` clean on every touched path.

**Not verified.** `/onboarding` is auth-gated and API routes are intercepted by
the same middleware, so none of this was exercised in a browser from the dev
session. It needs a logged-in click-through.

**Then split, in that order.** The screens now live in
`components/onboarding/steps/{site,profile,scope,extras}-step.tsx` and the route
is 1,330 → **966 lines**.

The test rewrite came first, and it had to. Roughly eight assertions greped
`page.tsx` for user-visible copy; extracting a screen would have moved the string
out of the file the assertion reads, and every one would have passed by
vacuously looking at the wrong place. `onboardingSurface()` in the contract suite
now joins the route with every file in the steps directory, so copy assertions
are about **what the user sees** rather than where a developer put it. Verified
the hard way: all four pinned literals — `Find my business areas`,
`What do people type into Google…`, `keep yours and find others`,
`Usually 1–3 minutes` — are now absent from the route and present in step files,
and the suite stays green only because the helper exists.

Assertions about the route's own behaviour still read the route directly, which
is what they are about. A new test pins the division: the route renders the four
screens and keeps `type Step`, `resetToBrandStep`, the three handlers,
`STORAGE_KEYS` and `migrateLegacyStep`; the screens are presentational and may
not `fetch`, touch `localStorage`, or navigate.

71/71 contract groups pass; `tsc` clean.

### 2026-08-05 - onboarding's two validators contradicted each other

**Founder evidence.** A new brand (an AI mobile-app-UI-design SaaS) produced
**zero** scope categories. The founder added one by hand and Continue refused:

> `ai mobile app ui designer needs confirmed mechanics in "How we understand this works."`
> `Assign every target search to a product area: ai mobile app ui designer, text to mobile ui design.`

There was no way forward from that screen. Not a scatter of bugs — one
structural fault and its UI consequences.

**Root cause.** `validateGroundedScope` (`lib/brand-scope.ts:284-298`) rescues
every unassigned target search into a family built from
`fallbackCapabilityContract`, whose `facts` and `evidenceRefs` are empty.
`validateConfirmedScope` (`:388-404`) rejects exactly that shape. One validator
created families so demand would not be lost; the other refused every one of
them. `:353-355` made it circular — substituting the fallback, then rejecting
what it had just produced.

`tests/pivot-contract.test.mjs` asserted the rescue *created* families and never
that they *passed the gate they feed*. That is why it shipped.

**Second-order faults, all verified in code:**

- **The placeholder was the failure condition.** `add()` seeded
  `action: "Describe what…"`, and the gate rejects `/^describe\b/i` — because
  `scope-classifier.ts:350-353` inlines that action verbatim as the definition of
  the business for every query classification.
- **The only cure was hidden.** `withFounderConfirmedOperation` mints the
  required `founder-confirmed:onboarding` fact but fired only from the `action`
  and `inputs/outputs/limits` fields, inside a collapsed 10px disclosure with no
  error styling. Editing the visible "What this helps with" minted nothing.
- **A `capability_contract: null` family rendered no editor** — unfixable except
  by deletion.
- **`"Brand details are invalid."`** — a freshly added category fails
  `BrandDetailsSchema` before the mechanics check, collapsing the whole screen to
  one string with no field named.
- **Zero categories + stale notes** came from localStorage: `brandProfileReady`
  was set from `product_name` alone while issues restored from a *separate* key,
  so notes outlived the families they described. Exactly the reported screenshot.
- **Dead air.** `brand_ready` (flash-lite) reliably beats `scope_ready`
  (flash-preview + grounding), so the confirm screen rendered an empty `0/12`
  box with an enabled "Add category" — indistinguishable from "we found nothing"
  — under a status line reading *"Building brand profile…"*, the thing that had
  just finished. The correct copy was unreachable in that branch.
- **Edits were discarded.** The `complete` handler wholesale-replaced
  `scope_families` one persona call after the UI invited editing.

**Fixed.**

- `lib/scope-mechanics.ts` (new) — one definition of "has confirmed mechanics",
  free of node builtins so the client computes the identical answer.
  `validateConfirmedScope` delegates to it and now names the fixable field.
- `scope-family-review.tsx` — empty-not-placeholder `add()`; mechanics editor
  always rendered and auto-opened when incomplete; "What this helps with" mints a
  founder fact; `withFounderConfirmedOperation` hardened so it only mints from a
  meaningful action (the old empty-action quote `"Action: ."` was 9 chars and
  slipped past `min(8)`) and only ever touches its own namespaced id.
- `findScopeBlockers` + `focusScopeField` — per-field, clickable pre-flight in
  both hosts. "Brand details are invalid." is now unreachable.
- Unassigned searches get chips: assign to a category, name-match suggestion,
  create a category from the search, or **drop it** — the first time withdrawing
  demand has been possible at all.
- Orphan loop no longer drops silently: the cap pushes an issue, and a
  duplicate-named rescue **appends the seed to the existing family**.
- Dead air: `scopeReady` state, a skeleton instead of an empty list, the status
  branch corrected, both selects gated, `AnalyzePhaseList` (modelled on
  `audit-console.tsx:448-502`) marking phases complete **independently**, page
  count from the `pages[]` payload the client used to discard, and two progress
  emissions across the previously silent sitemap and crawl-fallback stretches.
- `complete` merges instead of replacing, in both hosts.
- localStorage: `brandProfileReady` requires ≥1 family; notes are cleared
  whenever the families are.
- Zero-family throw now names the measurable reason (readable characters, page
  count) so a JS-rendered site is told why retrying cannot help.
- Step indicator: `1 Website · 2 Confirm what you sell · 3 Audit`.

**Two test edits, both deliberate.** The `setBrandData({` literal at
`:1970-1978` was widened to `setBrandData(` — it pinned a call shape while its
own comment was about ordering, and it blocked the updater form required to stop
discarding edits. And the new `"the confirm gate is one rule"` test pins client
and server agreement directionally: anything the client flags, the server must
refuse. Message-equality fails legitimately, because an empty `deliveryMode`
trips `CapabilityContractSchema.min(2)` before the mechanics check runs — which
is itself why the client pre-flight has to exist.

69/69 contract groups pass; `tsc` clean on every touched path.

**Not done, deliberately.** The shared `use-analyze-brand` hook and the
sync-test rewrite (`:1032-1075`). The fixes above were applied to both hosts by
hand and verified, but the test that *mandates* that duplication is still there.
Extracting the hook is a ~150-line move in each host plus a test rewrite, and
`/onboarding` is auth-gated so none of it can be exercised in a browser from a
dev session — a large blind refactor of newly working code. It is the next
commit, not this one.

**Not verified.** No logged-in click-through. Everything is proven by 69 contract
groups and `tsc`; the flow itself needs a human with credentials.

### 2026-08-05 - the audit harvested the customer's own FAQ and sold it back

**Founder evidence.** A completed BringBack plan of 73 articles across 8
clusters. Four planned articles were verified, against the live page, as
paraphrases of BringBack's own product-page FAQ:

| Planned article's "primary search" | bringback.pro/ai-family-portrait FAQ |
|---|---|
| Can I include pets in my family portrait? | Can I include my dog, cat, or another pet in the family portrait? |
| How many people can I include? | How many people can I combine into one group photo? |
| What photo quality do I need for uploads? | What are the best photos to upload? |
| Can I use old photos? | Can I combine black-and-white photos with color photos? / generational portrait |

The article the writer produced earlier the same day — "How to Add Your Pets to
an AI Family Portrait" — was generated from the first of these. **The writer
executed a plan item that should never have existed.** A correct writer running
this plan still produces articles nobody searched for.

**Cause.** `serp-questions.ts` filtered `excludeBrands` against the **question
text** only:

```ts
if (containsExcludedBrand(question, excludeBrands)) continue
if (containsExcludedBrand(question, sourceBrand)) continue
```

`assembly.ts` already builds `excludeBrands` from `[subjectUrl, ...competitors]`,
so the intent to exclude the subject was there. But a generic FAQ line off the
customer's own page contains no brand token, so it passed, and entered the pool
as a gap with `source_url` pointing at the customer's own site. Provenance was
satisfied — the string genuinely is on that page — while the thing that matters
was never tested. **The source host was never checked.**

**Fixed.** `isSameHost` in `lib/harvest/types.ts` (placed there because that
module is import-free and therefore unit-testable; `serp-questions.ts` is
alias-bound and can only be asserted as text). `harvestSerpQuestions` takes the
subject URL and skips any result served from that host before extracting
questions. Nothing is lost: the subject's pages were never a demand signal —
autocomplete is — and a question that is genuinely searched still arrives from
there, corroborated. The subject's site is still read in full by the coverage
stage, which is a different job and must not be conflated with this one.

68/68 contract groups pass; `tsc` clean.

**Two adjacent fixes were deliberately NOT made.** Both were diagnosed, both
looked correct, and both would have repeated history:

1. **Corroboration on the main clusterer path.** `STANDALONE_MIN_BACKING_QUERIES
   = 2` is applied only inside `absorbOrphanedUnits`, which receives units only
   from groups *below* the 8-article floor. Groups at 8+ become clusters with no
   corroboration test, which is why **58 of 73 articles (79%) rest on a single
   observed phrasing**. Enforcing it on the main path would cut those 58 and
   collapse most clusters below the floor — re-creating exactly the failure the
   2026-08-02 entries fixed twice ("0 clusters" from 123 real gaps; 33% of gap
   demand destroyed; a paying-ready customer told they were ineligible).
   It is also coupled: most single-observation units are the own-FAQ scrapes
   this change removes, so the symptom may largely disappear on its own.
   **Re-run the audit and measure the single-observation rate before deciding.**
2. **Pattern-rejecting FAQ-shaped strings** (`Q5:`, leading digits, "your
   tool"). This is rule 14 and the CLAUDE.md blocklist prohibition, third
   attempt. Structural sanitation of malformed strings is still allowed;
   rejecting on content shape is not.

**Still open after this change** (needs the re-run before anything is proposed):
the 13-article "Digital Family History Books" cluster is out of product domain
(the Memory Book is private storage, not a genealogy-project product); four
articles target a professional/corporate audience the brand DNA does not serve;
and `restore old photos [android|free|near me|prompt]` is four articles chasing
one intent.

### 2026-08-04 - the writer shipped a 176-word article as completed

**Symptom.** An article with `status: "completed"` and `current_step_index: 4`
contained 176 words against a 1,600–2,200 word contract. Two other recent
articles were long enough but were full of invented first-party mechanics —
architecture names, accuracy percentages, DPI, ray tracing, archival media —
none of which any capability fact supported.

**Cause.** Four independent failures compounding:

1. The previous repair added `maxOutputTokens: 700` for the intro and
   `word_budget × 1.8` (765 tokens) per section. `gemini-3-flash-preview`
   reasons by default and thinking is billed from that same ceiling, so most
   calls ended after 20–35 visible words, several mid-sentence.
2. Nothing checked whether generation succeeded. The stream was consumed for
   `.text`; `finishReason`, word count and sentence completeness were never
   inspected. The only length check warned about articles that were too *long*.
   `status: "completed"` was then written unconditionally.
3. `normalizeContractOutline` gave each intent exactly one section and left
   surplus sections with no intent, no capability facts and no research. The
   contract writer also withheld `instruction_note` by design, so those sections
   received a heading, a purpose label and the previous 500 characters under the
   instruction "continue naturally from this final prose context". Every
   truncated section was therefore completed by the next one, producing one
   severed paragraph with headings wedged between the fragments.
4. External research was rewritten as first-party capability. One competitor's
   selection criteria became "we ensure skin tones, lighting direction, and
   shadows align perfectly", against a capability contract whose only attached
   fact was a credit-cost sentence.

**Fix.**

- `lib/writer/draft-quality.ts` (new): pure evidential tests — prose word count
  that ignores images/comments/table rules, truncation detection (max-tokens,
  unterminated sentence, unbalanced emphasis, dangling heading, dangling table,
  empty), sentence splitting, first-party claim candidate extraction, sentence
  removal, and the article-level verdict with per-length word floors.
- `callWriterModel` preserves `finishReason` and sets `thinkingLevel: "LOW"`
  explicitly, retrying without `thinkingConfig` if the model rejects the field.
  The ceiling is `wordBudget × 5 + 3,000`, capped at 16k.
- `writeContractProse` wraps every writing call — intro, sections, link retries
  and evidence rewrites — retrying up to three times with a doubling ceiling and
  a correction that names the actual word count or truncation reason.
- `normalizeContractOutline` keeps intent ownership exclusive but gives surplus
  sections `supporting_intent_ids`, falls back to shared research evidence
  rather than leaving a section blind, and gives the intro the primary intent's
  facts (it previously had none while being asked for the direct answer).
- `instruction_note` is restored as the per-section brief and the outline prompt
  now demands a brief that names each section's distinct job.
- The bridge prompt is a flow cue, not a continuation instruction.
- Per-section entailment audit for first-party claims: rewrite once naming the
  offending sentences, then delete what remains unbacked.
- Citation retries go from one to two, are re-checked after sentence deletion,
  and record a blocking defect instead of silently keeping uncited text.
- Commercial intent requires a comparison section with criteria from research.
- `articleQualityVerdict` runs before the completed write and throws on a
  blocking defect, which the existing handler records as `status: "failed"`.

**Also fixed.** `/api/founder/test-article` refused nothing when hydrating a
planned article from an audit produced under an older harvest policy, so a v4
contract — whose only attached capability fact was a credit-cost sentence — was
replayed through the v5 writer. That made the failing article look worse than
production would have been and masked the four bugs above. The route now returns
409 unless the request passes `"allowStalePolicy": true`.

**Not verified.** No article has been generated end-to-end against the repaired
writer. Everything above is proven by unit tests over pure functions and by
source assertions over the pipeline; the gate's behaviour under a real Gemini
response is the next thing to check (§5).

### 2026-08-02 - competitor candidate pool must not block audit restart

A failed run wrote the provisional 5–12 discovery list onto
`brand_details.discovered_competitors`. The next attempt then hard-failed with
"maximum is 4". Fix: treat the saved list as a candidate pool (cap 12), write
candidates only to the audit row mid-run, and update the brand only after
coverage succeeds with the usable working set.

### 2026-08-02 - finalize accepts absorbed / parent-rolled query ownership

**Production failure** on audit `7e9e8724` after a full harvest:

> An article references a query outside its confirmed scope

Parent-scope rollup and absorption correctly set `planned_articles.scope_family_id`
to the host cluster family and record the measured family on
`origin_scope_family_id`. `query_pool` rows keep the origin family. `finalize_audit_run`
still required `qp.scope_family_id = pa.scope_family_id`, so every rolled-up or
absorbed article failed at the last step.

**Fix:** migration `20260806_fix_finalize_absorbed_query_scope.sql` widens the
check to also accept `origin_scope_family_id` and child→parent
`parent_scope_family_id` links. Apply in the Supabase SQL editor (already
applied on production via MCP). Re-run the audit — no code deploy required for
the SQL side.

### 2026-08-02 - competitor coverage failover (policy v3.3.0)

**Production failure:** BringBack audit died after full autocomplete/PAA spend
with `competitor_coverage_failure` because `https://www.myheritage.com` had no
readable sitemap pages. `scanCoverage` already returned soft zero; assembly
re-threw it as fatal.

**Fix:**

- Discover up to `maxCompetitorCandidates` (12), user hosts first.
- During coverage, skip unreadable candidates and continue until 4 succeed
  (or the pool is exhausted). Never abort the audit for one bad rival.
- Persist only `competitorsUsed` on brand + audit; drop failures from the list.

### 2026-08-02 - onboarding analyze streams; competitor top-up at audit

**Wait UX.** `/api/analyze-brand` now returns NDJSON phases (`crawl_*`,
`scope_ready`, `brand_ready`, `complete`) so onboarding can unlock the existing
Confirm-what-you-sell review as soon as grounded families arrive, while persona
fields finish. Continue stays gated on the validated `complete` payload.
Honest ETA is 1–3 minutes. No AI-terminal console chrome.

**Competitor coverage.** Naming 1–N competitors used to skip discovery entirely
and starve gap ownership evidence. Audit now keeps user hosts first and fills
remaining slots via `discoverCompetitors` up to `maxCompetitors` (4).

### 2026-08-02 - clustering: family demand floor vs thematic split (BringBack)

**Production diagnosis** on audit `ce3aed21` (bringback.pro): harvest was **not**
starved — 333 pool rows, **123 gaps**, 14–26 gaps per family. Collapse produced
**40 article units** but **0 clusters** because:

1. **Thematic over-split** — families with 8 collapsed units (e.g. 25 gaps → 8
   units) were split into sub-groups that never reached 8, so `groupIntoClusters`
   returned all units as orphans.
2. **Sub-areas clustered alone** — `parent_scope_family_id` steered absorption
   but not clustering; child domains like "Add Person to Photo" were clustered
   separately from their parent.

**Fix (policy `v3.2.0`):**

- When a family has **≥8 collapsed units** but no thematic group of 8, emit a
  sellable cluster from the full unit set (`splitOversized` still applies).
- Roll **child scope families into their parent** before clustering (same FK
  adoption pattern as absorption: `originScopeFamilyId` preserved).

Re-audit required to pick up the new clustering behaviour.

### 2026-08-02 - fix confirm_brand_scope `item` ambiguity on onboarding

`20260804` parent-link UPDATE aliased `jsonb_array_elements` as `item` while the
preceding `FOR item` loop was still in scope. Postgres raised *column reference
'item' is ambiguous* and `save_onboarding_brand_with_scope` returned 400 at the
brand step. Fixed in `20260805_fix_confirm_brand_scope_item_ambiguous.sql` by
renaming the UPDATE alias to `family_row`.

### 2026-08-02 - founder test-article QA route fixed and fully wired

`/founder/test-article` failed at article insert with
`articles_user_id_fkey` when the founder account had no `profiles` row.
`ensureProfileRow` creates it before insert.

Loading a planned article now hydrates the full writer payload from the database
(source queries, sub-nodes, cluster competitors, frozen links when purchased)
via `loadPlannedWriterInputs`, shared with `/api/writer/dry-run`. The writer
task still never receives `plannedArticleId`, so cluster state is untouched.

### 2026-08-02 - parent_hint now steers thin-domain absorption

`parent_hint` from extraction was shown on the confirmation screen but absorption
still routed thin domains purely by embedding proximity. That worked on replay,
but it ignored the taxonomy the founder confirmed.

- `parent_scope_family_id` added to `brand_scope_families` and
  `audit_scope_families` (`20260804_parent_scope_family.sql`). `parent_hint` is
  resolved to this id at confirm time in `resolveParentScopeFamilyIds`.
- `confirm_brand_scope`, `create_customer_audit_with_scope`, and
  `create_scoped_prospect_audit` persist stable family ids and parent links.
  `claim_prospect_audit` copies them when a prospect claims an audit.
- `absorbOrphanedUnits` prefers the parent's qualifying cluster for Pass 2 (and
  for degenerate sub-node attachment when the parent has articles) and only
  falls back to embedding adjacency when the parent has no cluster.

Re-audit required for existing completed audits — parent links live on the scope
snapshot, not retroactively on old runs.

### 2026-08-02 - dynamic scope: the article floor was destroying measured demand

**Production evidence.** One audit measured 6 confirmed domains and 373
queries. Three domains produced real gap demand and **zero** articles:

| domain | gap queries | clusters | articles |
|---|---|---|---|
| C | 14 | 0 | 0 |
| D | 14 | 0 | 0 |
| F | **24** | **0** | **0** |

**52 of 156 gap queries — 33% — were silently destroyed** at
`clusterer.ts`, where groups below the 8-article floor were filtered into a
`residual` counter and never seen again. Sampling domain F showed they were not
drift: they were high-intent commercial queries including the product's core
use case. The audit then showed 4 clusters, failed the fixed six-cluster gate,
and told a paying-ready customer their site was "not eligible for a program".

**The four reported failures were not independent — Step 4 caused Step 1.**

**Thin domains are now absorbed in two passes** (`lib/harvest/absorption.ts`):

- **Pass 1** triages inside the thin domain by *demand weight*. A unit backed by
  2+ independently observed phrasings has corroborated demand and becomes a
  **standalone article**; a unit backed by exactly one becomes a **sub-node** —
  an H2/FAQ section folded into one of those articles. Folding everything as
  sub-nodes would bury searchable intents inside another domain's article where
  they can never rank or be linked to, and the graph is what is sold.
- **Pass 2** absorbs the promoted articles into the nearest qualifying cluster.
  Absorbed articles adopt the host's `scope_family_id` because
  `planned_articles_cluster_scope_fkey` requires article and cluster to share a
  family — that guard is load-bearing and was not weakened. The new
  `origin_scope_family_id` preserves where the demand was measured.
- Degenerate cases are handled: nothing corroborated → all fold as sub-nodes;
  nothing qualifies anywhere → surfaced as measured-but-unsold evidence.
- **No FAQ padding.** Manufacturing nodes to reach a price threshold is exactly
  the unoriginal-content pattern that lost ~71% of traffic.

Verified by replaying the failing audit's shape: **58 queries in, 58 out, 0
lost**, 16 promoted to standalone articles, 10 folded as sub-nodes, and the
8–15 ceiling still held (24 → 12 + 12).

**Scope is now dynamic.** `selectQualifiedProgramScope` sells every qualified
cluster — 2, 4, 7 or 12. The only remaining rejections are "audit needs
refreshing" and "nothing qualifies". No new Dodo product was needed: the three
velocity tiers already price per cluster correctly, so `programPricing()` varies
the *period count* instead of the price.

**A second inversion surfaced while testing that.** Whole billing periods mean a
scope that does not divide evenly leaves a half-empty final period the customer
still pays for. At 3 clusters Accelerate came to $299.33/cluster against Close's
$249 — the *faster* tier being *worse* value, the same defect that made the old
4-clusters-per-month Dominate indefensible. A first fix using Close as a
baseline still left an 8-cluster case ($224.63 vs $224.50). `availableTiers()`
now walks slowest to fastest keeping a running best, so a tier is offered only
when it beats **every** slower offered tier. Proven: **no value inversion at any
count from 1 to 40.**

**Also fixed while in here.** `platform_native` added to the scope classifier —
autocomplete is a popularity engine, so "do this job inside someone else's
platform" leaks in even when the job is exactly what the customer sells. Adding
it exposed that `VALID_DECISIONS` had drifted from the response schema: a value
the schema permitted but the validator rejected would have failed whole batches
and aborted audits after harvest spend. A test now pins union, validator and
schema in agreement.

`20260803_sub_nodes_and_origin_family.sql` adds `sub_node_intents`,
`sub_node_query_ids` and `origin_scope_family_id`, and patches
`finalize_audit_run` to persist them — without which the absorption would have
been recomputed and then dropped at persistence, the same loss one layer down.
Both patch anchors were rehearsed read-only against the live function first.

51/51 contract groups pass; `tsc` clean.

**Completed in the same pass.**

- **Sub-nodes reach the writer.** `run-harvest` persists `sub_node_intents`,
  `sub_node_query_ids` and `origin_scope_family_id`; `ship-cluster` forwards
  them; the outline prompt gains a `REQUIRED SUB-SECTIONS` block instructing a
  dedicated H2 or FAQ entry per absorbed intent, in the searcher's own wording,
  explicitly *not* padded. Without this the absorption would have been computed,
  stored and then never written — the same loss two layers down. A contract test
  pins every hop of the chain, because any one of them dropping the payload
  reproduces the original bug silently.
- **Peer-level extraction.** `lib/scope-extraction.ts` gains a PEER-LEVEL RULE
  and a `parent_hint` field: emitting a broad capability beside one of its own
  sub-cases is what produced areas too narrow to sustain a cluster. The hint is
  plumbed through `validateGroundedScope` (self-referential hints stripped) and
  surfaced on the confirmation screen as "Sub-area of X", so the founder merges
  deliberately instead of discovering a thin area after the audit runs.
- **Public copy is count-agnostic.** Every "six-cluster"/"all six" claim removed
  from pricing, features, about, terms, SEO metadata, `llms.txt`, checkout and
  restore paths — the site no longer promises a number the engine no longer
  guarantees. `purchase-intent.ts`'s fallback rejection string was stale too;
  its gate already delegated correctly.

52/52 contract groups pass; `tsc` clean.


### 2026-07-31 - confirm-scope blocks use client-ready field labels

Each family row now labels **Category**, **Keywords**, and **What this helps
with** — founder language, not harvest jargon. Section hint:
`Most important category first · keywords belong to that category`. Placeholders
match. No Google / research / chips / seeds copy on the block.

### 2026-07-31 - confirm-scope chips align with priority numbers

Search chips and the customer-job line no longer sit under a `pl-6` indent that
tracked the index column. They start at the same left edge as the priority
number so mobile width is not wasted under empty gutter.

### 2026-07-31 - confirm-scope auto-trims to 12; no trim essay

Analyze returns at most 12 search directions (`trimFamiliesToSearchCap` in
`lib/scope-search-cap.ts`, applied in `/api/analyze-brand`). The review UI
shows a quiet `N/12` counter; at 12, chip add and “Add area” are disabled.
Under 12, the user can add. Continue is never a “remove N searches” nag —
over-cap state is prevented, not explained.

### 2026-07-31 - confirm-scope onboarding is compact and action-led

Second pass after the widen-the-island change still felt exhausting: stacked
explanations, tall family cards, and brand DNA always expanded. Now:

- Title is one line; product areas are dense rows (Category + Keywords + what it helps with).
- Quiet `N/12` counter; add disabled at cap (see auto-trim entry above).
- Brand voice/details sit in a closed disclosure so scope is the default focus.

### 2026-07-31 - confirm-scope step uses page space instead of a cramped nest

Brand confirm no longer traps families inside `max-h-[60vh]` with stacked
info cards. The island widens to `max-w-5xl`, the page scrolls, each family is
a two-column row (area name + customer job | searches), and alerts collapse to
plain text under a `N/12 searches` counter. Caps and validation unchanged.

### 2026-07-31 - brand gate accepts real Supabase clients under tsc

`userHasActiveBrand` no longer takes a hand-rolled `BrandGateClient` that
typed `maybeSingle()` as `Promise<T>`. Real Postgrest builders are thenables,
so Vercel `tsc` rejected `createClient()` at `actions/onboarding.ts`. The helper
now accepts `{ from: (table: string) => any }`.

### 2026-07-31 - audit progress UI is opacity-driven text, not card stacks

`AuditConsole` running state no longer renders bordered icon cards per phase.
Phases are a tight numbered text list: active step breathes at full opacity,
completed/pending steps sit at lower opacity. Phase descriptions crossfade
under the title. Polling, failure, and retry logic are unchanged.

### 2026-07-31 - audit Trigger budget raised from 15m to 30m

`run-topical-audit` and `run-prospect-audit` override `maxDuration` to **1800**
(project `trigger.config.ts` already defaulted to 1800; the tasks had been
capped at 900). Large sites with dense sitemaps, multi-family SERP, and
classification need the extra wall clock even after SERP parallelism.

`AUDIT_STALE_AFTER_MINUTES` on `/api/topical-audit` moves **20 → 40** so a
live 30-minute run is not reclaimed as `worker_never_ran`. Contract suite pins
both values.

### 2026-07-31 - SERP harvest no longer burns the 900s audit budget sequentially

**Production evidence.** Audit on animatememories.com hit Trigger
`MAX_DURATION_EXCEEDED` (900s) after logs like:

```
[Harvest:SERP] Failed for seed "ai hug video": Request timed out after 60 seconds
… (five seeds, same 60s timeout)
[Harvest:Autocomplete] Level 1: 2590 unique queries (408 requests)
```

This was **not** caused by the 8–15 cluster-floor commit (`eab53fb`) — that
change only touches post-gap clustering/eligibility. The death was in harvest:
`harvestSerpQuestions` walked seeds in a **serial** `for` loop. Each hung
Tavily `advanced`+markdown call waited ~60s. Five timeouts alone are ~5 minutes
wall clock before coverage/embeddings/classification even start, which is enough
to push a 12-seed audit over the task ceiling.

**Fixed in `lib/harvest/serp-questions.ts`.**

- Seeds run with `mapWithConcurrency` at **3** (bounded Tavily parallelism).
- Per-seed wall-clock cap **25s** via `Promise.race` — a stuck seed fails and
  the others continue; partial SERP success still soft-fails closed only when
  *all* seeds fail (`hardFailure`).
- Worst-case SERP wall time drops from ~12×60s serial to ~⌈12/3⌉×25s.

Contract suite pins concurrency + timeout constants.

### 2026-07-31 - brandless users cannot leave onboarding into the dashboard

Authenticated customers with no non-deleted `brand_details` row were able to
open `/content-plan`, settings, and other dashboard shells — empty, confusing,
and a soft escape from setup. Login also bounced every authed user to
`/content-plan`.

**Fixed.**

- [`lib/onboarding-gate.ts`](lib/onboarding-gate.ts) — shared `userHasActiveBrand`
  + `pathRequiresBrand` list (content-plan, audit, articles, settings, account,
  integrations, subscribe, reports, seo-health).
- [`proxy.ts`](proxy.ts) redirects brandless users on those paths to
  `/onboarding`; login → `/onboarding` when brandless, `/content-plan` when not.
  `/onboarding`, `/founder`, and `/api` stay ungated so analyze-brand can run
  before the brand is saved.
- Protected layout re-checks the gate (defence in depth) using `x-pathname`,
  exempting `/founder`.
- Escape from onboarding remains sign-out only until a brand exists.

### 2026-07-31 - lock 8–15 cluster depth; never invent SEO junk

**Founder evidence.** A BringBack audit showed 21 planned articles across 3
“program” clusters (sizes 6, 5, 10) while marketing promises 8–15 per cluster.
UI still said “Your six-cluster program” / “The selected six contain 21…”. Logs:

```
Collapsed 33 → 6, 60 → 5, 0 → 0, 58 → 10
```

An earlier run with six real scopes produced ~58 articles / 6 clusters — not
randomness: more confirmed families with demand-backed gap depth.

**Causes.**

1. Backend `minQualifiedClusterArticles` was **3** while marketing and the
   clusterer’s `TARGET_CLUSTER_MIN` were **8**.
2. `groupIntoClusters` forced everything into one undersized cluster when no
   thematic group reached 8 — shipping 5–6 article “PROGRAM CLUSTER” rows.
3. Ineligible copy still used the happy-path “selected six” strings.
4. Empty / thin families were silent except a collapse log line.

**Product stance (locked).** Six demand-backed clusters of 8–15 **unique**
articles. Do not pad vanity scopes, do not un-merge same-intent queries into
near-duplicates to inflate counts, do not invent subtopics without search
demand. Fewer than six real qualified clusters ⇒ evidence-only audit, no
checkout (small-niche rejection).

**Fixed.**

- `PRODUCT_TRUTH.minClusterArticles` and `HARVEST_POLICY.minQualifiedClusterArticles`
  → 8; policy version `confirmed-business-scope-v3.1.0`.
- `groupIntoClusters` emits **zero** clusters when nothing reaches the minimum;
  residual undersized articles are logged, not sold.
- Assembly hard-fails `cluster_too_small`; warns per family on 0 gaps or
  insufficient distinct depth; `findDuplicateArticlePairs` remains fail-closed.
- Scope-results titles ineligible audits “Measured clusters (not yet a program)”
  and states real counts.
- Docs / terms / HOW_IT_WORKS / link-graph strings synced to 8–15.

Follow-up (not this change): calibrate `ARTICLE_MERGE` on labeled BringBack
pairs if true multi-intent families are over-merged — never hand-tune mid-audit.

### 2026-07-31 - brand analyze: cut crawl cost, discover omitted scopes, real pricing

**Founder evidence.** Onboarding brand step took ~84s with a button spinner,
spent ~10 Tavily credits while competitors stayed user-supplied, echoed the
founder's typed searches as "Business Scope" (missing site features they
intentionally omitted), and extracted vague pricing while the landing page
showed clear plans and perks. Refresh mid-run looked like progress was gone.

**Causes.**

1. `tvly.crawl({ limit: 20, extractDepth: "advanced" })` dominated wall time
   and credits. Competitors are not part of this call.
2. Scope prompt said founder seeds "outrank" the pages — correct for protecting
   typed searches, wrong for discovering omitted site capabilities.
3. Persona prompt literally asked for `Pricing: High-level model (Subscription,
   One-time, Free tier)` and fed an unordered 50k crawl blob, so plan grids
   were truncated out.
4. UX was a single "Analyzing..." label with no interrupt recovery.

**Fixed.**

- Crawl bound to 8 pages; `basic` first, escalate to `advanced` only when the
  corpus is thinner than 1500 characters. Instructions prioritize homepage and
  pricing/product paths.
- Persona corpus uses `buildRankedBrandCorpus` / `selectScopePages` so pricing
  and product pages survive the character cap.
- Scope extraction still requires every founder seed, and also requires every
  distinct sellable capability visible on the pages even when the founder did
  not name it.
- Pricing extraction requires plan name / price / period / perks; forbids vague
  model-only summaries.
- Onboarding + brand-onboarding show phased progress copy and restore
  URL/seeds/competitors after a mid-analyze refresh with a re-run prompt.

Contract suite pins crawl bound, ranked corpus, omitted-capability discovery,
pricing rules, and analyze UX phases.

### 2026-07-31 - scope classifier fail-closed on UUID family_ids

**Production evidence.** A Trigger.dev `run-topical-audit` died after harvest
spend with:

```
Business-scope classification failed after 4 bounded attempts:
assignments violated the scope response contract
```

A second run of the same site then succeeded with no code change — the gate is
nondeterministic. The first failure did not include per-check diagnostics; the
exact lastError string is only set when Gemini's batch response fails the
malformed / coverage contract (not when the call throws).

**Root cause class.** The classifier asked the model to echo Postgres UUIDs as
`family_id`, and treated any unknown `family_id` on a non-direct row as a batch
failure. Structured output for 50-row batches also routinely missed indexes.
Worked examples said `-> direct` with no `family_id`, teaching the wrong shape.

**Fixed in `lib/harvest/scope-classifier.ts`:**

- Prompt and schema use short aliases (`f1`…`fN`); aliases map back to real
  family UUIDs before persistence.
- Worked examples show `direct, family_id=f1` and `…, family_id=null`.
- `BATCH_SIZE` reduced from 50 → 25.
- Non-direct rows with a mangled/unknown `family_id` clear the id and keep the
  decision instead of aborting the batch.
- Alias, raw UUID, and case-insensitive family name are accepted as refs.
- Durable `console.error("[scope-classifier] …")` diagnostics on contract
  violations so the next Trigger failure names the counters.

Contract suite pins aliases, batch size, and the non-direct clear path.

### 2026-08-02 - a deleted brand stranded onboarding

**Reported immediately after the first `purge_brand` run.** Onboarding sat on
`?step=audit-results&brandId=<purged>` showing a permanent spinner plus:

```
The audit finished, but its scope could not be loaded. Please run it again.
```

Refreshing reproduced it exactly. There was no way out.

**Cause.** Onboarding persists `step` and `brandId` in localStorage and the URL,
so deleting a brand server-side left the browser pointing at something that no
longer existed. `getAuditScope` returns `null` for **both** "no completed audit
yet" and "this brand does not exist", so the audit-results step could not tell
the two apart: it threw, set an error, and left `step` and `brandId` intact —
which is what made every refresh repeat it.

The `audit` step failed differently but just as badly: `GET /api/topical-audit`
answered `not_found` for a missing brand, the console read that as "never ran"
and auto-started, and the `POST` then 404'd with "Brand not found".

**Fixed.** A restored `brandId` is now verified once at hydration against
`getUserBrands()` — reusing the existing action rather than adding one — so a
single check covers every step instead of patching each failure separately. If
the brand is gone, `resetToBrandStep()` clears all onboarding storage and
brand-derived state, returns to the brand step with a plain explanation, and
rewrites the URL so the dead `brandId` cannot come back on refresh. The
audit-results path keeps its own check as defence in depth, and both fail open
on a transient lookup error so a network blip cannot itself strand a user.

Contract test pins the reset helper, the hydration check, the fail-open
behaviour, and every piece of state the reset must clear. 44/44 groups pass.


### 2026-08-02 - brand purge and single-article QA generation

Two founder tools. Neither changes the production pipeline.

**1. `purge_brand(uuid, acknowledge_active_subscription boolean)`**
(`supabase/migrations/20260802_purge_brand.sql`)

`discard_unpurchased_audit` refuses once money is involved, which left no way
out when a paid setup is wrong end to end. This deletes everything for one
brand: audits, evidence, clusters, planned and generated articles, the frozen
link graph, programs, purchase intents, billing ledgers, scope families, claims,
internal links, and the brand row.

Two deliberate refusals:

- **It will not silently orphan a live subscription.** Deleting a program does
  not stop Dodo billing, so the function raises while an active/pending
  subscription exists unless the caller explicitly acknowledges it, and always
  returns `orphaned_dodo_subscription` so it can be cancelled in Dodo. It never
  deletes `dodo_subscriptions` itself — that row is the payment record.
- **It does not touch the auth user.** The account survives so they can start
  over.

Deletion is ordered by FK direction because every constraint into `programs`
and `topical_audits` is `RESTRICT`, not `CASCADE` — deliberately, so a stray
`DELETE` can never take purchased work with it.

**On the vector column:** nothing rewrites embeddings; `query_pool` rows are
deleted whole. The immutability trigger is opened only through the existing
transaction-scoped `audit_discard_in_progress` hatch. That hatch matches **one**
audit id, so evidence deletion loops per audit and re-sets the setting each time
— a single `set_config` would exempt only the first audit and the trigger would
reject the rest. It depends on `guard_audit_snapshot_row` being able to resolve
pgvector (repaired in `20260801`); that migration must stay applied.

Rehearsed read-only against the live schema before shipping: the nested block
parses, every table and column resolves, and the run rolled back.

**2. `/founder/test-article` (page) + `POST /api/founder/test-article`**

Generating one article previously meant shipping a whole cluster. This runs the
real writer against real brand data with the same inputs ship-cluster would send.
When a planned article is loaded, `hydrateFromPlannedId` pulls audit evidence,
sub-nodes, cluster context and any frozen links from the database — but
`plannedArticleId` is never passed to the writer task, so no cluster generation
state is mutated.

`ensureProfileRow` fixes the `articles_user_id_fkey` failure when a founder
account exists in auth without a matching `profiles` row.

It stays outside the paid pipeline by *omission*, not by reimplementation:

- **no `plannedArticleId` on the writer task** — status writes inside the task
  are guarded on it;
- **no credit consumption** — `consume_program_credit` lives in ship-cluster;
- **frozen links** are only forwarded when they already exist on the planned
  article after purchase — never fabricated.

The only row created is one `articles` record, deleted again if the trigger
call fails.

An admin page at `/founder/test-article` lists the founder's own planned
articles (when an audit exists), loads one into an editable form in a click, and
generates it. Title, keyword, article type, supporting keywords, observed
searches, cluster name, pillar flag and **intro pattern** are all editable — the
pattern selector is the point, since it is what lets one title be compared
across all five opening shapes without generating a cluster. With no brand on
the account it says so and points at onboarding, because the route needs real
brand data but deliberately does not need an audit.

**Founder surfaces are gated in two independent layers.** Verified empirically:
fetching `/founder/test-article` unauthenticated leaked no founder UI, so the
page-level `isFounderUser` + `notFound()` check was already holding. `'/founder'`
is now also in `protectedRoutes`, so an anonymous request is redirected to
`/login` at the edge (confirmed 307) instead of reaching a server component that
queries the database on its way to rejecting the caller. A logged-in non-founder
still gets 404 — not 403 — so the surface stays undiscoverable, and the API
repeats the check because a page gate is not an API gate. This also closed the
same edge gap on the pre-existing `/founder/prospect-audits`.

Contract tests pin the purge ordering, the subscription refusal, the per-audit
hatch loop, both gating layers, and all three QA-route omissions — the last verified in both
directions against a simulated regression. 42/42 groups pass.

### 2026-08-01 - a paid audit reported itself ineligible

**Reported from production, immediately after the first successful payment.**
The audit page showed 58 planned articles across 6 clusters and, directly above
them:

```
Not eligible for a program yet. This site currently has 0 unsold qualified
clusters. The program requires six.

The selected six contain 0 articles. They cover 0 confirmed business areas.
Review every title and its supporting searches before choosing a delivery speed.
```

Nothing was broken in the purchase — `programs` held the correct active row:
6 clusters, 58 articles, `scope_status = active`.

**Cause.** `selectQualifiedProgramScope(clusters, soldClusterIds)` filters out
clusters already sold. That is right for the question it answers — *can this
customer buy ANOTHER program* — and after a purchase the answer is legitimately
"no, zero remain". The bug was rendering that result as though it described the
audit's quality, to the person who had just bought it. Three surfaces consumed
it unguarded: the ineligibility banner, the "Program scope" stat, and the
six-cluster heading copy, all of which read from `selection.selected` — which is
empty by design post-purchase.

The public report page (`app/audit/[token]/page.tsx`) duplicated the same
computation, so a shared outreach link flipped to "not eligible" the moment the
prospect converted.

**Fixed.**

- `getAuditScope` now loads the active/paused program for the audit and, when
  one exists, displays the **purchased** scope (`clusters_included`,
  `total_articles`) instead of a fresh selection with nothing left to select.
- New `hasActiveProgram` flag on `AuditScope`, mirrored in the public page.
- `belowViableThreshold` is now `!checkoutEligible && !hasActiveProgram` —
  "too small to sell" must never be conflated with "already sold".
- The ineligibility banner requires all three of `!checkoutEligible`,
  `!hasActiveProgram` and `!progress`.
- Post-purchase copy reads "Your program covers N articles across M confirmed
  business areas. Clusters are delivered complete, in priority order."

**Verified against the live purchased audit** on the public report route:
banner gone, scope line reads *"Your program covers 58 articles across 4
confirmed business areas"*, header still *"58 planned articles across 6 measured
clusters"*, and no visible mention of eligibility anywhere. The old reason string
survives only as inert data inside the serialized RSC payload, never rendered.

Contract test pins all of it across both the authenticated action and the public
page. 40/40 groups pass.

### 2026-08-01 - writer quality: intros, links, brand starvation

Four complaints from reading a real delivered cluster. Root causes were not what
they looked like.

**Research first (2026 evidence, not assumption).** Two findings reshaped the
work:

- **Answer-first is worth protecting.** Models extract ~44% of citations from the
  first 30% of a page, and 97% of AI Overviews cite a top-20 organic result. The
  existing "Bridge Answer" rule was correct; variety must not come from delaying
  the answer.
- **Originality now dominates.** AI-paraphrased content lost ~71% of traffic
  post-March-2026 while sites with original data gained ~22%. Google's spam
  policy targets *"large amounts of unoriginal content… no matter how it's
  created"*. A pipeline that synthesises competitor research produces exactly the
  "comprehensive but impersonal" category that lost — this is almost certainly
  why the old FlipAEO content was de-indexed.

**1. Intros were templated by instruction.** `INTRO_TEMPLATES` mandated one
"GOLDEN ORDER" per type: definition → `**Key Characteristics:**` → hook →
*"By the end of this guide…"*. Every article of a type opened identically
because it was told to. Two further defects compounded it: a second, *different*
mandatory intro recipe (`introStrategy`) was rendered into **every section's**
prompt, and the intro was built with `currentSectionIndex = -1`, so
`slice(Math.max(0,-3), -1)` handed it every section but the last labelled
"already covered — do not repeat".

Replaced with invariants + rotation in `lib/writer/composition.ts`:
answer-first, bolding rules, paragraph limits and banned openers are now
invariants; 5 answer framings × 4 second moves rotate deterministically from
cluster position, seeded by cluster id. 20 combinations against a 15-article
cluster maximum, so **no two articles in a cluster can share an opening shape**,
and a retry cannot change one. The mandatory "by the end of this guide" promise
is gone — no evidence required it and it was the most recognisable tell.

Verified live on a real 5-article cluster: `definition+attribute-list`,
`verdict+mechanism`, `direct-number+worked-example`, `corrective+common-failure`,
`conditional+attribute-list`.

**2. External links: a contradiction, not a lazy agent.** `authority_links` come
from a Tavily search on the article's own keyword — so the top results *are* the
ranking competitors. `filterAuthorityLinks` stripped only social/UGC domains, and
the synthesis prompt asked for "non-competitor URLs" while never being told who
the competitors were. One would land in a section's `external_link`, and the
writer was then told both "MANDATORY CITATION" and (§4) "NEVER CITE COMPETITORS".
It resolved the contradiction by dropping the link.

Competitor hosts from the audit (`clusterCompetitorUrls`) are now filtered out of
citation candidates before the outline sees them, www-insensitively.

**3. Internal links read as bolted on.** Nothing detected an omitted link, and
the only recovery was `ensureFrozenLinksInMarkdown` appending a
`## Related reading` block. Now each section is checked after drafting and
re-prompted **once** to weave the link mid-paragraph, with trailing
"To learn more about X, read our blog on Y" constructions explicitly banned. The
deterministic append survives as a last resort for frozen links only, because
cluster delivery genuinely depends on them.

**4. Brand handling was starvation, not overload.** The section writer received
only `product_name` and `audience.primary` — no `core_features`, `how_it_works`,
`uvp` or `pricing`. It wrote generic How-To steps because *it did not know how
the product works*. Those facts existed only in the outline prompt, which was
expected to copy them into `instruction_note` and silently didn't.

`ArticleOutlineSchema` gained `needs_product_detail`, `product_aspect` and
`is_comparison`. The outline model — which has the full brand context — flags
which sections need product knowledge, and only those receive that one slice.
Given the originality finding, this is not a polish item: **product knowledge is
the only genuinely first-party material available**, and the existing
`FIRST-PARTY PRIORITY` rule could never be obeyed without it.

**Prompt structure.** `### 6` and `### 7` each appeared twice. Critically, the
two blocks named "ANTI-FLUFF PROTOCOL" are **not duplicates** and were not
merged — `### 10` contained zero fluff rules; its content is citation policy
(never cite competitors, always cite super-authorities, first-party priority).
It was renamed `### 4. CITATION & ATTRIBUTION POLICY`; its rules are untouched.
Headings are now unique. No cross-references of the form "section N" exist, so
renumbering was label-only.

**Nothing deleted.** `INTRO_TEMPLATES` and `getIntroTemplate` are retained,
unused, as the documented provenance of every invariant. A contract test asserts
the surviving rules ("Visual Speed Bumps", "3 lines", "Let's dive in",
"Top 10 Best", "Getting started is easy") are all still present, and that both
protocol blocks still exist independently.

39/39 contract groups pass; `tsc` clean on every touched path.

**Open strategic risk.** This makes the best originality move available, but a
pipeline whose research input is "what competitors published" has a structural
ceiling on originality. Worth deciding separately: whether the customer can
supply genuinely first-hand material, whether author attribution should be real
and verifiable, and whether cluster composition should shift toward case-study
and pricing-shaped articles, which reportedly earn more AI citations than
"what is" guides.

### 2026-08-01 - the article writer's inputs, audited and connected

Nobody had ever looked at what the writer actually receives. Four findings, in
order of severity.

**1. Two brand fields never existed.** `trigger/generate-blog.ts` read
`brandDetails.features` and `brandDetails.unique_value_proposition`. The real
schema names are `core_features` and `uvp`, so **every article ever generated**
was outlined against:

```
- Features: N/A
- UVP: undefined
```

inside the same block instructing the model to position the product in
comparison tables and How-To sections. TypeScript could not catch it:
`brandDetails` is typed `any` in every prompt builder, so each access silently
returned `undefined`. `pricing` and `how_it_works` had a softer version — they
are arrays, so `arr || 'N/A'` never fires on an empty one and rendered blank.

Fixed with a `brandList()` helper that prints `Not provided` for a genuinely
absent fact, plus a contract test that parses `BrandDetailsSchema` and asserts
**every** `brandDetails.X` in the writer is a declared field. Verified in both
directions: clean on the real file, and it reproduces `features,
unique_value_proposition` when the historical bug is reintroduced in an
in-memory copy.

**2. The other three input surfaces were already safe.** Audited rather than
assumed: the outline is validated by `ArticleOutlineSchema` so a renamed key
throws instead of degrading; `frozenLinks` derives its anchor from `title`,
matching what ship-cluster sends, and `ensureFrozenLinksInMarkdown` appends any
edge the model omits before HTML is saved; `angleInsights` already fails closed
to `null`. All three are now pinned by tests.

**3. `/api/writer/dry-run` (new, dev-only).** Answers "what does the writer
receive for this planned article?" for free — no Gemini, Tavily or fal.ai call,
no article row written, the research slot stubbed and labelled. It assembles the
prompt through the *real* builder (`generateOutlineSystemPrompt` is now
exported; exporting a pure function changes no runtime behaviour) so it proves
something about production rather than approximating it. Added to
`devOnlyApiRoutes` in `proxy.ts`; returns 404 when `NODE_ENV=production`.

Its first real run was the proof of finding 1 — `missingBrandFacts: []`, with
`core_features` and `uvp` populated — and it surfaced this planned article:

```
title:      "Step-by-Step Picsart Tutorial for Restoring Vintage Pictures"
keyword:    "How to restore an old photo with Picsart"
supporting: photoshop elements / photoshop 2023 / photoshop cs6 / picsart download
```

Every source query names a competitor tool. The deliverability gate now rejects
all five, so that article cannot form — but it was planned before the gate
existed, which is why re-auditing matters before selling.

**4. The audit's evidence stopped at the plan.** The writer got a title, a
keyword, supporting keywords and frozen links — then re-researched the topic
from scratch with a generic Tavily search. `source_query_ids`,
`competitor_matches`, the cluster name and the pillar role all sat unused in the
database. The product's entire claim is that those queries are real and
traceable, and the article answering them had never seen one.

`ship-cluster.ts` now loads them in two batched queries per cluster (not per
article) and forwards `cluster`, `sourceQueries`, `clusterCompetitorUrls` and
`isPillar`. The outline prompt gained a `MEASURED SEARCH DEMAND` block that
names the real searches, tells the model to cut any section that does not help
answer one, distinguishes pillar from supporting treatment, and lists the
ranking competitors as depth to beat and never to recommend.

Every field is optional and the block is conditional, so a run without evidence
behaves exactly as before. `loadClusterEvidence` catches its own failure and
returns empty — losing enrichment must degrade article quality, never block a
paid cluster that is otherwise ready.

Verified live against a real planned article:

```
cluster:      "Photo Restoration Service Overview"   isPillar: true
sourceQueries: "What if I want to restore a photo from a negative?"
               "Who can restore an old picture?"
competitors:   https://www.pixreunion.com/old-photo-restoration
```

all present in the assembled prompt.

34/34 contract groups pass; `tsc` clean on every touched path.

### 2026-08-01 - deliverability gate: relevance was never the problem

**Production evidence.** A completed bringback.pro plan contained these, among
others:

```
Using Adobe Firefly to Colorize and Restore Any Old Image
Easy Steps to Scan and Upload Photos to Forever Studios
How to Animate Faded Memories Using Fotor's AI Tools
Using Clipfly AI to Quickly Add New People to Any Image
Understanding Our Turnaround Times for Your Photo Projects
Items We Accept: From Slides and Negatives to Physical Prints
Real Reviews: See What Our Clients Say About Their Restored Photos
Understanding Our Easy Cancellation Policy and Subscription Terms
```

Every one passed provenance, demand validation, confirmed-family relevance,
cluster sizing, and the duplicate check. **Relevance was never the problem** —
"colorize an old image" genuinely belongs to a confirmed family. The pipeline
had no concept of whether a relevant topic was *deliverable for this customer*.

**Two structural classes, not one bug.**

| Class | Property | Why it is fatal |
|---|---|---|
| `third_party_branded` | Centres on a named company/product that is not this business | Cannot ship a customer an article recommending a rival's tool |
| `publisher_specific` | Answerable only from the publishing company's private operational facts | Not a topic at all — a company fact every service business has a page for |

Class B is the subtler one. The test is not the first-person wording but the
dependency: "photo restoration turnaround times" is still publisher-specific
with the pronoun removed, because no outside writer can answer it correctly.

**Implemented.** The gate lives in the scope classifier, which was already the
positive relevance gate and already had a reject path — it simply was never
asked about deliverability.

- `ScopeDecision` replaces the bare `direct | adjacent | unrelated` union with
  two additional rejection values. Machine-readable rather than free text so
  drops can be grouped in diagnostics and pinned in tests. `direct` now means
  relevant **and** deliverable.
- Prompt gains rules 6 and 7 (deliverability outranks relevance; the
  outside-writer test) plus twelve worked examples drawn from the real failures
  above — these classes are easy to misjudge described only in the abstract.
- `findThirdPartyBrand()` in `lib/harvest/types.ts` is the deterministic half:
  a query naming a crawled competitor is rejected before it costs a
  classification token. It flattens non-alphanumerics on both sides so the
  domain token `foreverstudios` matches the display form "Forever Studios".
  Tokens under 4 characters are left to the model, since they collide with
  ordinary words once spaces are stripped.
- Assembly passes `brandTokensFromUrls(input.competitors)` — competitors only.
  The pre-existing `excludeBrands` includes the *subject's* own brand for
  harvest hygiene and must never be reused here, or the customer's own product
  name would be rejected as third-party. A contract test pins that distinction.
- A deliverability rejection returns `suggestedFamilyId: null`. Only `adjacent`
  drops keep it, because suggesting a family invites someone to reinstate a
  topic that names a competitor.
- `/api/harvest/verify` now reports `droppedByDecision` counts and an
  `undeliverableSample`, so the gate is inspectable before spending on a real
  audit.

**Known limitation, by design.** The deterministic check only knows the
competitor domains actually crawled. Adobe, Fotor, and Clipfly were never
competitors — they were third parties *mentioned on* competitor pages, which is
exactly why they reached the plan. Those depend on the model rule. Evidence
where evidence exists; judgement only where it does not.

31/31 contract groups pass; `tsc` clean.

### 2026-07-30 - checkout guided to test-mode enablement

Founder asked to enable `/subscribe` after a full audit ran cleanly for the
first time. Flagged before proceeding: an audit succeeding exercises none of
the payment path — purchase intent, webhook handling, provisioning, cluster
delivery, cancellation have never run once, not even in sandbox, and
`docs/SOLO_LAUNCH_GATE.md` lists 6 checks against this exact flag, 0 completed.

`CLOSED_POOL_CHECKOUT_ENABLED` is not in `.env.local`, so production reads it
from the hosting platform (Vercel) directly — outside this session's reach.
Founder confirmed production `DODO_ENVIRONMENT=test_mode`, which changes the
risk profile entirely: enabling now charges nothing real, and doubles as the
sandbox run that items 2-4 of the solo gate call for. Guided the founder to set
the flag in Vercel and run one real checkout through it before treating those
items as done.

**Still open, called out explicitly:** the Dominate tier's
`dodo_product_id` (`pdt_0NkDO0sMN9Lu8VQKdhM7I`) previously belonged to the
retired $799 plan. Our own price check (`recognizedPlans` in
`app/(protected)/subscribe/page.tsx`) only compares against
`dodo_pricing_plans.price`, so this cannot block the page from rendering — but
if that product was never repriced inside Dodo's own dashboard, a real charge
on Dominate would not match the displayed $599. Must be confirmed before
`DODO_ENVIRONMENT` ever moves to live.

No code changed this entry — the checkout gate in code
(`app/api/dodopayments/checkout/route.ts`, `app/(protected)/subscribe/page.tsx`,
`app/pricing/page.tsx`) is unchanged and correct as designed; only the external
env var moves.

### 2026-07-30 - two production incidents, both mine, both fixed live

Two separate failures hit production back to back.

**1. Every audit returned 503 "temporarily unavailable."** Root cause:
`20260801_discard_unpurchased_audit.sql` re-declared `guard_audit_snapshot_row`
(to add the discard escape hatch) with a bare `SET search_path = public`.
`CREATE OR REPLACE FUNCTION` replaces a function's search_path along with its
body, so this silently undid the pgvector fix `20260731` had already applied —
the exact same class of bug as the `finalize_audit_run` incident earlier this
week, reintroduced by my own follow-up migration:

```
assert_harvest_schema_ready() -> cannot resolve pgvector: guard_audit_snapshot_row
POST /api/topical-audit       -> 503 "temporarily unavailable"
```

**Fixed live first, source second.** Ran `ALTER FUNCTION
public.guard_audit_snapshot_row() SET search_path = public, extensions;`
directly against production and confirmed `assert_harvest_schema_ready()`
passes — audits work again without waiting for a deploy. Then corrected
`20260801_discard_unpurchased_audit.sql` itself: the `CREATE OR REPLACE` is
immediately followed by a `DO` block that resolves the pgvector schema
dynamically and restores it via `ALTER FUNCTION`, so the file is self-correcting
if replayed.

Added a contract test that replays every migration in filename order and
tracks the *last* event affecting `guard_audit_snapshot_row`'s search_path —
whether a `CREATE`'s own clause or a later `ALTER` — and fails if that last
event is a bare `CREATE ... SET search_path = public` with nothing after it to
restore the vector schema. Verified in both directions without touching the
real file: simulated stripping the `ALTER` block in an isolated in-memory copy
and confirmed the test fails exactly as expected, then confirmed it passes on
the real, fixed file.

**2. Onboarding's "Analyzing..." step hung for three minutes.** Root cause:
`findSeedsWithoutDemand` was awaited inline in `POST /api/analyze-brand`, over
every seed keyword across every extracted family — up to ~90 on a multi-family
brand — via a bare `Promise.all` with no concurrency limit. That is a burst of
near-simultaneous requests to an undocumented, rate-limit-prone Google
endpoint, exactly what `suggest-client.ts`'s own module comment warns against.
Google throttled the burst; the retry/backoff in `fetchSuggest` correctly
waited out the throttle on every request in the burst; the response didn't
return until the slowest one finished.

This was a design mistake, not a code bug: an advisory, best-effort signal
(which product areas look mispositioned) was made a hard blocking dependency
of the single most important step in onboarding.

Fixed:

- `lib/harvest/query-validation.ts` — `findSeedsWithoutDemand` now uses
  `mapWithConcurrency` (concurrency 6, matching the harvest's own demand
  filter) instead of raw `Promise.all`, and hard-caps input to
  `MAX_SEEDS_PER_DEMAND_CHECK` (30) regardless of what the caller passes in.
- `app/api/analyze-brand/demand-check/route.ts` (new) — the check now lives
  behind its own endpoint. It never throws to the caller; any failure returns
  `{ seedsWithoutDemand: [] }`, which just means no badges render.
- `app/api/analyze-brand/route.ts` no longer imports or calls the demand
  check at all.
- Both call sites (`app/(onboarding)/onboarding/page.tsx` and
  `components/brand-onboarding.tsx`) call the new endpoint *after*
  `setBrandData()` has already rendered the confirmation screen, and swallow
  any failure. Badges appear a moment later, or never — the screen itself is
  never gated on this again.

Contract suite pins all of it: the blocking route must not reference
`findSeedsWithoutDemand` as a call or import (a regex distinguishes that from
this very changelog's incident comment, which does name it), the shared
function must use bounded concurrency and the input cap, the new endpoint must
fail open, and both client call sites must fire the demand-check fetch
strictly after `setBrandData(data)`, never before.

30/30 contract tests pass; `tsc` clean on every touched file.


`20260731_confirmed_business_scope.sql` applied successfully. Deleting the
mispositioned bringback.pro audit afterwards was impossible:

```
DELETE FROM query_pool     -> Completed audit evidence cannot be deleted
DELETE FROM topical_audits -> still referenced from table query_pool
```

Every child FK on `topical_audits` is `RESTRICT` and every child DELETE is
blocked by `guard_audit_snapshot_row` / `guard_audit_scope_snapshot`. The guards
were correct; the gap was that **no legitimate discard operation existed**, so a
completed audit was permanent even with zero programs, zero purchase intents and
zero generated articles. A founder audit that came back mispositioned is not
history worth protecting — it is a bad measurement.

`20260801_discard_unpurchased_audit.sql` adds the missing operation:

- `discard_unpurchased_audit(uuid)` — `SECURITY DEFINER`, `service_role` only.
  Locks the audit, then refuses if a program exists, if a purchase intent
  exists, or if any planned article already has a generated article. Otherwise
  clears `brand_details.current_audit_id` and deletes children in FK order
  (`planned_article_links`, `program_cost_events`,
  `subscription_credit_consumptions`, `program_clusters`, `planned_articles`,
  `audit_clusters`, `query_pool`, `audit_scope_families`, `audit_claims`) before
  the audit row. Returns per-table counts.
- `audit_discard_in_progress(uuid)` — the escape hatch, backed by
  `set_config(..., is_local => true)` so it expires with the transaction and
  cannot leak into another statement or session. Both guards yield on DELETE
  only for the exact audit id being discarded; every other row stays protected
  throughout.

Explicitly rejected: switching the FKs to `ON DELETE CASCADE`. Cascade would let
a careless `DELETE FROM topical_audits` destroy a purchased program, which is
precisely what `RESTRICT` is there to stop. The rule the guards enforce is not
"nothing may be deleted" but **work somebody bought must never disappear**, and
that condition now lives in the function instead of in whoever holds the console.

All 16 table/column references were verified against the live schema before the
migration was handed over. 28/28 contract groups pass.

### 2026-07-30 - scope extraction rebuilt after a mispositioned audit

**Production evidence.** drawgle.com is a generative AI mobile-UI engine — text
prompt in, mobile screens and an agent-ready HTML handoff out. Scope analysis
returned **one** family: "Design Handoff and Implementation". That names a step
inside the product and points the entire audit at Zeplin/Locofy's search intent.
The founder had typed `ai mobile app ui designer` and `text to mobile ui design`
into onboarding, and the system responded by asking *them* to assign those
searches to its own wrong family.

**Four independent causes, all structural.**

1. **Scope was field 10 of an 11-field persona prompt.** The same
   `gemini-3.1-flash-lite` call produced emotional identity, "the enemy",
   audience psychology, pricing model, and a Style DNA paragraph. The most
   consequential decision in the product competed for attention with prose about
   tone of voice.
2. **The evidence gate was an exact substring match that deleted silently.**
   A family survived only if the model emitted a quote appearing verbatim in the
   normalized page text. Models paraphrase when they quote, so real capabilities
   were deleted for a *formatting* failure, and survivors were biased toward
   families named after literally-quotable marketing boilerplate. This is the
   same defect as absolute-threshold-only coverage: high precision, no recall,
   and no measurement of what was dropped.
3. **Founder target searches were advisory.** Supplied to the prompt as
   "authoritative direction, if any", then enforced only as a validation error
   the founder had to resolve by hand.
4. **One family silently degrades the whole program.** Portfolio balance takes
   one cluster per family before depth; with a single family that rule
   degenerates, so one mispositioning propagates into all six clusters. "One
   family because the business is focused" and "one family because three were
   pruned" looked identical on screen.

**Implemented.**

- `lib/scope-extraction.ts` (new). Scope is its own call on
  `gemini-3-flash-preview`, reading only the pages that say what is sold —
  homepage and product/pricing/feature paths first, blog and legal last, capped
  at 12 pages and 24k characters. It is started before the persona call is
  awaited, so the split costs a few thousand tokens and **no wall-clock time**,
  and the focused corpus is cheaper than the 50k-character blob it replaced.
  The prompt names the failure directly: a family is a customer job, and
  "Design Handoff and Implementation" is a step inside one.
- `lib/brand-scope.ts` — `verifyQuote()` is now two-stage, mirroring coverage.
  Exact substring first (precision), then a sliding token-window requiring 70%
  of the quote to appear *together* in one place (recall). A paraphrase of a
  real sentence passes; a fabricated claim whose words are merely scattered
  across the site does not.
- **Nothing is deleted.** An extracted family that fails verification is kept
  and marked `verified: false` for the founder to confirm or remove. Every
  founder target search that no family claims becomes its own `source: "founder"`
  family, needing no site quote — the founder knows what they sell better than a
  crawler does.
- `findSeedsWithoutDemand()` (`lib/harvest/query-validation.ts`) checks confirmed
  seeds against Google Autocomplete on the confirmation screen. Free, advisory,
  fails open. A phrase nobody searches is usually a mispositioning, and saying so
  before research beats discovering it in a delivered plan.
- The onboarding question changed from *"What should this audit help you become
  known for? (recommended)"* — which asks for brand positioning and got brand
  positioning — to *"What do people type into Google to find a tool like yours?"*,
  with the note that these are treated as the truth about what the business
  sells. It is no longer marked optional.
- The review screen badges each area: **From your search**, **Not found on your
  site**, **Rarely searched**.

**Contract suite** pins that a founder target search can never be silently
dropped, that an unverified family is kept rather than deleted, that
`verifyQuote` survives paraphrase but rejects invention, and that scope
extraction is a separate call started before the persona await. 28/28 pass;
`tsc` clean on every touched file. Not visually verified — onboarding is behind
auth and browser navigation was unavailable in that session.

**Unrelated change found in passing.** The "Leave setup" link back to
`/content-plan` was removed from `app/(onboarding)/layout.tsx` outside this work,
leaving unused `Link`/`ArrowLeft` imports and a failing contract assertion. The
dead imports are removed and the test now pins sign-out as the required exit.
**If removing that link was not deliberate, onboarding no longer has a way back
to the dashboard except logging out.**

### 2026-07-30 - two latent guard bugs blocked the confirmed-scope migration

`20260731_confirmed_business_scope.sql` aborted twice while backfilling
`scope_family_id`. Both failures were in `guard_audit_snapshot_row`, both latent
since `20260730_closed_pool_v2.sql`, and neither had ever executed before: the
guard's UPDATE path only runs when a completed audit's rows are modified, which
nothing did until this backfill.

**1. pgvector invisible to the guard.**

```
ERROR: 42883: operator does not exist: extensions.vector = extensions.vector
```

`IS DISTINCT FROM` needs the type's `=` operator, and operator lookup goes
through `search_path` — schema-qualifying the type does not help. pgvector is
installed in `extensions`; the guard was pinned to `SET search_path = public`.

`20260730_fix_finalize_vector_search_path.sql` had fixed exactly this for
`finalize_audit_run`, and `assert_harvest_schema_ready` then verified exactly
that one function — so the preflight built to catch schema drift certified
"ready" while its sibling was broken. The migration now repairs the guard's
search_path before the backfill, and the preflight checks every function known
to manipulate vector values.

**2. Flat trigger dispatch evaluated another table's columns.**

```
ERROR: 42703: record "new" has no field "name"
```

One trigger function serves `query_pool`, `audit_clusters` and
`planned_articles`, dispatching as
`IF TG_TABLE_NAME = 'x' AND (NEW.<field-of-x> ...)`. PL/pgSQL prepares a
branch's whole condition as one SQL statement when that branch is reached, so
`NEW.name` had to resolve even with the table check false — and `NEW` is a
`query_pool` record there. An UPDATE that changes nothing protected (exactly
what the backfill does) falls past branch one and dies on branch two.

The table check is now its own `IF`, so an unreached branch is never planned.
`scope_family_id` is deliberately not protected: the backfill must set it, and
cross-family integrity is enforced by the composite foreign keys.

**Verified against the live database before recommending the re-run**, having
twice told the founder to re-run on reasoning alone:

| Check | Result |
|---|---|
| Flat dispatch, backfill-shaped UPDATE | reproduces `has no field "name"` |
| Nested dispatch, same UPDATE | succeeds |
| `search_path = public` vector compare | reproduces `operator does not exist` |
| `search_path = public, extensions` | resolves |
| Nested guard vs. tampering with `query`/`name` | still blocked |
| Rows that would stay NULL after backfill | 0 of 353 / 13 / 142 |

Contract suite pins the class: the effective definition of
`guard_audit_snapshot_row` must dispatch on `TG_TABLE_NAME` in its own `IF`.
26/26 groups pass.

**Also fixed:** `classifyQueriesToScope` allowed two attempts per batch with no
backoff, and classification runs *after* all Tavily and crawl spend — one
transient error discarded a paid run. Now four attempts with exponential
backoff and jitter, matching `suggest-client.ts`. Still fail-closed.

**Open gap, not yet built.** The scope classifier is now the single component
the entire relevance guarantee rests on, and it has no calibration harness.
`/api/harvest/calibrate` measures coverage only. Its error rate on the
BringBack pool is unmeasured, which is the same unfalsifiable position the
retired authority scorer occupied. Rule 5 of the classifier prompt (assigned
queries must use a language present in that family's confirmed searches) is
enforced only by the model; the deterministic language filter it replaced was
verified 16/16 against the exact production strings.

### 2026-07-30 - confirmed business scope replaces the blended niche gate

**Production evidence.** BringBack explicitly offers old-photo restoration,
photo animation, AI family portraits, adding/removing people, nostalgic hug
videos, and memory books. The old brand analyzer reduced that multi-product
business to flat/generic seeds. The harvest then produced 65 selected articles,
39 from wholly irrelevant clusters and 56 with no competitor match. Every row
could still pass provenance, demand, cluster-size, and collapse checks.

**Root cause.** The pipeline asked whether a query was semantically near one
blended brand centroid. That is an open-world permission model: a vague seed
widens the whole universe. Adding rejected words would only encode BringBack’s
incident and fail again on another category or language.

**Implemented replacement.**

- Onboarding now asks for founder target searches alongside website and
  competitors, then shows evidence-backed business-family cards.
- Users can confirm, rename, remove, add, and reprioritize those cards before any
  audit cost is incurred. Extraction notes remain visible when a proposed family
  was removed because its exact page evidence could not be verified.
- One bounded positive classifier assigns every observed query to exactly one
  immutable audit family or rejects it as adjacent/unrelated.
- Harvest caps are fair across family and source; search-page seed selection is
  round-robin across families.
- Auto-discovery can search one confirmed direction from every family (bounded
  at 12 discovery searches) before selecting at most four competitors; it no
  longer ignores every family after the first four.
- Collapse, cluster construction, and duplicate checks cannot cross a family.
- The six-cluster program represents distinct available families before taking
  additional depth from a verbose family.
- Query, cluster, article, purchase, public report, and prospect-claim paths now
  carry the same mandatory family ID.
- Customer and prospect audit creation are transactional with their scope
  snapshots. Finalization rejects any cross-audit or cross-family relationship.
- The initial website, competitor set, brand profile, and confirmed scope now
  save in one database transaction; a failed scope constraint cannot leave an
  inserted or partially updated brand behind.
- Legacy audits remain visible under an unverified family but unpurchased ones
  require a new confirmed audit.
- Scope confirmation and customer-audit creation lock the same brand row. A
  concurrent edit/start cannot create two running audits or spend on a run whose
  scope changed while it was queued.
- A completed audit is reusable only for the same scope hash, exact subject URL,
  and normalized competitor set. Changing the site or competitors clears the
  current pointer and makes unmatched unpurchased evidence stale.
- Demand-token overlap is Unicode-aware; non-English searches are not erased by
  an ASCII-only tokenizer.
- Removed the unused flat `pool.ts`, blended `niche-filter.ts`, heuristic
  `language-filter.ts`, and semantic query blocklists.

**Deployment dependency.**
`supabase/migrations/20260731_confirmed_business_scope.sql` must be applied
before these application changes. Until then the preflight intentionally refuses
to start an audit. Existing completed, unpurchased audits must be rerun after
scope confirmation.

**Local verification.** `tsc --noEmit` passes and all 25 pivot-contract groups
pass. No production build was run, following the founder’s explicit instruction.

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

That first repair added a separate language word/suffix gate before demand.
It was later removed as the same incident-by-incident architecture the
confirmed-scope rewrite rejects. The positive classifier now requires a query
to use a language represented in the confirmed searches of its assigned
family. A multilingual customer can confirm multiple languages; an unconfirmed
translation is rejected without maintaining a global vocabulary list.

The retired detector used non-Latin script, foreign function words, and
morphological suffixes (`-ieren`, `-ção`, `-ość`, `-ement`). Suffixes matter:
"Alte Fotos animieren" contains no German function word at all, but `-ieren` is
unambiguous — morphology generalises where a word list only catches the case in
front of you.

Verified 16/16 against the exact production strings plus English controls,
including "café website design" which must survive its single loan diacritic.
Drops were reported as `languageFilter` in `/api/harvest/verify`; that retired
field no longer exists.

Contract suite now pins both durable rules: the merge loop must not `break` on
the display cap, and the retired heuristic language filter cannot return.


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
whose `started_at` is older than `AUDIT_STALE_AFTER_MINUTES` (30, against the
task's `maxDuration` of 1800s) is marked failed with
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
The source-only cap then took page-backed rows before autocomplete, so a subject
whose competitors published rich FAQ/blog content got a pool dominated by
unmergeable strings — and the ratio rises mechanically. **The gate was rejecting
audits based on a property of someone else's website.** It would recur on any
such niche, unpredictably from the URL alone. The current confirmed-scope
pipeline replaces that cap with family/source round-robin selection.

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

Current policy version: `evidence-bound-writer-v5.0.0`.
`collapseMin`/`collapseMax` remain removed; the contract suite pins their absence
plus the direct duplicate invariant so the proxy gate cannot be reintroduced.


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
  8-15 articles and the six-cluster program has a minimum of 25.
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
  fetching against a 1800s task budget). Competitors need only enough depth to
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
- Added mandatory provenance, hard source failures, demand validation, bounded
  site coverage, evidence verification, gap computation, and constrained
  clustering. The blended niche filter from this first version was superseded
  by confirmed business-family ownership on 2026-07-30.
- Removed quota-refill duplicate generation and the old LLM planning chain.
- Calibrated two-stage retrieval/evidence coverage against BringBack and
  PixReunion test sets.

## 8. AI-visibility probe — how the loop runs

The second gap source, added 2026-08-15. The Google harvest is unchanged and
still the default; these two coexist and answer different questions.

```
  confirmed families  (audit_scope_families — the customer already approved these)
        │
        ▼
  buyer prompts       prompt-builder.ts · one Gemini call per family
        │             10 per family, weighted to commercial intent
        │             never names any brand — that is what makes it a discovery test
        ▼
  answer engines      engines.ts · ChatGPT + Google AI Mode via Cloro
        │             the REAL consumer surfaces, submit-and-poll, not the APIs
        │             (trigger/run-probe.ts owns the run — a task can take minutes)
        ▼
  counted facts       answer-parser.ts · mentions, first-mention rank, citations
        │             ported from Ansvisor, MIT, Empler AI Inc.
        ▼
  verdict             gap-mapper.ts · absent / outranked / present
        │
        ▼
  GapItem[]           ← the join. Same shape computeGaps() returns.
        │
        ▼
  clusters            lib/harvest/clusterer.ts · UNCHANGED
```

### The two definitions of "gap" are not the same claim

| | Google harvest | AI probe |
|---|---|---|
| Question | Is this searched, and does your site answer it? | Does an engine name you when asked this? |
| Demand evidence | Observed (someone typed it) | Assumed (we constructed the prompt) |
| Coverage evidence | Your site was crawled and read | Not consulted at all |
| Provenance | Re-openable public URL | Stored verbatim answer |
| Reproducible | Largely | No |

`userStatus: "gap"` on an `ai_answer` item means *absent from the AI answer*. It
says nothing about whether the page exists on the customer's site. Do not
conflate them — a customer sold an article for a page they already have will
notice, and that is the credibility the audit trades on.

The two sources compose well and that is worth building next: a prompt the
engines don't name you for *and* your site doesn't answer is the strongest
signal this product can produce. It is not implemented.

### Which surfaces, and why those

| Surface | Via | Why |
|---|---|---|
| **ChatGPT** (`chatgpt-web`) | Cloro | ~63% of measurable B2B AI referrals. |
| **Google AI Mode** (`google-aimode`) | Cloro | The highest-reach Google surface for someone researching a purchase — it sits inside Search, unlike the Gemini app. |

Available but off by default: `google-aio`, `perplexity-web`, `gemini-web`.

**Claude is deliberately absent** despite being ~18.5% of B2B referrals — second
only to ChatGPT and well ahead of Gemini for this ICP. Cloro has no Claude
scraper, so Claude is only reachable through its API, and an API number sitting
beside two consumer numbers would corrupt the comparison. Revisit if a
consumer-surface Claude scraper ships. Until then this is a known blind spot in
the buyer segment that matters most, and it should be said out loud rather than
papered over.

### Why Cloro and not the provider APIs

The first implementation called the OpenAI Responses API and Gemini grounding.
That measured the wrong thing.

- **Petra Labs**, 900 trials across paid ChatGPT, free ChatGPT and the API, same
  prompts, same day: the same brand's visibility moved **32 percentage points**
  across the three surfaces. One brand appeared in 15-18% of chat trials and
  **zero** API trials — an API-only tool reports it at 0%, indistinguishable
  from a brand with no AI presence.
- **Ansvisor ships `allowedModels: []` on Starter, Growth and Enterprise.** Its
  commercial product is scraper-only; API-model tracking is a per-customer DB
  override. The people who wrote both paths decided the API path was not good
  enough to sell.

The consumer app is a different product wearing the same name: different system
prompt, model routing, retrieval stack, memory and personalisation. Cloro drives
the real surfaces and returns their markdown and sources.

It is also **cheaper**, which was not the expected result:

| Path | Per 40-prompt, 2-engine probe |
|---|---|
| Provider APIs | 80 calls x $10/1k web search + tokens ~ **$1.50-2.00** |
| Cloro | ~360 credits at ~$0.0004 ~ **$0.14** |

Credit figures are from Cloro's published pricing and are **unverified against
an invoice**. `ai_probe_runs.credits_used` records what each run actually
consumed so the first real bill can be reconciled against it.

### Running it

The probe runs on Trigger.dev (`run-visibility-probe`), not in the request.
Cloro is submit-and-poll and one task can take minutes; a serverless route would
time out mid-flight and strand a `running` row with no writer.

```bash
npm run dev
curl -s -X POST http://127.0.0.1:3000/api/visibility/probe \
  -H 'content-type: application/json' \
  -d '{"auditId":"<audit-with-confirmed-scope>","maxPrompts":20}' | jq
# -> 202 { runId, estimatedCredits, engines: [...] }

curl -s "http://127.0.0.1:3000/api/visibility/probe?runId=<runId>" | jq
```

Requires `CLORO_API_KEY`. Without it the route returns 503 rather than quietly
downgrading to the API surface — that fallback is opt-in via
`allowApiSurface: true`, and every answer it produces is stored with
`surface: "api"` and labelled as such in the UI.

Then read `/visibility/<runId>` and open several questions. If the stored
answers do not obviously support the verdicts, stop and fix that before anything
else.

### The dashboard

`components/visibility/visibility-dashboard.tsx`. Seven sections, in claim ->
evidence order: headline, rivals, per-surface split, cited sources (grouped by
what kind of source and what you can do about it), the shaped pages the engines
read, every question (expandable to the verbatim answer with brands marked in
place), and the cluster plan.

**Citation classification** (`lib/visibility/citation-classifier.ts`) exists to
turn a source list into a content decision. Rules are ordered by how well they
age:

1. **Facts from the audit** — `owned` and `competitor` come from the audit's own
   domains and competitor set. Never a guess.
2. **Structure** — `.edu`/`.gov`, and the URL's own path shape (`/best-…`,
   `/…-vs-…`, `/…-alternatives`). Works on hosts nobody has catalogued.
3. **Short curated lists** — Reddit, YouTube, G2 and a handful more. A contract
   test caps each at 15 entries: a list that needs a 16th means the rule is
   wrong, not the list.
4. **`unclassified`** — the honest default, reported as a first-class number.
   Above 33% the dashboard says the breakdown describes the limits of our lists
   rather than the market.

Ansvisor's classifier is the counter-example that set the design. Its
`editorial` list contains `motortrend.com`, `caranddriver.com` and
`jalopnik.com`; its `forum` list contains `bimmerpost.com` and
`teslamotorsclub.com` — one automotive customer's report, patched host by host.
That is the same decay this repo already hit twice with content-quality regex
lists.

The axis that matters is **publish vs earn**: a source you can write yourself is
a different job from one someone else has to publish about you. That split is
borrowed from upstream's own opportunity generator rather than its classifier.

**"Cited alongside you" is not "mentions you."** Each source carries how many of
the citing *answers* named the brand. We have not fetched the pages, so a claim
about a page's contents would be unsupported; the UI says so directly under the
list.

**The method panel** (`components/visibility/method-panel.tsx`) is Ansvisor's
best idea, adapted: their formula dialog imports the scoring weights from the
scoring module so the explanation cannot drift from the implementation. Here the
panel imports `PROMPT_INTENTS` and the classifier's own labels for the same
reason. It differs in what it spends space on — there is no composite to audit,
so it documents what each verdict means precisely, where the classifier stops
working, and what the measurement cannot tell you at all.

Chart forms follow the data's job. The rival chart is an **emphasis** form (the
brand in the accent hue, competitors in de-emphasis gray) because one series is
the point and the rest are context. Sources are **sequential**, one hue. The
question list is a **table** because seven-plus classes that all carry meaning
belong in a table. There is no trend line — see below.

The palette is the validated default from the data-viz method, run through the
six checks in both modes: light `#2a78d6`/`#eb6834` (adjacent CVD dE 24.7,
normal-vision 33.6), dark `#3987e5`/`#d95926` (26.8 / 31.8). Status colours are
fixed and always ship with an icon and a text label, never colour alone.

### Rules for the next agent

30. **A verdict is a count, never a score.** If you find yourself adding a
    threshold to decide whether something is a gap, the method is wrong. Absence
    is a fact; "visibility below 30" is an opinion with a number painted on it.
31. **Never truncate `answer_text`.** It is the only provenance this source has.
    A summarised answer is an unverifiable gap, which is precisely the claim
    this product exists not to make.
32. **A failed engine is not an absence.** Any new engine adapter must record
    its failures in the ledger and must not return an empty answer on error.
    With a scraper vendor this matters *more*, not less: Cloro tasks time out
    routinely, and a timeout rendered as "absent" is a fabricated finding.
33. **Do not add a trend line without measuring variance first.** Probe the same
    site three times in one day. Whatever spread you see is the noise floor, and
    any "improvement" smaller than it is not an improvement. Ship the number
    only after you can state that floor.
34. **Do not let the probe silently become the audit.** It measures a different
    thing (see the table above). If the two are ever merged into one report,
    each gap must still say which source produced it.
35. **Never average a consumer-surface number with an API-surface number.**
    They are measurements of different systems that diverge by up to 32 points.
    `ai_probe_results.surface` exists so every read path can group by it, and
    the dashboard reports per surface for the same reason.
36. **A curated domain list is a smell, not a feature.** If the classifier
    needs another host to get one customer's report right, the rule is wrong.
    Add a structural signal or let the citation stay `unclassified` — the
    contract test caps each list at 15 entries precisely so this decision has
    to be made deliberately.
37. **Never say a page omits the brand.** We do not fetch cited pages. The
    supportable claim is about the answers that cited it, and the wording in
    both the summary and the UI has to keep those apart.
38. **The method panel reads from the code, never from prose.** Any number or
    definition it states must be imported from the module that computes it. A
    hand-written formula is a doc that goes stale in silence — which is worse
    than having no panel, because the reader trusted it.
39. **Never re-run a probe as a retry.** `runProbeTask` is `maxAttempts: 1`
    deliberately: a retry re-submits every Cloro task and bills the credits a
    second time for a run whose partial answers are already stored.
