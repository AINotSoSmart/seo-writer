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
 * The launch contract is 40 tracked questions and up to eight selected actions
 * per cycle. Eight is always a ceiling, never a filler quota.
 */
export const features: Record<string, FeatureTruth> = {
    "evidence-backed-topical-audit": {
        slug: "evidence-backed-topical-audit",
        name: "AI visibility evidence you can inspect",
        summary:
            "We ask your confirmed buyer questions in ChatGPT and Google AI Mode, then retain the answers, mentions and citations behind every verdict.",
        promise:
            "You can open each result and inspect what the engine returned. Unresolved evidence is labelled for review rather than quietly converted into production work.",
        inputs: ["Your public website", "40 confirmed buyer questions", "Up to four competitors"],
        outputs: [
            "Per-question presence or absence evidence",
            "Observed competitors, mentions and citations",
            "An immutable measurement-run snapshot",
        ],
        safeguards: [
            "No access to your Google account or analytics",
            "Unresolved citation shapes stay out of automatic production",
            "A later measurement never rewrites an earlier report",
        ],
    },
    "competitor-gap-evidence": {
        slug: "competitor-gap-evidence",
        name: "See who AI answers mention instead",
        summary:
            "For each tracked question, inspect the brands and source pages the AI answer actually used.",
        promise:
            "We show you what we observed, not a forecast. No traffic estimates, no ranking predictions, no invented numbers.",
        inputs: ["The confirmed questions", "Observed AI answers", "Stored citations"],
        outputs: [
            "Questions where your brand is absent, present or outranked",
            "The cited sources behind each answer",
            "Clear publish, earn, report-only or founder-review evidence",
        ],
        safeguards: [
            "Four named competitors maximum for focused comparison",
            "Every citation remains attached to the observed answer",
            "Unknown source types are never treated as article gaps",
        ],
    },
    "topic-cluster-delivery": {
        slug: "topic-cluster-delivery",
        name: "Selected cycle batches, never filler",
        summary:
            "Each billing cycle selects up to eight prioritised create or refresh actions and releases all selected drafts together.",
        promise:
            "A batch only reaches you once every article in it is finished. If one fails, the batch waits rather than shipping you something to repair.",
        inputs: ["The latest measurement", "The durable opportunity backlog", "Explicit target-page decisions"],
        outputs: [
            "One complete cycle batch, ready to review",
            "Create or refresh drafts tied to selected opportunities",
            "A visible backlog of qualified work not selected yet",
        ],
        safeguards: [
            "At most eight actions; fewer is an acceptable outcome",
            "Only failed output is retried while the batch stays hidden",
            "Report-only findings consume no production slot",
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
        name: "Recurring cycles you can cancel",
        summary:
            "Watch each billing cycle move from measurement through selection, generation and complete-batch delivery.",
        promise:
            "Cancel anytime to prevent future billing cycles. Completed reports and delivered drafts remain available.",
        inputs: ["Your billing period", "Cycle progress", "Your cancellation choice"],
        outputs: [
            "Cycle and selected-action states kept apart",
            "Generated, delivered and published states kept apart",
            "Period-end cancellation status",
        ],
        safeguards: [
            "A retry never charges you twice",
            "Pausing production does not masquerade as billing cancellation",
            "Cancellation prevents future cycles without deleting history",
        ],
    },
}
