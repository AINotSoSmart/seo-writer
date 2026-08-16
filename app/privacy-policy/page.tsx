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
            summary="This policy explains the data needed to run recurring AI visibility measurement and content-delivery cycles."
        >
            <LegalSection title="Data we process">
                <p>
                    We process account identifiers, billing references, your brand settings,
                    tracked buyer questions, AI answer evidence, article content, delivery
                    status, and any WordPress credentials you choose to provide. We process
                    publicly available website pages and cited sources for reports. FlipAEO
                    does not require Google Search Console access.
                </p>
            </LegalSection>
            <LegalSection title="Where your reports are readable">
                <p>
                    Your AI visibility report, the stored answer evidence behind it, your
                    tracked buyer questions, and your audit are readable only while signed in
                    to your own account. We do not issue public share links for customer
                    reports, and these pages are excluded from search engine indexing.
                </p>
                <p>
                    The one exception is outreach: where we prepare an audit for a company that
                    is not yet a customer, that single report is reachable through an
                    unguessable read-only link until the recipient claims it, at which point
                    the link stops working. Claiming uses a separate one-time token bound to
                    the named email address; claim tokens expire after 30 days and are stored
                    only as hashes.
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
