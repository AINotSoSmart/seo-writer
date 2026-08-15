# FlipAEO Roadmap — what we decided not to build yet, and why

This file is for work that is **planned, deferred, or deliberately rejected**.
`PIVOT.md` records what was built; this records what was not, and the reasoning
that would otherwise have to be rediscovered.

**Rules for this file.** Every entry states: what it is, the evidence it rests
on, what it costs, and what would trigger building it. Claims cite a file, a
line, or an external source. An entry with no trigger condition is not a
roadmap item — it is a wish, and belongs in a conversation instead.

Upstream references point at
[`AINotSoSmart/flipaeo-visibility`](https://github.com/AINotSoSmart/flipaeo-visibility),
the open-source project this repo's `lib/visibility/` was ported from.

---

## 1. Deferred — "you already have a page for this" via target URLs

**Status:** designed, not built. Deferred 2026-08-15.

### What it is

Every losing question currently produces the same verdict: *write a new
article*. That is wrong whenever the customer already has a page on the topic —
and a second page on the same topic is worse than none, because the two compete.

The fix is not to guess which page they have. It is to let them tell us, and
then check whether the engines actually cited it.

Per prompt, one optional field: **which page of yours should win this?** Then
match it against the citations we already store.

### Worked example

Brand: a meeting-notes tool. Confirmed question:

> *"what's the best way to get automatic summaries of my zoom calls?"*

Customer supplies `example.com/features/zoom-summaries`. The probe runs; the
stored answer carries citations to `otter.ai`, `zapier.com`, `fireflies.ai` —
and not to them. The report can then say:

> **You have a page for this. ChatGPT cited three others and not yours.**
> Your page: `/features/zoom-summaries` — cited 0 times across 4 answers.

Today the same run says only "you were absent", which is a mystery rather than a
work order.

### The three states, all measured rather than inferred

| Signal | Meaning | Action |
|---|---|---|
| No URL supplied | We know nothing about their coverage | Say nothing. Never imply a hole we did not check for |
| URL supplied, never cited | The page exists; engines do not reach for it | Fix that page |
| URL supplied, cited, brand still unnamed | Engines read it and still did not name them | Rare. Usually the page never plainly states what the product does |

Row 1 matters as much as the others: it is the honest state, and it is what the
system reports today *without saying so*.

### Why this is cheap

- **Zero** extra API calls, fetches or credits. One normalised string comparison
  per citation (protocol, `www.`, query, trailing slash).
- We already store citations verbatim: `ai_probe_results.citations`, written in
  [`lib/visibility/run-probe.ts`](../lib/visibility/run-probe.ts).
- Cost is one optional input, one column on `ai_probe_prompts` (**new migration
  required** — this repo forbids editing applied ones), a counter beside the
  existing citation parsing, and a report section.

### Why it is deferred, and the property that makes deferring free

**Because the citations are stored verbatim, a target URL supplied later can be
matched against runs that already happened.** Building this in three months
costs exactly what building it today costs, and it will work retroactively on
every probe already recorded. There is no first-mover cost to waiting — which is
rare, and it is the whole argument.

Meanwhile **not one prompt has ever been asked** (no `CLORO_API_KEY` in this
repo). Building a control surface on top of questions nobody has read would be
building on an unverified foundation.

### Where it must NOT go

Not in onboarding. A URL field per question, before the customer has seen a
single result, is friction at the point of least motivation and highest drop-off.

It belongs **on the report**, on a question the customer has just been told they
lost, where the dashboard already has expandable per-prompt rows
([`visibility-dashboard.tsx`](../components/visibility/visibility-dashboard.tsx)).
It resolves instantly against stored citations. It is also self-selecting: only
customers who care about a specific question will fill it in, and those are
exactly the answers worth having.

### Upstream precedent

`server/src/lib/target-url-stats.js` — a `prompt_target_urls` table, and
`cited_count` / `first_cited_at` / `last_cited_at` maintained by matching each
freshly stored result's citations against the prompt's registered URLs, with
"best-effort" normalised comparison. Same mechanism, already in production
somewhere.

### Build trigger

Two real probe runs completed and their answers read by hand, **and** a
meaningful share of losing questions turning out to be topics the customer
already covers. If the engines already cite their domain for most questions, row
2 barely exists and this was never the problem.

### Known risk to design around

If customers skip the field, we learn nothing. Pre-filling a guess from their
sitemap for them to confirm or correct is the obvious mitigation — and is also
the thing most likely to quietly grow this into the crawl-based feature that was
already rejected (§3). Decide that boundary before building, not during.

---

## 2. Deferred — single-page AEO audit with paste-able fixes

**Status:** not designed. Deferred 2026-08-15.

### What it is

§1 tells a customer **that** their page is not cited. It cannot say **why**.
This would: fetch that one page, score it against a rubric of independent
signals, and return specific fixes.

### Why it is much smaller than it sounds

Upstream's `server/src/lib/audit/fetcher.js` **fetches exactly one URL per
call** — no sitemap, no discovery, no recursion — through a proxy with optional
JS rendering, explicitly to match how AI crawlers see the page. Direct fetch for
`robots.txt` / `llms.txt` with a proxy fallback on `401/403/405/406/429/503`,
8s timeout.

`server/src/lib/audit/engine.js` iterates a signal registry where a signal that
throws is recorded `na` rather than aborting the run — "one bad check never
sinks the whole audit". Signals live in `audit/signals/`:
`authority`, `content`, `eeat`, `structure`, `trust`.

`server/src/lib/audit/recommendations.js` sends only the **failed** signals plus
page content to a model, and returns per-signal `{ priority, recommendation,
draft }` — paste-able text for meta descriptions, H1s, FAQ schema, readability
rewrites — while excluding mechanical signals (HTTPS, alt-text) from
model-written advice.

That is a self-contained deliverable that never touches the article pipeline,
the cluster floor, or the writer.

### Build trigger

§1 shipped and showing that customers land in state "URL supplied, never cited"
often enough to matter. Not before — this is months of signal-tuning if the case
is rare.

---

## 3. Rejected — full-site coverage scan for the visibility path

**Status:** rejected 2026-08-15. Do not reintroduce without reading this.

The old Google harvest read the customer's site and subtracted what they already
covered. The obvious move was to reattach it to the probe path so gaps stop
proposing articles for pages that exist.

**Why it was rejected:** `HARVEST_POLICY.maxCoveragePages` is 150, and
[`coverage.ts`](../lib/harvest/coverage.ts) takes `contentUrls.slice(0,
pageBudget)`. On a 20,000-URL store that reads **0.75% of the site** and then
reports "you have no page for this."

The problem is not the crawl budget. It is that the claim would be
**fabricated** — a confident answer from evidence that cannot support it. That is
the same failure class as the absolute-threshold coverage incident already
documented in `PIVOT.md`, where a site covering almost nothing was reported at
99% authority.

§1 solves the same problem by asking the customer instead of guessing, at zero
crawl cost and with no sampling error. The scanner stays where it is, correct
and unused by this path.

---

## 4. Rejected — weighted opportunity scores and search-volume purchase

**Status:** rejected. Restates and reinforces the `PIVOT.md` fourth-pass
decision.

Upstream's `server/src/lib/opportunity-generator.js` ranks with:

```
nv * 40  (normalised volume, capped at 50k/mo)
vg * 30  (visibility gap = 100 - visibility score)
cg * 20  (competitor gap)
iw * 10  (intent weight, 0.5–1.0 by category)
```

Two independent reasons not to port it:

1. It is a hand-weighted composite. A customer cannot check it, and a movement
   in it cannot be attributed to anything — the exact reason this repo already
   refused upstream's 0–100 visibility score.
2. `nv` requires paid search-volume data (DataForSEO), which `PIVOT.md` already
   examined and declined, including its hardcoded `AI_VOLUME_MULTIPLIER` with no
   derivation.

---

## 5. Rejected — daily tracking, trend lines, and digests

**Status:** rejected. Reinforced by upstream's own behaviour.

`PIVOT.md` refuses trend claims because a probe samples a non-deterministic
system, so a delta between two samples is mostly noise and attributing it to
published articles is a causal claim the data cannot support.

Worth noting: upstream's `server/src/lib/pulse/engine.js` **also computes no
deltas.** It snapshots a rolling window (1 day / 7 day), and manages noise with a
7-day cooldown so the same warning does not repeat for the same subject. Even the
product built around daily tracking declined to claim trends.

Revisit only after repeated same-day sampling establishes the variance first.

---

## 6. Rejected — open-ended entity extraction from answers

**Status:** rejected, with the consequence documented.

It is tempting to extract *any* brand named in an answer rather than counting
only tracked competitors. Upstream does not do this either
(`server/src/lib/response-parser.js` counts the supplied list only), and the
reason is the product's core epistemics: *"ChatGPT named Notion and not you"* is
checkable against the stored answer; *"a model believes it saw a brand name"* is
not.

**The consequence must be managed, not ignored:** a rival we do not track is a
rival we cannot see. That is why competitor discovery was reconnected as probe
phase 0 (see `PIVOT.md`, ninth pass) and why `summary.competitorTracking` records
whether an empty leaderboard is a finding or a failure.

Partial mitigation already in place: **citations are open-ended.** Every cited
URL is captured whoever owns it, so unknown players surface as sources even
though they cannot surface as names.

---

## 7. Open defect — every probe measures the United States

**Status:** live bug. Not yet fixed.

[`engines.ts`](../lib/visibility/engines.ts) `buildCloroPayload` does
`const country = (countryCode || "US").toUpperCase()`. The value is plumbed all
the way through `trigger/run-probe.ts` → `runVisibilityProbe` → the Cloro
payload — but **`app/api/visibility/probe/route.ts` never sets it**, and nothing
in onboarding collects it.

So a customer in Germany, India or Australia is measured against US answers, and
nothing on the report says so. `brand_data.search_country` exists but is a Tavily
preference string (`"australia"`), not an ISO country code.

Language is a second, larger hole: `buildCloroPayload` takes a country and no
language at all.

Fixing the country is small and should ride along with any onboarding change
(§8). Language needs `engines.ts` work first.

---

## 8. Proposed — onboarding rework

**Status:** proposed 2026-08-15, not approved, not built.

Prompted by comparing our flow against upstream's live onboarding.

| Ours today | Upstream | Worth taking? |
|---|---|---|
| Website → Your brand → What you sell → AI Prompts → Extras (competitors) → Audit | Brand → **Target market (region / state / language)** → **Topics** → Review prompts → **Competitors (required)** → done | Partly |

**1. Collect region and language, early.** Upstream's first screen is "Select
your target market", framed as *"Pick the region and language your audience
uses. This helps us deliver more accurate AI visibility data."* This directly
fixes §7, and it is a question customers understand instantly.

**2. Rename "product areas" to "topics", and state the arithmetic.** Upstream
says *"5 prompts are created per topic"* and *"More can be added anytime from the
dashboard"* — the second clause removes the fear of getting it wrong. Our screens
say "What you sell" / "product areas" / "scope families" and never tell the
customer how many questions an area yields. `PIVOT.md` already records this exact
drift once: the method panel claimed "each confirmed business area gets 10
questions", which stopped being true the moment a run-wide cap applied.

Naming is customer-facing only. `scope_families` is load-bearing across the
database, the RPCs and the writer contracts; **do not rename the code.**

**3. Competitors need a reason and near-mandatory status.** Upstream explains
*"We'll track how often competitors appear alongside your brand in AI responses"*
and disables the button with *"Add a competitor to continue"*. That is correct
for the same reason established in §6: the list is the entire rival column. Ours
is an unexplained optional field on the extras screen. Now that discovery is
reconnected, the strongest version is: **show the auto-discovered list for
confirmation** and require at least one to survive.

**4. What NOT to change.** The brand profile screen is already three fields
(product name, what it is, category) with everything else behind an "Edit full
brand details" accordion — it is not the wall it looks like. And those extra
fields are **not vestigial**: `trigger/generate-blog.ts` consumes
`core_features`, `pricing`, `uvp`, `how_it_works` and `style_dna`, including a
`product_aspect` selector that picks which block to inject into a section. They
are not useless — they are *early*. The real improvement is deferring the
accordion to just before the first article is generated, not deleting it.

**5. What NOT to copy.** Upstream tells customers prompts "will be sent to AI
platforms daily". We deliberately do not do daily tracking (§5).

### Build trigger

Founder approval. Item 1 is worth doing regardless, because §7 is a correctness
bug rather than a polish item.
