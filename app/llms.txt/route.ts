import { features } from "@/app/features/data"
import { PRODUCT_TRUTH } from "@/config/product-truth"
import { defaultSEO } from "@/config/seo"

export const revalidate = 3600

export function GET() {
    const featureUrls = Object.keys(features).map(
        (slug) => `- ${defaultSEO.siteUrl}/features/${slug}`,
    )
    const tiers = Object.values(PRODUCT_TRUTH.tiers).map(
        (tier) =>
            `- ${tier.label}: $${tier.price}/month; ${tier.cadence.toLowerCase()}.`,
    )
    const body = [
        "# FlipAEO",
        "",
        defaultSEO.description,
        "",
        "## Product contract",
        "",
        // `programClusters` is a legacy display default, never a gate. Scope is
        // dynamic — a program contains however many qualified clusters the audit
        // measured — so this file must not state a fixed count as fact.
        "- One program contains every qualified priority cluster the audit measured.",
        `- Qualified clusters contain ${PRODUCT_TRUTH.minClusterArticles}-${PRODUCT_TRUTH.maxClusterArticles} unique planned articles.`,
        "- Measured demand too thin for its own article becomes a named section inside a related one; it is never padding.",
        "- FlipAEO is the agency alternative for founder-led B2B SaaS: the same research, planning, writing and delivery an agency retainer covers, priced as software and scoped to end.",
        "- Every audit query retains its observed source URL.",
        "- Article URLs and the internal-link graph are frozen before purchase.",
        "- A cluster is withheld until every member is generated.",
        "- Generated, delivered, and published are separate states.",
        `- ${PRODUCT_TRUTH.automaticCancellation}`,
        "",
        "FlipAEO does not guarantee rankings, traffic, citations, or complete coverage of an entire niche. It does not require Google Search Console access.",
        "",
        "## Delivery speeds",
        "",
        ...tiers,
        "",
        "## Canonical pages",
        "",
        `- ${defaultSEO.siteUrl}/`,
        `- ${defaultSEO.siteUrl}/features`,
        ...featureUrls,
        `- ${defaultSEO.siteUrl}/pricing`,
        `- ${defaultSEO.siteUrl}/privacy-policy`,
        `- ${defaultSEO.siteUrl}/terms`,
        `- ${defaultSEO.siteUrl}/refund-policy`,
        "",
        "Contact: support@flipaeo.com",
        "",
    ].join("\n")

    return new Response(body, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    })
}
