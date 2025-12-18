
import { Metadata } from 'next'
import { commonPageMetadata, generateWebApplicationJsonLd } from '@/lib/seo'
import { StructuredData } from '@/components/seo/StructuredData'
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { FeaturePreview } from '@/components/landing/FeaturePreview';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { BenefitsSection } from '@/components/landing/BenefitsSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = commonPageMetadata.home()

export default function Home() {
  return (
    <div className="landing-page min-h-screen w-full flex flex-col overflow-x-hidden font-sans">
      <Navbar />
      <main className="flex-grow flex flex-col items-center pt-16 md:pt-24 w-full">

        {/* Hero Section */}
        <div className="w-full px-4 flex flex-col items-center mb-32">
          <Hero />
          <div className="w-full max-w-[1400px] mt-16 md:mt-20 relative z-10">
            <FeaturePreview />
          </div>
        </div>

        {/* Main Content Sections */}
        <ProblemSection />
        <BenefitsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
        <FAQSection />
        <CTASection />

      </main>
      <Footer />
      {/* WebApplication Schema - Home Page Only */}
      <StructuredData data={JSON.parse(generateWebApplicationJsonLd())} />
    </div>
  )
}