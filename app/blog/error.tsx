"use client"

import { useEffect, useState } from "react"
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from "@/components/landing/Footer"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RefreshCw, ArrowRight, Home } from "lucide-react"
import { ErrorGraphic } from "@/components/ui/error-graphic"

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isOnline, setIsOnline] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Blog page error:', error)

    // Check network status
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [error])

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    reset()
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      <Navbar />

      <main className="flex-1 flex items-center justify-center pt-24 pb-16 px-4 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40 -z-10"></div>

        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">

          {/* Left Side: content */}
          <div className="order-2 md:order-1 flex flex-col items-start text-left">
            <div className={`inline-block border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-3 py-1 mb-6 transform rotate-1 ${!isOnline ? 'bg-red-100' : 'bg-brand-yellow'}`}>
              <span className="font-mono font-bold text-xs uppercase tracking-widest">
                {!isOnline ? 'Connection Lost' : 'System Error'}
              </span>
            </div>

            <h1 className="font-display font-black text-4xl md:text-6xl mb-6 uppercase leading-[0.9]">
              {!isOnline ? 'You Are\nOffline' : 'Something\nWent Wrong'}
            </h1>

            <p className="font-sans text-gray-600 text-lg mb-8 leading-relaxed border-l-4 border-black pl-4 py-1 max-w-md">
              {!isOnline
                ? 'We cannot reach our servers. Please check your internet connection and try again.'
                : 'We\'re having trouble loading the blog content. This might be a temporary issue.'
              }
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <Button
                onClick={handleRetry}
                disabled={!isOnline}
                className="flex-1 h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-black text-white rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${!isOnline ? 'animate-spin' : ''}`} />
                {!isOnline ? 'Waiting for connection...' : 'Try Again'}
              </Button>

              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white text-black hover:bg-gray-50 rounded-none">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </Link>
            </div>

            {process.env.NODE_ENV === 'production' && (
              <div className="mt-8 p-4 bg-gray-50 border-2 border-black/10 text-left w-full max-w-md">
                <h3 className="font-mono font-bold text-xs text-gray-500 mb-1 uppercase">Diagnostics Code</h3>
                <p className="text-xs text-gray-400 font-mono break-all">{error.digest || error.message || 'UNKNOWN_ERROR'}</p>
              </div>
            )}

          </div>

          {/* Right Side: Graphic */}
          <div className="order-1 md:order-2 flex justify-center transform hover:scale-105 transition-transform duration-500">
            <ErrorGraphic mode={!isOnline ? 'offline' : 'error'} />
          </div>

        </div>
      </main>
      <Footer />
    </div>
  )
}