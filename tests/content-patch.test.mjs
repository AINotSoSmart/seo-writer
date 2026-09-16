import assert from "node:assert/strict"
import test from "node:test"

import { parseHtmlToContentDocument, serializeContentDocumentToHtml } from "../lib/content-patch/content-document.ts"
import { applySectionChanges } from "../lib/content-patch/patch-applier.ts"

test("parseHtmlToContentDocument strips non-content chrome and partitions sections", () => {
    const rawHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Best AI Mockup Tools | My Brand</title></head>
        <body>
            <header class="site-header"><nav><ul><li><a href="/">Home</a></li></ul></nav></header>
            <div class="cookie-banner"><p>Accept cookies</p></div>
            <article class="entry-content">
                <h1>Best AI Mockup Tools in 2026</h1>
                <p>Creating mockups with AI saves engineering time.</p>
                <h2>1. Fast Prototyping</h2>
                <p>Speed is essential for early feedback.</p>
                <p>Use tools that output clean layouts.</p>
                <h2>2. Code Export</h2>
                <p>Exporting to Flutter and React is supported.</p>
            </article>
            <aside class="sidebar"><p>Recent posts</p></aside>
            <footer><p>© 2026 My Brand</p></footer>
        </body>
        </html>
    `

    const doc = parseHtmlToContentDocument("https://example.com/mockup-tools", rawHtml, "html")

    assert.equal(doc.title, "Best AI Mockup Tools in 2026")
    assert.equal(doc.sourceType, "html")
    assert.ok(doc.sourceHash.length === 64)

    // Verify non-content elements are stripped
    assert.ok(!doc.rawContent.includes("Accept cookies") || doc.sections.every(s => !s.text.includes("Accept cookies")))
    assert.ok(doc.sections.every(s => !s.text.includes("Recent posts")))

    // Verify sections
    assert.ok(doc.sections.length >= 3)
    const h1Section = doc.sections.find(s => s.level === 1)
    assert.ok(h1Section)
    assert.equal(h1Section?.heading, "Best AI Mockup Tools in 2026")

    const sec1 = doc.sections.find(s => s.heading.includes("Fast Prototyping"))
    assert.ok(sec1)
    assert.ok(sec1?.text.includes("Speed is essential"))

    const sec2 = doc.sections.find(s => s.heading.includes("Code Export"))
    assert.ok(sec2)
    assert.ok(sec2?.text.includes("Exporting to Flutter"))
})

test("applySectionChanges inserts and replaces sections deterministically", () => {
    const rawHtml = `
        <article>
            <h1>AI UI Design Guide</h1>
            <h2>Introduction</h2>
            <p>Welcome to modern UI design.</p>
            <h2>Choosing the Right Tool</h2>
            <p>Pick a tool that matches your team skill level.</p>
        </article>
    `
    const doc = parseHtmlToContentDocument("https://example.com/guide", rawHtml, "html")

    const introSec = doc.sections.find(s => s.heading === "Introduction")
    assert.ok(introSec)

    const patch = applySectionChanges(doc, [
        {
            operation: "insert_after",
            sectionId: introSec ? introSec.id : "",
            reason: "Addresses missing question about mobile mockups",
            newHeading: "Mobile UI Mockups",
            newContent: "<p>Mobile designers should look for native component kits.</p>",
        },
    ])

    assert.equal(patch.changes.length, 1)
    assert.ok(patch.mergedDocumentHtml.includes("Mobile UI Mockups"))
    assert.ok(patch.mergedDocumentHtml.includes("Mobile designers should look for native component kits."))
    assert.ok(patch.mergedDocumentHtml.includes("Choosing the Right Tool"))
    // Ensure untouched sections remain
    assert.ok(patch.mergedDocumentHtml.includes("Welcome to modern UI design."))
})

test("applySectionChanges handles replace_section and delete_section", () => {
    const rawHtml = `
        <article>
            <h1>SaaS Onboarding</h1>
            <h2>Step 1: Sign Up</h2>
            <p>Enter email.</p>
            <h2>Step 2: Deprecated Flow</h2>
            <p>Old instructions here.</p>
            <h2>Step 3: Verification</h2>
            <p>Check inbox.</p>
        </article>
    `
    const doc = parseHtmlToContentDocument("https://example.com/onboarding", rawHtml, "html")
    const step1 = doc.sections.find(s => s.heading === "Step 1: Sign Up")
    const step2 = doc.sections.find(s => s.heading === "Step 2: Deprecated Flow")

    assert.ok(step1 && step2)

    const patch = applySectionChanges(doc, [
        {
            operation: "replace_section",
            sectionId: step1.id,
            reason: "Update sign up steps with OAuth",
            newHeading: "Step 1: Sign Up with Google or Email",
            newContent: "<p>Sign in with one click via Google or enter your work email.</p>",
        },
        {
            operation: "delete_section",
            sectionId: step2.id,
            reason: "Remove obsolete step",
        },
    ])

    assert.equal(patch.changes.length, 2)
    assert.ok(patch.mergedDocumentHtml.includes("Step 1: Sign Up with Google or Email"))
    assert.ok(patch.mergedDocumentHtml.includes("Sign in with one click"))
    assert.ok(!patch.mergedDocumentHtml.includes("Step 2: Deprecated Flow"))
    assert.ok(!patch.mergedDocumentHtml.includes("Old instructions here."))
    assert.ok(patch.mergedDocumentHtml.includes("Step 3: Verification"))
})

test("convertMergedHtmlToGutenberg wraps HTML tags with WordPress Gutenberg comments", async () => {
    const { convertMergedHtmlToGutenberg } = await import("../lib/content-patch/publishing/wordpress-adapter.ts")
    const html = `<h2>Comparison Table</h2><p>Here is how each tool stacks up.</p>`
    const blockContent = convertMergedHtmlToGutenberg(html)

    assert.ok(blockContent.includes("<!-- wp:heading {\"level\":2} -->"))
    assert.ok(blockContent.includes("<h2>Comparison Table</h2>"))
    assert.ok(blockContent.includes("<!-- /wp:heading -->"))
    assert.ok(blockContent.includes("<!-- wp:paragraph -->"))
    assert.ok(blockContent.includes("<p>Here is how each tool stacks up.</p>"))
    assert.ok(blockContent.includes("<!-- /wp:paragraph -->"))
})

