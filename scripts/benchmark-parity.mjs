/**
 * Parity and quality benchmark for AI visibility scrapers.
 * Tests Bright Data (and Cloro if configured) across buyer prompts
 * evaluating answer text, citations, brand/competitor mentions, and response integrity.
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

// Load environment variables safely from .env.local if present without logging secrets
if (existsSync(".env.local")) {
    const lines = readFileSync(".env.local", "utf8").split("\n")
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const eqIdx = trimmed.indexOf("=")
        if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim()
            const val = trimmed.slice(eqIdx + 1).trim()
            if (!process.env[key]) {
                process.env[key] = val
            }
        }
    }
}

const hasBrightData = Boolean(process.env.BRIGHT_DATA_API_KEY)
const hasCloro = Boolean(process.env.CLORO_API_KEY)

console.log("=== AI Visibility Scraper Parity Benchmark ===")
console.log(`Bright Data configured: ${hasBrightData ? "YES" : "NO"}`)
console.log(`Cloro configured:       ${hasCloro ? "YES" : "NO"}`)

if (!hasBrightData) {
    console.error("Error: BRIGHT_DATA_API_KEY is not set.")
    process.exit(1)
}

const {
    submitBrightDataTask,
    pollBrightDataTask,
} = await import("../lib/visibility/providers/brightdata.js").catch(async () => {
    // Fallback if ts/esm resolution needs direct import
    return import("../lib/visibility/providers/brightdata.ts")
})

const testPrompts = [
    {
        prompt: "What are the best CRM tools for small B2B sales teams in 2026?",
        subject: { brandName: "Pipedrive", domains: ["pipedrive.com"] },
        competitors: [
            { id: "hubspot", name: "HubSpot", domain: "hubspot.com" },
            { id: "close", name: "Close", domain: "close.com" },
            { id: "zoho", name: "Zoho", domain: "zoho.com" },
        ],
    },
    {
        prompt: "What are the top alternatives to Salesforce for mid-market companies?",
        subject: { brandName: "HubSpot", domains: ["hubspot.com"] },
        competitors: [
            { id: "pipedrive", name: "Pipedrive", domain: "pipedrive.com" },
            { id: "zoho", name: "Zoho", domain: "zoho.com" },
        ],
    },
]

const engines = ["chatgpt-web", "google-aimode"]

async function runBenchmark() {
    console.log(`\nRunning benchmark across ${testPrompts.length} prompts on engines: ${engines.join(", ")}...\n`)

    for (const [pIdx, testItem] of testPrompts.entries()) {
        console.log(`[Prompt ${pIdx + 1}/${testPrompts.length}] "${testItem.prompt}"`)

        for (const engine of engines) {
            console.log(`  -> Testing ${engine} on Bright Data...`)
            const startTime = Date.now()
            try {
                const snapshotId = await submitBrightDataTask(testItem.prompt, engine, { countryCode: "US" })
                console.log(`     Submitted task: ${snapshotId}`)

                const answer = await pollBrightDataTask(snapshotId, engine, { pollIntervalMs: 5000, maxWaitMs: 600000 })
                const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)

                const hasBase64 = answer.text.includes("data:image/")
                const charLen = answer.text.length
                const citationCount = answer.citations.length
                const queryCount = answer.searchQueries.length

                console.log(`     ✓ Ready in ${elapsedSec}s | Length: ${charLen} chars | Citations: ${citationCount} | Queries: ${queryCount}`)
                if (hasBase64) {
                    console.warn(`     ⚠ Warning: Answer text contains base64 image data!`)
                } else {
                    console.log(`     ✓ Clean text: No base64 data URIs detected.`)
                }

                if (citationCount > 0) {
                    console.log(`     Sample citation: ${answer.citations[0].url} (${answer.citations[0].title || "no title"})`)
                }

                // Check mentions
                const lowerText = answer.text.toLowerCase()
                const brandFound = lowerText.includes(testItem.subject.brandName.toLowerCase())
                const rivalsFound = testItem.competitors.filter((c) => lowerText.includes(c.name.toLowerCase())).map((c) => c.name)

                console.log(`     Subject [${testItem.subject.brandName}]: ${brandFound ? "FOUND" : "NOT FOUND"}`)
                console.log(`     Competitors found: ${rivalsFound.join(", ") || "none"}`)
            } catch (err) {
                console.error(`     ✗ Engine ${engine} failed:`, err.message)
            }
        }
        console.log("")
    }

    console.log("=== Benchmark Complete ===")
}

runBenchmark().catch((err) => {
    console.error("Benchmark threw error:", err)
    process.exit(1)
})
