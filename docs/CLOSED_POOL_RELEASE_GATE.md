# Closed-Pool Release Gate

Public checkout is deliberately fail-closed. Keep
`CLOSED_POOL_CHECKOUT_ENABLED=false` until every automated and manual item below
has passed in the environment that will serve customers.

## Required environment

```text
CLOSED_POOL_CHECKOUT_ENABLED=false
FOUNDER_USER_IDS=<comma-separated Supabase user UUIDs>
FOUNDER_ALERT_EMAIL=<founder operations email>
PROGRAM_COST_RATES_JSON=<provider rate map>
```

`PROGRAM_COST_RATES_JSON` is server-only. Rates may be keyed by
`provider:model`, model, or provider:

```json
{
  "gemini:gemini-3.1-flash-lite": {
    "inputPerMillion": 0,
    "outputPerMillion": 0
  },
  "gemini:gemini-3-flash-preview": {
    "inputPerMillion": 0,
    "outputPerMillion": 0
  },
  "tavily": { "perRequest": 0 },
  "fal": { "perRequest": 0 }
}
```

Replace every zero with the actual contracted price before the margin test.
If a rate is missing, usage is still stored but `cost_usd` remains null; that is
an incomplete release gate, not a zero-cost call.

## Deployment order

1. Back up the database and apply
   `20260729_velocity_pricing.sql`, then
   `20260730_closed_pool_v2.sql` in staging.
2. Deploy the application and Trigger.dev source with checkout disabled.
3. Confirm the only new recurring Trigger task is `program-lifecycle`.
4. In Trigger.dev, archive these old schedules only after the new deployment is
   healthy:
   - `daily-content-watchman`
   - `seo-health-auto-refresh`
   - `sitemap-sync-scheduler`
   - `gsc-daily-auto-refresh`
   - `ship-cluster`
5. Run `npm run test:pivot-contract`, TypeScript typecheck, and a production
   build from the exact deployed commit.

## Automated contract

`npm run test:pivot-contract` is the repository-level static/pure contract suite.
It covers URL-pattern validation, deterministic graph construction, eligibility,
shared harvest policy, immutable SQL constraints/RPCs, finite billing behavior,
retired surfaces, stale product copy, consent defaults, and provider usage
accounting.

The suite is necessary but cannot prove external system behavior.

## Manual staging contract

Record evidence for every numbered item:

1. Create a new brand and completed immutable audit.
2. Open 20 sampled provenance URLs and verify that each observed query is
   genuinely present or returned by that source.
3. Run `/api/harvest/verify` and production with identical input and mocked or
   cached source responses. Confirm identical policy version and result hash.
4. Confirm demand/niche filtering, configured source caps, maximum cluster size,
   and 25–40% collapse when at least 60 gaps exist.
5. Confirm an eligible six-cluster audit and an intentionally ineligible niche.
6. Confirm an HTTPS, same-host, single-`{slug}` publication pattern and its URL
   previews. Create a purchase intent.
7. Complete a Dodo sandbox purchase.
8. Replay activation/payment webhooks duplicated and out of order.
9. Verify one subscription, one program, one graph snapshot, one schedule, and
   one period grant.
10. Verify the program is pinned to the purchased audit and exact six clusters.
11. Re-audit the brand and verify the running program and its history do not
    change.
12. Force one article in cluster one to fail. Verify successful siblings remain
    withheld, delivery does not advance, and retry targets only the failed member.
13. Recover and deliver the cluster atomically.
14. Validate every graph edge and simultaneous customer visibility.
15. Create one WordPress draft and publish another. Verify draft/delivered/
    published remain distinct and the returned permalink matches the frozen URL.
16. Pause before cluster two. Verify no delivery while paused, then resume and
    confirm exact date shifting without cadence compression.
17. Deliver all six clusters.
18. Verify customer copy says “Program scope delivered.”
19. Verify Dodo records `cancel_at_next_billing_date=true`.
20. Force an initial cancellation API failure and verify retry, founder alert,
    and eventual webhook-confirmed scheduled state.
21. Replay renewal/update events after scope delivery and verify no work,
    entitlement, dates, clusters, or programs are recreated.
22. Complete the founder prospect flow: public report, authentication, exact-email
    claim, ownership transfer, and checkout eligibility.
23. Crawl public routes and verify redirects/410s, sitemap, canonicals, metadata,
    schema, `llms.txt`, legal pages, and absence of retired controls or promises.
24. Query `program_cost_events` for the completed cluster. Every provider call
    must have `usage_complete=true` and a non-null cost. A
    `pricing_source=usage_unavailable` row is an incomplete measurement, never a
    zero-cost call. Compare the summed cost to the tier's internal allowance and
    gross margin.

## Enablement

Only after all checks pass:

1. Save the evidence and actual cluster cost with the release record.
2. Set `CLOSED_POOL_CHECKOUT_ENABLED=true`.
3. Redeploy the exact tested commit.
4. Perform one final checkout smoke test.

Any provenance, graph, billing-idempotency, permalink, cancellation, or unknown
cost failure turns checkout back off.
