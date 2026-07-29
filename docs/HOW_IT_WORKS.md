# How FlipAEO Works — the plain version

Written for you, not for an engineer. No jargon. If something here doesn't match
what the code does, the code is right and this file is a bug.

---

## 1. The whole thing in one paragraph

Someone gives us a website. We go and collect real search questions from Google
and from competitor pages — never invented, always with a link back to where we
saw them. We check which ones their site already answers. The leftovers are
gaps. We group the gaps into themed batches of 3–15 articles ("clusters"). We
show them the six best clusters and say "this is your scope, here's what it costs
to close it." If they buy, we write and deliver one complete cluster at a time.
When all six are done, the subscription cancels itself.

That's it. Everything below is detail.

---

## 2. The four stages

```
  STAGE 1              STAGE 2           STAGE 3          STAGE 4
  AUDIT       ──▶      OFFER      ──▶    PURCHASE   ──▶   DELIVERY
  (free)               (free)            (paid)           (over months)

  find the gaps        show scope        freeze it        ship clusters
                       + price                            then auto-cancel
```

Each stage hands the next one something fixed. Nothing recalculates behind the
customer's back.

---

## 3. Stage 1 — The audit

### What it does, in order

1. **Work out the seeds.** 2–6 short phrases describing what the business does,
   pulled from their brand info. Example: `old photo restoration`.
2. **Ask Google Autocomplete** for real searches around those seeds.
3. **Read the top-ranking pages** for those seeds and pull out the questions
   those pages answer.
4. **Read competitor pages** and take their actual headlines.
5. **Throw away junk** — page furniture, competitor support FAQs, off-topic drift.
6. **Read their site** and work out which questions it already answers.
7. **Subtract.** Everything left over is a gap.
8. **Group the gaps** into clusters and give each one a title.

### Real numbers from an actual run (bringback.pro, 3 seeds, 1 competitor)

| | |
|---|---|
| Questions collected | 744 |
| Survived the junk filters | 395 |
| Their site already answered | 170 |
| **Gaps** | **225** |
| Gaps merged into articles | 63 |
| Clusters formed | 5 |
| Time | 105 seconds |

Note 225 gaps became 63 articles. That's on purpose — `restore old photos free`
and `free old photo restoration` are the same article, so they merge.

---

## 4. Where every API call goes

This is the part you asked about. Here's exactly what fires and what controls it.

### Google Autocomplete — the biggest count, but free

**Formula:** `seeds × 34`, plus 20, plus one per short page-derived phrase.

Where `34` comes from: for each seed we ask for the bare seed, the seed followed
by each of the 26 letters, and 7 question forms (`how to`, `what is`, `why`,
`best`, `is`, `vs`, `for`).

| Seeds | Harvest calls | + deep pass | + demand checks | **Total** |
|---|---|---|---|---|
| 1 | 34 | 20 | ~50 | **~105** |
| 3 | 102 | 20 | ~150 | **~270** |
| 6 | 204 | 20 | ~200 | **~420** |

**What increases it:** more seeds (linear), more competitors (more page phrases
to demand-check).
**Cost:** $0. It's a free public endpoint.
**Risk:** it's undocumented, so we now retry with backoff and cache results for
an hour. At 20 customers you're at ~200 calls/day — Google won't notice.

### Tavily search — small count, real money

One search per seed (max 6), plus a couple for finding competitors.
**~5–8 searches per audit.** This is your main audit cost.

### Page fetches — free but slow

| What | Cap |
|---|---|
| Their own site | 150 pages |
| Each competitor | 80 pages |
| Competitor headline harvest | 120 pages total |
| **Worst case** | **590 fetches** |

Typical real audit: ~80. The caps exist so one huge site can't run past the
15-minute task limit.

### Embeddings — one per question, one per page

~400 questions + ~80 pages = ~480. Fractions of a cent.

### Gemini text generation — only 2 calls in the whole audit

One writes the article titles, one names the clusters. **The AI never decides
what the topics are** — it only labels topics that were already found in the
wild. That's the core rule.

---

## 5. Why six clusters

Three separate reasons stack up:

1. **A cluster is only useful whole.** Articles in a cluster link to each other.
   Half a cluster is a broken web of links.
2. **Six is a real program, not a taster.** Six clusters × 3–15 articles = 25+
   articles minimum. Enough to actually move a site.
3. **It ends.** Six is a finite promise. Your old product promised 30 articles a
   month forever, ran out of real topics around month three, and started
   repeating itself. That's why everyone churned. Six clusters means the work
   genuinely finishes and you say so.

If a site can't produce six qualified clusters (each needing 3–15 articles), **we
refuse the sale.** That's deliberate. A niche too small to fill six clusters is a
customer who'd churn in two months.

---

## 6. Stage 2 & 3 — Offer and purchase

The customer sees: *"Your niche is 63 articles across 5 clusters. Here are the
six best. Choose how fast you want them."*

| Tier | Price/month | Speed | Payments | **Total** | Per cluster |
|---|---|---|---|---|---|
| Close | $249 | 1 cluster/month | 6 | **$1,494** | $249.00 |
| Accelerate | $449 | 2 clusters/month | 3 | **$1,347** | $224.50 |
| Dominate | $599 | 3 clusters/month | 2 | **$1,198** | $199.67 |

**Same work. Same six clusters. Only the speed differs.** You're selling
delivery rate, not quantity — that's why a big niche doesn't cost you money.

### Why the cluster counts are 1, 2 and 3 — never 4

Every tier's cluster count **must divide 6 exactly**, so the subscription ends on
a whole billing period.

Dominate used to ship 4 clusters a month. Six doesn't divide by four, so the
second period delivered only 2 clusters but still charged a full $799 — which
made the *fastest* tier the *most expensive overall* ($1,598), and made Close
strictly worse than Accelerate on both price and speed. Nobody could explain the
table, including the people who wrote it.

With 1, 2 and 3 the periods come out at 6, 3 and 2, the per-cluster price falls
as speed rises (an ordinary volume discount), and the subscription always ends
cleanly.

This matters technically too: **Dodo has no "limit the number of billing cycles"
field** on subscription creation. A program ends by calling
`cancel_at_next_billing_date` after cluster six (see
`lib/harvest/billing-lifecycle.ts`). Landing on a whole period is what keeps that
from becoming a partial-period refund problem.

### What "freezing" means

Before they pay, we lock down: which audit, which six clusters, every article's
title, every article's final URL, and every internal link between them.

**Why:** payment confirmations can arrive minutes or hours later. Without a
freeze, a webhook arriving late could accidentally sell whatever the newest audit
happened to say. Freezing means they get exactly what they saw on screen.

---

## 7. Stage 4 — Delivery

### What happens each month

1. A scheduled job wakes up and asks: is any cluster due today?
2. If yes, it writes **every article in that cluster**.
3. It checks each article actually contains the internal links we promised.
4. Only when **all** of them pass does the cluster become visible to the customer.
5. The customer can then publish to WordPress, or copy them out.

### The important rule

**A half-finished cluster shows nothing.** If article 9 of 12 fails, the other 11
stay hidden and we retry only the broken one. The customer never sees a cluster
with dead internal links.

### What happens at the end

After cluster six delivers, we tell Dodo to cancel at the end of the current
billing period. The customer sees *"Program scope delivered."*

**They are never charged for a seventh month.** This is the single biggest change
from the old product.

---

## 8. What's public and what isn't

You asked why "the expensive audit route is public." **It isn't.** Here's the
actual split:

| Thing | Who can do it | Costs money? |
|---|---|---|
| Run an audit on your own site | Logged-in customer | Yes |
| Run an audit on a prospect's site | **Founder only** — everyone else gets a 404 | Yes |
| **View a finished report via its link** | **Anyone with the link** | **No** |
| Buy a program | Logged-in, and only when checkout is switched on | Yes |

The **report page** is public. Running the audit is not. Nobody can burn your
API budget — a stranger with a link is just reading a page that already exists.

The links are long random tokens, marked `noindex` so Google won't list them, and
you can revoke one at any time.

**Why make reports public at all:** so you can send a prospect a link without
making them sign up first. Your old funnel demanded a signup before showing
anything, and 78% of people left at that wall.

---

## 9. When things go wrong

| Problem | What happens |
|---|---|
| Google Autocomplete rate-limits us | Retry with backoff. If it truly fails, **the audit stops** — we won't build a plan on missing evidence. |
| Tavily key is wrong | Audit stops immediately and says so. (This used to fail silently.) |
| A competitor site has no sitemap | Audit stops. Better than a half-blind comparison. |
| One article fails to generate | Its cluster stays hidden. We retry that article only. |
| Payment webhook arrives twice | Second one is ignored. One program, one charge. |
| Customer re-runs their audit mid-program | New audit is stored separately. **Their running program does not change.** |
| Cancellation call to Dodo fails | Retries, then emails you. |

The pattern: **when we're unsure, we stop rather than guess.** A wrong audit is
worse than no audit, because the whole product claim is that our evidence is
real.

---

## 10. What it costs you per customer

Calculated from your provider rates (Gemini $0.50/M in, $3.00/M out; Tavily
$0.008/credit; images $0.005/megapixel):

| Item | Cost |
|---|---|
| One audit | ~$0.20 |
| One article | **$0.13 – $0.33** |
| One cluster (12 articles) | **~$2 – $4** |
| Fixed monthly stack | $95 (Supabase $25 + Vercel $20 + Trigger $50) |

Even taking a very conservative $1.00 per article, a 12-article cluster costs
about $12 against $249 of revenue — **95% gross margin**. One customer's first
cluster covers the entire monthly infrastructure bill.

**Cost does not constrain your price.** Price is a positioning and volume
decision, not a cost-recovery one. `program_cost_events` still records real token
usage per call, so verify this against a live cluster before scaling — but the
order of magnitude is settled.

---

## 11. The rules that must never break

If a future change breaks one of these, the product is back to being a $19
competitor with nicer copy.

1. **Every question must link back to where we saw it.** No source URL, no entry.
2. **The AI never invents a topic.** It only labels and titles what was found.
3. **"Covered" means a specific page actually answers it** — not that the site is
   vaguely about the same subject.
4. **Clusters ship whole or not at all.**
5. **Programs end.** Six clusters, then cancel.
6. **Small niches get refused**, not sold a plan that will run dry.

---

## 12. How this differs from what we first discussed

The direction changed, and mostly for the better. For the record:

| First plan | Now | Why it changed |
|---|---|---|
| Sell "scope + velocity", open-ended | Finite six-cluster program that auto-cancels | Open-ended subscriptions are what killed the old product |
| Coverage by similarity score | Similarity **plus** a check that the page really contains the terms | Testing proved similarity alone rated a site 99% covered when it covered almost nothing |
| Audit could be re-run over itself | Every audit is a permanent record | A re-audit could otherwise change what somebody already paid for |
| Pay, then we figure out the plan | Everything frozen before payment | Late webhooks could sell the wrong thing |

The thing that has **not** changed: the whole product rests on the audit being
verifiable. Every hardening decision above exists to protect that one claim.
