"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { signInWithMagicLink, signInWithGoogle } from "./actions"
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { CSRFProvider, CSRFInput } from "@/components/csrf-provider"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"

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
      className="w-full text-md font-semibold py-5 sm:py-6 group relative bg-[#ff6f00] hover:bg-[#ff6f00]/90 text-white rounded-md overflow-hidden cursor-pointer pr-12"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending link...
        </>
      ) : (
        <>Send Magic Link to Login</>
      )}
      <div className="bg-white rounded-sm p-2 sm:p-3 absolute right-1 top-1/2 -translate-y-1/2">
        <img
          src="/arrow.svg"
          alt="arrow-right"
          className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
        />
      </div>
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
      className="w-full text-md py-5 sm:py-6 group relative bg-white hover:bg-white/90 text-black rounded-md overflow-hidden cursor-pointer pr-12 border border-gray-300"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
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
      <div className="min-h-screen flex flex-col bg-[#F7F5F3]">
        <Navbar />
        <div className="h-16 " aria-hidden />
        <main className="flex-1 flex items-center justify-center px-2 sm:px-6 lg:px-8 min-h-screen">
          <div className="mx-auto max-w-4xl px-4 sm:px-1">
            <div className="grid  place-items-center">
              <Card className="overflow-hidden p-0 shadow-xs w-full">
                <CardContent className="grid p-0 md:grid-cols-2">
                  <div className="p-6 md:p-8">
                    <div className="space-y-2 text-center">
                      <h1 className="text-4xl font-semibold tracking-tight text-black">Welcome to Unrealshot AI</h1>
                      <p className="text-lg text-gray-600">Sign in to pretend you're a model</p>
                    </div>

                    {/* Error & success messages */}
                    {displayError && (
                      <div className="mt-4 mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                        {displayError}
                        {displayError.includes('expired') && (
                          <p className="mt-2 text-xs text-red-600">
                            💡 Simply enter your email below to request a new authentication link.
                          </p>
                        )}
                      </div>
                    )}
                    {state?.success && (
                      <div className="mt-4 mb-4 px-4 py-3 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700">{state.success}</div>
                    )}

                    {/* Magic link form */}
                    <form action={formAction} className="space-y-6">
                      <CSRFInput />
                      <div className="space-y-2">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-900">Email</label>
                        <Input id="email" name="email" type="email" placeholder="you@example.com" required className="bg-white border-gray-300 text-black placeholder:text-gray-500 rounded-lg h-12" />
                      </div>
                      <MagicLinkSubmit />
                    </form>

                    {/* Divider & Google sign-in */}
                    <div className="mt-6 space-y-4">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
                        <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-gray-500">Or</span></div>
                      </div>

                      <form action={signInWithGoogle}>
                        <CSRFInput />
                        <GoogleSignInButton />
                      </form>
                    </div>
                  </div>

                  {/* Right: fading slideshow */}
                  <div className="relative hidden md:block bg-muted">
                    <LoginShowcase />
                  </div>
                </CardContent>
              </Card>

              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  By signing in, you agree to our{' '}
                  <a href="/terms" className="text-black hover:underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy-policy" className="text-black hover:underline">Privacy Policy</a>
                </p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </CSRFProvider>
  )
}

function LoginShowcase() {
  const images = [
    "/landing/landingphotowoman15.webp",
    "/landing/landingphotoman2.webp",
    "/content/ai-generated-sachin2.webp",
    "/content/ai-generated-shreya.jpg",
    "/content/ai-generated-sumesh3.webp",
    "/content/christmas1.jpg",

  ]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length)
    }, 3500)
    return () => clearInterval(id)
  }, [images.length])

  return (
    <div className="relative h-full min-h-[380px] md:min-h-[520px]">
      <div className="absolute inset-0 rounded-none md:rounded-r-xl overflow-hidden">
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt="User showcase"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-none md:rounded-r-xl" />
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 bg-white/60 text-black p-1 rounded text-xs">
          <Image
            src="/site-logo.png"
            alt="Unrealshot AI Logo"
            width={24}
            height={24}
            className="w-6 h-6 rounded"
          />
          <span>Real results from our users</span>
        </div>
      </div>
    </div>
  )
}

export default function LoginClient() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>}>
      <LoginFormWithSearchParams />
    </Suspense>
  )
}