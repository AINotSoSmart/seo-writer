/**
 * Reduces a model-suggested competitor URL to a safe hostname.
 *
 * Models occasionally append an HTML or JSON fragment after an otherwise
 * valid URL. URL parsing still gives us the correct hostname; no downstream
 * prompt should ever receive the untrusted remainder.
 */
export function competitorDomain(value: unknown): string | null {
    const raw = String(value || "").trim()
    if (!raw) return null

    try {
        const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
        const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "")
        if (!hostname || !hostname.includes(".")) return null
        return hostname
    } catch {
        return null
    }
}
