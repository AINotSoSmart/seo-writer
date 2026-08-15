import {
    Button,
    Heading,
    Section,
    Text,
} from "@react-email/components";
import * as React from "react";
import { EmailWrapper } from "./wrapper";

interface PlanRefilledEmailProps {
    articleCount?: number;
    nextBillingDate?: string;
    userName?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flipaeo.com";

export const PlanRefilledEmail = ({
    articleCount = 30,
    userName,
}: PlanRefilledEmailProps) => {
    const dashboardUrl = `${baseUrl}/content-plan`;
    const previewText = `Your content plan for the next month is ready.`;

    return (
        <EmailWrapper previewText={previewText}>
            <Heading style={h1}>Fresh Content Plan Ready 📅</Heading>

            <Text style={text}>
                {userName ? `Hi ${userName},` : "Hi there,"}
            </Text>

            <Text style={text}>
                Your auto-pilot just generated a fresh content plan! We've researched and scheduled <strong>{articleCount} new articles</strong> for the upcoming month.
            </Text>

            <Section style={card}>
                <Text style={statNumber}>{articleCount}</Text>
                <Text style={statLabel}>New Article Ideas</Text>
            </Section>

            <Section style={actionSection}>
                <Button href={dashboardUrl} style={button}>
                    View Content Plan
                </Button>
            </Section>

            <Text style={text}>
                These articles will be automatically written and published according to your schedule. You can pause or edit them anytime from your dashboard.
            </Text>
        </EmailWrapper>
    );
};

// Styles
const h1 = {
    color: "#1a1a1a",
    fontSize: "24px",
    fontWeight: "600",
    textAlign: "center" as const,
    margin: "24px 0 32px",
    lineHeight: "32px",
};

const text = {
    color: "#4a4a4a",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "16px 0",
};

const card = {
    textAlign: "center" as const,
    margin: "32px 0",
    padding: "24px 0",
};

const statNumber = {
    color: "#1a1a1a",
    fontSize: "48px",
    fontWeight: "700",
    margin: "0",
    lineHeight: "1",
};

const statLabel = {
    color: "#6b7280",
    fontSize: "14px",
    textTransform: "uppercase" as const,
    letterSpacing: "1.5px",
    marginTop: "12px",
    fontWeight: "500",
};

const actionSection = {
    textAlign: "center" as const,
    margin: "32px 0",
};

const button = {
    backgroundColor: "#1a1a1a",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "14px 32px",
};

export default PlanRefilledEmail;

