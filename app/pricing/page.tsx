
import { Metadata } from 'next'
import PublicHeader from '@/components/Header'

import { commonPageMetadata, generateBreadcrumbJsonLd, generateFAQJsonLd, generateProductJsonLd } from '@/lib/seo'
import { MultipleStructuredData } from '@/components/seo/StructuredData'
import Footer from '@/components/MainFooter'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { seoUtils } from '@/config/seo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = commonPageMetadata.pricing()

// Pricing feature sets (mirroring PricingCards for consistency)
const starterFeatures = [
  "20 AI-generated photos",
  "1 model training included",
  "20 unique styles & backgrounds",
  "20 different outfits",
  "Full commercial license",
  "30 credits included"
]

const proFeatures = [
  "80 AI-generated photos",
  "1 model training included",
  "80 unique styles & backgrounds",
  "80 different outfits",
  "Priority processing",
  "Premium customer support",
  "60 credits included"
]

export default function Home() {
  // Consolidated feature list for the comparison table (unused, keep for future but underscore to avoid linter warning)
  const _allFeatures = Array.from(new Set([...starterFeatures, ...proFeatures]))

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="pt-20 md:pt-24">
        {/* Pricing Overview Hero */}
        <section className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-12 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight font-[var(--font-inter-tight)]">Simple, transparent pricing</h1>
            <p className="text-gray-600 mt-3">One-time payments. Credits never expire.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <span className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700">No hidden fees</span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700">Secure checkout</span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700">Money-back guarantee</span>
            </div>
          </div>
        </section>

        {/* Existing Pricing Cards */}

        {/* How We Compare */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">How we compare</h2>
          <p className="text-gray-600 mb-6">See how Unrelashot stacks up against traditional photo studios and other AI providers.</p>

          {/* Traditional studio vs Unrelashot */}
          <div className="rounded-xl border bg-white mb-8">
            <div className="px-4 pt-4">
              <h3 className="text-lg font-semibold">Traditional photo studio vs Unrelashot</h3>
            </div>
            <Table className="px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Aspect</TableHead>
                  <TableHead>Traditional studio</TableHead>
                  <TableHead>Unrelashot AI Photoshoot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="px-4">
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Cost</TableCell>
                  <TableCell className="text-gray-700">$150–$600+ per session</TableCell>
                  <TableCell className="text-gray-800 font-semibold">$9.99–$17.99 one-time</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Setup & scheduling</TableCell>
                  <TableCell className="text-gray-700">Book time, travel, prep outfits</TableCell>
                  <TableCell className="text-gray-800">No scheduling, generate anytime</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Delivery time</TableCell>
                  <TableCell className="text-gray-700">2–7 days depending on studio</TableCell>
                  <TableCell className="text-gray-800">Minutes to hours</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Variety of looks</TableCell>
                  <TableCell className="text-gray-700">Limited by wardrobe/backgrounds</TableCell>
                  <TableCell className="text-gray-800">Dozens of styles, backgrounds, outfits</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Retouching & revisions</TableCell>
                  <TableCell className="text-gray-700">Usually extra cost or slower</TableCell>
                  <TableCell className="text-gray-800">Fast iterations included</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Ownership & license</TableCell>
                  <TableCell className="text-gray-700">Varies by studio contract</TableCell>
                  <TableCell className="text-gray-800">Full commercial license</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Privacy</TableCell>
                  <TableCell className="text-gray-700">Photographer retains copies</TableCell>
                  <TableCell className="text-gray-800">Private processing; no hidden usage</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Convenience</TableCell>
                  <TableCell className="text-gray-700">In-person session required</TableCell>
                  <TableCell className="text-gray-800">Fully online, self-serve</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Other AI providers vs Unrelashot */}
          <div className="rounded-2xl border bg-white">
            <div className="px-4 pt-4">
              <h3 className="text-lg font-semibold">Other AI providers vs Unrelashot</h3>
            </div>
            <Table className="px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Aspect</TableHead>
                  <TableHead>Other AI providers</TableHead>
                  <TableHead>Unrelashot AI Photoshoot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="px-4">
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Pricing model</TableCell>
                  <TableCell className="text-gray-700">Often subscription or upsells</TableCell>
                  <TableCell className="text-gray-800 font-semibold">Transparent one-time pricing</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Quality consistency</TableCell>
                  <TableCell className="text-gray-700">Varies by provider</TableCell>
                  <TableCell className="text-gray-800">Studio-quality outputs, consistent styles</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Priority processing</TableCell>
                  <TableCell className="text-gray-700">Limited or paywalled</TableCell>
                  <TableCell className="text-gray-800">Included on Pro</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Privacy & data usage</TableCell>
                  <TableCell className="text-gray-700">May use data for training</TableCell>
                  <TableCell className="text-gray-800">No hidden data usage claims</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Support</TableCell>
                  <TableCell className="text-gray-700">Email-only or slow</TableCell>
                  <TableCell className="text-gray-800">Responsive support</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-gray-800">Transparency</TableCell>
                  <TableCell className="text-gray-700">Opaque features/pricing</TableCell>
                  <TableCell className="text-gray-800">Clear features and licensing</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        {/* FAQs, Guarantee, Testimonials, CTA remain below */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-6 font-[var(--font-inter-tight)]">FAQs</h2>
          <div className="space-y-3">
            <details className="group border rounded-2xl p-4 bg-white">
              <summary className="cursor-pointer font-medium">How do credits work?</summary>
              <p className="mt-2 text-gray-600">Credits are used to generate AI photos. Each generation consumes credits based on the chosen options. Credits don’t expire.</p>
            </details>
            <details className="group border rounded-2xl p-4 bg-white">
              <summary className="cursor-pointer font-medium">Is this a subscription?</summary>
              <p className="mt-2 text-gray-600">No. Plans are one-time purchases. You can buy more credits whenever you need them.</p>
            </details>
            <details className="group border rounded-2xl p-4 bg-white">
              <summary className="cursor-pointer font-medium">Can I get a refund?</summary>
              <p className="mt-2 text-gray-600">We aim to make you happy. If something goes wrong, check our <Link href="/refund-policy" className="text-[#ff6f00] hover:underline">Refund Policy</Link> for details.</p>
            </details>
            <details className="group border rounded-2xl p-4 bg-white">
              <summary className="cursor-pointer font-medium">How long does generation take?</summary>
              <p className="mt-2 text-gray-600">Most generations complete within minutes. Pro plans get priority processing.</p>
            </details>
            <details className="group border rounded-2xl p-4 bg-white">
              <summary className="cursor-pointer font-medium">Do I own the photos?</summary>
              <p className="mt-2 text-gray-600">Yes. You get a full commercial license for the generated photos.</p>
            </details>
          </div>
        </section>

        {/* Guarantee & Policies */}
        <section className="max-w-5xl mx-auto px-4 pb-12">
          <div className="bg-[#F7F5F3] rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-gray-800 font-medium">No hidden fees. Refund-friendly. Transparent terms.</p>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/refund-policy" className="text-[#ff6f00] hover:underline">Refund Policy</Link>
              <Link href="/terms" className="text-[#ff6f00] hover:underline">Terms</Link>
            </div>
          </div>
        </section>



        {/* Contact / Enterprise CTA */}
        <section className="max-w-5xl mx-auto px-4 py-12 text-center">
          <h3 className="text-xl font-bold mb-3 font-[var(--font-inter-tight)]">Need a custom plan or invoice?</h3>
          <p className="text-gray-600 mb-6">We’re happy to help.</p>
          <Link href="mailto:support@unrealshot.com">
            <Button
              className="text-md sm:text-md font-semibold py-5 sm:py-6 group relative bg-[#ff6f00] hover:bg-[#ff6f00]/90 text-white rounded-md overflow-hidden cursor-pointer pr-12"
            >
              Contact us
              <div className="bg-white rounded-sm p-2 sm:p-3 absolute right-1 top-1/2 -translate-y-1/2">
                <img
                  src="/arrow.svg"
                  alt="arrow-right"
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </div>
            </Button>
          </Link>
          <p className="mt-4 text-sm text-gray-500">Payments are processed securely.</p>
        </section>
      </main>
      <Footer />
      {/* Pricing page specific structured data below */}
      <MultipleStructuredData
        schemas={[
          {
            id: 'breadcrumb',
            data: JSON.parse(
              generateBreadcrumbJsonLd([
                { name: 'Home', url: seoUtils.generateCanonicalUrl('/') },
                { name: 'Pricing', url: seoUtils.generateCanonicalUrl('/pricing') },
              ])
            ),
          },
          {
            id: 'product-starter',
            data: JSON.parse(
              generateProductJsonLd({
                name: 'Starter AI Photoshoot',
                description:
                  '20 AI-generated photos with unlimited styles & backgrounds, full commercial license.',
                price: 9.99,
                currency: 'USD',
                features: starterFeatures,
              })
            ),
          },
          {
            id: 'product-pro',
            data: JSON.parse(
              generateProductJsonLd({
                name: 'Pro AI Photoshoot',
                description:
                  '80 AI-generated photos with 1 model training, priority processing, and premium support.',
                price: 17.99,
                currency: 'USD',
                features: proFeatures,
              })
            ),
          },
          {
            id: 'faq',
            data: JSON.parse(
              generateFAQJsonLd([
                {
                  question: 'How do credits work?',
                  answer:
                    "Credits are used to generate AI photos. Each generation consumes credits based on the chosen options. Credits don’t expire.",
                },
                {
                  question: 'Is this a subscription?',
                  answer:
                    'No. Plans are one-time purchases. You can buy more credits whenever you need them.',
                },
                {
                  question: 'Can I get a refund?',
                  answer:
                    'We aim to make you happy. If something goes wrong, check our Refund Policy for details.',
                },
                {
                  question: 'How long does generation take?',
                  answer: 'Most generations complete within minutes. Pro plans get priority processing.',
                },
                {
                  question: 'Do I own the photos?',
                  answer: 'Yes. You get a full commercial license for the generated photos.',
                },
              ])
            ),
          },
        ]}
      />
    </div>
  )
}