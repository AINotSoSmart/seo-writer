export function normalizeEvidenceText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim()
}

export function isEvidenceQuoteSupported(content: string, quote: string): boolean {
  const normalizedQuote = normalizeEvidenceText(quote)
  return Boolean(normalizedQuote) && normalizeEvidenceText(content).includes(normalizedQuote)
}

export function isKnownCompetitorUrl(value: string, competitorUrls: string[]): boolean {
  let host = ""
  try { host = new URL(value).hostname.toLowerCase().replace(/^www\./, "") } catch { return false }
  return competitorUrls.some((competitor) => {
    try {
      const known = new URL(competitor).hostname.toLowerCase().replace(/^www\./, "")
      return host === known || host.endsWith(`.${known}`)
    } catch {
      return false
    }
  })
}
