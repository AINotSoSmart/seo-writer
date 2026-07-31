/**
 * Shared search-direction cap for confirmed business scope.
 * Safe for client and server (no Node builtins).
 */

export const MAX_SEARCH_DIRECTIONS = 12

/**
 * Keeps at most `cap` search directions. Every family keeps one seed while
 * budget remains, then extras round-robin by priority.
 */
export function trimFamiliesToSearchCap<
    T extends { seed_keywords: string[]; priority: number },
>(families: T[], cap: number = MAX_SEARCH_DIRECTIONS): T[] {
    if (families.length === 0) return families
    const ordered = [...families].sort((a, b) => a.priority - b.priority)
    const total = ordered.reduce(
        (sum, family) => sum + family.seed_keywords.length,
        0,
    )
    if (total <= cap) return ordered

    const keepCount = ordered.map(() => 0)
    let kept = 0

    for (let i = 0; i < ordered.length && kept < cap; i++) {
        if (ordered[i].seed_keywords.length > 0) {
            keepCount[i] = 1
            kept += 1
        }
    }

    let round = 1
    const maxLen = Math.max(
        ...ordered.map((family) => family.seed_keywords.length),
        0,
    )
    while (kept < cap && round < maxLen) {
        for (let i = 0; i < ordered.length && kept < cap; i++) {
            if (round < ordered[i].seed_keywords.length) {
                keepCount[i] += 1
                kept += 1
            }
        }
        round += 1
    }

    return ordered
        .map((family, index) => ({
            ...family,
            seed_keywords: family.seed_keywords.slice(0, keepCount[index]),
        }))
        .filter((family) => family.seed_keywords.length > 0)
        .map((family, index) => ({ ...family, priority: index }))
}
