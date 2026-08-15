'use client'

import React, { createContext, useContext } from 'react'

type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
    currentTheme: Theme
    previewDarkMode?: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
    currentTheme: 'system',
    previewDarkMode: false,
})

export function ThemeProvider({
    children,
    value,
}: {
    children: React.ReactNode
    value?: Partial<ThemeContextValue>
}) {
    const merged: ThemeContextValue = {
        currentTheme: value?.currentTheme ?? 'system',
        previewDarkMode: value?.previewDarkMode ?? false,
    }
    return <ThemeContext.Provider value={merged}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
    return useContext(ThemeContext)
}