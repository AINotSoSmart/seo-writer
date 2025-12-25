import Sitemapper from 'sitemapper'

/**
 * Fetches all URLs from a website's sitemap
 */
export async function fetchSitemapUrls(websiteUrl: string): Promise<string[]> {
    // Normalize URL and construct sitemap URL
    const baseUrl = websiteUrl.replace(/\/$/, '')
    const sitemapUrl = `${baseUrl}/sitemap.xml`

    console.log(`[Sitemap] Fetching from: ${sitemapUrl}`)

    const sitemapper = new Sitemapper({
        url: sitemapUrl,
        timeout: 15000, // 15 seconds
    })

    try {
        const { sites } = await sitemapper.fetch()
        const urls = Array.from(new Set(sites || [])) // Deduplicate
        console.log(`[Sitemap] Found ${urls.length} URLs`)
        return urls
    } catch (error) {
        console.warn(`[Sitemap] Failed to fetch: ${error}`)
        return []
    }
}

/**
 * Extracts human-readable titles from URL slugs
 * e.g., /blog/how-to-restore-photos → "how to restore photos"
 */
export function extractTitlesFromUrls(urls: string[]): string[] {
    return urls.map(url => {
        try {
            const path = new URL(url).pathname
            // Get the last segment of the path
            const slug = path.split('/').filter(Boolean).pop() || ''
            // Convert slug to readable title
            return slug
                .replace(/-/g, ' ')
                .replace(/_/g, ' ')
                .replace(/\d{4}\/\d{2}\/\d{2}/g, '') // Remove date patterns
                .trim()
        } catch {
            return ''
        }
    }).filter(title => title.length > 3) // Filter out very short titles
}

/**
 * Uses LLM to extract parent questions from existing article titles
 * This is used during onboarding to pre-seed coverage
 */
export async function extractParentQuestions(
    titles: string[],
    genAI: any
): Promise<Array<{ title: string; parentQuestion: string }>> {
    if (titles.length === 0) return []

    // Batch titles to avoid prompt overflow
    const batchSize = 30
    const batches = []
    for (let i = 0; i < titles.length; i += batchSize) {
        batches.push(titles.slice(i, i + batchSize))
    }

    const allResults: Array<{ title: string; parentQuestion: string }> = []

    for (const batch of batches) {
        const prompt = `
You are an SEO analyst. For each article title, identify the ONE fundamental user question it answers.

ARTICLE TITLES:
${batch.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

RULES:
1. Parent question should be a simple user question (not a keyword)
2. Multiple articles often answer the SAME parent question
3. Normalize to canonical form: "Can AI restore photos?" not "can AI restore photographs?"

OUTPUT (JSON array):
[
  { "title": "how to restore old photos", "parentQuestion": "How do I restore old photos?" },
  { "title": "what is AI photo restoration", "parentQuestion": "What is AI photo restoration?" }
]
`

        try {
            const response = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: { responseMimeType: "application/json" }
            })

            const text = response.text || "[]"
            const parsed = JSON.parse(text.replace(/```json|```/g, ''))
            allResults.push(...parsed)
        } catch (error) {
            console.warn(`[Sitemap] Failed to extract parent questions:`, error)
        }
    }

    return allResults
}

/**
 * Pre-seeds the answer_coverage table with existing site content
 */
export async function preseedCoverage(
    parentQuestions: Array<{ title: string; parentQuestion: string }>,
    userId: string,
    brandId: string,
    supabase: any
): Promise<number> {
    // Deduplicate by parent question
    const uniqueQuestions = new Map<string, string>()
    for (const pq of parentQuestions) {
        if (!uniqueQuestions.has(pq.parentQuestion.toLowerCase())) {
            uniqueQuestions.set(pq.parentQuestion.toLowerCase(), pq.parentQuestion)
        }
    }

    const inserts = Array.from(uniqueQuestions.values()).map(question => ({
        user_id: userId,
        brand_id: brandId,
        cluster: "Existing Content",
        answer_unit: question,
        coverage_state: "strong" as const, // Existing = already covered
    }))

    if (inserts.length === 0) return 0

    try {
        const { error } = await supabase
            .from("answer_coverage")
            .upsert(inserts, {
                onConflict: "user_id,brand_id,cluster,answer_unit"
            })

        if (error) {
            console.error("[Sitemap] Failed to pre-seed coverage:", error)
            return 0
        }

        console.log(`[Sitemap] Pre-seeded ${inserts.length} parent questions as "strong" coverage`)
        return inserts.length
    } catch (error) {
        console.error("[Sitemap] Pre-seed error:", error)
        return 0
    }
}
