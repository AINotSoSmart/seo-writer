'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Footer'

function ErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  const getErrorMessage = (message: string | null) => {
    if (!message) {
      return 'An unexpected error occurred. Please try again.'
    }

    if (message.includes('rate limit') || message.includes('Too many')) {
      return 'Too many attempts. Please wait a few minutes before trying again.'
    }

    if (message.includes('Security') || message.includes('CSRF')) {
      return 'Security validation failed. Please refresh and try again.'
    }

    if (message.includes('auth') || message.includes('login') || message.includes('sign')) {
      return 'Authentication failed. Please try signing in again.'
    }

    if (message.includes('network') || message.includes('connection')) {
      return 'Connection error. Please check your internet and try again.'
    }

    return 'Something went wrong. Please try again.'
  }

  return (
    <div className="landing-page min-h-screen flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">

          {/* Error Badge */}
          <div className="inline-block bg-red-50 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-1.5 mb-8 transform -rotate-1">
            <span className="font-display font-bold text-xs uppercase tracking-widest text-red-600">Oops!</span>
          </div>

          {/* Heading */}
          <h1 className="font-display font-black text-4xl sm:text-5xl text-black mb-4 uppercase tracking-tight leading-none">
            Something<br />Went Wrong
          </h1>

          {/* Message */}
          <p className="text-stone-600 text-base mb-10 max-w-sm mx-auto">
            {getErrorMessage(message)}
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login">
              <Button className="h-12 px-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-black text-white rounded-none font-bold uppercase tracking-wider">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </Link>

            <Link href="/">
              <Button variant="outline" className="h-12 px-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white text-black hover:bg-stone-50 rounded-none font-bold uppercase tracking-wider">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}