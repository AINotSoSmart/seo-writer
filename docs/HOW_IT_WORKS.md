# How FlipAEO Works — the plain version

Written for you, not for an engineer. No jargon. If something here doesn't match
what the code does, the code is right and this file is a bug.

---

## 1. The whole thing in one paragraph

Someone gives us a website, optional competitors, and their main customer
searches. We show the distinct product/service areas we found with exact page
evidence; they correct and confirm that business scope before research starts.
We then write the questions a buyer would type into ChatGPT about those areas,
show them the questions, and let them edit, delete and add before anything is
asked. Then we ask the real ChatGPT and the real Google AI Mode. Every question
where the answer names competitors and not them is a gap. We group those gaps
inside each area, and show the six-cluster program before payment. If they buy,
we deliver one complete cluster at a time. After cluster six, cancellation is
scheduled for period end.

That's it. Everything below is detail.

**One thing changed on 2026-08-15 and this file is still catching up.** The
sentence above used to read "we collect real search questions from Google and
competitor pages, then check which ones their site already answers". That
machinery still exists and still works — §3 and §4 describe it — but nothing
calls it after onboarding any more. §11.5 is the current path and the honest
comparison of what we gained and what we gave up.

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

> **Read §11.5 first if you are following a live customer.** Steps 2–4 below
> describe the Google harvest, which is no longer what runs after onboarding.
> Step 1 — confirming the business scope — is unchanged and still comes first;
> what happens after it is now the AI-visibility probe. The rest of this section
> stays because the harvest is still in the code, still correct, and is the
> fallback if the answer engines turn out to be the wrong bet.

### What it does, in order

1. **Confirm the business scope.** Ask what people type into Google to find a
   tool like theirs, read the product pages, and show the distinct areas we
   found. Every search they typed becomes an area — if our reading of the site
   missed it, theirs wins. Areas we could not match to a line on their site are
   shown marked "not found on your site" rather than quietly dropped, and
   searches Google has never heard of are marked "rarely searched". They rename,
   remove, add, and reorder before anything is researched.

   *Why it works this way:* an earlier version buried this in a prompt that also
   wrote brand-voice prose, required an exact word-for-word quote, and deleted
   anything it could not match. A tool that turns prompts into mobile app screens
   came back as one area called "Design Handoff and Implementation" — a step
   inside the product — which would have pointed the whole audit at the wrong
   competitors.
2. **Ask Google Autocomplete** for real searches around the confirmed searches.
3. **Read the top-ranking pages** for those searches and pull out the questions
   those pages answer.
4. **Read competitor pages** and take their actual headlines.
5. **Enforce confirmed ownership.** Each observed query must directly belong to
   exactly one confirmed family and use a language represented by that family’s
   confirmed searches. Adjacent and unrelated queries are rejected.
6. **Read their site** and work out which questions it already answers.
7. **Subtract.** Everything left over is a gap.
8. **Group inside each family.** Different confirmed customer jobs cannot merge
   into the same article or cluster.

### BringBack must be re-measured

The previous BringBack numbers came from the retired flat-scope pipeline and are
not product evidence. The next staging run must confirm restoration, animation,
family portraits, add/remove person, nostalgic hug, and memory-book families
before its counts are recorded here.

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
| 12 (hard maximum) | 408 | 20 | varies | **bounded by policy** |

**What increases it:** more seeds (linear), more competitors (more page phrases
to demand-check).
**Cost:** $0. It's a free public endpoint.
**Risk:** it's undocumented, so we now retry with backoff and cache results for
an hour. At 20 customers you're at ~200 calls/day — Google won't notice.

### Tavily search — small count, real money

One search per selected confirmed search, taking one from every family before a
second from any family (maximum 12). Automatic competitor discovery may make
one additional search per confirmed family (also capped at 12) before selecting
at most four competitors. This is the main paid audit cost.

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

### Gemini — constrained classification plus labels

The positive scope classifier handles batches of 50 observed queries: at most
12 successful batches for the 600-row pre-scope cap, with at most one bounded
retry per batch. One later call writes article titles and one names clusters.
The classifier cannot invent a family or query; it may only assign observed
evidence to a customer-confirmed family or reject it.

---

## 5. Why six clusters

Three separate reasons stack up:

1. **A cluster is only useful whole.** Articles in a cluster link to each other.
   Half a cluster is a broken web of links.
2. **Six is a real program, not a taster.** Six clusters × 8–15 articles = 25+
   articles minimum. Enough to actually move a site.
3. **It ends.** Six is a finite promise. Your old product promised 30 articles a
   month forever, ran out of real topics around month three, and started
   repeating itself. That's why everyone churned. Six clusters means the work
   genuinely finishes and you say so.

If a site cannot produce six qualified clusters (each needing 8–15 articles),
**we refuse the sale.** The evidence remains viewable, but no checkout is shown.

---

## 6. Stage 2 & 3 — Offer and purchase

The customer sees the measured queries, all clusters and articles, their
confirmed business-family labels, and source evidence. If at least six clusters
and 25 selected articles qualify, the six-cluster offer becomes available.

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
| Two planned articles turn out near-identical | **The audit stops.** That means clustering failed to merge them, and shipping both would be selling the same article twice. |
| An audit fails and the customer refreshes the page | Nothing re-runs. The failure is shown, and a retry is refused for 15 minutes. After 3 failures in that window retries stop entirely. |
| The background worker never picks the job up | After 20 minutes the audit is marked failed automatically and becomes retryable. Previously it showed a loader forever and blocked every retry. |
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
2. **The AI never invents a query or business area.** It may assign observed
   evidence to one customer-confirmed family, reject it, or label/title it.
   When it cannot verify an area it proposed, it says so and asks — it never
   deletes the area, and it never overrules a search the customer typed.
3. **"Covered" means a specific page actually answers it** — not that the site is
   vaguely about the same subject.
4. **Clusters ship whole or not at all.**
5. **Programs end.** Six clusters, then cancel.
6. **Small measured scopes get refused**, not sold a program that will run dry.
7. **Every query, cluster, and article belongs to one immutable confirmed
   business family.** No blended-centroid or word-blacklist fallback.

---

## 11.5 The new bit: asking the AI engines directly

Added 2026-08-15. **As of the same day, this is what runs when someone finishes
onboarding** — the Google harvest described in §3 is still in the code and still
works, but nothing calls it any more.

The reason is blunt: onboarding shows you the buyer questions and asks you to
edit them, so those are the questions that have to get asked. It used to show
you the questions and then run the Google harvest, which measured something
else entirely.

### 11.5.1 What makes the content plan now, step by step

This is the question worth being precise about, because the top half of the
funnel changed and the bottom half did not.

```
  confirmed areas          (unchanged — you still confirm what you sell)
        ↓
  buyer questions          NEW: written per area, shown to you, edited by you
        ↓
  asked of ChatGPT
  and Google AI Mode       NEW: the real consumer apps, via Cloro
        ↓
  who got named            NEW: absent / named-but-never-first / present
        ↓
  ═══════════ everything below this line is the ORIGINAL machinery ═══════════
        ↓
  one gap per lost
  question                 same GapItem shape the Google harvest produced
        ↓
  collapse near-
  duplicates into
  articles                 collapseToArticles  (unchanged)
        ↓
  title them               titleArticles       (unchanged)
        ↓
  group into clusters      groupIntoClusters   (unchanged, still 8–15)
        ↓
  absorb orphans           absorbOrphanedUnits (unchanged)
        ↓
  name the clusters        nameClusters        (unchanged)
        ↓
  freeze article
  contracts                freezeArticleContracts (unchanged)
        ↓
  save                     finalize_audit_run  (unchanged)
```

There is exactly one clusterer in this codebase and there always has to be one.
A second one would drift from the first, and then the report and the plan would
stop agreeing about what was sold.

### 11.5.2 What died, and what only moved

| Old step | Status now |
|---|---|
| Google Autocomplete (the biggest call count) | **Not used.** Demand is no longer proved by autocomplete — it is proved by an engine choosing to answer the question at all. |
| Top-ranking-page questions (SERP) | **Not used.** |
| Competitor headline harvest via Tavily | **Not used as a demand source.** "Competitors" now means whoever the AI actually named instead of you, which is a stronger claim than "they published a page about it". |
| Demand re-validation (is this really searched?) | **Not used.** A question the engine answered is a question someone asks. |
| Scope classification of harvested queries | **Not needed.** Each question is generated inside one confirmed area, so ownership is structural rather than assigned afterwards. |
| Reading your site to see what you already cover | **Not done. This is the real loss — see below.** |
| Clustering, titling, absorption, naming | **Unchanged, byte for byte.** |
| Tavily research when an article is written | **Unchanged.** The writer still does a full contract-bound research pass at generation time. Tavily did not go away; it just isn't used to *find* the topics any more. |

### 11.5.1b Two countries, and why we ask you twice

This looks like a duplicate question and isn't.

**Market** (on the brand screen) is where the *buyer* is. ChatGPT and Google
answer differently in Berlin and Boston, so this decides which country's answers
we ask for. There is no "global" option, because there is no global answer — an
engine answers from somewhere whether or not you choose, and not choosing just
silently picks the United States.

**Research country** (on the last screen) is where our *sources* come from —
which pages we read when finding your rivals, and later when writing your
articles. "Global" is a perfectly good answer here, and it is the default.

They usually match. They don't have to: a German company selling into the US
wants American answers measured, and may still be happy for its article research
to range globally. Collapsing them into one control was tried and reverted,
because it would have quietly changed which sources every future article cites.

### 11.5.2b Why the competitor list still matters more than ever

Worth being blunt about, because it is counter-intuitive: **the AI probe does
not discover who beat you.** It counts names it was given. There is no
open-ended "which brands appeared in this answer" extraction anywhere — not in
our code and not in the open-source project ours was ported from.

That is a deliberate trade, not an oversight. "ChatGPT named Notion and not you"
is a claim you can check by reading the stored answer. "A model believes it saw
a brand name" is not. The price of that certainty is that a rival we are not
tracking is a rival we cannot see.

So the tracked list *is* the rival column. If it is empty, the report can tell
you that you are absent and can never tell you who took your place — which is
the half customers actually care about.

The probe therefore resolves the list **before it asks anything**: your own
competitors first, then a web search fills the remaining slots up to four. If
that discovery fails, the report says so in the rivals section instead of
showing an empty chart, because "nobody was named" and "we had nobody to look
for" are opposite findings that look identical.

Citations are the exception, and a useful one: every URL the engines cite is
captured whoever owns it. So unknown players do still surface — as sources
rather than as names.

### 11.5.3 The one thing we gave up, said plainly

The old audit read your site and subtracted what you already cover. The probe
does not. It knows one thing — an answer engine didn't name you — and it says so
honestly: internally every gap is marked "absent from the AI answer", which is a
claim about the engine, not about your site.

The practical consequence: **the plan can propose an article about something you
have already written.** Not because it thinks the page is missing, but because
it never looked.

That is survivable and arguably even correct — if ChatGPT doesn't name you for a
question you already have a page for, the page isn't doing its job and a better
one is a reasonable answer. But it is a different promise from the old one, and
nobody should sell "we found what's missing from your site" off this pipeline
until the coverage scan is bolted back on. Bolting it back on is not hard: the
scanner still exists and still works.

### 11.5.4 What it does Takes the business areas you already confirmed, writes the
kind of question a buyer actually types ("what's the best tool for turning a
sketch into a working screen?"), and asks **the real ChatGPT and the real Google
AI Mode** — the same thing a person sees, not a developer API. Then it counts:
did they name you, who did they name instead, and which pages did they cite.

Anything you're absent from becomes a gap, and those gaps go into the *same*
cluster machinery as everything else. The output is the same kind of plan — only
the reason has changed:

> Old: "17 articles, because Google autocomplete and competitor pages say these
> topics have demand."
>
> New: "You were absent from 26 of 42 buyer questions. Competitors were named in
> 19. These 17 articles target those 26."

**Why the "real" bit matters so much.** The first version of this asked ChatGPT's
developer API instead of the app. Those are not the same thing. Someone measured
900 trials across the paid app, the free app and the API on the same day: the
same brand's score moved **32 points** depending which one you asked. One brand
showed up in 15-18% of app answers and *zero* API answers — a tool using the API
would have reported that brand at 0%, exactly like a brand nobody has heard of.

Imagine sending that report. The founder opens ChatGPT, types the question, sees
their own name, and never replies to you again. So we route through Cloro, which
drives the actual apps. It also costs about a tenth as much (~$0.14 a run versus
~$1.50-2.00), so the accurate way was also the cheap way.

**What you'll see.** One page. A big number (how often you got named), who got
named instead, how the two engines differ, which pages the answers were built
from, then every question we asked. Click any question and the actual answer
opens underneath — word for word, with your name and your competitors' names
highlighted where they appear. If a claim isn't backed by the answer below it,
the claim is wrong. That's the point: it's checkable.

**The bit that turns it into work.** The report doesn't just list which sites
the engines cited — it says what kind of site each one is, and whether you can
do something about it yourself. Two numbers up top: how much of what the engines
read is stuff you could *publish* (your pages, a competitor's page you could
answer better), and how much you have to *earn* (a G2 listing, a Reddit thread,
press). Then a list of the actual "best X" articles and comparison pages the
answers were built from — because that's how an engine decides who to
recommend, and getting onto those is a concrete job.

Two honesty notes on that. When it says "none of the answers citing this page
named you", that's about the answers, not the page — we haven't opened those
pages, so we can't tell you whether a given one mentions you. And when it can't
work out what kind of site something is, it says "uncategorised" rather than
guessing; if that number gets above a third, the page tells you to ignore the
categories and read the list instead.

**"How these numbers work"** — a button at the top opens the arithmetic behind
every figure on the page, plus a plain list of what this measurement *can't*
tell you. Most tools hide that. Showing it is the cheapest trust you'll ever
buy, and the reader who checks is the reader who buys.

**What the engines searched for.** When someone asks ChatGPT a question, it
doesn't search that sentence — it breaks it into its own searches. We record
those. So the report shows the searches the engines actually ran on a buyer's
behalf, how many of your questions triggered each one, and how often you turned
up in the answers that used them. A search the engines keep running that never
produces an answer naming you is the earliest possible warning: you're missing
before the answer is even written.

Two things to keep straight. This is **not search volume** — "12 of your 42
questions triggered this" means the engines kept converging on that framing, not
that 12 people searched it. And some engines publish their searches while others
don't; where one didn't, the report names it rather than letting a short list
look like the engine barely searched.

(This is also why we didn't buy a keyword-volume tool. The standard trick is to
boil your question down to a few broad Google terms, look up Google's volume,
and multiply by a fixed number to call it "AI volume" — a real figure about a
different search engine, three guesses deep. What the engines actually did is a
smaller number and a true one.)

**What it does not do.** It does not track you daily, and it will not tell you
"visibility went 12% to 31%". Ask an engine the same question twice and you can
get two different answers — so a change between two runs is mostly noise, and
saying your articles caused it would be a claim the data can't support. Sell the
gap, which is solid. Don't sell the trend until we've measured how much it
wobbles on its own.

**What's honest about it, and what isn't.** Every answer is stored word for word
and every gap links to the answers that prove it. But unlike a Google result you
can't go verify it independently — an AI answer is private and doesn't
reproduce. The evidence is our recording of it. That's a real step down in proof
strength, and the report says so out loud rather than blurring it.

**One blind spot, named.** Claude is roughly 18% of B2B AI referrals — second
place, ahead of Gemini — and we can't measure it, because Cloro has no Claude
scraper and its API is the wrong surface. That's a genuine hole in exactly your
buyer segment. Don't claim coverage you don't have.

**Status: built, wired, never run.** There's no Cloro key in the repo, so not one
question has actually been asked. Onboarding now ends on the "answer engines
aren't connected" screen rather than on a report — which is the honest outcome,
because reporting you as absent from answers nobody collected would be a
fabricated result. Before showing this to anyone: add the key, run it on two
real sites and read fifty answers by hand. If the questions aren't ones a buyer
would plausibly type, the whole thing is noise no matter how tidy the code is.

**It costs real money per run,** unlike the audit (~$0.20). A run currently asks
**10 questions** — roughly 90 Cloro credits, about four cents across both
engines. That is deliberately small: until you have run it once, the only
question worth answering is whether the questions themselves are any good, and
10 answers that.

Two consequences of starting small. You will probably get **no article plan** —
a cluster needs 8-15 articles and ten questions can't fill one, so that section
will say the scope was too thin. And the numbers are a small sample, so treat
them as a smell test rather than a measurement. Once the questions read like
things a buyer would actually type, raise it to about 40 and the plan appears.

(Credit figures come from Cloro's pricing page, not from a bill. Check your
first invoice.)

### 11.5.5 Where all of this shows up in the app

| Page | What it shows | State |
|---|---|---|
| `/visibility/[runId]` | The AI report: which questions you lose, who won them, which sources got cited, and the verbatim answer behind every claim. Onboarding ends here. | Works. **No link to it anywhere in the dashboard** — see below. |
| `/evidence/ai-answer/[runId]/[promptId]` | One stored answer, word for word. Every gap row links here. | Works. |
| `/audit` | The saved audit: clusters, articles, and one evidence row per gap. | Works — the probe fills the same tables. The page's own wording still says "observed search queries" and each evidence row's source column shows "source" instead of a website name, because an AI answer has no website. Cosmetic, but it reads like the old pipeline. |
| `/content-plan` | The delivery schedule and cluster shipping. | Works, same tables. |
| `/articles`, `/settings`, `/integrations`, `/subscribe`, `/account` | Unchanged. | Works. |

**The gap: the visibility report is reachable exactly once.** The sidebar has
Evidence Audit, Content Plan, Articles, Settings and Integrations — nothing for
the AI report. A customer sees it at the end of onboarding, navigates away, and
has no way back short of the original URL. There is also no index page listing
past runs. This needs a sidebar entry pointing at the newest completed run
before anyone outside the building uses it.

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
