
import { Metadata } from 'next'
import PublicHeader from '@/components/Header'
import HeroSection from '@/components/landing/HeroSection'
import PainSection from '@/components/landing/PainSection'
import SolutionSection from "@/components/landing/SolutionSection";
import { commonPageMetadata, generateWebApplicationJsonLd } from '@/lib/seo'
import { StructuredData } from '@/components/seo/StructuredData'
import Footer from '@/components/MainFooter'



export const metadata: Metadata = commonPageMetadata.home()

export default function Home() {
  return (
    <div className="landing-theme min-h-screen bg-cream text-ink font-serif selection:bg-signal selection:text-white relative overflow-x-hidden">
      <div className="bg-noise" />
      <PublicHeader />
      <main>
        <HeroSection />
        <PainSection />
        <SolutionSection />
      </main>
      <Footer />
      {/* WebApplication Schema - Home Page Only */}
      <StructuredData data={JSON.parse(generateWebApplicationJsonLd())} />
    </div>
  )
}