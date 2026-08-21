import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
    title: "Terms of Service | FlipAEO",
    description: "Terms for FlipAEO recurring AI visibility measurement and draft delivery.",
}

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            summary="FlipAEO provides recurring measurement evidence and selected content actions. It does not sell a ranking or citation outcome."
        >
            <LegalSection title="The service">
                <p>
                    One subscription covers one website and up to 25 confirmed buyer
                    questions. Each paid billing cycle measures those questions and may
                    select up to eight prioritised create or refresh actions. The allowance
                    is a ceiling, not a guaranteed article quota; report-only findings and
                    qualified backlog remain visible without manufacturing filler.
                </p>
            </LegalSection>
            <LegalSection title="URL confirmation and links">
                <p>
                    URLs and the internal-link graph for selected create actions are frozen
                    before generation. Refresh actions identify the existing target page.
                    You are responsible for preserving confirmed permalinks in your
                    publishing system.
                </p>
            </LegalSection>
            <LegalSection title="Generation, delivery, and publication">
                <p>
                    Generated means writing completed. Delivered means every selected output
                    in that billing cycle passed the batch release gate and was made visible
                    together. Published requires a real publishing action. Delivery does not
                    depend on whether you publish the content.
                </p>
            </LegalSection>
            <LegalSection title="Billing and program end">
                <p>
                    Billing authorises one measurement-and-delivery cycle at a time. Pausing
                    production does not itself cancel billing. Customer-requested cancellation
                    prevents future billing periods according to the payment provider’s
                    confirmed period-end state. Completed reports and delivered drafts are
                    retained.
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
