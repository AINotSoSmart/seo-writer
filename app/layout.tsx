import type React from "react"
import type { Metadata } from "next"
import { Inter, Instrument_Serif, Inter_Tight, Bricolage_Grotesque, Space_Grotesk, Playfair_Display, Caveat } from "next/font/google"
import "./globals.css"
import { Suspense } from "react"
import ErrorBoundary from "@/components/error-boundary"
import { generateMetadata } from "@/lib/seo"
import { StructuredData } from "@/components/seo/StructuredData"
import {
  generateOrganizationJsonLd,
  generateWebsiteJsonLd
} from "@/lib/seo"
import { Toaster } from "@/components/ui/sonner"
import { Toaster as ShadcnToaster } from "@/components/ui/toaster"
import { CookieConsent } from "@/components/CookieConsent"


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  display: "swap",
  preload: true,
})

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  preload: true,
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  display: "swap",
  preload: true,
})

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
})

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "700"],
  display: "swap",
  preload: true,
})

const FINE_NOISE_SVG = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E`;


export const metadata: Metadata = generateMetadata()

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable} ${caveat.variable} ${instrumentSerif.variable} ${interTight.variable} ${bricolage.variable} ${spaceGrotesk.variable} antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&display=swap" />

        {/* Favicon and App Icons */}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="manifest" href="/manifest.json" />


        {/* Apple-specific meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-title" content="FlipAEO" />

        {/* Microsoft tiles */}
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Theme color */}
        <meta name="theme-color" content="#000000" />

        {/* Google Search Console Verification */}
        <meta name="google-site-verification" content="HFUei7qB8OnXJs9EK9i48sky9Van9zgfcfjZDIHOU_c" />

        {/* Yandex Webmaster Verification */}
        <meta name="yandex-verification" content="9072c035937b6e28" />

        {/* Organization Schema - Global */}
        <StructuredData
          id="organization-schema"
          data={JSON.parse(generateOrganizationJsonLd())}
        />
        {/* Website Schema - Global */}
        <StructuredData
          id="website-schema"
          data={JSON.parse(generateWebsiteJsonLd())}
        />
        {/* Note: WebApplication schema is page-specific and added only to home page */}

      </head>
      <body className="font-sans antialiased public-headings" style={{
        backgroundImage: `url("${FINE_NOISE_SVG}")`,
        backgroundRepeat: 'repeat',
      }}>

        <ErrorBoundary>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </ErrorBoundary>
        <Toaster richColors closeButton />
        <ShadcnToaster />
        <CookieConsent
          analyticsId="G-FFT0K6XLCB"
          clarityProjectId={process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}
          crispWebsiteId="24e9aa78-e330-4dc3-9366-da0b3dc6f7ee"
        />
      </body>
    </html>
  )
}
