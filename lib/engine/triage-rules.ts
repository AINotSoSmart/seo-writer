/**
 * Which bucket a gap belongs in, once the evidence is verified. Pure.
 *
 *   create          no page of ours answers the question
 *   refresh         a WordPress post/page answers it, but the pages the engines
 *                   cited carry specific things it lacks
 *   page_suggestion the same, for a site page that only a sitemap knows about
 *                   (not editable here: suggestions, not a rewrite)
 *   monitor         ours already answers it and lacks nothing material, it was
 *                   changed recently, or an unpublished draft already covers it
 */

export type ActionKind = "create" | "refresh" | "monitor" | "page_suggestion"

/** A page changed this recently has not had time to be re-read by the engines. */
export const RECENTLY_CHANGED_DAYS = 21

export interface CoveringPage {
    source: "wordpress" | "sitemap" | "app_article"
    modifiedAt: string | null
}

export function decideBucket(input: {
    covering: CoveringPage | null
    verifiedMissingItems: number
    now: Date
}): { kind: ActionKind; why: string } {
    const { covering, verifiedMissingItems, now } = input
    if (!covering) {
        return { kind: "create", why: "No page of yours answers these questions." }
    }
    if (covering.source === "app_article") {
        return {
            kind: "monitor",
            why: "An article written here already answers this and is waiting for you to publish it.",
        }
    }
    if (verifiedMissingItems === 0) {
        return {
            kind: "monitor",
            why: "Your page already answers this and lacks nothing the cited pages have. Leave it and keep watching.",
        }
    }
    if (covering.modifiedAt) {
        const ageDays = (now.getTime() - new Date(covering.modifiedAt).getTime()) / 86_400_000
        if (ageDays >= 0 && ageDays < RECENTLY_CHANGED_DAYS) {
            return {
                kind: "monitor",
                why: `Your page was changed ${Math.floor(ageDays)} day(s) ago; engines need time to re-read it before it is changed again.`,
            }
        }
    }
    if (covering.source === "sitemap") {
        return {
            kind: "page_suggestion",
            why: "Your site page answers this but lacks specific points the cited pages have.",
        }
    }
    return {
        kind: "refresh",
        why: "Your post answers this but lacks specific points the cited pages have.",
    }
}
