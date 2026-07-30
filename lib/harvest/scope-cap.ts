/**
 * Deterministic fair selection primitives.
 *
 * Cost caps must not become product-scope decisions. These functions preserve
 * every represented group in rounds before taking additional depth from any
 * one group.
 */

export function roundRobinCap<T>(
    items: T[],
    cap: number,
    keyFor: (item: T) => string,
    preferredKeys: string[],
): T[] {
    if (items.length <= cap) return items

    const buckets = new Map<string, T[]>()
    for (const item of items) {
        const key = keyFor(item)
        const bucket = buckets.get(key) || []
        bucket.push(item)
        buckets.set(key, bucket)
    }
    const orderedKeys = [
        ...preferredKeys.filter((key) => buckets.has(key)),
        ...Array.from(buckets.keys())
            .filter((key) => !preferredKeys.includes(key))
            .sort(),
    ]
    const cursors = new Map(orderedKeys.map((key) => [key, 0]))
    const selected: T[] = []

    while (selected.length < cap) {
        let progressed = false
        for (const key of orderedKeys) {
            const bucket = buckets.get(key) || []
            const cursor = cursors.get(key) || 0
            if (cursor >= bucket.length) continue
            selected.push(bucket[cursor])
            cursors.set(key, cursor + 1)
            progressed = true
            if (selected.length >= cap) break
        }
        if (!progressed) break
    }
    return selected
}

export function selectSerpSeeds(
    families: Array<{ seedKeywords: string[] }>,
    cap: number,
): string[] {
    const selected: string[] = []
    let round = 0
    while (
        selected.length < cap &&
        families.some((family) => family.seedKeywords.length > round)
    ) {
        for (const family of families) {
            const seed = family.seedKeywords[round]
            if (seed) selected.push(seed)
            if (selected.length >= cap) break
        }
        round++
    }
    return selected
}
