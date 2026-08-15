/**
 * Test script to verify prepareContentForWordPress function
 * Run with: npx tsx scripts/test-wordpress-conversion.ts
 */

import { prepareContentForWordPress } from '../lib/integrations/wordpress-client'

const testCases = [
    {
        name: "Ordered List with Items",
        input: "<ol><li>First item</li><li>Second item</li><li>Third item</li></ol>",
        expectedContains: [
            '<!-- wp:list {"ordered":true} -->',
            '<ol class="wp-block-list">',
            '<!-- wp:list-item -->',
            '<li>First item</li>',
            '<!-- /wp:list-item -->',
            '<!-- /wp:list -->'
        ]
    },
    {
        name: "Unordered List with Items",
        input: "<ul><li>Apple</li><li>Banana</li></ul>",
        expectedContains: [
            '<!-- wp:list -->',
            '<ul class="wp-block-list">',
            '<!-- wp:list-item -->',
            '<li>Apple</li>',
            '<!-- /wp:list-item -->'
        ]
    },
    {
        name: "Blockquote",
        input: "<blockquote><p>This is a quote</p></blockquote>",
        expectedContains: [
            '<!-- wp:quote -->',
            '<blockquote class="wp-block-quote"',
            '<!-- /wp:quote -->'
        ]
    },
    {
        name: "Table",
        input: "<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>",
        expectedContains: [
            '<!-- wp:table -->',
            '<figure class="    ">',
            '<table class="has-fixed-layout"',
            '<!-- /wp:table -->'
        ]
    }
]

console.log("Running WordPress Conversion Tests...\n")

let failedCount = 0

testCases.forEach(test => {
    const result = prepareContentForWordPress(test.input)
    const missingPatterns: string[] = []

    test.expectedContains.forEach(pattern => {
        if (!result.includes(pattern)) {
            missingPatterns.push(pattern)
        }
    })

    if (missingPatterns.length > 0) {
        console.error(`[FAIL] ${test.name}`)
        console.error(`  Missing patterns:`)
        missingPatterns.forEach(p => console.error(`    - ${JSON.stringify(p)}`))
        console.error(`  Actual output:\n${result}\n`)
        failedCount++
    } else {
        console.log(`[PASS] ${test.name}`)
    }
})

if (failedCount > 0) {
    console.log(`\n${failedCount} tests failed.`)
    process.exit(1)
} else {
    console.log("\nAll tests passed!")
}
