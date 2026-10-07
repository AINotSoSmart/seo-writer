import test from "node:test"
import assert from "node:assert/strict"

import { buildFindings, classifyFinding, isOwnedUrl, runHealth } from "../lib/engine/findings.ts"
import { nearestPages, quoteIsInText, verifiedQuotes } from "../lib/engine/evidence.ts"
import { decideBucket } from "../lib/engine/triage-rules.ts"
import { applySegmentEdits, contentIndices, htmlToBlocks, joinSegments, splitSegments } from "../lib/engine/blocks.ts"
import { previousWeekStart, weekStartFor } from "../lib/engine/schedule.ts"

const fact = (engine, answered, mentioned, position = null) => ({
    engine, answered, mentioned, position, ownCitations: [], otherCitations: [],
})

test("a gap needs every engine to answer and none to name the tool", () => {
    assert.equal(classifyFinding([fact("a", true, false), fact("b", true, false)], 2), "gap")
    // One engine failed: absence is not proven.
    assert.equal(classifyFinding([fact("a", true, false), fact("b", false, false)], 2), "insufficient")
    // Named by one engine only: reported, never actioned.
    assert.equal(classifyFinding([fact("a", true, true, 3), fact("b", true, false)], 2), "partial")
    assert.equal(classifyFinding([fact("a", true, true, 2), fact("b", true, true, 4)], 2), "outranked")
    assert.equal(classifyFinding([fact("a", true, true, 1), fact("b", true, true, 4)], 2), "won")
})

test("findings confirm a gap only when last week was a gap too", () => {
    const prompts = [
        { id: "p1", trackedPromptId: "t1", prompt: "q1" },
        { id: "p2", trackedPromptId: "t2", prompt: "q2" },
    ]
    const results = [
        { promptId: "p1", engine: "chatgpt-web", mentionCount: 0, mentionPosition: null, citations: [{ url: "https://rival.com/best" }, { url: "https://blog.tool.com/post" }] },
        { promptId: "p1", engine: "google-aimode", mentionCount: 0, mentionPosition: null, citations: [{ url: "https://rival.com/best/" }] },
        { promptId: "p2", engine: "chatgpt-web", mentionCount: 0, mentionPosition: null, citations: [] },
        { promptId: "p2", engine: "google-aimode", mentionCount: 0, mentionPosition: null, citations: [] },
    ]
    const findings = buildFindings({
        prompts, results, engines: ["chatgpt-web", "google-aimode"], ownedHosts: ["tool.com"], previousGaps: new Set(["t1"]),
    })
    assert.equal(findings[0].state, "gap")
    assert.equal(findings[0].confirmed, true)
    assert.equal(findings[1].confirmed, false)
    // Own subdomain counts as cited; the rival page is counted once per engine.
    assert.equal(findings[0].enginesCiting, 1)
    assert.equal(findings[0].citedRivalUrls[0].count, 2)
})

test("owned hosts match subdomains, never substrings", () => {
    assert.equal(isOwnedUrl("https://blog.tool.com/a", ["tool.com"]), true)
    assert.equal(isOwnedUrl("https://nottool.com/a", ["tool.com"]), false)
    assert.equal(isOwnedUrl("https://x.com/?ref=tool.com", ["tool.com"]), false)
})

test("a week with too many failed engine calls is unhealthy", () => {
    assert.equal(runHealth([{ attempted: 50, failed: 5 }]).healthy, true)
    assert.equal(runHealth([{ attempted: 50, failed: 11 }]).healthy, false)
    assert.equal(runHealth([]).healthy, false)
})

test("quotes must really be in the page", () => {
    const page = "Restoring a torn photo: scan at 600 DPI, then use the healing brush on each crack."
    assert.equal(quoteIsInText("scan at 600 DPI, then use the healing brush", page), true)
    assert.equal(quoteIsInText("scan at 1200 DPI, then use the healing brush", page), false)
    // Too short to be evidence.
    assert.equal(quoteIsInText("600 DPI", page), false)
    assert.deepEqual(verifiedQuotes(["SCAN AT 600 dpi — then use the healing brush", 42], page), ["SCAN AT 600 dpi — then use the healing brush"])
})

test("nearest pages is recall only and skips pages without embeddings", () => {
    const pages = [
        { id: "a", embedding: [1, 0] },
        { id: "b", embedding: [0, 1] },
        { id: "c", embedding: null },
    ]
    assert.deepEqual(nearestPages([[0.9, 0.1]], pages, 5).map((x) => x.page.id), ["a", "b"])
})

test("bucket rules", () => {
    const now = new Date("2026-10-07T00:00:00Z")
    assert.equal(decideBucket({ covering: null, verifiedMissingItems: 3, now }).kind, "create")
    assert.equal(decideBucket({ covering: { source: "wordpress", modifiedAt: "2026-01-01T00:00:00Z" }, verifiedMissingItems: 0, now }).kind, "monitor")
    assert.equal(decideBucket({ covering: { source: "wordpress", modifiedAt: "2026-01-01T00:00:00Z" }, verifiedMissingItems: 2, now }).kind, "refresh")
    assert.equal(decideBucket({ covering: { source: "wordpress", modifiedAt: "2026-10-01T00:00:00Z" }, verifiedMissingItems: 2, now }).kind, "monitor")
    assert.equal(decideBucket({ covering: { source: "sitemap", modifiedAt: null }, verifiedMissingItems: 2, now }).kind, "page_suggestion")
    assert.equal(decideBucket({ covering: { source: "app_article", modifiedAt: null }, verifiedMissingItems: 2, now }).kind, "monitor")
})

const BLOCK_POST = `<!-- wp:paragraph -->
<p>Intro paragraph.</p>
<!-- /wp:paragraph -->

<!-- wp:image {"id":12} -->
<figure class="wp-block-image"><img src="a.png"/></figure>
<!-- /wp:image -->

<!-- wp:group -->
<div><!-- wp:paragraph --><p>Nested</p><!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:separator /-->

[shortcode id="1"]
`

test("splitting a block post loses nothing", () => {
    const segments = splitSegments(BLOCK_POST)
    assert.equal(joinSegments(segments), BLOCK_POST)
    const content = contentIndices(segments).map((i) => segments[i])
    assert.deepEqual(content.map((s) => s.name ?? s.kind), ["paragraph", "image", "group", "separator", "html"])
})

test("splitting a classic post loses nothing", () => {
    const classic = "<p>One</p>\n\n<img src=x>\n\n\n<h2>Two</h2>\nText"
    assert.equal(joinSegments(splitSegments(classic)), classic)
})

test("edits touch only their segment and keep images and shortcodes", () => {
    const updated = applySegmentEdits(BLOCK_POST, [
        { position: 0, operation: "insert_after", html: "<h2>New section</h2><p>New text.</p>" },
        { position: 2, operation: "replace", html: "<p>Replaced group</p>" },
    ])
    assert.match(updated, /<!-- wp:image \{"id":12\} -->/)
    assert.match(updated, /\[shortcode id="1"\]/)
    assert.match(updated, /<!-- wp:heading -->\n<h2 class="wp-block-heading">New section<\/h2>/)
    assert.doesNotMatch(updated, /Nested/)
    assert.ok(updated.startsWith("<!-- wp:paragraph -->\n<p>Intro paragraph.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading -->"))
})

test("generated HTML becomes valid-looking blocks", () => {
    const blocks = htmlToBlocks("<h3>A</h3><ul><li>x</li><li>y</li></ul><table><tr><td>1</td></tr></table>")
    assert.match(blocks, /<!-- wp:heading \{"level":3\} -->/)
    assert.match(blocks, /<!-- wp:list-item -->\n<li>x<\/li>/)
    assert.match(blocks, /<!-- wp:table -->/)
})

test("weeks start on Monday UTC", () => {
    assert.equal(weekStartFor(new Date("2026-10-05T08:30:00Z")), "2026-10-05")
    assert.equal(weekStartFor(new Date("2026-10-11T23:59:00Z")), "2026-10-05")
    assert.equal(weekStartFor(new Date("2026-10-12T00:00:00Z")), "2026-10-12")
    assert.equal(previousWeekStart("2026-10-05"), "2026-09-28")
})

import { buildActionOutcomes, buildCitationReport, buildQuestionHistory, buildShareOfVoice, buildTrend, questionChange } from "../lib/engine/report.ts"

const engineFact = (engine, mentioned, cited = false) => ({ engine, answered: true, mentioned, ownCitations: cited ? ["https://tool.com/a"] : [] })
const weeks = [
    { id: "w1", weekStart: "2026-09-28", state: "ready" },
    { id: "w2", weekStart: "2026-10-05", state: "ready" },
]
const reportFindings = [
    { weekId: "w1", trackedPromptId: "t1", prompt: "q1", state: "gap", perEngine: [engineFact("a", false), engineFact("b", false)] },
    { weekId: "w2", trackedPromptId: "t1", prompt: "q1", state: "outranked", perEngine: [engineFact("a", true, true), engineFact("b", true)] },
    { weekId: "w1", trackedPromptId: "t2", prompt: "q2", state: "gap", perEngine: [engineFact("a", false), engineFact("b", false)] },
    { weekId: "w2", trackedPromptId: "t2", prompt: "q2", state: "partial", perEngine: [engineFact("a", true), engineFact("b", false)] },
]

test("change is claimed only when every engine flipped", () => {
    assert.equal(questionChange("gap", "outranked"), "won_back")
    assert.equal(questionChange("gap", "partial"), "no_change")
    assert.equal(questionChange("won", "gap"), "lost")
    assert.equal(questionChange("partial", "gap"), "no_change")
    assert.equal(questionChange(null, "gap"), "new")
    const history = buildQuestionHistory(weeks, reportFindings)
    assert.deepEqual(history.map((row) => [row.prompt, row.states, row.change]), [
        ["q1", ["gap", "outranked"], "won_back"],
        ["q2", ["gap", "partial"], "no_change"],
    ])
})

test("trend counts per week and per engine", () => {
    const trend = buildTrend(weeks, reportFindings)
    assert.equal(trend[0].mentionedAnywhere, 0)
    assert.equal(trend[1].mentionedAnywhere, 2)
    assert.equal(trend[1].citedAnywhere, 1)
    assert.deepEqual(trend[1].perEngine.a, { mentioned: 2, cited: 1, answered: 2 })
    assert.equal(trend[0].gaps, 2)
})

test("share of voice and citations", () => {
    const answers = [
        { engine: "a", mentionCount: 1, citations: [{ url: "https://blog.tool.com/x" }, { url: "https://rival.com/y" }], competitorMentions: [{ name: "Rival", mentionCount: 2 }] },
        { engine: "b", mentionCount: 0, citations: [{ url: "https://rival.com/z" }], competitorMentions: [{ name: "Rival", mentionCount: 1 }, { name: "Other", mentionCount: 0 }] },
    ]
    const voice = buildShareOfVoice("Tool", answers)
    assert.deepEqual(voice.entries.map((entry) => [entry.name, entry.answers]), [["Rival", 2], ["Tool", 1]])
    assert.ok(Math.abs(voice.entries[1].share - 1 / 3) < 1e-9)
    const citations = buildCitationReport(answers, ["tool.com"])
    assert.equal(citations.totalCitations, 3)
    assert.equal(citations.ownCitations, 1)
    assert.deepEqual(citations.topDomains[0], { domain: "rival.com", answers: 2, owned: false })
})

test("action outcomes compare the action's week with the latest", () => {
    const outcomes = buildActionOutcomes(
        [{ id: "x", title: "T", kind: "create", weekId: "w1", trackedPromptIds: ["t1"], prompts: ["q1"] }],
        weeks,
        reportFindings,
    )
    assert.deepEqual(outcomes[0].questions[0], { prompt: "q1", then: "gap", now: "outranked", change: "won_back" })
})
