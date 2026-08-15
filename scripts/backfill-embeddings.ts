import { createClient } from "@supabase/supabase-js"
import { GoogleGenAI } from "@google/genai"
import fs from "fs"
import path from "path"

// Load env vars from .env.local
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), ".env.local")
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, "utf-8")
            content.split("\n").forEach(line => {
                const parts = line.split("=")
                if (parts.length >= 2) {
                    const key = parts[0].trim()
                    // Remove quotes if present
                    let value = parts.slice(1).join("=").trim()
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1)
                    }
                    if (key && !key.startsWith("#")) {
                        process.env[key] = value
                    }
                }
            })
            console.log("✅ Loaded .env.local")
        } else {
            console.log("ℹ️  .env.local not found, relying on existing process.env")
        }
    } catch (e) {
        console.warn("⚠️  Failed to load .env.local:", e)
    }
}

function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase environment variables")
    }

    return createClient(supabaseUrl, supabaseServiceKey)
}

function getGeminiClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured")
    }
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
}

async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const genAI = getGeminiClient()
        // Using the GA SDK @google/genai structure
        const result = await genAI.models.embedContent({
            model: "gemini-embedding-001",
            contents: [{ parts: [{ text }] }]
        })

        const embedding = (result as any).embeddings && (result as any).embeddings[0]

        if (!embedding || !embedding.values) {
            throw new Error("Failed to get embedding values from Gemini response")
        }

        return embedding.values
    } catch (error) {
        console.error("❌ Error generating embedding:", error)
        throw error
    }
}

async function backfill() {
    loadEnv()

    const args = process.argv.slice(2)
    const dryRun = args.includes("--dry-run")
    const batchSizeArg = args.find(a => a.startsWith("--batch-size="))
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1]) : 10

    const supabase = createAdminClient()

    console.log(`🚀 Starting answer_coverage embedding backfill`)
    console.log(`   Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`)
    console.log(`   Batch Size: ${batchSize}`)

    // Fetch all rows with null answer_embedding
    const { data: rows, error: fetchError } = await supabase
        .from("answer_coverage")
        .select("id, answer_unit")
        .is("answer_embedding", null)

    if (fetchError) {
        console.error("❌ Failed to fetch rows:", fetchError)
        process.exit(1)
    }

    if (!rows || rows.length === 0) {
        console.log("✅ No rows need backfilling!")
        return
    }

    console.log(`📊 Found ${rows.length} rows with missing embeddings`)

    let processedCount = 0
    let errorCount = 0

    // Process in batches
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        console.log(`⚙️  Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(rows.length / batchSize)}...`)

        // Run embeddings in parallel for the batch
        await Promise.all(batch.map(async (row) => {
            try {
                // Generate embedding
                const embedding = await generateEmbedding(row.answer_unit)

                if (!dryRun) {
                    const { error: updateError } = await supabase
                        .from("answer_coverage")
                        .update({ answer_embedding: JSON.stringify(embedding) })
                        .eq("id", row.id)

                    if (updateError) {
                        console.error(`❌ Failed to update row ${row.id}:`, updateError.message)
                        errorCount++
                    } else {
                        processedCount++
                    }
                } else {
                    // Dry run success
                    processedCount++
                }
            } catch (e: any) {
                console.error(`❌ Failed to generate embedding for "${row.answer_unit}":`, e.message)
                errorCount++
            }
        }))

        // Small delay between batches to be nice to APIs
        if (i + batchSize < rows.length) {
            await new Promise(resolve => setTimeout(resolve, 500))
        }
    }

    console.log(`\n🎉 Backfill complete!`)
    console.log(`   Success: ${processedCount}`)
    console.log(`   Errors:  ${errorCount}`)
    console.log(`   Total:   ${rows.length}`)
}

backfill().catch(console.error)
