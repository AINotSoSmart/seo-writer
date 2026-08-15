import {
    Button,
    Heading,
    Section,
    Text,
    Container,
    Hr,
} from "@react-email/components";
import * as React from "react";
import { EmailWrapper } from "./wrapper";

interface AuditFailedEmailProps {
    userId: string;
    brandId: string;
    brandName?: string;
    error: string;
    timestamp: string;
}

export const AuditFailedEmail = ({
    userId,
    brandId,
    brandName,
    error,
    timestamp,
}: AuditFailedEmailProps) => {
    const previewText = `🚨 Audit Failed for brand: ${brandName || brandId}`;

    return (
        <EmailWrapper previewText={previewText}>
            <Heading style={h1}>Audit Failure Alert 🚨</Heading>

            <Text style={text}>
                An audit process has failed. Here are the details:
            </Text>

            <Section style={detailsCard}>
                <Text style={detailRow}>
                    <strong style={label}>Timestamp:</strong> {timestamp}
                </Text>
                <Hr style={hr} />
                <Text style={detailRow}>
                    <strong style={label}>Brand Name:</strong> {brandName || 'N/A'}
                </Text>
                <Hr style={hr} />
                <Text style={detailRow}>
                    <strong style={label}>Brand ID:</strong> {brandId}
                </Text>
                <Hr style={hr} />
                <Text style={detailRow}>
                    <strong style={label}>User ID:</strong> {userId}
                </Text>
            </Section>

            <Section style={errorSection}>
                <Text style={errorLabel}>Error Message:</Text>
                <Container style={errorBox}>
                    <Text style={errorText}>{error}</Text>
                </Container>
            </Section>

            <Button href={`https://supabase.com/dashboard/project/_/editor`} style={button}>
                Check Database
            </Button>
        </EmailWrapper>
    );
};

// Styles
const h1 = {
    color: "#be123c", // Rese-700
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

const detailsCard = {
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    padding: "16px",
    margin: "24px 0",
};

const detailRow = {
    margin: "8px 0",
    fontSize: "14px",
    color: "#374151",
};

const label = {
    color: "#111827",
    fontWeight: "600",
};

const hr = {
    borderColor: "#e5e7eb",
    margin: "8px 0",
};

const errorSection = {
    margin: "24px 0",
};

const errorLabel = {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#9f1239", // Rose-800
    marginBottom: "8px",
};

const errorBox = {
    backgroundColor: "#fff1f2", // Rose-50
    borderRadius: "6px",
    border: "1px solid #fecdd3", // Rose-200
    padding: "12px",
};

const errorText = {
    color: "#881337", // Rose-900
    fontFamily: "monospace",
    fontSize: "12px",
    margin: "0",
};

const button = {
    backgroundColor: "#111827",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "block",
    padding: "12px 24px",
    marginTop: "24px",
};

export default AuditFailedEmail;
