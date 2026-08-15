/**
 * Moz Links API Client
 * Documentation: https://moz.com/help/links-api
 * 
 * Note: Moz now uses single API token (Bearer auth), not the legacy access_id + secret_key
 */

export interface MozMetrics {
    domain_authority: number
    page_authority: number
    linking_root_domains: number
    external_links: number
}

interface MozApiResponse {
    results: Array<{
        domain_authority?: number
        page_authority?: number
        root_domains_to_root_domain?: number
        external_pages_to_root_domain?: number
    }>
}

/**
 * Fetches domain metrics from Moz Links API v2
 * Uses 1 API call per domain
 */
export async function fetchMozMetrics(domain: string): Promise<MozMetrics | null> {
    const apiToken = process.env.MOZ_API_TOKEN

    if (!apiToken) {
        console.error("[Moz] Missing MOZ_API_TOKEN environment variable")
        return null
    }

    // Clean domain - remove protocol and trailing slashes
    const cleanDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .split('/')[0] // Remove path

    try {
        const response = await fetch('https://lsapi.seomoz.com/v2/url_metrics', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                targets: [cleanDomain],
                // Request all available metrics
                source_cols: [
                    "domain_authority",
                    "page_authority",
                    "root_domains_to_root_domain",
                    "external_pages_to_root_domain"
                ]
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            console.error("[Moz] API error:", response.status, error)
            return null
        }

        const data: MozApiResponse = await response.json()

        if (!data.results || data.results.length === 0) {
            console.warn("[Moz] No results for domain:", cleanDomain)
            return null
        }

        const result = data.results[0]

        return {
            domain_authority: result.domain_authority ?? 0,
            page_authority: result.page_authority ?? 0,
            linking_root_domains: result.root_domains_to_root_domain ?? 0,
            external_links: result.external_pages_to_root_domain ?? 0,
        }
    } catch (error) {
        console.error("[Moz] Fetch error:", error)
        return null
    }
}
