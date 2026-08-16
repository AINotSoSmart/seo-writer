/**
 * Returns a minimal date context string for AI prompts.
 * This prevents the AI from using outdated dates from its training cutoff.
 */
export function getCurrentDateContext(now: Date = new Date()): string {
    return `[Current date and time: ${now.toISOString()}; current calendar year: ${now.getUTCFullYear()}]`
}

/**
 * Gets just the current year
 */
export function getCurrentYear(): number {
    return new Date().getFullYear()
}
