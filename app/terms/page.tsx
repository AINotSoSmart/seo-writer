import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
    title: "Terms of Service | FlipAEO",
    description: "Terms for FlipAEO immutable audits and finite cluster delivery programs.",
}

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            summary="FlipAEO provides measured audit evidence and finite content delivery. It does not sell a ranking or citation outcome."
        >
            <LegalSection title="The service">
                <p>
                    A completed audit is an immutable snapshot of observed public evidence.
                    An eligible paid program contains six selected clusters, each with 8–15
                    planned articles and at least 25 articles across the selected scope.
                </p>
            </LegalSection>
            <LegalSection title="URL confirmation and links">
                <p>
                    Before checkout, you must confirm an HTTPS publication URL pattern on the
                    audited host containing exactly one {"{slug}"} placeholder. That pattern,
                    article slugs, and internal-link graph are frozen for the program. You are
                    responsible for preserving those permalinks on your publishing system.
                </p>
            </LegalSection>
            <LegalSection title="Generation, delivery, and publication">
                <p>
                    Generated means writing completed. Delivered means every article in the
                    cluster passed the batch release gate. Published means a real WordPress or
                    confirmed manual publication action occurred. Delivery does not depend on
                    whether you publish the content.
                </p>
            </LegalSection>
            <LegalSection title="Billing and program end">
                <p>
                    The selected subscription determines delivery cadence, not scope. Pausing
                    stops new deliveries but billing continues. Once every cluster is
                    delivered, FlipAEO requests cancellation at the end of the paid billing
                    period. A later program requires a new checkout.
                </p>
            </LegalSection>
            <LegalSection title="No outcome guarantee">
                <p>
                    Search results and AI systems are controlled by third parties. FlipAEO does
                    not guarantee rankings, traffic, revenue, indexing, AI mentions, citations,
                    or coverage of every topic in a market.
                </p>
            </LegalSection>
            <LegalSection title="Acceptable use and ownership">
                <p>
                    You must have the right to provide submitted material and may not use the
                    service for unlawful, deceptive, infringing, or harmful content. After
                    payment, you may use delivered article output, subject to rights in
                    third-party source material and provider terms.
                </p>
            </LegalSection>
            <LegalSection title="Contact">
                <p>Questions or notices may be sent to support@flipaeo.com.</p>
            </LegalSection>
        </LegalPage>
    )
}
