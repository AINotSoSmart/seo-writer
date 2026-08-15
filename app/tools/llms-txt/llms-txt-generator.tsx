"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Download, FileText, ExternalLink, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToolShell } from "@/components/tools/tool-shell";
import { ToolCTA } from "@/components/tools/tool-cta";
import { ToolFAQ, FAQItem } from "@/components/tools/tool-faq";
import { CopyButton } from "@/components/tools/copy-button";

interface LinkItem {
    id: string;
    title: string;
    url: string;
    description: string;
}

const DEFAULT_LINK: LinkItem = {
    id: crypto.randomUUID(),
    title: "",
    url: "",
    description: "",
};

const FAQ_DATA: FAQItem[] = [
    {
        question: "What is llms.txt?",
        answer:
            "llms.txt is a proposed web standard that helps Large Language Models (LLMs) like ChatGPT, Claude, and Perplexity better understand your website's structure and content. Similar to robots.txt for search engine crawlers, llms.txt provides AI systems with a curated overview of your most important pages, making it easier for them to accurately represent your business in their responses.",
    },
    {
        question: "Where do I upload my llms.txt file?",
        answer:
            "Upload your llms.txt file to the root directory of your website, so it's accessible at yourdomain.com/llms.txt. For WordPress sites, upload via FTP or your hosting file manager. For Next.js or React apps, place it in your 'public' folder. For Shopify, you can add it through Online Store > Themes > Edit code > Assets.",
    },
    {
        question: "Is llms.txt the same as robots.txt?",
        answer:
            "No, they serve different purposes. robots.txt tells search engine crawlers which pages to index or avoid. llms.txt is specifically designed for AI language models, providing them with curated, structured information about your site's key content. You should have both files on your website for comprehensive SEO and GEO (Generative Engine Optimization).",
    },
    {
        question: "Will llms.txt help me appear in ChatGPT or Perplexity results?",
        answer:
            "llms.txt improves your chances of accurate AI citations by giving LLMs clear, structured context about your website. While it doesn't guarantee rankings (AI systems use many signals), it helps ensure that when AI does reference your site, the information is accurate and properly attributed. Think of it as making your site 'AI-friendly'.",
    },
    {
        question: "Is this llms.txt generator free?",
        answer:
            "Yes, this tool is 100% free with no sign-up required. Generate as many llms.txt files as you need. We built this to help businesses optimize for the new era of AI-powered search. For comprehensive GEO content strategy, check out FlipAEO.",
    },
];

export default function LlmsTxtGeneratorPage() {
    const [brandName, setBrandName] = useState("");
    const [summary, setSummary] = useState("");
    const [links, setLinks] = useState<LinkItem[]>([{ ...DEFAULT_LINK }]);
    const [hasGenerated, setHasGenerated] = useState(false);

    const addLink = () => {
        setLinks([...links, { ...DEFAULT_LINK, id: crypto.randomUUID() }]);
    };

    const removeLink = (id: string) => {
        if (links.length > 1) {
            setLinks(links.filter((link) => link.id !== id));
        }
    };

    const updateLink = (id: string, field: keyof LinkItem, value: string) => {
        setLinks(
            links.map((link) =>
                link.id === id ? { ...link, [field]: value } : link
            )
        );
    };

    // Generate the llms.txt content
    const generatedContent = useMemo(() => {
        const validLinks = links.filter((l) => l.title && l.url);

        let content = `# ${brandName || "Your Brand"}\n\n`;
        content += `> ${summary || "A brief description of your business or website."}\n\n`;

        if (validLinks.length > 0) {
            content += `## Important Pages\n\n`;
            validLinks.forEach((link) => {
                content += `- [${link.title}](${link.url})`;
                if (link.description) {
                    content += `: ${link.description}`;
                }
                content += `\n`;
            });
        }

        return content;
    }, [brandName, summary, links]);

    const handleDownload = () => {
        const blob = new Blob([generatedContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "llms.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setHasGenerated(true);
    };

    const handleCopyComplete = () => {
        setHasGenerated(true);
    };

    return (
        <ToolShell
            title="Free llms.txt Generator"
            description="Create a compliant llms.txt file in seconds. Help AI search engines like ChatGPT and Perplexity understand your website."
            schema={{
                name: "llms.txt Generator",
                description:
                    "Free tool to generate llms.txt files for AI search engine optimization. Help ChatGPT, Perplexity, and other LLMs understand your website.",
                url: "https://flipaeo.com/tools/llms-txt",
            }}
        >
            {/* Main Tool Section */}
            <div className="grid gap-8 lg:grid-cols-2 mb-12">
                {/* Input Form */}
                <Card className="border-2 border-black shadow-neo rounded-none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Configure Your llms.txt
                        </CardTitle>
                        <CardDescription>
                            Fill in the details below to generate your file.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Brand Name */}
                        <div className="space-y-2">
                            <Label htmlFor="brandName">Brand/Site Name</Label>
                            <Input
                                id="brandName"
                                placeholder="e.g., FlipAEO"
                                value={brandName}
                                onChange={(e) => setBrandName(e.target.value)}
                            />
                        </div>

                        {/* Summary */}
                        <div className="space-y-2">
                            <Label htmlFor="summary">Summary</Label>
                            <Textarea
                                id="summary"
                                placeholder="A brief description of your business (1-2 sentences)"
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <Separator />

                        {/* Links */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Important Pages</Label>
                                <Button variant="outline" size="sm" onClick={addLink}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Link
                                </Button>
                            </div>

                            {links.map((link, index) => (
                                <div
                                    key={link.id}
                                    className="space-y-3 p-4 border rounded-none bg-muted/30"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            Link {index + 1}
                                        </span>
                                        {links.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeLink(link.id)}
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <Input
                                        placeholder="Page Title (e.g., Pricing)"
                                        value={link.title}
                                        onChange={(e) =>
                                            updateLink(link.id, "title", e.target.value)
                                        }
                                    />
                                    <Input
                                        placeholder="URL (e.g., https://example.com/pricing)"
                                        value={link.url}
                                        onChange={(e) => updateLink(link.id, "url", e.target.value)}
                                    />
                                    <Input
                                        placeholder="Description (optional)"
                                        value={link.description}
                                        onChange={(e) =>
                                            updateLink(link.id, "description", e.target.value)
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Preview & Actions */}
                <div className="space-y-4">
                    <Card className="border-2 border-black shadow-neo rounded-none">
                        <CardHeader>
                            <CardTitle>Live Preview</CardTitle>
                            <CardDescription>
                                Your generated llms.txt file content.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <pre className="p-4 bg-muted rounded-none overflow-x-auto text-sm font-mono whitespace-pre-wrap min-h-[200px]">
                                    {generatedContent}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <CopyButton
                            text={generatedContent}
                            variant="default"
                            className="flex-1 rounded-none"
                        />
                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            className="flex-1 gap-2 rounded-none"
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </Button>
                    </div>

                    {/* Tip Box */}
                    <Card className="rounded-none border-2 border-amber-500/30 bg-amber-500/5 shadow-neo-sm">
                        <CardContent className="p-4 flex gap-3">
                            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-amber-700 dark:text-amber-400">
                                    Pro Tip
                                </p>
                                <p className="text-muted-foreground">
                                    Upload your llms.txt to your website root (e.g.,{" "}
                                    <code className="px-1 py-0.5 bg-muted rounded">
                                        yourdomain.com/llms.txt
                                    </code>
                                    ) so AI models can discover it.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Contextual CTA - Shows after generation */}
            {hasGenerated && (
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ToolCTA
                        hook="You've created your llms.txt—great for AI crawlers. But are your articles optimized to get cited?"
                        description="FlipAEO writes GEO-ready content that AI search engines love to cite and recommend."
                        ctaText="Try FlipAEO Free"
                        ctaLink="/login"
                    />
                </div>
            )}

            <Separator className="my-12" />

            {/* Content Section 1: What is llms.txt? */}
            <section className="prose prose-neutral dark:prose-invert max-w-none mb-12">
                <h2 className="text-2xl md:text-3xl font-bold">
                    What is llms.txt? The New Standard for AI Visibility
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    In the rapidly evolving landscape of AI-powered search, a new file format is emerging
                    as essential for website owners: <strong>llms.txt</strong>. Similar to how robots.txt
                    revolutionized website-crawler communication in the early days of search engines,
                    llms.txt is designed to bridge the gap between your website and Large Language Models
                    (LLMs) like ChatGPT, Claude, Perplexity, and Google&apos;s Gemini.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                    The llms.txt file is a Markdown-formatted document placed in your website&apos;s root
                    directory. It provides AI systems with a structured, human-readable overview of your
                    website&apos;s most important content. Unlike traditional sitemaps that list every URL,
                    llms.txt curates the essential pages you want AI to understand and reference when
                    generating responses about your brand, products, or services.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                    Think of it as your website&apos;s elevator pitch to AI. When an LLM encounters your
                    llms.txt file, it gains immediate context about what your business does, what pages
                    are most important, and how your content is organized. This dramatically improves
                    the accuracy of AI-generated responses that mention your brand.
                </p>
            </section>

            {/* Content Section 2: Why Your Business Needs llms.txt */}
            <section className="prose prose-neutral dark:prose-invert max-w-none mb-12">
                <h2 className="text-2xl md:text-3xl font-bold">
                    Why Your Business Needs llms.txt for GEO (Generative Engine Optimization)
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    The way people search for information is fundamentally changing. Instead of scrolling
                    through ten blue links, users increasingly turn to AI assistants for direct answers.
                    According to recent studies, over 40% of Gen Z prefers using AI chatbots over
                    traditional search engines for product research and recommendations.
                </p>
                <div className="grid md:grid-cols-2 gap-6 not-prose my-8">
                    <Card className="rounded-none border-2 border-black shadow-neo transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                        <CardContent className="p-6">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <ExternalLink className="h-4 w-4 text-primary" />
                                Improved AI Citations
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                When AI models have structured context about your website, they&apos;re more likely
                                to cite your content accurately and link back to the right pages.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-none border-2 border-black shadow-neo transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                        <CardContent className="p-6">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <ExternalLink className="h-4 w-4 text-primary" />
                                Brand Protection
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Reduce AI hallucinations about your brand by providing authoritative, structured
                                information that LLMs can reference as ground truth.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-2 border-black shadow-neo transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                        <CardContent className="p-6">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <ExternalLink className="h-4 w-4 text-primary" />
                                Future-Proofing
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                As AI search becomes the norm, websites with llms.txt will have a head start.
                                Early adoption signals to AI systems that your site is optimized for their consumption.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-none border-2 border-black shadow-neo transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                        <CardContent className="p-6">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <ExternalLink className="h-4 w-4 text-primary" />
                                Competitive Advantage
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Most websites don&apos;t have llms.txt yet. Being an early adopter positions your
                                brand ahead of competitors in AI-powered discovery.
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    Generative Engine Optimization (GEO) is the practice of optimizing your content and
                    technical setup to appear in AI-generated responses. While traditional SEO remains
                    important, GEO focuses on the signals that LLMs use to determine which sources to
                    cite. llms.txt is one of the foundational elements of any GEO strategy.
                </p>
            </section>

            {/* Content Section 3: How to Add llms.txt */}
            <section className="prose prose-neutral dark:prose-invert max-w-none mb-12">
                <h2 className="text-2xl md:text-3xl font-bold">
                    How to Add llms.txt to Your Website
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    Adding llms.txt to your website is straightforward. Once you&apos;ve generated your file
                    using the tool above, follow these steps based on your platform:
                </p>
                <div className="not-prose space-y-4 my-6">
                    <Card className="rounded-none border-2 border-black shadow-neo">
                        <CardContent className="p-4">
                            <h3 className="font-semibold mb-1">WordPress</h3>
                            <p className="text-sm text-muted-foreground">
                                Upload via FTP to your root directory (same level as wp-content), or use a file
                                manager plugin. Your file should be accessible at yourdomain.com/llms.txt.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-none border-2 border-black shadow-neo">
                        <CardContent className="p-4">
                            <h3 className="font-semibold mb-1">Next.js / React</h3>
                            <p className="text-sm text-muted-foreground">
                                Place the llms.txt file in your <code className="px-1 py-0.5 bg-muted rounded">public</code> folder.
                                It will automatically be served at the root URL.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-none border-2 border-black shadow-neo">
                        <CardContent className="p-4">
                            <h3 className="font-semibold mb-1">Shopify</h3>
                            <p className="text-sm text-muted-foreground">
                                Go to Online Store → Themes → Actions → Edit code. In the Assets folder, upload
                                your llms.txt file or add it as a new asset.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-none border-2 border-black shadow-neo">
                        <CardContent className="p-4">
                            <h3 className="font-semibold mb-1">Static Hosting (Netlify, Vercel)</h3>
                            <p className="text-sm text-muted-foreground">
                                Add llms.txt to your project&apos;s public or static folder before deployment. The
                                file will be served from your domain&apos;s root.
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    After uploading, verify your llms.txt is accessible by visiting yourdomain.com/llms.txt
                    in your browser. You should see the Markdown content you generated. Keep your llms.txt
                    updated whenever you add important new pages or change your site&apos;s structure.
                </p>
            </section>

            {/* FAQ Section */}
            <ToolFAQ faqs={FAQ_DATA} />

            {/* Final CTA */}
            <div className="mt-12">
                <ToolCTA
                    hook="Ready to take your AI visibility to the next level?"
                    description="FlipAEO generates authority-building articles designed to get cited by AI search engines. 30 articles/month, fully automated."
                    ctaText="Start Your Free Trial"
                    ctaLink="/login"
                />
            </div>
        </ToolShell>
    );
}
