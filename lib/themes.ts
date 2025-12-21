import type { CSSProperties } from 'react'

/**
 * Returns inline style overrides for BillingSDK themed dialogs.
 * If you have a global theme system, replace this with your palette tokens.
 */
export function getThemeStyles(
    currentTheme: 'light' | 'dark' | 'system' = 'system',
    previewDarkMode: boolean = false
): CSSProperties {
    const isDark = previewDarkMode || currentTheme === 'dark'
    if (isDark) {
        return {
            // Minimal dark surface that works with shadcn/ui variables
            backgroundColor: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
        }
    }
    return {
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
    }
}