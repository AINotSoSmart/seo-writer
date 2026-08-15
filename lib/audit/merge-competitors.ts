/**
 * User-supplied competitors are preferred seeds, not a hard stop.
 * A founder who names one rival must still get a full competitor corpus
 * (up to maxCompetitors) so gap ownership evidence is not starved.
 */

export interface CompetitorRef {
    name: string
    url: string
    domain?: string
}

function hostnameOf(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./i, "").toLowerCase()
    } catch {
        return null
    }
}

export function mergeUserFirstCompetitors(
    userCompetitors: CompetitorRef[],
    discovered: CompetitorRef[],
    maxCompetitors: number,
): CompetitorRef[] {
    const out: CompetitorRef[] = []
    const seen = new Set<string>()

    const push = (competitor: CompetitorRef) => {
        if (out.length >= maxCompetitors) return
        const host = hostnameOf(competitor.url)
        if (!host || seen.has(host)) return
        seen.add(host)
        out.push({
            name: competitor.name || host,
            url: competitor.url,
            domain: competitor.domain || host,
        })
    }

    for (const competitor of userCompetitors) push(competitor)
    for (const competitor of discovered) push(competitor)
    return out
}
