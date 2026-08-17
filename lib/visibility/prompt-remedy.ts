import {
    classifyCitation,
    type Actionability,
} from "./citation-classifier.ts"

export interface StoredCitation {
    url: string
    title?: string
}

export interface PromptRemedyAssessment {
    kind: "content" | "report_only" | "founder_review"
    reason: string
    counts: Record<Actionability, number>
}

/**
 * Decides whether owned content is a supported remedy for one measured prompt.
 * It is deliberately conservative: an earned or unresolved citation landscape
 * cannot be converted into an article merely because production has capacity.
 */
export function assessPromptRemedy(input: {
    citations: StoredCitation[]
    subjectDomains: string[]
    competitorDomains: string[]
}): PromptRemedyAssessment {
    const counts: Record<Actionability, number> = {
        publish: 0,
        earn: 0,
        none: 0,
        review: 0,
    }
    for (const citation of input.citations) {
        if (!citation.url) continue
        const classified = classifyCitation(
            citation.url,
            {
                subjectDomains: input.subjectDomains,
                competitorDomains: input.competitorDomains,
            },
            citation.title ?? "",
        )
        counts[classified.actionability]++
    }

    const classifiedCount = counts.publish + counts.earn + counts.none + counts.review
    if (counts.publish > 0 || classifiedCount === 0) {
        return {
            kind: "content",
            reason:
                counts.publish > 0
                    ? `${counts.publish} cited source${counts.publish === 1 ? " supports" : "s support"} an owned-content remedy.`
                    : "No cited-source pattern contradicts an owned-content remedy.",
            counts,
        }
    }
    if (counts.review > 0) {
        return {
            kind: "founder_review",
            reason: `${counts.review} cited source${counts.review === 1 ? " requires" : "s require"} founder classification before content production.`,
            counts,
        }
    }
    return {
        kind: "report_only",
        reason:
            counts.earn > 0
                ? "The cited evidence points to earned placement on third-party pages, not another owned article."
                : "The cited evidence is reference material the customer cannot publish into.",
        counts,
    }
}
