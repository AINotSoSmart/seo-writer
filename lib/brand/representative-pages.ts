const REPRESENTATIVE_PAGE_LIMIT = 8
const DIRECT_SURFACE_PATH_SIGNALS = [
  "pricing", "price", "product", "feature", "tool", "solution", "use-case",
  "usecase", "service", "docs", "how-it-works",
]
const DEPRIORITIZED_PATH_SIGNALS = [
  "blog", "post", "article", "news", "career", "job", "legal", "privacy",
  "terms", "refund", "login", "signup", "contact",
]
const COMPARISON_PATH_SIGNALS = ["compare", "comparison", "alternative", "versus", "vs"]
const COLLECTION_ROUTE_SEGMENTS = new Set(["product", "products", "item", "items", "p"])

function tokens(value: string): string[] {
  return value.toLowerCase().replace(/https?:\/\//g, " ").replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/).filter((token) => token.length > 2)
}

function routeFamily(url: URL): string {
  const segments = url.pathname.toLowerCase().split("/").filter(Boolean)
  if (segments.length === 0) return "/"
  return COLLECTION_ROUTE_SEGMENTS.has(segments[0])
    ? `/${segments[0]}/*`
    : `/${segments.slice(0, 2).join("/")}`
}

/** Select a diverse, bounded first-party corpus before content extraction. */
export function selectRepresentativeBrandUrls(
  subjectUrl: string,
  sitemapUrls: string[],
  targetSeeds: string[],
  limit = REPRESENTATIVE_PAGE_LIMIT,
): string[] {
  const subject = new URL(subjectUrl)
  const host = subject.hostname.toLowerCase().replace(/^www\./, "")
  const seedTokens = new Set(targetSeeds.flatMap(tokens))
  const candidates = Array.from(new Set([`${subject.origin}/`, ...sitemapUrls])).flatMap((value) => {
    try {
      const url = new URL(value, subject.origin)
      const candidateHost = url.hostname.toLowerCase().replace(/^www\./, "")
      if (candidateHost !== host || !["http:", "https:"].includes(url.protocol)) return []
      url.hash = ""
      const path = url.pathname.toLowerCase()
      if (DEPRIORITIZED_PATH_SIGNALS.some((signal) => path.includes(signal))) return []
      const seedOverlap = tokens(path).filter((token) => seedTokens.has(token)).length
      const depth = path.split("/").filter(Boolean).length
      const score =
        (path === "/" ? 10_000 : 0) +
        (/\/(pricing|price)(\/|$)/.test(path) ? 2_000 : 0) +
        seedOverlap * 1_000 +
        (DIRECT_SURFACE_PATH_SIGNALS.some((signal) => path.includes(signal)) ? 350 : 0) -
        (COMPARISON_PATH_SIGNALS.some((signal) => path.includes(signal)) ? 500 : 0) -
        depth * 5
      return [{ url: url.toString(), score, family: routeFamily(url) }]
    } catch {
      return []
    }
  })
  candidates.sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
  const counts = new Map<string, number>()
  const selected: string[] = []
  for (const candidate of candidates) {
    const count = counts.get(candidate.family) || 0
    if (count >= 2) continue
    selected.push(candidate.url)
    counts.set(candidate.family, count + 1)
    if (selected.length >= limit) break
  }
  return selected
}
