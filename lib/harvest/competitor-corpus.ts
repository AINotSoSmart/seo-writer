/**
 * Competitor corpus harvester.
 *
 * Competitors' published pages are evidence that somebody with a budget decided
 * a topic was worth covering.
 *
 * WHAT CHANGED: the first version derived topics from URL slugs without opening
 * the page. Verification found six of sixteen sampled rows were "traceable but
 * not literally present" — the URL resolved, but the harvested phrase appeared
 * nowhere in the visible text. `/blog/how-ai-is-used` became the topic
 * "how ai is used", which is an inference, not an observation.
 *
 * Now each page is fetched and its own `<title>`/`<h1>` text is harvested. If
 * `extractPageDocument` falls back to the slug — meaning it could not read a
 * real title — the row is dropped rather than guessed at.
 */

import { fetchAllSitemapUrls, filterContentUrls, hasMeaningfulTitle } from "@/lib/audit/site-scanner"
import { batchExtractDocuments } from "./page-document"
import { HARVEST_POLICY } from "./policy"
import {
    HarvestedQuery,
    HarvestOutput,
    normalizeQuery,
    isPlausibleQuery,
    dedupeQueries,
    buildSourceReport,
    containsExcludedBrand,
} from "./types"

/**
 * Pages that exist on every site and describe no topic.
 * `hasMeaningfulTitle` covers the common cases; these catch the wordier
 * variants that reached the pool as "content gaps" on the first run.
 */
// Anchored at the start only. Requiring `$` let "Terms and Conditions
// (Affiliate Program)" through on the first run, because the qualifier suffix
// broke the end anchor.
const BOILERPLATE_TITLE_PATTERNS = [
    /^(privacy|cookie|refund|shipping|return)s?\s+(policy|notice|statement)\b/i,
    /^terms\s+(and|&)\s+conditions\b/i,
    /^terms\s+(of\s+)?(service|use)\b/i,
    /^(end\s+user\s+)?licen[cs]e\s+agreement\b/i,
    /^(about|contact)\s+(us|me)\b/i,
    /^(sign|log)\s?(in|up|out)\b/i,
    /^(blog|news|articles|resources|pricing|features|home|index|changelog|roadmap)$/i,
    /^page\s+\d+/i,
    /^\d{4}$/,
    /\b(privacy policy|terms of service|cookie policy)\b/i,
]

/** Pages worth fetching per competitor — each one is an HTTP request */
function isBoilerplateTitle(title: string): boolean {
    return BOILERPLATE_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()))
}

/**
 * Harvests topics from competitor pages using their visible title text.
 *
 * @param competitorUrls  competitor homepages (discovered via
 *                        lib/audit/competitor-scanner.ts or user-supplied)
 */
export async function harvestCompetitorCorpus(
    competitorUrls: string[],
    excludeBrands: string[] = []
): Promise<HarvestOutput> {
    if (competitorUrls.length === 0) {
        console.warn("[Harvest:Competitors] No competitor URLs provided")
        return { queries: [], report: buildSourceReport("competitor_sitemap", 0, 0, 0, []) }
    }

    console.log(`[Harvest:Competitors] Scanning ${competitorUrls.length} competitor sites`)

    const collected: HarvestedQuery[] = []
    const errors: string[] = []
    let failed = 0
    let slugOnlyDropped = 0
    let boilerplateDropped = 0
    let remainingPageBudget = HARVEST_POLICY.maxCompetitorCorpusPages

    for (const competitorUrl of competitorUrls) {
        if (remainingPageBudget <= 0) break
        try {
            const sitemapUrls = await fetchAllSitemapUrls(competitorUrl)

            if (sitemapUrls.length === 0) {
                failed++
                errors.push(`${competitorUrl}: no sitemap found`)
                continue
            }

            const contentUrls = filterContentUrls(sitemapUrls).slice(
                0,
                remainingPageBudget,
            )
            remainingPageBudget -= contentUrls.length
            const documents = await batchExtractDocuments(contentUrls)

            for (const doc of documents) {
                // The page could not be read — its "title" is a slug guess, which
                // is exactly the unverifiable provenance this rewrite removes.
                if (doc.titleSource === "url_slug") {
                    slugOnlyDropped++
                    continue
                }

                // Prefer the h1 when present: it is body copy, so it is visible
                // on the rendered page rather than only in the tab.
                const topic = doc.h1 && isPlausibleQuery(doc.h1) ? doc.h1 : doc.title

                if (!hasMeaningfulTitle(topic) || isBoilerplateTitle(topic)) {
                    boilerplateDropped++
                    continue
                }
                if (!isPlausibleQuery(topic)) continue
                // Their branded pages describe their product, not a shared topic
                if (containsExcludedBrand(topic, excludeBrands)) continue

                collected.push({
                    query: topic,
                    query_norm: normalizeQuery(topic),
                    source: "competitor_sitemap",
                    // The page whose visible text contains this string
                    source_url: doc.url,
                    source_seed: competitorUrl,
                    observed_value: topic,
                    observed_at: new Date().toISOString(),
                })
            }

            console.log(
                `[Harvest:Competitors] ${competitorUrl}: ${sitemapUrls.length} URLs -> ` +
                `${documents.length} fetched -> ${collected.length} topics so far`
            )
        } catch (error: any) {
            failed++
            const message = error?.message || String(error)
            errors.push(`${competitorUrl}: ${message}`)
            console.error(`[Harvest:Competitors] Failed for ${competitorUrl}:`, message)
        }
    }

    const unique = dedupeQueries(collected)

    console.log(
        `[Harvest:Competitors] Final: ${unique.length} unique topics ` +
        `(dropped ${slugOnlyDropped} unreadable pages, ${boilerplateDropped} boilerplate)`
    )

    return {
        queries: unique,
        report: buildSourceReport(
            "competitor_sitemap",
            competitorUrls.length,
            failed,
            unique.length,
            errors
        ),
    }
}
