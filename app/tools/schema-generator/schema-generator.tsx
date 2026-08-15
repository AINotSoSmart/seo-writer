"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Copy, FileJson, Lightbulb, Code as CodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToolShell } from "@/components/tools/tool-shell";
import { ToolCTA } from "@/components/tools/tool-cta";
import { ToolFAQ, FAQItem } from "@/components/tools/tool-faq";
import { CopyButton } from "@/components/tools/copy-button";
import { SchemaContent } from "@/components/tools/schema-content";

interface FAQPair {
    id: string;
    question: string;
    answer: string;
}

const FAQ_DATA: FAQItem[] = [
    {
        question: "Why do I need Schema Markup?",
        answer: "Schema markup (structured data) helps search engines and AI models understand specific details about your content. It can lead to 'rich results' in Google (like star ratings, FAQ snippets, or software details) and improves how AI tools like Perplexity cite your website."
    },
    {
        question: "What is WebApplication Schema?",
        answer: "WebApplication schema tells search engines that your page represents a software application available on the web. It allows you to define the category, operating system, and price, which helps AI agents correctly categorize your tool."
    },
    {
        question: "How do I use the generated JSON-LD?",
        answer: "Copy the generated code and paste it into the <head> section of your HTML, or use your CMS's header injection feature. In Next.js, you can use the 'next/script' component or dangerouslySetInnerHTML."
    }
];

export default function SchemaGeneratorPage() {
    const [activeTab, setActiveTab] = useState("webapp");
    const [hasGenerated, setHasGenerated] = useState(false);

    // WebApp State
    const [appName, setAppName] = useState("");
    const [appDesc, setAppDesc] = useState("");
    const [appUrl, setAppUrl] = useState("");
    const [appCategory, setAppCategory] = useState("UtilityApplication");
    const [appPrice, setAppPrice] = useState("0");
    const [appCurrency, setAppCurrency] = useState("USD");
    const [appOS, setAppOS] = useState("Web Browser");

    // FAQ State
    const [faqs, setFaqs] = useState<FAQPair[]>([{ id: crypto.randomUUID(), question: "", answer: "" }]);

    // FAQ Handlers
    const addFaq = () => {
        setFaqs([...faqs, { id: crypto.randomUUID(), question: "", answer: "" }]);
    };

    const removeFaq = (id: string) => {
        if (faqs.length > 1) {
            setFaqs(faqs.filter(f => f.id !== id));
        }
    };

    const updateFaq = (id: string, field: keyof FAQPair, value: string) => {
        setFaqs(faqs.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    // Download Handler
    const handleDownload = () => {
        setHasGenerated(true);
        const blob = new Blob([generatedSchema], { type: "application/ld+json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "schema.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Generate JSON-LD
    const generatedSchema = useMemo(() => {
        if (activeTab === "webapp") {
            const schema = {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                "name": appName || "Your App Name",
                "description": appDesc || "App Description",
                "url": appUrl || "https://example.com",
                "applicationCategory": appCategory,
                "operatingSystem": appOS || "Web Browser",
                "offers": {
                    "@type": "Offer",
                    "price": appPrice,
                    "priceCurrency": appCurrency
                }
            };
            return JSON.stringify(schema, null, 2);
        } else {
            const validFaqs = faqs.filter(f => f.question && f.answer);
            const schema = {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": validFaqs.map(f => ({
                    "@type": "Question",
                    "name": f.question,
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": f.answer
                    }
                }))
            };
            return JSON.stringify(schema, null, 2);
        }
    }, [activeTab, appName, appDesc, appUrl, appCategory, appPrice, appCurrency, appOS, faqs]);

    return (
        <ToolShell
            title="Schema Markup Generator"
            description="Generate compliant JSON-LD schema for your SaaS or Content site. Improve visibility in Google and AI search results."
            schema={{
                name: "Schema Markup Generator",
                description: "Free tool to generate WebApplication and FAQPage JSON-LD schema markup.",
                url: "https://flipaeo.com/tools/schema-generator"
            }}
        >
            <div className="grid gap-8 lg:grid-cols-2 mb-12">
                {/* Input Section */}
                <div className="space-y-6">
                    <Tabs defaultValue="webapp" onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-1 border-2 border-transparent h-auto">
                            <TabsTrigger
                                value="webapp"
                                className="font-bold data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:border-2 data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all py-2"
                            >
                                Web Application
                            </TabsTrigger>
                            <TabsTrigger
                                value="faq"
                                className="font-bold data-[state=active]:bg-brand-yellow data-[state=active]:text-black data-[state=active]:border-2 data-[state=active]:border-black data-[state=active]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all py-2"
                            >
                                FAQ Page
                            </TabsTrigger>
                        </TabsList>

                        <Card className="border-2 border-black shadow-neo rounded-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {activeTab === 'webapp' ? <CodeIcon className="h-5 w-5 text-primary" /> : <FileJson className="h-5 w-5 text-primary" />}
                                    {activeTab === 'webapp' ? 'App Details' : 'FAQ Items'}
                                </CardTitle>
                                <CardDescription>
                                    Enter your information to generate the schema.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {activeTab === "webapp" ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Application Name</Label>
                                            <Input
                                                className="rounded-none border-2 border-muted focus-visible:border-black focus-visible:ring-0"
                                                placeholder="e.g., FlipAEO"
                                                value={appName}
                                                onChange={(e) => setAppName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Textarea
                                                className="rounded-none border-2 border-muted focus-visible:border-black focus-visible:ring-0"
                                                placeholder="Brief description of your tool..."
                                                value={appDesc}
                                                onChange={(e) => setAppDesc(e.target.value)}
                                                rows={3}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>URL</Label>
                                            <Input
                                                className="rounded-none border-2 border-muted focus-visible:border-black focus-visible:ring-0"
                                                placeholder="https://..."
                                                value={appUrl}
                                                onChange={(e) => setAppUrl(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Category</Label>
                                                <Select value={appCategory} onValueChange={setAppCategory}>
                                                    <SelectTrigger className="rounded-none border-2 border-muted focus:border-black focus:ring-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="UtilityApplication">Utility</SelectItem>
                                                        <SelectItem value="BusinessApplication">Business</SelectItem>
                                                        <SelectItem value="DesignApplication">Design</SelectItem>
                                                        <SelectItem value="DeveloperApplication">Developer</SelectItem>
                                                        <SelectItem value="FinanceApplication">Finance</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Price (USD)</Label>
                                                <Input
                                                    className="rounded-none border-2 border-muted focus-visible:border-black focus-visible:ring-0"
                                                    type="number"
                                                    min="0"
                                                    value={appPrice}
                                                    onChange={(e) => setAppPrice(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Operating System</Label>
                                                <Input
                                                    className="rounded-none border-2 border-muted focus-visible:border-black focus-visible:ring-0"
                                                    placeholder="e.g., iOS, Android, Web Browser"
                                                    value={appOS}
                                                    onChange={(e) => setAppOS(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        {faqs.map((faq, index) => (
                                            <div key={faq.id} className="space-y-3 p-4 border-2 border-muted/50 bg-muted/10">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Question {index + 1}</span>
                                                    {faqs.length > 1 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeFaq(faq.id)}
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-none"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <Input
                                                    className="rounded-none border-2 border-muted focus-visible:border-black focus-visible:ring-0 bg-white"
                                                    placeholder="Question..."
                                                    value={faq.question}
                                                    onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
                                                />
                                                <Textarea
                                                    className="rounded-none border-2 border-muted focus-visible:border-black focus-visible:ring-0 bg-white"
                                                    placeholder="Answer..."
                                                    value={faq.answer}
                                                    onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
                                                    rows={2}
                                                />
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline"
                                            onClick={addFaq}
                                            className="w-full rounded-none border-2 border-black hover:bg-black hover:text-white transition-colors uppercase font-bold text-xs tracking-widest h-10"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Question
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </Tabs>
                </div>

                {/* Preview Section */}
                <div className="space-y-4">
                    <Card className="border-2 border-black shadow-neo rounded-none h-fit top-24">
                        <CardHeader className="bg-muted/30 border-b-2 border-black/5">
                            <CardTitle className="flex justify-between items-center">
                                <span>JSON-LD Output</span>
                                <span className="text-xs font-mono bg-black text-white px-2 py-0.5 rounded-none">application/ld+json</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="relative group">
                                <pre className="p-6 bg-[#1a1b26] text-blue-100 text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-[500px] overflow-y-auto selection:bg-brand-orange/30">
                                    {generatedSchema}
                                </pre>

                            </div>
                            <div className="p-4 bg-muted/30 border-t-2 border-black/5 flex gap-3">
                                <CopyButton
                                    text={generatedSchema}
                                    onCopy={() => {
                                        setHasGenerated(true);
                                    }}
                                    className="flex-1 rounded-none border-2 border-black shadow-neo-sm hover:shadow-none hover:translate-y-[2px] transition-all font-bold"
                                />
                                <Button
                                    variant="outline"
                                    onClick={handleDownload}
                                    className="flex-1 rounded-none border-2 border-black shadow-neo-sm hover:shadow-none hover:translate-y-[2px] transition-all font-bold"
                                >
                                    Download JSON
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Pro Tip */}
                    <Card className="rounded-none border-2 border-amber-500/30 bg-amber-500/5 shadow-neo-sm">
                        <CardContent className="p-4 flex gap-3">
                            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold text-amber-800 uppercase tracking-wide text-xs mb-1">
                                    Pro Tip
                                </p>
                                <p className="text-muted-foreground leading-relaxed">
                                    Always validate your schema using the <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-black">Google Rich Results Test</a> before deploying. This ensures you're eligible for rich snippets in search results.
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
                        hook="You've built your structured data—great for AI parsing. But are your articles optimized to win the 'Primary Source' spot in AI search results?"
                        description="FlipAEO generates authority-building articles that search engines love to cite and recommend. Bridge the gap between technical SEO and AI visibility."
                        ctaText="Generate GEO Content Free"
                        ctaLink="/login"
                    />
                </div>
            )}

            <SchemaContent />



            <ToolFAQ faqs={FAQ_DATA} />

            <div className="mt-12">
                <ToolCTA
                    hook="Ready to Rank Higher with AI?"
                    description="FlipAEO generates authority-building articles designed to get cited by AI search engines. 30 articles/month, fully automated."
                    ctaText="Start Free Trial"
                    ctaLink="/login"
                />
            </div></ToolShell>
    );
}
