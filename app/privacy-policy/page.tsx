import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
    title: "Privacy Policy | FlipAEO",
    description: "How FlipAEO processes account data, public website content, audit links, analytics, and support data.",
}

export default function PrivacyPolicyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            summary="This policy explains the data needed to run immutable website audits and finite content-delivery programs."
        >
            <LegalSection title="Data we process">
                <p>
                    We process account identifiers, billing references, your brand settings,
                    article content, delivery status, and any WordPress credentials you choose
                    to provide. We scan publicly available website pages and search-result
                    sources for audits. FlipAEO does not require Google Search Console access.
                </p>
            </LegalSection>
            <LegalSection title="Audit and prospect links">
                <p>
                    Audit evidence may be shared through an unguessable, read-only public link
                    marked noindex. Founder-created prospect audits use a separate one-time
                    claim token bound to the specified email address. Claim tokens expire after
                    30 days and are stored as hashes.
                </p>
            </LegalSection>
            <LegalSection title="Third-party processing">
                <p>
                    Public-site discovery, search evidence, language-model generation, image
                    generation, email, hosting, database, payments, and optional WordPress
                    delivery are processed by specialist providers. Only the information
                    required for the requested operation is sent to each provider.
                </p>
            </LegalSection>
            <LegalSection title="Cookies and analytics">
                <p>
                    Essential cookies support authentication, security, and saved privacy
                    choices. Google Analytics, Microsoft Clarity, and Crisp support chat load
                    only after the relevant consent choice. You can change or withdraw consent
                    through “Cookie settings.”
                </p>
            </LegalSection>
            <LegalSection title="Retention and security">
                <p>
                    Completed audit evidence is retained as an immutable record so purchased
                    programs remain reproducible. We retain billing and transaction records as
                    required for accounting and dispute handling. Access controls, row-level
                    security, hashed claim tokens, and encrypted transport reduce unauthorized
                    access risk.
                </p>
            </LegalSection>
            <LegalSection title="Your choices">
                <p>
                    Subject to applicable law, you may request access, correction, export, or
                    deletion of personal data. Public evidence already incorporated into a
                    delivered commercial record may be retained where required to establish or
                    defend contractual claims. Contact support@flipaeo.com.
                </p>
            </LegalSection>
        </LegalPage>
    )
}
