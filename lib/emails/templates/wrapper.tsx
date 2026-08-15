import {
    Body,
    Container,
    Head,
    Html,
    Img,
    Preview,
    Section,
    Text,
    Link,
    Hr,
} from "@react-email/components";
import * as React from "react";

interface EmailWrapperProps {
    previewText?: string;
    children: React.ReactNode;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flipaeo.com";

export const EmailWrapper = ({ previewText, children }: EmailWrapperProps) => {
    return (
        <Html>
            <Head />
            {previewText && <Preview>{previewText}</Preview>}
            <Body style={main}>
                <Container style={container}>
                    <Section style={logoContainer}>
                        <Img
                            src={`${baseUrl}/site-logo.png`}
                            width="40"
                            height="40"
                            alt="FlipAEO"
                            style={logo}
                        />
                    </Section>

                    <Section style={contentContainer}>
                        {children}
                    </Section>

                    <Section style={footer}>
                        <Hr style={hr} />
                        <Text style={footerText}>
                            © {new Date().getFullYear()} FlipAEO. All rights reserved.
                        </Text>
                        <Text style={footerText}>
                            <Link href={`${baseUrl}`} style={link}>
                                Dashboard
                            </Link>
                            {" • "}
                            <Link href={`${baseUrl}/account`} style={link}>
                                Account Settings
                            </Link>
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

// Styles
const main = {
    backgroundColor: "#ffffff",
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "20px 0 48px",
    marginBottom: "64px",
    maxWidth: "600px",
};

const logoContainer = {
    padding: "20px 48px",
};

const logo = {
    margin: "0 auto",
    display: "block",
    objectFit: "contain" as const,
};

const contentContainer = {
    padding: "0 48px",
};

const footer = {
    padding: "0 48px",
    marginTop: "32px",
};

const hr = {
    borderColor: "#e6ebf1",
    margin: "20px 0",
};

const footerText = {
    color: "#8898aa",
    fontSize: "12px",
    lineHeight: "16px",
    textAlign: "center" as const,
};

const link = {
    color: "#8898aa",
    textDecoration: "underline",
};
