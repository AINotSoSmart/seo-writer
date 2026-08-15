/**
 * Returns a minimal date context string for AI prompts.
 * This prevents the AI from using outdated dates from its training cutoff.
 */
export function getCurrentDateContext(): string {
    const now = new Date()
    const month = now.toLocaleDateString('en-US', { month: 'long' })
    const year = now.getFullYear()
    return `[Current Date: ${month} ${year}]`
}

/**
 * Gets just the current year
 */
export function getCurrentYear(): number {
    return new Date().getFullYear()
}
