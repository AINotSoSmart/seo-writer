import {
    Button,
    Heading,
    Section,
    Text,
} from "@react-email/components";
import * as React from "react";
import { EmailWrapper } from "./wrapper";

interface BillingAlertEmailProps {
    userName?: string;
    billingDate?: string;
    amount?: string;
    planName?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flipaeo.com";

export const BillingAlertEmail = ({
    userName,
    billingDate,
    amount,
    planName = "Pro Plan",
}: BillingAlertEmailProps) => {
    const accountUrl = `${baseUrl}/account`;
    // Default to 5 days from now if not provided, just for preview text context
    const previewText = `Upcoming charge for your ${planName} subscription.`;

    return (
        <EmailWrapper previewText={previewText}>
            <Heading style={h1}>Upcoming Invoice 🧾</Heading>

            <Text style={text}>
                {userName ? `Hi ${userName},` : "Hi there,"}
            </Text>

            <Text style={text}>
                This is a friendly reminder that your subscription for <strong>{planName}</strong> is scheduled to renew on <strong>{billingDate}</strong>.
            </Text>

            <Section style={card}>
                <Text style={cardText}>
                    Amount: <strong>{amount}</strong>
                </Text>
                <Text style={cardText}>
                    Date: <strong>{billingDate}</strong>
                </Text>
            </Section>

            <Section style={actionSection}>
                <Button href={accountUrl} style={button}>
                    Manage Subscription
                </Button>
            </Section>

            <Text style={text}>
                Your payment method on file will be charged automatically. If you need to update your payment details or cancel, please do so before the renewal date.
            </Text>
        </EmailWrapper>
    );
};

// Styles
const h1 = {
    color: "#333",
    fontSize: "24px",
    fontWeight: "bold",
    textAlign: "center" as const,
    margin: "30px 0",
};

const text = {
    color: "#333",
    fontSize: "16px",
    lineHeight: "26px",
};

const card = {
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    padding: "20px",
    margin: "24px 0",
    border: "1px solid #e5e7eb",
};

const cardText = {
    color: "#374151",
    fontSize: "16px",
    margin: "4px 0",
};

const actionSection = {
    textAlign: "center" as const,
    margin: "32px 0",
};

const button = {
    backgroundColor: "#fff",
    borderRadius: "6px",
    color: "#333",
    border: "1px solid #d1d5db",
    fontSize: "16px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "12px 24px",
};

export default BillingAlertEmail;
