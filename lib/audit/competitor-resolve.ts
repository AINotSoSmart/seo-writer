/**
 * Anchors a model's competitor picks to the pages it was actually shown.
 *
 * MUST STAY DEPENDENCY-FREE. `competitor-scanner.ts` imports `@tavily/core` and
 * the `@/` path alias, neither of which resolves under the plain
 * `node --experimental-strip-types` the contract suite runs on. This rule is
 * the part worth testing, so it lives in its own module — same reason
 * `lib/scope-mechanics.ts` exists.
 *
 * WHY THIS RULE EXISTS. Discovery hands a model a numbered list of real domains
 * returned by search and asks which are competitors. Its `url` field is a
 * *reference into that list*, not new information — but a flash-weight model
 * will cheerfully answer with a plausible URL from memory instead. Trusting it
 * fails in two directions, and this repo has now seen both:
 *
 * 1. **Invention.** A domain no search returned is not evidence of anything. It
 *    becomes a tracked rival, gets crawled, and its coverage is reported to the
 *    customer as measured fact. The previous code did
 *    `catch { domain = item.url }` — storing the raw string as a domain.
 * 2. **Silent loss.** The retired finder in `/api/analyze-competitors` dropped
 *    every candidate whose domain the model could not supply, after a prompt
 *    that explicitly invited it to leave the URL empty. That bias runs exactly
 *    the wrong way: famous generalists survive because their domains are
 *    memorised, and the small specific rivals a customer actually loses to are
 *    deleted. For bringback.pro it left one name — PicWish.
 *
 * So: match on domain when it is one we searched, otherwise recover by name,
 * and only then give up. Nothing is dropped for lacking a URL the model was
 * never required to know; nothing is admitted that no search returned.
 */

// Relative, not "@/lib/...": see the dependency note above. This module has no
// imports of its own, so it is safe to reach for here.
import { competitorDomain } from "../visibility/competitor-domain.ts"

export interface DiscoveredCompetitor {
    name: string
    url: string
    domain: string
}

export interface CompetitorCandidate {
    url: string
    title: string
    domain: string
}

/** Loose comparison key: letters and digits only, so "Kin Pict" matches "kinpict". */
export function slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function resolveAgainstCandidates(
    picks: unknown[],
    candidates: CompetitorCandidate[],
    subjectHost: string | null,
): DiscoveredCompetitor[] {
    const byDomain = new Map(candidates.map((candidate) => [candidate.domain, candidate]))
    const bySlug = new Map<string, CompetitorCandidate>()
    for (const candidate of candidates) {
        // First writer wins: earlier candidates ranked higher in search.
        const domainSlug = slug(candidate.domain.split(".")[0])
        if (domainSlug && !bySlug.has(domainSlug)) bySlug.set(domainSlug, candidate)
    }

    const out: DiscoveredCompetitor[] = []
    const taken = new Set<string>()

    for (const pick of picks) {
        const row =
            pick && typeof pick === "object" ? (pick as Record<string, unknown>) : {}
        const name = String(row.name || "")
            .replace(/[<>"{}]/g, "")
            .trim()
            .slice(0, 60)
        const rawUrl = String(row.url || "").trim()

        // `competitorDomain` also strips the trailing garbage a model sometimes
        // appends to an otherwise valid URL ('https://x.com/" target="_blank"'),
        // so an injected fragment can never reach a downstream prompt.
        const host = competitorDomain(rawUrl)
        let match: CompetitorCandidate | undefined = host
            ? byDomain.get(host)
            : undefined
        // The model named a rival it could not address. Recover it by name
        // rather than discarding it — this is the case that used to lose
        // exactly the competitors worth knowing about.
        if (!match && name) match = bySlug.get(slug(name))

        if (!match) continue
        if (subjectHost && match.domain === subjectHost) continue
        if (taken.has(match.domain)) continue

        taken.add(match.domain)
        out.push({
            name: name || match.title || match.domain,
            url: match.url,
            domain: match.domain,
        })
    }

    return out
}
