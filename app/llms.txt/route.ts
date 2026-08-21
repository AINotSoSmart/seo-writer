import { features } from "@/app/features/data"
import { PRODUCT_TRUTH } from "@/config/product-truth"
import { defaultSEO } from "@/config/seo"

export const revalidate = 3600

export function GET() {
    const featureUrls = Object.keys(features).map(
        (slug) => `- ${defaultSEO.siteUrl}/features/${slug}`,
    )
    const body = [
        "# FlipAEO",
        "",
        defaultSEO.description,
        "",
        "## Product contract",
        "",
        `- One website and up to ${PRODUCT_TRUTH.trackedPromptAllowance} confirmed buyer questions.`,
        `- Questions are remeasured in ${PRODUCT_TRUTH.engines.join(" and ")} each paid billing cycle.`,
        `- Each cycle can select up to ${PRODUCT_TRUTH.actionAllowance} create or refresh actions; the allowance is a ceiling, never a filler quota.`,
        "- Findings that do not justify a draft remain visible as report-only evidence.",
        "- Unselected qualified work remains in a visible backlog for a later cycle.",
        "- Selected drafts are released together as one complete batch.",
        "- Generated, delivered, and published are separate states.",
        `- ${PRODUCT_TRUTH.cancellation}`,
        "",
        "FlipAEO does not guarantee rankings, traffic, citations, or complete coverage of an entire niche. It does not require Google Search Console access.",
        "",
        "## Founding beta price hypothesis",
        "",
        `- $${PRODUCT_TRUTH.introductoryPrice}/month for the first ${PRODUCT_TRUTH.introductoryPeriods} billing periods.`,
        `- Planned continuing price: $${PRODUCT_TRUTH.continuingPrice}/month from period ${PRODUCT_TRUTH.introductoryPeriods + 1}.`,
        "- Checkout remains closed until the recurring payment-to-batch path passes sandbox testing.",
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
