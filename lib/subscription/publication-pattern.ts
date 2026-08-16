export class PublicationPatternError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "PublicationPatternError"
    }
}

/**
 * The publication path is collected before checkout so every future create
 * action can receive a stable, same-site target URL without asking again.
 */
export function validatePublicationPattern(
    pattern: string,
    subjectUrl: string,
): string {
    const trimmed = typeof pattern === "string" ? pattern.trim() : ""
    if (trimmed.split("{slug}").length !== 2) {
        throw new PublicationPatternError(
            "The publication URL pattern must contain {slug} exactly once.",
        )
    }

    let target: URL
    let subject: URL
    try {
        target = new URL(trimmed.replace("{slug}", "selected-action-preview"))
        subject = new URL(subjectUrl)
    } catch {
        throw new PublicationPatternError(
            "The publication URL pattern is not a valid URL.",
        )
    }

    if (
        target.protocol !== "https:" ||
        target.search ||
        target.hash ||
        target.username ||
        target.password ||
        !target.pathname.includes("selected-action-preview")
    ) {
        throw new PublicationPatternError(
            "The publication URL pattern must be a clean HTTPS path.",
        )
    }

    const normalizeHost = (url: URL) =>
        url.hostname.toLowerCase().replace(/^www\./, "")
    if (normalizeHost(target) !== normalizeHost(subject)) {
        throw new PublicationPatternError(
            "The publication URL pattern must use the measured website host.",
        )
    }

    return trimmed
}

export function defaultPublicationPattern(subjectUrl: string): string {
    try {
        const url = new URL(subjectUrl)
        return `${url.origin}/blog/{slug}`
    } catch {
        return ""
    }
}
