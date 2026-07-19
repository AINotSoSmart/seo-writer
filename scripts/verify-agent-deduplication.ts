
import { checkSimilarityWithAgent } from "@/lib/plans/similarity-agent"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config() // fallback to .env

async function runVerification() {
    console.log("🚀 Starting Agentic Deduplication Verification")
    console.log("Model: gemini-3.1-flash-lite")
    console.log("----------------------------------------")

    const testCases = [
        {
            name: "Obvious Duplicate",
            topicA: "How to get cited by ChatGPT",
            topicB: "How to get your brand mentioned in ChatGPT",
            expected: true
        },
        {
            name: "Distinct Topics",
            topicA: "Advanced SEO Techniques for 2025",
            topicB: "Best Chocolate Chip Cookie Recipe",
            expected: false
        },
        {
            name: "Different OS (Distinct Intent)",
            topicA: "How to install Node.js on Windows 11",
            topicB: "How to install Node.js on macOS Sequoia",
            expected: false
        },
        {
            name: "Topic vs Definition (Distinct Intent)",
            topicA: "Top 10 CRM Software for Small Business",
            topicB: "What is Customer Relationship Management (CRM)?",
            expected: false
        },
        {
            name: "Same Topic, Different Wording",
            topicA: "Benefits of drinking green tea",
            topicB: "Why text green tea is good for you",
            expected: true
        }
    ]

    let passed = 0
    let failed = 0

    for (const test of testCases) {
        console.log(`\nTEST: ${test.name}`)
        console.log(`A: "${test.topicA}"`)
        console.log(`B: "${test.topicB}"`)

        try {
            const isDuplicate = await checkSimilarityWithAgent(test.topicA, test.topicB)
            const resultMatch = isDuplicate === test.expected

            if (resultMatch) {
                console.log(`✅ PASSED - Result: ${isDuplicate} (Expected: ${test.expected})`)
                passed++
            } else {
                console.log(`❌ FAILED - Result: ${isDuplicate} (Expected: ${test.expected})`)
                failed++
            }
        } catch (error) {
            console.error("❌ ERROR running test:", error)
            failed++
        }
    }

    console.log("\n----------------------------------------")
    console.log(`SUMMARY: ${passed}/${testCases.length} Passed`)

    if (failed > 0) {
        console.log("⚠️ Some tests failed. Check logs.")
        process.exit(1)
    } else {
        console.log("🎉 All tests passed!")
        process.exit(0)
    }
}

runVerification()
