import { Metadata } from 'next'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Footer'
import { generateBreadcrumbJsonLd, generateMetadata } from '@/lib/seo'
import { MultipleStructuredData } from '@/components/seo/StructuredData'
import { seoUtils } from '@/config/seo'

export const metadata: Metadata = generateMetadata({
  title: 'Privacy Policy',
  description: 'Learn how FlipAEO collects, uses, and protects your personal data.',
  canonical: '/privacy-policy',
})

export default function PrivacyPolicy() {
  return (
    <div className=" min-h-screen w-full flex flex-col overflow-x-hidden font-sans bg-stone-50/50">
      <Navbar />
      <main className="flex-grow flex flex-col items-center w-full pt-12">
        {/* Hero */}
        <section className="w-full py-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-block bg-stone-100 text-stone-800 border border-stone-200 rounded-full px-4 py-1.5 mb-6 text-sm font-medium tracking-wide">
              <span className="font-display font-bold text-xs uppercase tracking-widest">LEGAL</span>
            </div>
            <h1 className="font-display text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black text-4xl sm:text-5xl md:text-6xl leading-tight uppercase mb-4">Privacy Policy</h1>
            <p className="font-sans text-gray-600 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">Learn how FlipAEO collects, uses, and protects your personal data.</p>
          </div>
        </section>

        {/* Content */}
        <section className="max-w-5xl mx-auto px-4 py-12 w-full">
          <p className="text-gray-600 mb-6">Effective Date: January 20, 2026</p>

          <div className="space-y-8 ">
            <div className="">
              <p>
                At <strong>FlipAEO</strong>, accessible from{' '}
                <a
                  href="https://flipaeo.com"
                  className="text-blue-500 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://flipaeo.com
                </a>
                , we are committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, how we process user data, and your rights under <strong>applicable privacy laws, including the General Data Protection Regulation (GDPR)</strong>. By using our services, you agree to the practices described in this Privacy Policy.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">1. Information We Collect</h2>
              <p className="mb-4">We collect and process the following types of personal data:</p>
              <h3 className="text-lg font-semibold mb-2">1.1 Personal Information (Provided by You)</h3>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li><strong>Email Address</strong> (for account creation and communication).</li>
                <li><strong>Brand Information</strong> (company name, website URL, brand voice preferences for content generation).</li>
                <li><strong>Competitor URLs</strong> (for competitive analysis and content strategy).</li>
                <li><strong>Payment Information</strong> (processed securely via third-party payment providers).</li>
              </ul>
              <h3 className="text-lg font-semibold mb-2">1.2 Data Obtained via Third-Party Integrations</h3>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li><strong>Google Search Console Data</strong> — When you connect your Google Search Console account, we access and store aggregated search performance metrics including search queries, page URLs, click counts, impression counts, average position, and click-through rates. This data is retrieved via the Google Search Console API and stored in our database to power the ROI Action Board analytics features.</li>
                <li><strong>Google OAuth Tokens</strong> — We securely store your OAuth 2.0 refresh token, encrypted at rest using AES-256-GCM authenticated encryption, to maintain authorized access to your Google Search Console data for automated background synchronization (see Section 6.3).</li>
              </ul>
              <h3 className="text-lg font-semibold mb-2">1.3 Automatically Collected Data</h3>
              <ul className="list-disc list-inside pl-5">
                <li><strong>Device Information</strong> (browser type, operating system, and device details).</li>
                <li><strong>IP Address & Location Data</strong> (to ensure service functionality and security).</li>
                <li><strong>Usage Data</strong> (features used, session duration, and interactions).</li>
                <li><strong>Cookies & Tracking Technologies</strong> (see Section 7).</li>
              </ul>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">2. How We Use Your Information</h2>
              <p className="mb-4">We process your data for the following purposes:</p>
              <ul className="list-disc list-inside pl-5">
                <li>✅ <strong>Content Generation:</strong> To analyze your brand, competitors, and create strategic content.</li>
                <li>✅ <strong>SEO Performance Analysis:</strong> To process your Google Search Console data and generate actionable insights including keyword cannibalization detection, content decay monitoring, CTR interventions, striking distance opportunities, emerging trend identification, and Answer Engine Optimization (AEO) alignment.</li>
                <li>✅ <strong>Automated Data Synchronization:</strong> To periodically refresh your search performance data via background processing to ensure your analytics dashboard reflects current performance metrics without requiring manual intervention.</li>
                <li>✅ <strong>Account Management:</strong> To enable login, profile settings, and service customization.</li>
                <li>✅ <strong>Payment Processing:</strong> To process subscription payments securely.</li>
                <li>✅ <strong>Customer Support:</strong> To address inquiries and technical issues.</li>
                <li>✅ <strong>Service Improvement:</strong> To improve our AI models and user experience.</li>
                <li>✅ <strong>Security & Fraud Prevention:</strong> To prevent misuse, unauthorized access, or data breaches.</li>
              </ul>
              <p className="mt-4">We <strong>do not</strong> sell or misuse your data.</p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">3. Data Storage & Retention</h2>
              <ul className="list-disc list-inside pl-5">
                <li>📌 <strong>Account Data:</strong> Stored in <strong>Supabase</strong> until account deletion.</li>
                <li>📌 <strong>Brand Profiles:</strong> Retained to improve content consistency across articles.</li>
                <li>📌 <strong>Generated Articles:</strong> Retained for <strong>30 days</strong> after creation for access and revisions.</li>
                <li>📌 <strong>Google Search Console Data:</strong> Cached in our database for up to <strong>60 days</strong> of rolling historical data. This cache is automatically refreshed every <strong>30 days</strong> via background synchronization. Upon account deletion or disconnection of your Google Search Console, all cached search data is permanently deleted.</li>
                <li>📌 <strong>OAuth Tokens:</strong> Your Google OAuth refresh tokens are encrypted at rest using <strong>AES-256-GCM</strong> authenticated encryption before being stored in our database. Plaintext tokens are never written to persistent storage. Tokens are immediately revoked and permanently deleted upon account deletion or when you disconnect the integration.</li>
                <li>📌 <strong>Payment Data:</strong> Not stored by us; processed by <strong>secure third-party payment providers</strong>.</li>
                <li>📌 <strong>Logs & Analytics:</strong> Retained for performance monitoring but anonymized after 30 days.</li>
              </ul>
              <p className="mt-4">If you request deletion of your account, we will permanently erase all stored personal data, including any cached Google Search Console data and associated OAuth tokens.</p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">4. Your Rights (GDPR & Global Compliance)</h2>
              <p className="mb-4">If you are an <strong>EU/EEA resident</strong>, you have additional GDPR rights:</p>
              <ul className="list-disc list-inside pl-5">
                <li>🔹 <strong>Right to Access:</strong> Request a copy of your personal data.</li>
                <li>🔹 <strong>Right to Rectification:</strong> Correct inaccurate or incomplete data.</li>
                <li>🔹 <strong>Right to Erasure ("Right to be Forgotten"):</strong> Request deletion of your personal data.</li>
                <li>🔹 <strong>Right to Restrict Processing:</strong> Limit how we use your data.</li>
                <li>🔹 <strong>Right to Data Portability:</strong> Request your data in a structured format.</li>
                <li>🔹 <strong>Right to Object:</strong> Stop processing for marketing purposes.</li>
                <li>🔹 <strong>Right to Withdraw Consent:</strong> If data processing is based on consent, you can withdraw it at any time.</li>
              </ul>
              <p className="mt-4">
                📩 <strong>To exercise your rights, contact us at:</strong>{' '}
                <a href="mailto:support@flipaeo.com" className="text-blue-500 hover:underline">
                  support@flipaeo.com
                </a>. We will respond within <strong>14 days</strong> as per GDPR guidelines.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">5. Data Sharing & Third-Party Services</h2>
              <p className="mb-4">We <strong>do not sell</strong> your personal data. However, we may share data with:</p>
              <ul className="list-disc list-inside pl-5">
                <li><strong>AI Content Generation:</strong> AI providers for content creation and research.</li>
                <li><strong>Cloud Storage:</strong> Supabase for secure data storage.</li>
                <li><strong>Payment Processors:</strong> DodoPayments (for secure subscription processing).</li>
                <li><strong>CMS Platforms:</strong> WordPress, Webflow, Shopify (for content publishing, at your request).</li>
                <li><strong>Analytics & Performance Monitoring:</strong> To improve user experience.</li>
                <li><strong>Legal & Compliance Reasons:</strong> If required by law or court order.</li>
              </ul>
              <p className="mt-4">Each provider follows <strong>industry-standard security measures</strong> and <strong>GDPR compliance policies</strong>.</p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">6. Google Services Integration</h2>
              <p className="mb-4">FlipAEO integrates with the following Google services to provide our core functionality:</p>

              <h3 className="text-lg font-semibold mb-2">6.1 Google Authentication (OAuth 2.0)</h3>
              <p className="mb-4">
                We use <strong>Google Sign-In</strong> to allow you to authenticate securely with your Google account. When you sign in with Google, we receive:
              </p>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li>Your <strong>email address</strong> (for account creation and communication)</li>
                <li>Your <strong>name</strong> (for personalization)</li>
                <li>Your <strong>profile picture</strong> (optional, for display purposes)</li>
              </ul>
              <p className="mb-4">
                We do not receive or store your Google password. Google authentication is handled securely through Google's OAuth 2.0 protocol.
              </p>

              <h3 className="text-lg font-semibold mb-2">6.2 Google Search Console Integration</h3>
              <p className="mb-4">
                When you connect your Google Search Console account to FlipAEO, you explicitly grant us permission to access your search performance data through the <strong>Google Search Console API</strong> (SearchAnalytics endpoint). This integration is essential to power our ROI Action Board and requires the following OAuth scope: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-sm">https://www.googleapis.com/auth/webmasters.readonly</code> (read-only access).
              </p>

              <h4 className="text-base font-semibold mb-2">6.2.1 Data We Access</h4>
              <p className="mb-2">Through the Google Search Console API, we retrieve the following <strong>aggregated, non-personally-identifiable</strong> search metrics for your verified web properties:</p>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li><strong>Search Queries</strong> — The keywords users searched for that triggered your pages.</li>
                <li><strong>Page URLs</strong> — The specific pages on your site that appeared in search results.</li>
                <li><strong>Clicks</strong> — The number of times users clicked through to your site.</li>
                <li><strong>Impressions</strong> — The number of times your pages appeared in search results.</li>
                <li><strong>Average Position</strong> — Your average ranking position for each query.</li>
                <li><strong>Click-Through Rate (CTR)</strong> — The ratio of clicks to impressions.</li>
              </ul>
              <p className="mb-4">
                We do <strong>not</strong> access personal data about your website visitors, crawl errors, security issues, sitemaps, or any data outside the SearchAnalytics scope.
              </p>

              <h4 className="text-base font-semibold mb-2">6.2.2 How We Store This Data</h4>
              <p className="mb-4">
                Your search performance data is cached in our secure <strong>Supabase</strong> database (encrypted at rest and in transit). We store up to <strong>60 days</strong> of rolling historical search data per connected property. This cached data is used exclusively to compute the SEO insights displayed on your ROI Action Board, including keyword cannibalization detection, content decay monitoring, CTR interventions, striking distance analysis, emerging trend identification, and Answer Engine Optimization (AEO) alignment.
              </p>

              <h4 className="text-base font-semibold mb-2">6.2.3 Automated Background Synchronization</h4>
              <p className="mb-4">
                To ensure your analytics remain current without requiring manual action, FlipAEO employs an <strong>automated background synchronization process</strong>. This process runs on a <strong>30-day cycle</strong> and operates as follows:
              </p>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li>Every 30 days, our system automatically uses your stored <strong>OAuth refresh token</strong> to obtain a temporary access token from Google.</li>
                <li>Using this temporary token, we fetch the latest 60 days of search performance data from the Google Search Console API.</li>
                <li>The fetched data is upserted (inserted or updated) into your cached dataset, and the synchronization timestamp is recorded.</li>
                <li>The temporary access token is discarded immediately after use and is <strong>never stored</strong>.</li>
              </ul>
              <p className="mb-4">
                This process is fully automated and does not require your intervention. You may disconnect your Google Search Console at any time from your account settings, which will immediately halt all background synchronization and delete your cached search data.
              </p>

              <h4 className="text-base font-semibold mb-2">6.2.4 Token Security & Encryption</h4>
              <p className="mb-4">
                All Google OAuth tokens (both access tokens and refresh tokens) are encrypted at rest using <strong>AES-256-GCM (Galois/Counter Mode)</strong> authenticated encryption before being written to our database. This is the same encryption standard recommended by <strong>NIST (National Institute of Standards and Technology)</strong> and used by financial institutions worldwide. Key highlights of our token security architecture:
              </p>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li><strong>256-bit Encryption Keys:</strong> Tokens are encrypted with a cryptographically random 256-bit key that is stored separately from the database, never in source code.</li>
                <li><strong>Unique Initialization Vectors:</strong> Each encryption operation generates a cryptographically random 128-bit IV, ensuring that even identical tokens produce completely different ciphertexts.</li>
                <li><strong>Authenticated Encryption:</strong> GCM mode includes a 128-bit authentication tag that detects any unauthorized tampering with the encrypted data.</li>
                <li><strong>Zero Plaintext Storage:</strong> Plaintext tokens are never persisted to disk or database. They exist in memory only for the duration of an API request.</li>
                <li><strong>Ephemeral Access Tokens:</strong> Access tokens generated from the refresh token are valid for approximately 1 hour and are discarded from memory after each synchronization cycle — they are never stored in the database.</li>
              </ul>
              <p className="mb-4">
                We <strong>never</strong> use your tokens to access any other Google services, modify your Search Console settings, or perform any write operations on your Google account.
              </p>

              <h3 className="text-lg font-semibold mb-2">6.3 Google API Services User Data Policy Compliance</h3>
              <p className="mb-4">
                FlipAEO's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. Specifically:
              </p>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li>We <strong>limit our use</strong> of Google user data to providing and improving the features described in this Privacy Policy.</li>
                <li>We do <strong>not</strong> transfer Google user data to third parties except as necessary to provide our service, comply with applicable laws, or as part of a merger or acquisition with adequate data protection commitments.</li>
                <li>We do <strong>not</strong> use Google user data for serving advertisements.</li>
                <li>We do <strong>not</strong> allow humans to read Google user data unless we have your affirmative consent, it is necessary for security purposes or to comply with applicable law, or our use is limited to internal operations and the data has been aggregated and anonymized.</li>
              </ul>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">7. Data Security Measures</h2>
              <p className="mb-4">FlipAEO implements industry-leading security measures that align with <strong>OWASP</strong>, <strong>SOC 2</strong>, and <strong>GDPR Article 32</strong> requirements for the protection of personal data:</p>
              <ul className="list-disc list-inside pl-5">
                <li>🔒 <strong>Encryption in Transit:</strong> All data transmitted between your browser and our servers is protected using <strong>TLS 1.2+</strong> encryption.</li>
                <li>🔒 <strong>Encryption at Rest:</strong> Sensitive credentials (including OAuth tokens) are encrypted at rest using <strong>AES-256-GCM</strong> authenticated encryption with unique per-record initialization vectors, the same standard used by banks and government agencies.</li>
                <li>🔒 <strong>Key Management:</strong> Encryption keys are stored in environment-level secrets, isolated from the application database, and are never committed to source code repositories.</li>
                <li>🔒 <strong>Access Control:</strong> Database access follows the <strong>principle of least privilege</strong>. Row Level Security (RLS) policies ensure users can only access their own data.</li>
                <li>🔒 <strong>Tamper Detection:</strong> GCM authentication tags provide cryptographic proof that stored data has not been altered or corrupted.</li>
                <li>🔒 <strong>Regular Security Audits:</strong> We perform routine security reviews to prevent unauthorized data access and to identify potential vulnerabilities.</li>
              </ul>
              <p className="mt-4">However, no system is <strong>100% secure</strong>, and we encourage users to take necessary precautions.</p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">8. Cookies & Tracking Technologies</h2>
              <p className="mb-4">We use cookies and similar tracking technologies to improve your experience on FlipAEO.</p>
              <h3 className="text-lg font-semibold mb-2">8.1 What Cookies Do We Use?</h3>
              <ul className="list-disc list-inside pl-5 mb-4">
                <li>🔐 <strong>Authentication Cookies:</strong> Used by Supabase to keep you logged in after signing in via email or Google login.</li>
                <li>🍪 <strong>Necessary Cookies:</strong> Required for basic website functionality and security.</li>
                <li>📊 <strong>Analytics Cookies:</strong> Help us analyze site usage and improve performance.</li>
              </ul>
              <h3 className="text-lg font-semibold mb-2">8.2 Managing Cookies</h3>
              <p className="mb-4">
                You can control or disable cookies through your browser settings. However, disabling authentication cookies may log you out or limit certain features. For any questions regarding our use of cookies, contact us at{' '}
                <a href="mailto:support@flipaeo.com" className="text-blue-500 hover:underline">
                  support@flipaeo.com
                </a>.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">9. Children's Privacy</h2>
              <p className="mb-4">We <strong>do not</strong> knowingly collect or process data from users under <strong>18 years old</strong>. If we discover such data, we will delete it immediately.</p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">10. International Data Transfers</h2>
              <p className="mb-4">
                Since we operate globally, your data <strong>may be transferred to servers outside your country</strong> (including the US & EU). We ensure these transfers comply with <strong>GDPR, SCCs (Standard Contractual Clauses), and other international laws</strong> for secure handling.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">11. Changes to This Privacy Policy</h2>
              <p className="mb-4">
                We may update this Privacy Policy to reflect <strong>legal, technical, or business changes</strong>. Any updates will be posted here with an <strong>effective date</strong>. Continued use of FlipAEO signifies your acceptance of the changes.
              </p>
            </div>

            <div className="">
              <h2 className="text-2xl font-bold mb-2 font-[var(--font-inter-tight)]">12. Contact Information</h2>
              <p>
                For any questions or privacy-related concerns, contact us:
                <br />
                📧 <strong>Email:</strong>{' '}
                <a href="mailto:support@flipaeo.com" className="text-blue-500 hover:underline">
                  support@flipaeo.com
                </a>
                <br />
                🌍 <strong>Website:</strong>{' '}
                <a href="https://flipaeo.com" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
                  https://flipaeo.com
                </a>
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
                { name: 'Privacy Policy', url: seoUtils.generateCanonicalUrl('/privacy-policy') },
              ])
            ),
          },
        ]}
      />
    </div>
  )
}