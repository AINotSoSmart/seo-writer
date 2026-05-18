# SEO Recovery Fix Plan

## Goal
Recover deindexed URLs by reducing low-value index footprint, upgrading the strongest pages into evidence-backed assets, and tracking execution in phases.

## Decision Rules
- `Keep` = page stays indexable and gets a full rewrite
- `Merge` = page is absorbed into a stronger page or cluster page, then redirected or retired
- `Noindex` = page stays live for users if needed, but is removed from index consideration
- `P0` = immediate
- `P1` = this sprint
- `P2` = after P0/P1 winners are upgraded
- `P3` = only if earlier work shows strong recovery

## Recovery Targets
- Improve indexed status for rewritten winners within 2 to 8 weeks
- Reduce low-value pSEO footprint before requesting reindexing
- Increase information gain, proof, differentiation, and internal-link support
- Replace generic persuasion with verifiable, first-hand comparison content

## Master Tracker

| URL | Type | Decision | Priority | Current Problem | Recovery Goal | Merge / Canonical Destination | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `https://flipaeo.com/compare/flipaeo-vs-outranking` | Compare | Keep | P0 | Strong intent, but template-heavy and proof-light | Turn into flagship comparison with tested workflow evidence | N/A | Not started |
| `https://flipaeo.com/compare/flipaeo-vs-contentbase-ai` | Compare | Keep | P0 | Strong intent, plus visible text-quality issues | Rewrite and fix all formatting defects first | N/A | Not started |
| `https://flipaeo.com/compare/flipaeo-vs-getgenie` | Compare | Keep | P1 | Useful WP-specific intent, but low differentiation | Make it the best WordPress-native comparison page in cluster | N/A | Not started |
| `https://flipaeo.com/solutions/llm-brand-optimization` | Solution | Keep | P0 | Strategic page, but too claim-heavy and not evidence-backed enough | Rebuild as authoritative framework page with method, examples, and proof | N/A | Not started |
| `https://flipaeo.com/compare/flipaeo-vs-frase` | Compare | Keep | P1 | Good demand profile, but repetitive structure | Rebuild around editor workflow, team use case, and manual-vs-managed comparison | N/A | Not started |
| `https://flipaeo.com/compare/flipaeo-vs-autoblogging-ai` | Merge | P2 | Bulk pSEO angle is weak, likely low-value cluster member | Fold value into one stronger bulk-AI-writer comparison asset | Proposed: `/compare/flipaeo-vs-bulk-ai-writers` | Not started |
| `https://flipaeo.com/compare/flipaeo-vs-surfer-seo` | Compare | Keep | P0 | High-intent competitor page, but currently too templated | Make this the strongest legacy-SEO-tool comparison in the cluster | N/A | Not started |
| `https://flipaeo.com/compare/flipaeo-vs-article-forge` | Noindex | P2 | Legacy tool, weak future demand, high overlap with other bulk-writer pages | Remove from index to reduce low-value footprint | N/A | Not started |
| `https://flipaeo.com/compare/flipaeo-vs-byword` | Merge | P2 | Similar pSEO narrative overlap with other bulk-writer pages | Consolidate into broader bulk-writer comparison page | Proposed: `/compare/flipaeo-vs-bulk-ai-writers` | Not started |

## Batch Plan

### Batch 1: Immediate Winners
- `flipaeo-vs-outranking`
- `flipaeo-vs-contentbase-ai`
- `flipaeo-vs-surfer-seo`
- `llm-brand-optimization`

### Batch 2: Strong Supporting Winners
- `flipaeo-vs-getgenie`
- `flipaeo-vs-frase`

### Batch 3: Cleanup / Consolidation
- `flipaeo-vs-autoblogging-ai`
- `flipaeo-vs-byword`
- `flipaeo-vs-article-forge`

## Page-by-Page Recovery Framework

### 1. `flipaeo-vs-outranking`
- Decision: `Keep`
- Priority: `P0`
- Why it survives:
- Strong commercial intent
- Strong competitor recognition
- Good fit for mid-to-high intent SaaS buyers
- Main issues:
- Too much repeatable “FlipAEO vs X” language
- Not enough proof of how Outranking actually works today
- Lacks methodology, tested examples, and source links
- Rewrite requirements:
- Verify pricing, features, workflow, and GSC-related claims
- Add “Who should choose Outranking” with honest use cases
- Add tested workflow screenshots or step walkthrough
- Add comparison rubric: strategy depth, editing control, AI readiness, implementation time, cost to operate
- Add sources block with docs, pricing, changelog, and product pages
- Add “last verified” date
- Success criteria:
- Feels like a researched buyer guide, not a sales landing page
- Has enough original evaluation to justify indexing on its own

### 2. `flipaeo-vs-contentbase-ai`
- Decision: `Keep`
- Priority: `P0`
- Why it survives:
- Useful “AI SEO agent” angle
- Can target users evaluating hands-off automation
- Main issues:
- Visible broken text / formatting quality problem
- Heavy jargon and low trust without proof
- Rewrite requirements:
- Fix all text integrity issues first
- Rebuild feature breakdown in plain language
- Show exactly what Contentbase automates vs what still requires human review
- Add tested scenario: “publish one post/day” vs “publish fewer authority assets”
- Add evidence for page-speed / automation / CMS claims
- Add screenshots or source references
- Success criteria:
- No broken text
- Clear, human-readable, evidence-backed comparison
- High trust and low hype

### 3. `flipaeo-vs-getgenie`
- Decision: `Keep`
- Priority: `P1`
- Why it survives:
- Clear WordPress-native use case
- Different enough from broader SEO-tool comparisons
- Main issues:
- Likely overlaps with generic “AI writer vs AEO platform” framing
- Needs more CMS-specific substance
- Rewrite requirements:
- Focus on WordPress workflow, editor experience, publishing speed, WooCommerce angle, plugin dependency, maintenance cost
- Add “best for WordPress teams” section
- Add real setup and output comparison
- Add buyer-fit table by user type: solo blogger, agency, SaaS marketing team
- Success criteria:
- Distinct from Surfer/Frase/Outranking pages
- Strong WordPress-specific information gain

### 4. `llm-brand-optimization`
- Decision: `Keep`
- Priority: `P0`
- Why it survives:
- Strong strategic topic
- Not just a comparison page
- High upside if turned into a framework page
- Main issues:
- Too abstract and buzzword-heavy
- Needs stronger examples, process, and trust signals
- Rewrite requirements:
- Rebuild around a real framework:
- AI brand perception audit
- Narrative gap mapping
- Source control
- Recommendation visibility
- Reputation defense
- Add examples of brand query types users ask LLMs
- Add case-style scenarios
- Add measurable outputs: recommendation share, sentiment themes, misinformation types, retrieval source gaps
- Add editorial trust elements: author, reviewer, methodology, update date
- Success criteria:
- Reads like a serious category-defining resource
- Useful even if user never buys the product
- Strong enough to attract links and citations

### 5. `flipaeo-vs-frase`
- Decision: `Keep`
- Priority: `P1`
- Why it survives:
- Strong editor-workflow intent
- Good fit for in-house content teams
- Main issues:
- Template repetition
- Needs workflow-level nuance
- Rewrite requirements:
- Compare writing workflow, outline generation, optimization loop, collaboration model, briefing depth, editorial control
- Add “Frase wins if…” and “FlipAEO wins if…” with more nuance
- Add sample content process comparison
- Add editor screenshots / official docs references
- Success criteria:
- Valuable to teams choosing between managed output and manual optimization workflow

### 6. `flipaeo-vs-autoblogging-ai`
- Decision: `Merge`
- Priority: `P2`
- Why it does not deserve standalone index priority:
- Overlaps heavily with Byword / Article Forge / bulk-pSEO angle
- Likely low information delta as a leaf page
- Merge plan:
- Extract best unique points into a broader page:
- `FlipAEO vs Bulk AI Writers`
- Include Autoblogging.ai as one section or comparison block inside that asset
- After merge:
- Redirect if a replacement page exists
- If no replacement yet, keep live temporarily but mark for retirement after content migration
- Success criteria:
- One stronger bulk-writer asset outranks three weak leaf pages

### 7. `flipaeo-vs-surfer-seo`
- Decision: `Keep`
- Priority: `P0`
- Why it survives:
- Highest-recognition legacy SEO competitor in this list
- Strong buyer intent
- Can become a true flagship comparison page
- Main issues:
- Too much repeated anti-SEO rhetoric
- Not enough nuanced evaluation of where Surfer is still genuinely better
- Rewrite requirements:
- Add real “when Surfer wins” sections
- Compare editor scoring, audits, content updating, agency workflows, team handoff, learning curve
- Add tested examples or annotated workflow comparison
- Add source-backed pricing and feature verification
- Add “best for” segmentation by business model
- Success criteria:
- Balanced, credible, high-conviction comparison that deserves ranking on its own

### 8. `flipaeo-vs-article-forge`
- Decision: `Noindex`
- Priority: `P2`
- Why it should leave the index:
- Legacy bulk writer category
- Lower strategic upside than Surfer / Frase / Outranking
- High overlap with other “bulk content” pages
- Action:
- Keep available if needed for users or paid traffic
- Remove from index consideration
- Reuse any unique useful research in the future bulk-writer hub
- Success criteria:
- Reduces low-value footprint without losing usable internal knowledge

### 9. `flipaeo-vs-byword`
- Decision: `Merge`
- Priority: `P2`
- Why it should not remain standalone:
- High overlap with Autoblogging.ai / Article Forge style narrative
- Risk of being one more near-same pSEO comparison
- Merge plan:
- Move best byword-specific observations into:
- `FlipAEO vs Bulk AI Writers`
- Include sections:
- Best for sheer volume
- Best for affiliate / programmatic workflows
- Why those workflows now face indexing pressure
- Success criteria:
- Consolidation produces a stronger, more linkable asset than the current standalone page

## Consolidation Map

| Old URL | Action | New Role |
| --- | --- | --- |
| `flipaeo-vs-autoblogging-ai` | Merge | Section inside bulk-writer comparison hub |
| `flipaeo-vs-byword` | Merge | Section inside bulk-writer comparison hub |
| `flipaeo-vs-article-forge` | Noindex | Optional supporting reference only |

## Rewrite Standards For All Kept Pages
- Add author / reviewer / last updated
- Add “how we evaluated this tool” section
- Add real source list with outbound links
- Add screenshots, examples, or tested notes wherever possible
- Replace generic claims with verified claims
- Keep strong opinions only when backed by proof
- Reduce repeated section naming across the cluster
- Add unique angle per page so each URL earns its own right to exist
- Improve internal links from hub pages and relevant solution pages
- Add honest competitor wins, not just token concessions

## Compare Page Brief Template

### Page Role
- Primary keyword:
- Secondary keywords:
- Search intent:
- Funnel stage:
- Primary audience:

### Keep / Merge / Noindex Decision
- Decision:
- Why this page deserves index space:
- What makes it distinct from sibling pages:
- If merged, target destination:

### Competitive Positioning
- Competitor:
- What competitor is genuinely good at:
- Where competitor beats FlipAEO:
- Where FlipAEO beats competitor:
- Who should choose competitor:
- Who should choose FlipAEO:
- Who should choose neither:

### Evidence Pack
- Pricing verified from:
- Features verified from:
- Workflow tested from:
- Screenshots collected:
- Changelog / docs reviewed:
- Date last verified:

### Required Sections
- Direct answer / short verdict
- Who each product is for
- Tested workflow comparison
- Feature comparison table
- Pricing and implementation cost
- Honest limitations
- Best fit by team type
- Final recommendation
- FAQ based on real buyer questions
- Sources / methodology

### Information Gain Checklist
- Original scoring rubric included
- At least 3 proof points not repeated from sibling pages
- At least 1 real workflow example
- At least 1 competitor win explained clearly
- At least 1 decision table for buyer fit
- No generic “AI citations vs SEO” filler repeated without new detail

### Internal Linking Plan
- Link from compare hub:
- Link from related solution page:
- Link from relevant blog / case study:
- Add backlinks from kept comparison winners:

### Publish Gate
- No formatting defects
- No unsupported claims
- No placeholder citation markers
- No repeated boilerplate paragraphs from sibling pages
- Final human editorial review complete

## Solution Page Brief Template

### Page Role
- Primary keyword:
- Secondary keywords:
- Search intent:
- Funnel stage:
- Primary audience:

### Strategic Goal
- What category or problem this page should own:
- Why this topic matters after core updates:
- What unique framework this page introduces:

### Trust Signals Needed
- Named author:
- Reviewer:
- Last updated date:
- Methodology statement:
- Real examples or scenarios:
- Source list:

### Required Sections
- Clear definition and direct answer
- Why this matters now
- Common failure patterns
- Framework or operating model
- Real-world scenarios
- Measurement model
- Implementation phases
- FAQ
- Sources / methodology
- CTA

### Information Gain Checklist
- Introduces a named framework or model
- Includes measurable outputs or KPIs
- Includes real examples of problems and fixes
- Avoids buzzword-only explanation
- Useful as a standalone educational resource

### Internal Linking Plan
- Link from solutions hub:
- Link from relevant comparison pages:
- Link from case study / blog pages:
- Link to supporting pages in same cluster:

### Publish Gate
- No hype-only claims
- No unsupported statements
- Real examples included
- Clear structure with strong retrieval value
- Final human editorial review complete

## Execution Checklist

### Phase 1: Prune And Prepare
- Finalize decisions for all 9 URLs
- Mark merge/noindex candidates
- Fix any visible text integrity issues
- Gather source docs, pricing pages, changelogs, screenshots

### Phase 2: Rewrite Winners
- Rewrite P0 pages fully
- Add methodology and source sections
- Add trust elements and updated dates
- Add internal links from hubs and related pages

### Phase 3: Publish In Batches
- Publish Batch 1 first
- Request indexing only for rewritten kept pages
- Wait and observe before Batch 2
- Do not push low-value leaf pages back into index

### Phase 4: Consolidate Cluster
- Build bulk-writer comparison hub if approved
- Migrate useful content from merge candidates
- Redirect or retire merged pages
- Noindex retained low-value support pages if needed

## Progress Tracker

| Task | Owner | Priority | URL / Cluster | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Approve page decisions |  | P0 | All 9 URLs | Not started |  |
| Fix formatting defects |  | P0 | `flipaeo-vs-contentbase-ai` | Not started |  |
| Rewrite flagship compare page |  | P0 | `flipaeo-vs-surfer-seo` | Not started |  |
| Rewrite flagship compare page |  | P0 | `flipaeo-vs-outranking` | Not started |  |
| Rewrite solution framework page |  | P0 | `llm-brand-optimization` | Not started |  |
| Add sources + methodology pattern |  | P0 | Compare + Solution templates | Not started |  |
| Rewrite compare page |  | P1 | `flipaeo-vs-getgenie` | Not started |  |
| Rewrite compare page |  | P1 | `flipaeo-vs-frase` | Not started |  |
| Decide bulk-writer hub scope |  | P2 | Byword / Autoblogging / Article Forge | Not started |  |
| Merge byword content |  | P2 | `flipaeo-vs-byword` | Not started |  |
| Merge autoblogging content |  | P2 | `flipaeo-vs-autoblogging-ai` | Not started |  |
| Noindex low-value leaf |  | P2 | `flipaeo-vs-article-forge` | Not started |  |
| Publish Batch 1 |  | P0 | P0 pages | Not started |  |
| Measure reindexing after rewrite |  | P1 | P0 pages | Not started |  |

## Notes
- Do not judge success page by page only; watch whether the entire compare cluster starts regaining trust.
- Kept pages must become meaningfully better than the current pSEO pattern, not just longer.
- If Batch 1 does not recover, prune harder before rewriting more leaf pages.
```