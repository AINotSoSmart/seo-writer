'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface CSRFContextType {
  token: string | null
  isReady: boolean
  refreshToken: () => Promise<void>
}

const CSRFContext = createContext<CSRFContextType>({
  token: null,
  isReady: false,
  refreshToken: async () => { },
})

export function CSRFProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const getTokenFromCookie = (): string | null => {
    if (typeof document === 'undefined') return null

    const cookies = document.cookie.split(';')
    const csrfCookie = cookies.find(cookie =>
      cookie.trim().startsWith('csrf-token-client=')
    )

    if (csrfCookie) {
      return decodeURIComponent(csrfCookie.split('=')[1])
    }

    return null
  }

  const refreshToken = async () => {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        // Token will be set in cookie, read it from there
        const newToken = getTokenFromCookie()
        setToken(newToken)
        setIsReady(true)
      }
    } catch (error) {
      console.error('Failed to refresh CSRF token:', error)
    }
  }

  useEffect(() => {
    // Get initial token from cookie
    const initialToken = getTokenFromCookie()
    if (initialToken) {
      setToken(initialToken)
      setIsReady(true)
    } else {
      // If no token, fetch one
      refreshToken()
    }
  }, [])

  return (
    <CSRFContext.Provider value={{ token, isReady, refreshToken }}>
      {children}
    </CSRFContext.Provider>
  )
}

export function useCSRF() {
  const context = useContext(CSRFContext)
  if (!context) {
    throw new Error('useCSRF must be used within a CSRFProvider')
  }
  return context
}

// Helper component to add CSRF token to forms
export function CSRFInput() {
  const { token, refreshToken } = useCSRF()

  useEffect(() => {
    if (!token) {
      refreshToken()
    }
  }, [token, refreshToken])

  // Always render the input, even if token is empty initially
  // This prevents form submission issues
  return (
    <input
      type="hidden"
      name="csrf-token"
      value={token || ''}
    />
  )
}