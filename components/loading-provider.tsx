"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { PageSkeleton, SimplePageSkeleton, ListPageSkeleton } from '@/components/ui/page-skeleton'

interface LoadingContextType {
  isLoading: boolean
  setLoading: (loading: boolean) => void
  startPageTransition: () => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}

interface LoadingProviderProps {
  children: React.ReactNode
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  // Auto-hide loading after initial page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800) // Show skeleton for 800ms to ensure smooth loading experience

    return () => clearTimeout(timer)
  }, [pathname]) // Reset loading state on route change

  const setLoading = (loading: boolean) => {
    setIsLoading(loading)
  }

  const startPageTransition = () => {
    setIsLoading(true)
  }

  const getSkeletonForPage = () => {
    // Determine which skeleton to show based on the current page
    if (pathname.includes('/demo-tool')) {
      return <ListPageSkeleton />
    }
    if (pathname.includes('/reports') || pathname.includes('/settings')) {
      return <SimplePageSkeleton />
    }
    // Default dashboard skeleton
    return <PageSkeleton />
  }

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading, startPageTransition }}>
      {isLoading ? (
        <div className="animate-pulse">
          {getSkeletonForPage()}
        </div>
      ) : (
        children
      )}
    </LoadingContext.Provider>
  )
}

// Hook for manual loading control in components
export function usePageLoading() {
  const { setLoading, startPageTransition } = useLoading()
  
  const showLoading = () => setLoading(true)
  const hideLoading = () => setLoading(false)
  
  return {
    showLoading,
    hideLoading,
    startPageTransition
  }
}