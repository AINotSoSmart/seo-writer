import { Metadata } from 'next'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Footer'
import { generateBreadcrumbJsonLd, generateMetadata } from '@/lib/seo'
import { MultipleStructuredData } from '@/components/seo/StructuredData'
import { seoUtils } from '@/config/seo'

export const metadata: Metadata = generateMetadata({
  title: 'Terms of Service',
  description: 'Review the terms and conditions for using FlipAEO, the Strategic Content Engine for Generative Engine Optimization.',
  canonical: '/terms',
})

export default function TermsOfService() {
  return (
    <div className="min-h-screen w-full flex flex-col overflow-x-hidden font-sans bg-stone-50/50">
      <Navbar />
      <main className="flex-grow flex flex-col items-center w-full pt-12">
        {/* Hero */}
        <section className="w-full py-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-block bg-stone-100 text-stone-800 border border-stone-200 rounded-full px-4 py-1.5 mb-6 text-sm font-medium tracking-wide">
              <span className="font-display font-bold text-xs uppercase tracking-widest">LEGAL</span>
            </div>
            <h1 className="font-display text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black text-4xl sm:text-5xl md:text-6xl leading-tight uppercase mb-4">Terms of Service</h1>
            <p className="font-sans text-gray-600 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">Review the terms and conditions for using FlipAEO.</p>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-5xl mx-auto px-4 py-12 w-full">
          <div className="space-y-8 p-6 md:p-12">
            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">1. Introduction</h2>
              <p>
                Welcome to <strong>FlipAEO</strong> ("we," "our," "us"). By accessing or using our website at
                <a href="https://flipaeo.com" className="text-indigo-600"> https://flipaeo.com</a>
                ("Site"), you agree to comply with and be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Site.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">2. Use of Our Service</h2>
              <p>
                <strong>FlipAEO</strong> is a Strategic Content Engine for Generative Engine Optimization (GEO) that helps businesses create authority-building content to improve visibility in AI search results.
                Users must adhere to all applicable laws and agree not to misuse our services. Any violations of these rules can result in the termination of access to the platform.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">3. Account and User Responsibilities</h2>
              <p>
                To access certain features of the Site, you may need to create an account. You agree to provide accurate and complete information when registering and to keep this information updated.
                Users are responsible for maintaining the confidentiality of their account details and for all activities under their account.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">4. Subscription and Billing</h2>
              <p>
                <strong>FlipAEO</strong> operates on a subscription-based model. Subscriptions are billed monthly and provide access to a set number of AI-generated articles per month. All subscription fees are charged in advance. We reserve the right to modify pricing at any time with reasonable notice. Refunds are available as specified in our
                <a href="https://flipaeo.com/refund-policy" className="text-indigo-600"> Refund Policy</a>.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">5. Content Ownership and License</h2>
              <p>
                All content generated through FlipAEO is owned by you upon publication. You receive a full commercial license to use, modify, and distribute the generated content for your business purposes. We retain no rights to your generated content once it is delivered to you.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">6. Data Retention and Deletion</h2>
              <p>
                We value your privacy. Brand profiles and content strategies are stored to improve your experience. Generated articles are retained for 30 days after creation. Users may request the deletion of their data at any time by contacting us at
                <a href="mailto:support@flipaeo.com" className="text-indigo-600"> support@flipaeo.com</a>.
                For more information, please review our
                <a href="https://flipaeo.com/privacy-policy" className="text-indigo-600"> Privacy Policy</a>.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">7. Third-Party Services</h2>
              <p>
                <strong>FlipAEO</strong> uses third-party services for AI content generation, research, and payment processing. By using our service, you agree to be bound by the terms and policies of these third parties. Payment processing is handled securely by our payment provider.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">8. Google Search Console Integration & Data Authorization</h2>
              <p className="mb-4">
                FlipAEO offers optional integration with <strong>Google Search Console</strong> to power the ROI Action Board. By connecting your Google Search Console account, you expressly authorize and agree to the following:
              </p>

              <h3 className="text-lg font-semibold mb-2">8.1 Scope of Authorization</h3>
              <p className="mb-4">
                You grant FlipAEO permission to access your Google Search Console data via read-only API access (<code className="bg-stone-100 px-1.5 py-0.5 rounded text-sm">webmasters.readonly</code> scope). This access is limited exclusively to retrieving aggregated search performance metrics (queries, clicks, impressions, position, CTR) for the web properties you select. FlipAEO cannot and will not modify your Search Console settings, submit URLs, or access any data beyond search analytics.
              </p>

              <h3 className="text-lg font-semibold mb-2">8.2 Data Processing & Automated Synchronization</h3>
              <p className="mb-4">
                You acknowledge and agree that FlipAEO will:
              </p>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li>Store up to 60 days of rolling search performance data in our database to compute SEO insights.</li>
                <li>Automatically synchronize your search data on a <strong>30-day cycle</strong> using your stored OAuth refresh token (encrypted at rest via AES-256-GCM), without requiring manual action from you.</li>
                <li>Process this data through our proprietary algorithms to generate actionable SEO recommendations, including but not limited to: keyword cannibalization detection, content decay alerts, CTR optimization suggestions, striking distance analysis, emerging trend identification, and Answer Engine Optimization (AEO) alignment.</li>
                <li>Encrypt all OAuth credentials at rest using <strong>AES-256-GCM authenticated encryption</strong> with unique initialization vectors per record. Plaintext tokens are never written to persistent storage.</li>
              </ul>

              <h3 className="text-lg font-semibold mb-2">8.3 Your Responsibilities</h3>
              <p className="mb-4">
                You represent and warrant that you have the authority to grant FlipAEO access to the Google Search Console properties you connect. You are solely responsible for ensuring that sharing this data with FlipAEO does not violate any agreements you may have with third parties or your organization's data governance policies.
              </p>

              <h3 className="text-lg font-semibold mb-2">8.4 Disconnection & Data Removal</h3>
              <p className="mb-4">
                You may disconnect your Google Search Console integration at any time. Upon disconnection, FlipAEO will immediately cease all background data synchronization and permanently delete all cached search data and encrypted OAuth tokens associated with your account. The deletion process is irreversible.
              </p>

              <h3 className="text-lg font-semibold mb-2">8.5 Data Ownership</h3>
              <p className="mb-4">
                Your Google Search Console data remains your property at all times. FlipAEO does not claim ownership of any data retrieved from your Google Search Console account. The data is used exclusively to provide the analytics services described herein and is never sold, licensed, or shared with third parties for commercial purposes.
              </p>

              <h3 className="text-lg font-semibold mb-2">8.6 Credential Security</h3>
              <p>
                FlipAEO commits to protecting your OAuth credentials using encryption standards aligned with <strong>NIST SP 800-38D</strong> (AES-GCM) and <strong>GDPR Article 32</strong> (security of processing). All tokens are encrypted at rest using <strong>AES-256-GCM</strong> with cryptographically random 128-bit initialization vectors and 128-bit authentication tags. Encryption keys are managed separately from the application database and are never exposed in client-side code. FlipAEO does not log, display, or transmit plaintext tokens outside of the secure server-side execution context required to communicate with Google APIs.
              </p>
            </div>


            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">9. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, <strong>FlipAEO</strong> and its affiliates shall not be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of our services. This includes but is not limited to search ranking results, traffic changes, or business outcomes.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">10. Changes to the Terms</h2>
              <p>
                We reserve the right to update these Terms at any time. Any changes will be posted on this page, with the updated date. Continued use of the Site after any changes constitutes acceptance of those changes.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">11. Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us at
                <a href="mailto:support@flipaeo.com" className="text-indigo-600"> support@flipaeo.com</a>.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">12. Digital Delivery</h2>
              <p>
                FlipAEO provides a fully digital service. All generated articles and content are delivered digitally through your dashboard or directly to your connected CMS (WordPress, Webflow, Shopify). There are no physical products or shipping involved.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">13. Acceptable Use</h2>
              <p>
                You agree not to use FlipAEO to generate content that:
              </p>
              <ul className="list-disc list-inside pl-5 mt-2">
                <li>Violates any applicable laws or regulations</li>
                <li>Infringes on intellectual property rights of others</li>
                <li>Contains misleading or false information presented as fact</li>
                <li>Promotes illegal activities or harmful behavior</li>
                <li>Impersonates other individuals or organizations</li>
              </ul>
              <p className="mt-2">
                We reserve the right to suspend or terminate accounts that violate these guidelines.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* Structured Data */}
      <MultipleStructuredData
        schemas={[
          {
            id: 'breadcrumb',
            data: JSON.parse(
              generateBreadcrumbJsonLd([
                { name: 'Home', url: seoUtils.generateCanonicalUrl('/') },
                { name: 'Terms', url: seoUtils.generateCanonicalUrl('/terms') },
              ])
            ),
          },
        ]}
      />
    </div>
  )
}
