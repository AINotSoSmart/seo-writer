"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Sparkles, ArrowRight } from "lucide-react"
import { signInWithMagicLink, signInWithGoogle } from "./actions"
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { CSRFProvider, CSRFInput } from "@/components/csrf-provider"

type AuthState = {
  error?: string
  success?: string
}

function MagicLinkSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-14 text-base font-black uppercase tracking-widest bg-black text-white border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          SENDING DEPLOYMENT LINK...
        </>
      ) : (
        <>
          SEND LOGIN LINK
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  )
}

function GoogleSignInButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="w-full h-14 text-sm font-bold uppercase tracking-wider bg-white text-black border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-stone-50 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          CONNECTING...
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
          CONTINUE WITH GOOGLE
        </>
      )}
    </Button>
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
      <div className="landing-page min-h-screen flex flex-col font-sans">
        <Navbar />

        <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative z-10">

          <div className="w-full max-w-md relative z-20">

            {/* Header Text */}
            <div className="text-center mb-10">
              <div className="inline-block bg-brand-yellow border-2 border-black shadow-neo-sm px-4 py-1 mb-6 transform rotate-2">
                <span className="font-display font-black text-xs uppercase tracking-widest text-black">Autonomous Writer</span>
              </div>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-black mb-2 uppercase tracking-tight leading-none">
                Welcome Back
              </h2>
            </div>

            {/* Login Card - STRICT NEO-BRUTALIST */}
            <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">

              {/* Google Sign In */}
              <div className="mb-6">
                <form action={signInWithGoogle}>
                  <CSRFInput />
                  <GoogleSignInButton />
                </form>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-dashed border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-stone-900 font-bold tracking-wider">Or</span>
                </div>
              </div>

              {/* Error & success messages */}
              {displayError && (
                <div className="mb-6 px-4 py-3 bg-red-50 border-2 border-black text-red-700 font-bold text-sm shadow-neo-sm">
                  {displayError}
                  {displayError.includes('expired') && (
                    <p className="mt-1 text-xs font-normal">
                      Try requesting a new link below.
                    </p>
                  )}
                </div>
              )}
              {state?.success && (
                <div className="mb-6 px-4 py-3 bg-green-50 border-2 border-black text-green-700 font-bold text-sm shadow-neo-sm">
                  {state.success}
                </div>
              )}

              {/* Magic Link Form */}
              <form action={formAction} className="space-y-5">
                <CSRFInput />
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-bold text-black uppercase tracking-wide">Work Email</label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    className="h-12 bg-white border-2 border-black text-black placeholder:text-gray-400 rounded-none focus:ring-0 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all font-medium"
                  />
                </div>
                <MagicLinkSubmit />
              </form>

            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-stone-500 font-bold uppercase tracking-widest">
                Secure Access · No Password Needed
              </p>
              <div className="mt-2 text-[10px] text-stone-400">
                By signing in, you agree to our <a href="/terms" className="underline hover:text-black">Terms</a>
              </div>
            </div>

          </div>
        </main>

        <Footer />
      </div>
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