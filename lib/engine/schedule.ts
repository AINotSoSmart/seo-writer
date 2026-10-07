/**
 * When the internal engine runs. Pure, so it can be asserted under plain node.
 */

/** Every Monday at 08:30 GMT — the owner's chosen run time. */
export const ENGINE_WEEKLY_CRON = "30 8 * * 1"
export const ENGINE_WEEKLY_TIMEZONE = "UTC"

/** A week with no live writer for this long is abandoned, not slow. */
export const ENGINE_MEASURING_STALE_MINUTES = 60

/**
 * The Monday (UTC) a moment belongs to, as YYYY-MM-DD. A manual run on a
 * Thursday belongs to that week's Monday, so it replaces nothing in another week.
 */
export function weekStartFor(moment: Date): string {
    const day = new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()))
    const sinceMonday = (day.getUTCDay() + 6) % 7
    day.setUTCDate(day.getUTCDate() - sinceMonday)
    return day.toISOString().slice(0, 10)
}

/** The Monday before `weekStart`, as YYYY-MM-DD. */
export function previousWeekStart(weekStart: string): string {
    const day = new Date(`${weekStart}T00:00:00Z`)
    day.setUTCDate(day.getUTCDate() - 7)
    return day.toISOString().slice(0, 10)
}

/** Lower-cased host without `www.`, from a URL or a bare host. */
export function normalizeHost(value: string): string | null {
    const trimmed = String(value || "").trim()
    if (!trimmed) return null
    try {
        const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
        return url.hostname.toLowerCase().replace(/^www\./, "") || null
    } catch {
        return null
    }
}
