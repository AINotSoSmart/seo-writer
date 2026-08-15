import { Metadata } from "next";
import { defaultSEO } from "@/config/seo";
import LlmsTxtGenerator from "./llms-txt-generator";

export const metadata: Metadata = {
    title: "Free llms.txt Generator - Create AI-Friendly Website Files | FlipAEO",
    description:
        "Generate a compliant llms.txt file in seconds. Help AI search engines like ChatGPT and Perplexity understand your website structure and content.",
    keywords: [
        "llms.txt",
        "llms.txt generator",
        "AI SEO",
        "generative engine optimization",
        "ChatGPT SEO",
        "Perplexity optimization",
        "AI visibility",
        "LLM optimization",
    ],
    openGraph: {
        title: "Free llms.txt Generator",
        description:
            "Create a compliant llms.txt file to help AI search engines understand your website.",
        url: `${defaultSEO.siteUrl}/tools/llms-txt`,
        siteName: defaultSEO.siteName,
        type: "website",
        images: [
            {
                url: `${defaultSEO.siteUrl}/tools/llms-txt-og.png`,
                width: 1200,
                height: 630,
                alt: "llms.txt Generator Tool by FlipAEO",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Free llms.txt Generator | FlipAEO",
        description:
            "Create a compliant llms.txt file to help AI search engines understand your website.",
        images: [`${defaultSEO.siteUrl}/tools/llms-txt-og.png`],
    },
};

export default function LlmsTxtPage() {
    return <LlmsTxtGenerator />;
}
