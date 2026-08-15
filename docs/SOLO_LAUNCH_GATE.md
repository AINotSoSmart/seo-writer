# Solo Launch Gate — customers 1 to 3

> This is the short gate. `CLOSED_POOL_RELEASE_GATE.md` is the full 24-item
> version and it is correct — but it is written for a product with paying
> customers and revenue at risk. You have none yet. Running all 24 items before
> speaking to a single prospect optimises for a problem you do not have.
>
> **With three customers, you are the monitoring system.** You will notice a
> broken delivery within hours. Most of the full gate exists to replace human
> observation at scale.

Do these six. Defer the rest until the trigger conditions below fire.

---

## The six that protect money

### 1. Backup, then migrate in staging
Apply `20260729_velocity_pricing.sql` then `20260730_closed_pool_v2.sql`.
Confirm the app boots and an existing brand still loads.

**Why it can't wait:** it is the only irreversible step. Everything else can be
fixed after the fact; a bad migration on real data cannot.

### 2. One full happy path, end to end
Audit → purchase intent → Dodo **sandbox** purchase → cluster one delivers →
articles exist and are readable.

**Why:** proves the contract works at all. If this passes, the product is real.

### 3. Replay the payment webhook once
Send the same activation event twice. Verify exactly one subscription, one
program, one schedule, one period grant.

**Why:** Dodo *will* retry. A duplicate program means double-charging your first
customer, which is the single worst thing that can happen at n=3.

### 4. Confirm cancellation at scope end
Deliver all six clusters (or set the counter manually) and verify Dodo records
`cancel_at_next_billing_date=true`.

**Why:** charging someone after you finished the work is a refund, a chargeback,
and the end of a reference.

### 5. Measure one real cluster's cost
Generate one cluster for real. Query `program_cost_events` and sum `cost_usd`.
Requires `PROGRAM_COST_RATES_JSON` filled with actual contracted prices.

**Why:** this is the last number that can invalidate $249. If a 12-article
cluster costs more than about $60 all-in, the tier prices move before you sell,
not after.

### 6. Spot-check provenance on a real prospect audit
Open 10 source URLs from an audit you are about to send someone. Confirm each
query is genuinely there.

**Why:** your entire differentiation is that the audit is falsifiable. Send one
report with a broken link and you have a $19 competitor with worse copy.

---

## Deferred, with the trigger that un-defers it

| Deferred check | Do it when |
|---|---|
| Out-of-order webhook replay | Customer 4, or the first time a webhook arrives late |
| Pause / resume exact date shifting | The first customer asks to pause |
| Forced cluster failure and atomic recovery | The first real generation failure — you will see it in Trigger.dev |
| Full graph-edge validation | Customer 4, or the first broken internal link a customer reports |
| Public route crawl, sitemap, canonicals, schema, `llms.txt` | You have organic traffic worth protecting |
| Prospect claim / ownership transfer flow | Customer 4 — do the first three by hand |
| Founder alert on cancellation API failure | Customer 4 |
| Renewal replay after scope delivery | The first renewal date arrives |
| Draft vs delivered vs published separation | The first customer actually uses WordPress publishing |

None of these are wrong. They are all things that matter at 50 customers and
almost none of them can hurt you at 3, because you will be watching every run by
hand.

---

## Sell before the gate finishes

The public audit route does **not** require checkout to be enabled.

You can run prospect audits today, send the links, and have the conversation
while items 1-6 proceed. For the first three customers, take the money by
invoice — Dodo checkout does not need to be live for someone to pay you $249.

That decouples the distribution test from the release gate, which matters
because distribution is the constraint that has not moved since February.

**Sequence:**

1. Harden + measure (items 1, 5, 6) — one day.
2. Send 30 prospect audits. This is the actual experiment.
3. Items 2, 3, 4 while conversations are running.
4. Flip `CLOSED_POOL_CHECKOUT_ENABLED=true` when someone is ready to pay by card.

---

## What turns checkout back off

Unchanged from the full gate: any provenance failure, double-provisioning,
wrong permalink, failed cancellation, or unknown cost.
