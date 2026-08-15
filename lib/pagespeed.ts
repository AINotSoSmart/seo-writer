/**
 * Google PageSpeed Insights API Client
 * Documentation: https://developers.google.com/speed/docs/insights/v5/get-started
 * 
 * This API provides:
 * - Lighthouse scores (Performance, Accessibility, Best Practices, SEO)
 * - Core Web Vitals (LCP, CLS, TBT, FCP)
 * - SEO Recommendations
 */

export interface PageSpeedMetrics {
    // Lighthouse Scores (0-100)
    performance_score: number
    accessibility_score: number
    best_practices_score: number
    seo_score: number

    // Core Web Vitals
    lcp_seconds: number    // Largest Contentful Paint
    cls: number            // Cumulative Layout Shift
    tbt_ms: number         // Total Blocking Time
    fcp_seconds: number    // First Contentful Paint

    // Recommendations
    recommendations: Recommendation[]
}

export interface Recommendation {
    id: string
    title: string
    description: string
    category: 'performance' | 'accessibility' | 'seo' | 'best-practices'
}

type Strategy = 'desktop' | 'mobile'

/**
 * Fetches PageSpeed Insights metrics for a URL
 * Free API - no quota limits for basic usage
 */
export async function fetchPageSpeedMetrics(
    url: string,
    strategy: Strategy = 'desktop'
): Promise<PageSpeedMetrics | null> {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`

    // PageSpeed API key is optional but recommended for higher rate limits
    const apiKey = process.env.PAGESPEED_API_KEY || ''
    const apiKeyParam = apiKey ? `&key=${apiKey}` : ''

    const categories = ['performance', 'accessibility', 'best-practices', 'seo']
    const categoryParams = categories.map(c => `category=${c}`).join('&')

    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(fullUrl)}&strategy=${strategy}&${categoryParams}${apiKeyParam}`

    try {
        const response = await fetch(apiUrl)

        if (!response.ok) {
            if (response.status === 429) {
                console.warn("[PageSpeed] Quota exceeded. API key required or limit reached.")
                throw new Error("QUOTA_EXCEEDED")
            }
            const error = await response.text()
            console.error("[PageSpeed] API error:", response.status, error)
            return null
        }

        const data = await response.json()

        // Extract Lighthouse scores
        const categories_result = data.lighthouseResult?.categories || {}
        const audits = data.lighthouseResult?.audits || {}

        // Extract Core Web Vitals
        const lcpAudit = audits['largest-contentful-paint'] || {}
        const clsAudit = audits['cumulative-layout-shift'] || {}
        const tbtAudit = audits['total-blocking-time'] || {}
        const fcpAudit = audits['first-contentful-paint'] || {}

        // Extract recommendations from audits that need improvement
        const recommendations: Recommendation[] = []

        // Get SEO issues
        const seoAudits = categories_result.seo?.auditRefs || []
        for (const auditRef of seoAudits) {
            const audit = audits[auditRef.id]
            if (audit && audit.score !== null && audit.score < 1) {
                recommendations.push({
                    id: auditRef.id,
                    title: audit.title || '',
                    description: audit.description || '',
                    category: 'seo'
                })
            }
        }

        // Get accessibility issues (top 5)
        const a11yAudits = categories_result.accessibility?.auditRefs || []
        let a11yCount = 0
        for (const auditRef of a11yAudits) {
            if (a11yCount >= 5) break
            const audit = audits[auditRef.id]
            if (audit && audit.score !== null && audit.score < 1) {
                recommendations.push({
                    id: auditRef.id,
                    title: audit.title || '',
                    description: audit.description || '',
                    category: 'accessibility'
                })
                a11yCount++
            }
        }

        const metrics: PageSpeedMetrics = {
            performance_score: Math.round((categories_result.performance?.score || 0) * 100),
            accessibility_score: Math.round((categories_result.accessibility?.score || 0) * 100),
            best_practices_score: Math.round((categories_result['best-practices']?.score || 0) * 100),
            seo_score: Math.round((categories_result.seo?.score || 0) * 100),

            lcp_seconds: parseFloat(((lcpAudit.numericValue || 0) / 1000).toFixed(2)),
            cls: parseFloat((clsAudit.numericValue || 0).toFixed(3)),
            tbt_ms: Math.round(tbtAudit.numericValue || 0),
            fcp_seconds: parseFloat(((fcpAudit.numericValue || 0) / 1000).toFixed(2)),

            recommendations: recommendations.slice(0, 10) // Limit to 10 recommendations
        }

        return metrics
    } catch (error) {
        console.error("[PageSpeed] Fetch error:", error)
        return null
    }
}

/**
 * Helper to determine if Core Web Vitals are passing
 */
export function getCoreWebVitalsStatus(metrics: PageSpeedMetrics): 'good' | 'needs-improvement' | 'poor' {
    // Good thresholds: LCP <= 2.5s, CLS <= 0.1, FCP <= 1.8s
    const lcpGood = metrics.lcp_seconds <= 2.5
    const clsGood = metrics.cls <= 0.1
    const fcpGood = metrics.fcp_seconds <= 1.8

    if (lcpGood && clsGood && fcpGood) return 'good'
    if (metrics.lcp_seconds > 4 || metrics.cls > 0.25) return 'poor'
    return 'needs-improvement'
}
