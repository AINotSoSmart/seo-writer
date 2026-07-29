import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
    title: "Refund Policy | FlipAEO",
    description: "Refund and cancellation terms for FlipAEO finite delivery programs.",
}

export default function RefundPolicyPage() {
    return (
        <LegalPage
            title="Refund Policy"
            summary="Refund requests are evaluated against the measured program scope and the delivery state recorded in the dashboard."
        >
            <LegalSection title="Before checkout">
                <p>
                    The audit discloses the measured scope before purchase. Ineligible small
                    scopes do not display a subscription or one-off checkout.
                </p>
            </LegalSection>
            <LegalSection title="Delivery failure">
                <p>
                    If FlipAEO cannot deliver paid scope because of a confirmed service failure,
                    contact support@flipaeo.com. We may retry, extend the delivery period, or
                    refund the affected undelivered portion as appropriate.
                </p>
            </LegalSection>
            <LegalSection title="Delivered content">
                <p>
                    A cluster recorded as delivered has been made available as a complete batch.
                    Publication is optional and does not determine whether delivery occurred.
                    Fees for delivered clusters are generally non-refundable except where
                    required by law.
                </p>
            </LegalSection>
            <LegalSection title="Cancellation">
                <p>
                    Customer-requested cancellation takes effect according to the billing
                    provider’s confirmed period-end state. Program completion automatically
                    starts the same period-end cancellation request. Access continues through
                    the paid period.
                </p>
            </LegalSection>
            <LegalSection title="Duplicate or unauthorized charges">
                <p>
                    Report duplicate or unauthorized charges promptly. Approved refunds return
                    to the original payment method; bank processing times vary.
                </p>
            </LegalSection>
        </LegalPage>
    )
}
