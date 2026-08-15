import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Search, Code, Globe, Cpu, Check, Terminal, FileJson, Info } from "lucide-react";

export function SchemaContent() {
    return (
        <div className="max-w-4xl mx-auto space-y-12 mt-16">
            {/* Intro Section */}
            <section className="prose prose-neutral dark:prose-invert max-w-none">
                <h2 className="text-2xl md:text-3xl font-bold">
                    Mastering Schema Markup for the AI Era
                </h2>
                <div className="text-lg text-muted-foreground leading-relaxed">
                    <p className="mb-6">
                        In the rapidly evolving landscape of search, standing out requires more than just keywords.
                        <strong>Schema Markup</strong> (or Structured Data) is the secret language that helps search engines
                        and AI agents deeply understand your content. By implementing the right schema, you're not just
                        ranking—you're defining how your software or content is perceived by the algorithms that power the web.
                    </p>
                    <p>
                        Whether you're a SaaS founder, a developer, or a content creator, providing structured data is essential.
                        It transforms ambiguous web pages into explicit, machine-readable entities. This tool automates the process,
                        giving you the precise JSON-LD code needed to communicate with Google, Bing, Perplexity, and the next generation
                        of AI-powered search engines.
                    </p>
                </div>
            </section>

            {/* Why JSON-LD Section */}
            <section className="grid gap-6 md:grid-cols-2 not-prose">
                <Card className="bg-muted/30 border-2 border-black/5 shadow-sm rounded-none">
                    <CardContent className="p-6 space-y-4">
                        <div className="h-10 w-10 bg-brand-yellow/20 flex items-center justify-center border border-brand-yellow/50">
                            <FileJson className="h-5 w-5 text-brand-orange-dark" />
                        </div>
                        <h3 className="text-xl font-bold">Why JSON-LD?</h3>
                        <p className="text-muted-foreground">
                            Google explicitly prefers <strong>JSON-LD</strong> (JavaScript Object Notation for Linked Data) over other
                            formats like Microdata or RDFa. It's cleaner, easier to maintain, and can be injected dynamically without
                            cluttering your HTML structure. It isolates your data from your presentation layer.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-muted/30 border-2 border-black/5 shadow-sm rounded-none">
                    <CardContent className="p-6 space-y-4">
                        <div className="h-10 w-10 bg-brand-blue/20 flex items-center justify-center border border-brand-blue/50">
                            <Code className="h-5 w-5 text-brand-blue" />
                        </div>
                        <h3 className="text-xl font-bold">Zero-Dependency</h3>
                        <p className="text-muted-foreground">
                            Our generator produces pure, standardized JSON-LD. It works with <strong>Next.js</strong>,
                            <strong>WordPress</strong>, <strong>Shopify</strong>, or any custom stack. No plugins required.
                            Just copy, paste, and validate to instantly upgrade your site's semantic vocabulary.
                        </p>
                    </CardContent>
                </Card>
            </section>

            {/* Deep Dive: WebApplication Schema */}
            <section className="prose prose-neutral dark:prose-invert max-w-none">
                <div className="flex items-center gap-3 mb-6 not-prose">
                    <div className="h-8 w-8 bg-black text-white flex items-center justify-center font-mono text-sm">01</div>
                    <h2 className="text-2xl md:text-3xl font-bold m-0">The Power of WebApplication Schema</h2>
                </div>
                <div className="text-lg text-muted-foreground leading-relaxed">
                    <p>
                        For SaaS companies and online tools, the <code>WebApplication</code> schema is non-negotiable.
                        It tells search engines that your page isn't just an article—it's a functional tool.
                        This distinction is crucial for triggering "Rich Results" that can display your app's rating,
                        price, and operating system compatibility directly in the search snippets.
                    </p>
                    <ul className="grid sm:grid-cols-2 gap-4 list-none pl-0 my-6 not-prose">
                        <li className="flex gap-3 items-start">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 shrink-0" />
                            <span><strong>Category Clarity:</strong> Explicitly categorize as Finance, Utility, or Design software.</span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 shrink-0" />
                            <span><strong>Pricing Visibility:</strong> Display pricing models (free, freemium, or paid) upfront.</span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 shrink-0" />
                            <span><strong>OS Support:</strong> Define compatibility (Web, iOS, Android) to target the right users.</span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 shrink-0" />
                            <span><strong>Rich Snippets:</strong> Increase click-through rates (CTR) with visually enhanced results.</span>
                        </li>
                    </ul>
                </div>
            </section>

            {/* Deep Dive: FAQPage Schema */}
            <section className="prose prose-neutral dark:prose-invert max-w-none">
                <div className="flex items-center gap-3 mb-6 not-prose">
                    <div className="h-8 w-8 bg-brand-orange text-black flex items-center justify-center font-mono text-sm">02</div>
                    <h2 className="text-2xl md:text-3xl font-bold m-0">Dominating SERPs with FAQPage Schema</h2>
                </div>
                <div className="text-lg text-muted-foreground leading-relaxed">
                    <p>
                        The <code>FAQPage</code> schema is one of the most effective ways to occupy more vertical real estate in search results.
                        By marking up your Frequently Asked Questions, you allow Google to render collapsible questions and answers
                        directly beneath your link. This "FAQ Rich Result" pushes competitors further down the page and answers user queries instantly.
                    </p>
                    <p className="mt-4">
                        <strong>Strategic Advantage:</strong> AI search engines like Perplexity often extract answers directly from FAQ schema
                        to construct their responses. By providing structured FAQs, you increase the likelihood of your content being used
                        as a primary source for AI-generated answers, driving high-intent traffic back to your site.
                    </p>
                </div>
            </section>

            {/* GEO & AI Search */}
            <section className="bg-[#1a1b26] text-blue-100 p-8 rounded-none border-l-4 border-brand-yellow not-prose">
                <div className="flex items-start gap-4">
                    <Cpu className="h-10 w-10 text-brand-yellow shrink-0" />
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">Optimizing for the AI Search Revolution (GEO)</h2>
                        <p className="text-blue-200/80 leading-relaxed text-lg">
                            Generative Engine Optimization (GEO) is the new frontier. Traditional SEO focuses on keywords; GEO focuses on logic, facts, and structure.
                            LLMs (Large Language Models) thrive on structured data.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-6 mt-4">
                            <div>
                                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                    <Terminal className="h-4 w-4 text-brand-green" />
                                    Machine Readability
                                </h4>
                                <p className="text-sm text-blue-200/70">
                                    Schema provides factual density that helps LLMs hallucinate less and cite more. It grounds your content in established vocabulary.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-brand-blue" />
                                    Entity Recognition
                                </h4>
                                <p className="text-sm text-blue-200/70">
                                    It connects your brand to specific concepts in the Knowledge Graph, establishing authority and relevance in your niche.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Implementation Guide */}
            <section className="space-y-8 border-t-2 border-black/5 pt-8">
                <h2 className="text-2xl md:text-3xl font-bold">Implementation Guide</h2>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Next.js Guide */}
                    <div className="space-y-3">
                        <h3 className="font-bold border-b-2 border-black/10 pb-2">Next.js (App Router)</h3>
                        <p className="text-muted-foreground">
                            Add the schema in your <code>layout.tsx</code> or <code>page.tsx</code> using the script tag strategy.
                        </p>
                        <div className="bg-muted p-3 text-xs font-mono overflow-x-auto rounded-none border border-black/10">
                            {`<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(schema)
  }}
/>`}
                        </div>
                    </div>

                    {/* WordPress Guide */}
                    <div className="space-y-3">
                        <h3 className="font-bold border-b-2 border-black/10 pb-2">WordPress</h3>
                        <p className="text-muted-foreground">
                            Use a plugin like "Header and Footer Scripts" or your theme's custom code area.
                        </p>
                        <ol className="text-muted-foreground list-decimal pl-4 space-y-1">
                            <li>Copy the generated JSON.</li>
                            <li>Go to <strong>Settings {'>'} Insert Headers</strong>.</li>
                            <li>Paste inside a <code>{`<script>`}</code> tag.</li>
                        </ol>
                    </div>

                    {/* Verification Guide */}
                    <div className="space-y-3">
                        <h3 className="font-bold border-b-2 border-black/10 pb-2">Verification</h3>
                        <p className="text-muted-foreground">
                            Always validate before publishing to avoid syntax errors that could invalidate your page.
                        </p>
                        <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                            <li>Use <a href="https://search.google.com/test/rich-results" className="underline decoration-brand-orange">Rich Results Test</a></li>
                            <li>Check <a href="https://validator.schema.org/" className="underline decoration-brand-orange">Schema Validator</a></li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="space-y-6 border-t-2 border-black/5 pt-8">
                <h2 className="text-2xl md:text-3xl font-bold">Common Questions</h2>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-2">
                        <h4 className="font-bold text-lg text-foreground">Can I use both schemas on one page?</h4>
                        <p className="text-muted-foreground">
                            Yes! You can include multiple script tags or an array of objects in JSON-LD. It is common to have
                            <code>WebApplication</code> for the tool itself and <code>FAQPage</code> for the support section below it.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-lg text-foreground">Does this guarantee rich snippets?</h4>
                        <p className="text-muted-foreground">
                            No. Google treats schema as a "strong suggestion." However, without it, you have zero chance. With it, and high-quality content, your odds increase significantly.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-lg text-foreground">What if my app is free?</h4>
                        <p className="text-muted-foreground">
                            Set the price to "0" and the currency to your local currency (e.g., USD). This explicitly tells Google it is a free tool, which can be a strong click magnet.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-lg text-foreground">Does this help with SearchGPT/Perplexity?</h4>
                        <p className="text-muted-foreground">
                            Absolutely. These engines rely heavily on parsing structured data to understand "what" a page is essentially about. Clear schema helps them categorize and recommend your tool correctly.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
