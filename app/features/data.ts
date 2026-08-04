export type FeatureTruth = {
    slug: string
    name: string
    summary: string
    promise: string
    inputs: string[]
    outputs: string[]
    safeguards: string[]
}

/**
 * Public-facing copy. Written for a founder who does not employ an SEO.
 *
 * Every internal term has a plain-English equivalent and the plain one wins
 * here: "batch" not "cluster snapshot", "we check it still works" not "graph
 * validation", "cannot be edited afterwards" not "immutable run hash". The
 * engineering vocabulary is correct and stays in docs/PIVOT.md — it just does
 * not belong on a page whose whole job is to be understood in ten seconds.
 *
 * Counts stay dynamic: the audit decides how many batches there are, so no
 * string here may promise a fixed number.
 */
export const features: Record<string, FeatureTruth> = {
    "evidence-backed-topical-audit": {
        slug: "evidence-backed-topical-audit",
        name: "A gap audit you can fact-check",
        summary:
            "We find the questions your market is searching that your site does not answer — and every single one carries a link to the page or search where we saw it.",
        promise:
            "You can open any gap we show you and check it yourself. If we cannot trace a question back to somewhere real, it does not go in your report.",
        inputs: ["Your public website", "The product areas you confirm", "Up to four competitors"],
        outputs: [
            "Every missing question, with its source link",
            "What your existing pages already cover",
            "A snapshot that cannot be quietly edited later",
        ],
        safeguards: [
            "No access to your Google account or analytics",
            "A question with no traceable source is dropped, not guessed",
            "Re-running an audit never rewrites work you already bought",
        ],
    },
    "competitor-gap-evidence": {
        slug: "competitor-gap-evidence",
        name: "See who is already answering it",
        summary:
            "For each question you are missing, see the competitor pages that answer it today and the closest thing you have published.",
        promise:
            "We show you what we observed, not a forecast. No traffic estimates, no ranking predictions, no invented numbers.",
        inputs: ["The questions we observed", "Public competitor pages", "Your own published pages"],
        outputs: [
            "Questions you miss entirely, and ones you half-answer",
            "The competitor pages currently answering them",
            "Your nearest existing page, so you can judge overlap",
        ],
        safeguards: [
            "Four competitors maximum — a focused read, not a scrape",
            "Every claim links to the page it came from",
            "We never mark a topic covered just because your site is vaguely about it",
        ],
    },
    "topic-cluster-delivery": {
        slug: "topic-cluster-delivery",
        name: "Complete batches, never half-built",
        summary:
            "Articles arrive in themed batches of 8 to 15, each one a pillar article plus the supporting pieces around it, already linked to each other.",
        promise:
            "A batch only reaches you once every article in it is finished. If one fails, the batch waits rather than shipping you something to repair.",
        inputs: [
            "The batches your audit qualified",
            "The delivery speed you chose",
            "Your confirmed product areas",
        ],
        outputs: [
            "Whole batches, ready to review",
            "Articles written against the evidence we showed you",
            "A running count of what is done and what is left",
        ],
        safeguards: [
            "No partial batches, ever",
            "Only the failed article is retried, not the whole batch",
            "The scope is fixed before you pay and cannot grow afterwards",
        ],
    },
    "frozen-internal-link-graph": {
        slug: "frozen-internal-link-graph",
        name: "Internal links that work on arrival",
        summary:
            "You confirm where articles will live before writing starts, so every internal link points at a real address from day one.",
        promise:
            "Articles in a batch link to each other and back to their pillar. We check every link resolves before the batch is released to you.",
        inputs: ["Your permanent blog URL pattern", "The planned article list", "Your current site structure"],
        outputs: [
            "A final web address for every planned article",
            "Links already written into the articles",
            "A check that the whole set connects properly",
        ],
        safeguards: [
            "Links only ever point at your own domain",
            "No self-links and no duplicates",
            "A batch with a broken link is held back, not delivered",
        ],
    },
    "wordpress-manual-delivery": {
        slug: "wordpress-manual-delivery",
        name: "Publish to WordPress, or take it anywhere",
        summary:
            "Review the batch in your dashboard, push it straight to WordPress as drafts, or export it and publish however you like.",
        promise:
            "Delivered is not published. Nothing goes live on your site until you choose to publish it.",
        inputs: ["Your delivered articles", "An optional WordPress connection", "The agreed web address"],
        outputs: ["Articles in your dashboard", "WordPress drafts", "A confirmed live URL once you publish"],
        safeguards: [
            "Nothing installed on your server",
            "If WordPress changes the address, it stays a draft and tells you",
            "We never guess whether something went live",
        ],
    },
    "program-burn-down": {
        slug: "program-burn-down",
        name: "A programme that ends",
        summary:
            "Watch what is written, what has been delivered and what you have published, tracked separately — and see exactly how much is left.",
        promise:
            "Once your last batch is delivered, we ask for the subscription to be cancelled at the end of that billing period. There is nothing for you to remember to switch off.",
        inputs: ["Your agreed schedule", "Batch progress", "Your billing dates"],
        outputs: [
            "Written, delivered and published counts, kept apart",
            "Dates that shift correctly if you pause",
            "Confirmation that cancellation was requested",
        ],
        safeguards: [
            "A retry never charges you twice",
            "Pausing shifts the schedule without changing the price",
            "No work is generated after your scope is delivered",
        ],
    },
}
