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
