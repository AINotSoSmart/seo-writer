import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal/LegalPage"

export const metadata: Metadata = {
    title: "Refund Policy | FlipAEO",
    description: "Refund and cancellation terms for FlipAEO recurring delivery cycles.",
}

export default function RefundPolicyPage() {
    return (
        <LegalPage
            title="Refund Policy"
            summary="Refund requests are evaluated against the paid billing cycle and the delivery state recorded in the dashboard."
        >
            <LegalSection title="Before checkout">
                <p>
                    The subscription contract discloses the tracked-question and action
                    allowances before purchase. Checkout remains closed until the recurring
                    payment-to-batch path has passed sandbox verification.
                </p>
            </LegalSection>
            <LegalSection title="Delivery failure">
                <p>
                    If FlipAEO cannot complete a paid cycle because of a confirmed service
                    failure, contact support@flipaeo.com. We may retry, extend the delivery
                    period, or refund the affected undelivered portion as appropriate.
                </p>
            </LegalSection>
            <LegalSection title="Delivered content">
                <p>
                    A cycle recorded as delivered has made all of its selected drafts available
                    as one complete batch. Publication is optional and does not determine
                    whether delivery occurred. Fees for delivered cycles are generally
                    non-refundable except where required by law.
                </p>
            </LegalSection>
            <LegalSection title="Cancellation">
                <p>
                    Customer-requested cancellation takes effect according to the billing
                    provider’s confirmed period-end state. Completing a cycle does not cancel
                    the recurring subscription. Access continues through the paid period, and
                    completed reports and delivered drafts remain available.
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
