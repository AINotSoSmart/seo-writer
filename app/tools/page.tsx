import Link from "next/link";
import { FileText, Code, Shield, ArrowRight } from "lucide-react";
import { Metadata } from "next";
import { defaultSEO } from "@/config/seo";

export const metadata: Metadata = {
    title: "Free GEO Tools - Optimize for AI Search Engines | FlipAEO",
    description: "Free tools to help your website get discovered by AI search engines like ChatGPT and Perplexity. Generate llms.txt, schema markup, and more.",
    openGraph: {
        title: "Free GEO Tools by FlipAEO",
        description: "Free tools to help your website get discovered by AI search engines.",
        url: `${defaultSEO.siteUrl}/tools`,
        siteName: defaultSEO.siteName,
        type: "website",
    },
};

const tools = [
    {
        title: "llms.txt Generator",
        description: "Create a compliant llms.txt file to help AI models understand your website structure.",
        href: "/tools/llms-txt",
        icon: FileText,
        badge: "Popular",
        badgeColor: "bg-brand-orange text-black",
    },
    {
        title: "Schema Generator",
        description: "Generate WebApplication and FAQPage schema markup for better AI visibility.",
        href: "/tools/schema-generator",
        icon: Code,
        badge: "New",
        badgeColor: "bg-brand-orange text-black",
    },
    {
        title: "AI Bot Manager",
        description: "Build robots.txt rules to control which AI bots can crawl your content.",
        href: "/tools/robots-txt",
        icon: Shield,
        badge: "New",
        badgeColor: "bg-brand-orange text-black",
        disabled: false,
    },
];

export default function ToolsPage() {
    return (
        <div className="landing-page min-h-screen w-full flex flex-col items-center pt-12 pb-20 font-sans">
            {/* Hero Section */}
            <div className="max-w-4xl mx-auto text-center px-4 mb-16">
                <div className="inline-block bg-brand-yellow text-black border-2 border-black shadow-neo-sm px-4 py-1.5 mb-6 transform -rotate-2 hover:rotate-0 transition-transform">
                    <span className="font-display font-bold text-xs uppercase tracking-widest">100% Free • No Sign-up</span>
                </div>
                <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black uppercase leading-tight mb-6">
                    Free <span className="text-brand-yellow">GEO Tools</span>
                </h1>
                <p className="font-sans text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                    Optimize your website for AI search engines like ChatGPT, Perplexity, and Claude.
                    These free tools help you get discovered and cited by generative AI.
                </p>
            </div>

            {/* Tools Grid */}
            <div className="max-w-6xl mx-auto px-4 w-full">
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {tools.map((tool) => (
                        <Link
                            key={tool.href}
                            href={tool.disabled ? "#" : tool.href}
                            className={`group relative block h-full ${tool.disabled ? "cursor-not-allowed opacity-75" : ""}`}
                        >
                            <div className={`h-full bg-white border-2 border-black p-8 flex flex-col transition-all duration-200 ${tool.disabled
                                ? ""
                                : "shadow-neo hover:shadow-neo-lg hover:-translate-y-1"
                                }`}>
                                <div className="flex items-start justify-between mb-6">
                                    <div className="p-3 bg-brand-yellow/20 border-2 border-black rounded-none text-black">
                                        <tool.icon className="h-6 w-6" strokeWidth={2.5} />
                                    </div>
                                    <span className={`px-3 py-1 text-xs text-black font-bold uppercase border border-black ${tool.badgeColor}`}>
                                        {tool.badge}
                                    </span>
                                </div>

                                <h3 className="font-display text-2xl font-bold mb-3 group-hover:text-brand-yellow transition-colors">
                                    {tool.title}
                                </h3>

                                <p className="text-gray-600 font-sans leading-relaxed mb-6 flex-grow">
                                    {tool.description}
                                </p>

                                {!tool.disabled && (
                                    <div className="flex items-center text-sm font-bold uppercase tracking-wide text-black mt-auto">
                                        Use Tool
                                        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
