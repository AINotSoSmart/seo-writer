"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Button from "@/components/landing/Button"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowRight } from "lucide-react"
import { signInWithMagicLink, signInWithGoogle } from "./actions"
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { CSRFProvider, CSRFInput, useCSRF } from "@/components/csrf-provider"

type AuthState = {
  error?: string
  success?: string
}

function MagicLinkSubmit({ csrfReady }: { csrfReady: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending || !csrfReady}
      className="text-center justify-center w-full active:translate-y-[2px] active:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
          Sending Link...
        </>
      ) : (
        <>
          Send Login Link
        </>
      )}
    </Button>
  )
}

function GoogleSignInButton({ csrfReady }: { csrfReady: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="secondary"
      disabled={pending || !csrfReady}
      className="w-full justify-center cursor-pointer flex items-center gap-2.5 bg-white border border-gray-300 shadow-tactile-gray active:translate-y-[2px] active:shadow-tactile-gray-active px-2 sm:px-5 pt-1 sm:pt-2 pb-2 sm:pb-3 rounded-lg transition-all duration-150 ease-out"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <g fill="none" fillRule="evenodd">
              <path d="M9.82727273,24 C9.82727273,22.4757333 10.0804318,21.0144 10.5322727,19.6437333 L2.62345455,13.6042667 C1.08206818,16.7338667 0.213636364,20.2602667 0.213636364,24 C0.213636364,27.7365333 1.081,31.2608 2.62025,34.3882667 L10.5247955,28.3370667 C10.0772273,26.9728 9.82727273,25.5168 9.82727273,24" fill="#FBBC05" />
              <path d="M23.7136364,10.1333333 C27.025,10.1333333 30.0159091,11.3066667 32.3659091,13.2266667 L39.2022727,6.4 C35.0363636,2.77333333 29.6954545,0.533333333 23.7136364,0.533333333 C14.4268636,0.533333333 6.44540909,5.84426667 2.62345455,13.6042667 L10.5322727,19.6437333 C12.3545909,14.112 17.5491591,10.1333333 23.7136364,10.1333333" fill="#EB4335" />
              <path d="M23.7136364,37.8666667 C17.5491591,37.8666667 12.3545909,33.888 10.5322727,28.3562667 L2.62345455,34.3946667 C6.44540909,42.1557333 14.4268636,47.4666667 23.7136364,47.4666667 C29.4455,47.4666667 34.9177955,45.4314667 39.0249545,41.6181333 L31.5177727,35.8144 C29.3995682,37.1488 26.7323182,37.8666667 23.7136364,37.8666667" fill="#34A853" />
              <path d="M46.1454545,24 C46.1454545,22.6133333 45.9318182,21.12 45.6113636,19.7333333 L23.7136364,19.7333333 L23.7136364,28.8 L36.3181818,28.8 C35.6879545,31.8912 33.9724545,34.2677333 31.5177727,35.8144 L39.0249545,41.6181333 C43.3393409,37.6138667 46.1454545,31.6490667 46.1454545,24" fill="#4285F4" />
            </g>
          </svg>
          Continue with Google
        </>
      )}
    </Button>
  )
}

// Inner component that can access useCSRF (must be inside CSRFProvider)
function LoginFormContent({ displayError, state, formAction }: {
  displayError: string | null
  state: AuthState
  formAction: (formData: FormData) => void
}) {
  const { isReady } = useCSRF()
  const searchParams = useSearchParams()
  const requestedNext = searchParams.get('next') || '/content-plan'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/content-plan'

  return (
    <div className="min-h-screen flex flex-col font-sans bg-stone-50/50">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative z-10">

        <div className="w-full max-w-md relative z-20">

          {/* Header Text */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white border border-stone-200  mb-6 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="font-medium text-xs text-stone-600">Strategic Content Engine</span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-stone-900 mb-2 tracking-tight">
              Welcome Back
            </h2>
            <p className="text-stone-500 text-sm">
              Sign in to grow your brand for real
            </p>
          </div>

          {/* 
            Outer Shell - Matches Navbar Style
            - Pure white background
            - Subtle border and shadow for lift
            - Rounded-15px
          */}
          <div className="
            relative w-full
            bg-white
            border border-stone-300/50
            rounded-[15px] p-1
            
          ">

            {/* 
               Inner Core - Matches Navbar Style
               - Light gray background for contrast
               - Rounded-12px
            */}
            <div className="
              w-full bg-stone-100/50 backdrop-blur-sm
              rounded-[12px] p-6 sm:p-8
              border border-stone-100
            ">

              {/* Google Sign In */}
              <div className="mb-6">
                <form action={signInWithGoogle}>
                  <CSRFInput />
                  <input type="hidden" name="next" value={next} />
                  <GoogleSignInButton csrfReady={isReady} />
                </form>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-stone-100 px-2 text-stone-400 font-medium tracking-wider">Or</span>
                </div>
              </div>

              {/* Error & success messages */}
              {displayError && (
                <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 text-red-600 font-medium text-sm rounded-lg flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <div>
                    {displayError}
                    {displayError.includes('expired') && (
                      <p className="mt-0.5 text-xs text-red-500 opacity-80">
                        Try requesting a new link below.
                      </p>
                    )}
                  </div>
                </div>
              )}
              {state?.success && (
                <div className="mb-6 px-4 py-3 bg-green-50 border border-green-100 text-green-700 font-medium text-sm rounded-lg flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {state.success}
                </div>
              )}

              {/* Magic Link Form */}
              <form action={formAction} className="space-y-4">
                <CSRFInput />
                <input type="hidden" name="next" value={next} />
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-semibold text-stone-700">Work Email</label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    className="h-11 bg-white border border-stone-200 text-stone-900 placeholder:text-stone-400 rounded-lg focus:ring-2 focus:ring-stone-200 focus:border-stone-400 focus:shadow-none transition-all font-medium"
                  />
                </div>
                <MagicLinkSubmit csrfReady={isReady} />
              </form>

            </div>
          </div>

          <div className="mt-8 text-center text-xs text-stone-400">
            <span className="mr-1">By signing in, you agree to our</span>
            <a href="/terms" className="underline hover:text-stone-600 transition-colors">Terms of Service</a>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}

// Separate component for search params logic
function LoginFormWithSearchParams() {
  const [state, formAction] = useActionState<AuthState, FormData>(signInWithMagicLink, {} as AuthState)
  const searchParams = useSearchParams()
  const router = useRouter()
  const [urlError, setUrlError] = useState<string | null>(null)

  // Check for error messages in URL parameters (from callback redirects)
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      setUrlError(error)
      // Clear the error from URL to prevent it from showing again on refresh
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  // Combine form state errors with URL errors
  const displayError = state?.error || urlError

  return (
    <CSRFProvider>
      <LoginFormContent displayError={displayError} state={state} formAction={formAction} />
    </CSRFProvider>
  )
}

export default function LoginClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-stone-900" />
      </div>
    }>
      <LoginFormWithSearchParams />
    </Suspense>
  )
}
