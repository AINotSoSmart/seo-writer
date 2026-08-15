'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationProgress() {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    let progressTimer: NodeJS.Timeout
    let completeTimer: NodeJS.Timeout

    const startLoading = () => {
      setIsLoading(true)
      setProgress(0)
      
      // Simulate progress
      progressTimer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 10
        })
      }, 100)
    }

    const completeLoading = () => {
      setProgress(100)
      completeTimer = setTimeout(() => {
        setIsLoading(false)
        setProgress(0)
      }, 200)
    }

    // Listen for navigation start (when clicking links)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a') as HTMLAnchorElement | null
      
      if (!link) return
      
      // Skip progress for downloads, blob URLs, and new-tab links
      const isDownload = link.hasAttribute('download')
      const isBlob = link.href?.startsWith('blob:')
      const isExternalTarget = link.target === '_blank'
      const isNonNavProtocol = link.href?.startsWith('mailto:') || link.href?.startsWith('tel:')

      if (isDownload || isBlob || isExternalTarget || isNonNavProtocol) {
        return
      }
      
      try {
        const url = new URL(link.href)
        const currentUrl = new URL(window.location.href)
        
        // Only show loader for internal navigation to different pages
        if (url.origin === currentUrl.origin && url.pathname !== currentUrl.pathname) {
          startLoading()
        }
      } catch (_) {
        // If URL parsing fails (e.g., custom protocols), do nothing
      }
    }

    document.addEventListener('click', handleClick)

    // Complete loading when route changes
    completeLoading()

    return () => {
      document.removeEventListener('click', handleClick)
      if (progressTimer) clearInterval(progressTimer)
      if (completeTimer) clearTimeout(completeTimer)
    }
  }, [pathname, searchParams])

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-gray-200">
      <div 
        className="h-full bg-gray-600 transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}