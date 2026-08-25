# Product UI rollout

## Design baseline

The authenticated product uses `/visibility` as its reference system:

- one clear page finding or job, stated in the header;
- white 14px panels on a quiet stone plane;
- hairline borders and nearly invisible shadows;
- tinted icon squares as scanning anchors;
- numbers paired with a visible ratio where a denominator exists;
- status shown with text and an icon, never colour alone;
- absence described as absence, not displayed as a measured zero;
- dense desktop tables collapse into readable mobile structures;
- explanations live beside the term they explain;
- no invented deltas or trend language.

## Product journey

1. **Visibility — understand the evidence.** Completed in the visibility redesign.
2. **Content Plan — understand what was selected and why.** Shared shell and cycle layout updated.
3. **Articles — review production state and publish.** Library and workflow states updated.
4. **Settings — control the measurement context.** Brand workspace updated.
5. **Integrations — control delivery destinations.** WordPress workflow updated.
6. **Account — administer access and billing.** Account hierarchy updated.

The sidebar now derives its active state from the current route. It no longer presents Content Plan as active on every page.

## Next rollout

### Article workspace (`/articles/[id]`)

This is the next high-impact surface. It should become a three-part workspace:

- a compact brief and evidence header;
- the article editor as the dominant canvas;
- a publication rail for validation, export, WordPress, and confirmed manual URLs.

On mobile, the publication rail becomes a sheet and the editor keeps the full viewport width. The existing generation, editing, export, and publication behavior should remain unchanged.

### Subscription (`/subscribe`)

Reframe the page around the active delivery program, allowance, next billing event, and one primary billing action. Separate plan facts from account operations.

### Onboarding

Carry the same hierarchy into setup without making it look like a dashboard: one decision per step, visible progress, concise evidence for why each field matters, and a persistent summary of confirmed choices.

### Founder operations

Treat founder routes as a separate operational system. Reuse tokens and responsive patterns, but prioritize queue density, exception states, and batch control over customer-facing narrative.

## Explicit boundary

Public marketing, blog, comparison, and tools pages should keep their acquisition-oriented visual language. They should share typography and brand tokens, but not inherit dashboard cards or information density merely for consistency.
