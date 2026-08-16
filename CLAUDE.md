# FlipAEO — agent context

## Read this first

If the founder is asking "how does this actually work", point them at
**[`docs/HOW_IT_WORKS.md`](docs/HOW_IT_WORKS.md)** — plain-language, no jargon.
Keep it in sync when behaviour changes; if it disagrees with the code, the code
is right and the doc is a bug.

If the founder is asking "what do I do next", the answer is
**[`docs/SOLO_LAUNCH_GATE.md`](docs/SOLO_LAUNCH_GATE.md)** — a six-item gate for
customers 1-3. `docs/CLOSED_POOL_RELEASE_GATE.md` is the full 24-item version;
it is correct but sequenced for a product that already has revenue at risk.

This repo is mid-pivot. **[`docs/PIVOT.md`](docs/PIVOT.md) is the source of truth**
for what is being built, why, how it works, what is calibrated, and what is still
open. Read it fully before changing anything under `lib/harvest/`, `lib/audit/`,
`lib/plans/`, or `trigger/`.

**[`docs/SUBSCRIPTION_PIVOT.md`](docs/SUBSCRIPTION_PIVOT.md)** is the proposed
commercial refactor: from a finite article program to a tracked-prompt monthly
subscription. Not built. Read it before touching `programs`, `purchase-intent`,
`program-contract.ts`, or the cluster qualification thresholds — several of those
are scheduled for deletion and patching them first is wasted work.

**[`docs/ROADMAP.md`](docs/ROADMAP.md) is the other half**: what was deliberately
deferred or rejected, and why. Read it before proposing a feature — several
obvious-looking ideas (full-site coverage scanning, weighted opportunity scores,
daily trend lines, open-ended entity extraction) have already been evaluated and
declined with reasons. It also carries the one open correctness defect that has
no owner yet: every probe currently measures the United States.

Active branch: `pivot/closed-pool-harvest`.

## Standing instruction

**Update `docs/PIVOT.md` with every change you make** — the Status Board and the
Changelog. That file is the only continuity between sessions; if it goes stale
the next agent re-derives everything from scratch or, worse, reintroduces a bug
that was already diagnosed and fixed.

## Things that will bite you

- **Use `127.0.0.1`, not `localhost`.** `localhost` resolves to IPv6 here and
  hangs on dev-server requests.
- **Never hand-tune a matching threshold.** Use `POST /api/harvest/calibrate`
  with hand-labelled positives and negatives. If the populations overlap, the
  method is wrong — report that instead of picking a midpoint.
- **Never reintroduce absolute-threshold-only coverage.** It once reported 99%
  authority for a site that covered almost nothing. Coverage is two stages:
  semantic retrieval for recall, lexical evidence for precision.
- **Do not add regex blocklists for content quality.** Tried twice; each round
  caught the previous examples and missed the next. Prefer evidential tests.
- **Provenance is mandatory.** Every harvested query must carry a working
  `source_url`. A gap that cannot be traced to its source is a bug.
- **Never edit an applied migration.** The closed-pool tables use
  `CREATE TABLE IF NOT EXISTS`, so editing `20260728_harvest_pool.sql` is a
  silent no-op against any existing database — the change looks correct in the
  repo and never reaches Postgres. Add a new migration with
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, then extend
  `20260730_reconcile_harvest_columns.sql` so `npm run test:pivot-contract`
  stays green. The one permitted edit is making an existing statement
  re-runnable — a migration must survive being replayed against a database
  that is *ahead* of it, which is why every `COMMENT ON` is wrapped in an
  existence check.
- **Apply migrations via the Supabase SQL editor, never `supabase db push`.**
  The CLI's migration history on this project stops at `20260404014829`, so it
  treats every pivot migration as pending and would replay all of them.
- Pre-existing TypeScript errors exist in unrelated UI files (`mobile-panel.tsx`,
  `pattern-picker.tsx`, `ContentParser.tsx`, `RelatedPosts.tsx`,
  `mini-stats.tsx`). They are not yours; filter `tsc` output to the paths you
  touched.

## Verification

```bash
npm run dev
```

Then see §7 of `docs/PIVOT.md` for the `/api/harvest/verify` and
`/api/harvest/calibrate` invocations and the acceptance criteria.
