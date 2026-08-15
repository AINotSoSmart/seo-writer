import { Metadata } from "next";
import { defaultSEO } from "@/config/seo";
import SchemaGeneratorPage from "./schema-generator";

export const metadata: Metadata = {
    title: "Free Schema Markup Generator - WebApp & FAQ | FlipAEO",
    description: "Generate Google-compliant JSON-LD schema markup for WebApplications and FAQPages. Improve your visibility in AI search results.",
    openGraph: {
        title: "Free Schema Markup Generator",
        description: "Generate Google-compliant JSON-LD schema markup for WebApplications and FAQPages.",
        url: `${defaultSEO.siteUrl}/tools/schema-generator`,
        siteName: defaultSEO.siteName,
        type: "website",
    },
};

export default function Page() {
    return <SchemaGeneratorPage />;
}
