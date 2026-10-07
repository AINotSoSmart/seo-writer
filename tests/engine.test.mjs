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
