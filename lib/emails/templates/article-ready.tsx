import {
    Button,
    Heading,
    Img,
    Section,
    Text,
} from "@react-email/components";
import * as React from "react";
import { EmailWrapper } from "./wrapper";

interface ArticleReadyEmailProps {
    articleTitle: string;
    articleSlug: string;
    articleId: string;
    featuredImageUrl?: string | null;
    authorName?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flipaeo.com";

export const ArticleReadyEmail = ({
    articleTitle = "Your Article Title",
    articleSlug = "your-article-slug",
    articleId,
    featuredImageUrl,
    authorName,
}: ArticleReadyEmailProps) => {
    const articleUrl = `${baseUrl}/articles/${articleId}`;
    const previewText = `Your article "${articleTitle}" is ready to review.`;

    return (
        <EmailWrapper previewText={previewText}>
            <Heading style={h1}>Your Article is Ready 🚀</Heading>

            <Text style={text}>
                {authorName ? `Hi ${authorName},` : "Hi there,"}
            </Text>

            <Text style={text}>
                Good news! The AI has finished researching and writing your article. It's now ready for your review and one-click publishing.
            </Text>

            {featuredImageUrl && (
                <Section style={imageSection}>
                    <Img
                        src={featuredImageUrl}
                        width="100%"
                        height="auto"
                        alt={articleTitle}
                        style={image}
                    />
                </Section>
            )}

            <Section style={articleCard}>
                <Text style={cardTitle}>{articleTitle}</Text>
                <Button href={articleUrl} style={button}>
                    View & Publish Article
                </Button>
            </Section>

            <Text style={text}>
                You can verify the facts, edit the content, or publish it directly to your CMS from the dashboard.
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

const imageSection = {
    margin: "24px 0",
};

const image = {
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    maxWidth: "100%",
};

const articleCard = {
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    padding: "24px",
    textAlign: "center" as const,
    margin: "24px 0",
    border: "1px solid #e5e7eb",
};

const cardTitle = {
    color: "#111827",
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "16px",
};

const button = {
    backgroundColor: "#000000",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "bold",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "12px 24px",
};

export default ArticleReadyEmail;
