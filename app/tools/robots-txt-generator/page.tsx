import { Metadata } from "next";
import BotManager from "./bot-manager";
import { defaultSEO } from "@/config/seo";

export const metadata: Metadata = {
    title: "AI Search Bot Manager - Robots.txt Generator | FlipAEO",
    description:
        "Manage how AI search engines like ChatGPT, Claude, and Perplexity crawl your site. Generate high-performance robots.txt files for the GEO era.",
    keywords: [
        "robots.txt generator",
        "AI bot manager",
        "ChatGPT crawler control",
        "ClaudeBot settings",
        "AI search optimization",
        "GEO",
        "crawler management",
    ],
    openGraph: {
        title: "AI Search Bot Manager - Robots.txt Generator",
        description:
            "Manage how AI search engines like ChatGPT, Claude, and Perplexity crawl your site. Generate high-performance robots.txt files for the GEO era.",
        url: `${defaultSEO.siteUrl}/tools/robots-txt-generator`,
        siteName: defaultSEO.siteName,
        type: "website",
        images: [
            {
                url: `${defaultSEO.siteUrl}/tools/robots-txt-generator-og.png`,
                width: 1200,
                height: 630,
                alt: "AI Search Bot Manager Tool by FlipAEO",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "AI Search Bot Manager - Robots.txt Generator | FlipAEO",
        description:
            "Manage how AI search engines like ChatGPT, Claude, and Perplexity crawl your site. Generate high-performance robots.txt files for the GEO era.",
        images: [`${defaultSEO.siteUrl}/tools/robots-txt-generator-og.png`],
    },
};

export default function BotManagerPage() {
    return <BotManager />;
}
