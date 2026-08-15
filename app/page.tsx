
import { Metadata } from 'next'
import { commonPageMetadata, generateWebApplicationJsonLd } from '@/lib/seo'
import { StructuredData } from '@/components/seo/StructuredData'
import { Navbar } from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import ProblemSection from '@/components/landing/ProblemSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import PricingSection from '@/components/landing/PricingSection';
import { FAQSection } from '@/components/landing/FAQSection';
import CTASection from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';
import { GridBackground } from "@/components/landing/GridBackground"
import FounderNote from '@/components/landing/FounderNote';
import { AICitations } from '@/components/landing/AICitations';


export const metadata: Metadata = commonPageMetadata.home()

export default function Home() {
  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-x-hidden font-sans">
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <GridBackground />
      </div>
      {/* WebApplication Schema - Home Page Only */}
      <StructuredData data={JSON.parse(generateWebApplicationJsonLd())} />
      <Navbar />
      <main className="flex-grow flex flex-col items-center w-full">

        {/* Hero Section */}
        <Hero />
        {/* Proof before argument. This is the only outcome evidence on the site
            and it is first-party and screenshotted, so it earns the slot directly
            under the hero — everything below explains how it was produced. */}
        <AICitations />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <FounderNote />
        <PricingSection />
        <FAQSection />
        <CTASection />

      </main>
      <Footer />

    </div>
  )
}