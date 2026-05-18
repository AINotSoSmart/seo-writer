import { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { GridBackground } from '@/components/landing/GridBackground';
import { ArrowRight, Zap, Target, PenLine } from 'lucide-react';
import { StructuredData } from '@/components/seo/StructuredData';

export const metadata: Metadata = {
    title: 'FlipAEO vs. The Competition — Honest Comparisons | FlipAEO',
    description: 'Head-to-head comparisons of FlipAEO against traditional SEO tools and bulk AI writers. See exactly where we win, where we don\'t, and who each tool is best for.',
};

const comparisonData = [
    {
        feature: "Optimization Goal",
        legacy: "Google SERP Dominance. Optimizes content scores based on NLP keyword density and statistical analysis of the current top 10 Google results.",
        bulk: "Programmatic Scale (pSEO). Focuses on capturing long-tail search traffic by generating thousands of template-based articles.",
        flipaeo: "AI Citation Ownership. Engineers \"Structural Trust\" to become the primary cited source in ChatGPT, Perplexity, Gemini, and Google AI Overviews."
    },
    {
        feature: "Content Volume & Strategy",
        legacy: "Single-Page Perfection. Manual optimization or expensive single-article AI generation ($29/post) focused on outranking specific blue-link competitors.",
        bulk: "Industrial-Scale Batching. Generates 1,000+ articles per batch using custom datasets, prioritizing sheer volume and keyword coverage.",
        flipaeo: "Strategic Clusters (30/mo). Focuses on \"Topical Purity.\" Generates highly researched, connected entity clusters that fill semantic gaps LLMs are hungry for."
    },
    {
        feature: "Formatting Architecture",
        legacy: "Traditional SEO Layouts. Optimized to hit specific word counts, header distributions, and keyword frequencies to satisfy the classic Google algorithm.",
        bulk: "Programmatic Templates. Standardized blog structures designed to fulfill basic keyword intent quickly across mass variations.",
        flipaeo: "RAG-Native Structure. Built with \"Anti-Fluff\" definitional hooks, Markdown tables, and machine-readable data structures specifically designed for LLM extraction."
    },
    {
        feature: "Data Source & Research",
        legacy: "Historical SERP Scraping. Analyzes what is already ranking on Google to tell you what words to include.",
        bulk: "Live Web & Custom Data. Uses live web scraping and user-uploaded datasets to populate mass keyword lists.",
        flipaeo: "Category Intelligence. Maps competitor coverage to find \"Shadow Questions\" (visibility gaps), generating net-new answers rather than summarizing existing SERPs."
    }
];

const bulkSpamAlternatives = [
    { slug: 'bulk-ai-writers', name: 'Bulk AI Writers Hub', microCopy: "Compare Byword, Autoblogging.ai, and Article Forge in one stronger page built for consolidation instead of thin leaf-page overlap." },
    { slug: 'agility-writer', name: 'Agility Writer', microCopy: "If your goal is to spin up hundreds of high-volume Amazon affiliate reviews, Agility Writer is a great tool." },
    { slug: 'koala-writer', name: 'Koala Writer', microCopy: "If you are an affiliate marketer trying to pump out rapid-fire product reviews, Koala Writer is heavily optimized for that." },
    { slug: 'seowriting-ai', name: 'SEOwriting.ai', microCopy: "If you want to one-click publish hundreds of auto-generated WordPress articles for local SEO, SEOwriting.ai is a fast engine." },
    { slug: 'surgegraph', name: 'SurgeGraph', microCopy: "If your goal is to generate 5,000-word SEO articles in bulk to capture long-tail Google search volume, SurgeGraph is a powerhouse." },
    { slug: 'seo-ai', name: 'SEO.ai', microCopy: "If you want an autopilot tool to generate traditional, keyword-stuffed SEO blogs for a local business, SEO.ai is a solid system." },
    { slug: 'cuppa-ai', name: 'Cuppa.ai', microCopy: "If you want to plug in your own API keys to mass-generate thousands of programmatic or local SEO pages for pennies, Cuppa.ai is fantastic." },
    { slug: 'contentbase-ai', name: 'ContentBase AI', microCopy: "If you want AI-generated SEO content with automated keyword targeting and a simple dashboard, ContentBase AI is a convenient choice." },
    { slug: 'getgenie', name: 'GetGenie', microCopy: "If you want a WordPress-native AI assistant that generates SEO blog posts with built-in keyword research and SERP analysis, GetGenie is a solid pick." },
    { slug: 'aiclicks', name: 'AIClicks', microCopy: "If you want a lightweight AI tool to quickly generate SEO-optimized blog posts and landing page copy at scale, AIClicks is an efficient option." },
    { slug: 'blogseo', name: 'BlogSEO', microCopy: "If you want a streamlined AI writer focused on generating keyword-targeted blog articles with minimal setup, BlogSEO is a fast and focused engine." },
    { slug: 'blogbuster', name: 'BlogBuster', microCopy: "If you want to automate blog content creation with AI-driven outlines and SEO scoring for rapid publishing, BlogBuster is a handy tool." }
];

const legacyBlueLinkAlternatives = [
    { name: 'Surfer SEO', slug: 'surfer-seo', description: "If you want the industry standard for traditional Google rankings—analyzing top competitors to hit the perfect NLP keyword density score—Surfer SEO is king." },
    { name: 'Frase', slug: 'frase', description: "If you have an in-house team of writers who need a powerful AI text editor to manually optimize articles for Google, Frase is incredible." },
    { name: 'Clearscope', slug: 'clearscope', description: "If you have an in-house team of writers and a massive budget to manually grade and optimize articles for Google's traditional SERPs, Clearscope is the gold standard." },
    { name: 'Dashword', slug: 'dashword', description: "If you want a clean, user-friendly text editor to manually generate briefs and grade your writing against Google's top 10 results, Dashword is an excellent tool." },
    { name: 'MarketMuse', slug: 'marketmuse', description: "If you run an enterprise content team and need to audit a massive website to build manual topic clusters and content briefs, MarketMuse is world-class." },
    { name: 'Scalenut', slug: 'scalenut', description: "If you want an all-in-one SEO platform that combines keyword planning, NLP-optimized content briefs, and a Cruise Mode for bulk article generation, Scalenut is a strong contender." },
    { name: 'GrowthBar', slug: 'growthbar', description: "If you want a Chrome extension-friendly SEO tool that generates AI blog posts with built-in keyword research and competitor analysis, GrowthBar is a practical choice." },
    { name: 'Outranking', slug: 'outranking', description: "If you want an AI-driven content strategy tool that automates briefs, outlines, and on-page optimization based on SERP analysis, Outranking is a powerful workflow engine." },
    { name: 'Outrank.so', slug: 'outrank-so', description: "If you want an AI SEO writer that auto-generates optimized articles with internal linking and schema markup for traditional Google rankings, Outrank.so is a solid option." },
];

const promptWrapperAlternatives = [
    { name: 'Jasper AI', slug: 'jasper-ai', description: 'General purpose AI marketing writer.' },
    { name: 'Copy.ai', slug: 'copy-ai', description: 'Generative AI for marketing copy.' },
    { name: 'Writesonic', slug: 'writesonic', description: 'AI writer for articles and ads.' },
    { name: 'Rytr', slug: 'rytr-ai', description: 'AI writing assistant and content generator.' },
];

const faqs = [
    {
        question: "Why should I switch from bulk AI writers?",
        answer: "Bulk AI writers generate 'thin content' that gets penalized by Google's Helpful Content Updates. In the modern AEO/GEO era, you need structured, semantic depth that makes your brand the primary citation for AI engines."
    },
    {
        question: "How is AEO different from traditional SEO?",
        answer: "Traditional SEO focuses on keyword density and 'blue links'. Answer Engine Optimization (AEO) structures content semanticly to be ingested and cited directly by LLMs like ChatGPT, Perplexity, and Google AI Overviews."
    },
    {
        question: "Will my existing content lose traffic?",
        answer: "Legacy content already loses traffic to AI Overviews. Switching to an AEO-first approach helps you reclaim that visibility by becoming the source material the AI engines prefer."
    }
];

export default function CompareHub() {
    return (
        <div className="relative min-h-screen w-full flex flex-col font-sans bg-stone-50/30">
            <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <GridBackground />
            </div>

            <Navbar />

            <main className="flex-grow flex flex-col items-center w-full relative pt-32 pb-24 z-10 w-full overflow-hidden">
                <StructuredData
                    data={{
                        "@context": "https://schema.org",
                        "@type": "WebPage",
                        name: "FlipAEO vs. The Competition — Honest Comparisons",
                        description: "Head-to-head comparisons of FlipAEO against traditional SEO tools, bulk AI writers, and prompt wrappers."
                    }}
                />

                {/* Hero Section */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-24 text-center mt-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600 text-[13px] font-medium mb-8 shadow-sm">
                        <Zap className="w-4 h-4 text-brand-500" />
                        <span>The AEO Era is Here</span>
                    </div>
                    <h1 className="font-serif text-5xl md:text-7xl text-stone-900 leading-[1.1] mb-6 tracking-tight">
                        The Post-SEO Era Hub  <br />
                        <span className="italic font-light text-brand-600">FlipAEO vs. The Rest</span>
                    </h1>
                    <p className="font-sans text-lg md:text-xl text-stone-500 max-w-2xl mx-auto leading-snug mb-10 text-balance">
                        Traditional SEO tools optimize for blue links. Bulk AI writers optimize for spam. Discover why FlipAEO is the only platform built natively for Answer Engine Optimization (AEO).                    </p>
                </section>

                {/* Comparison Table Section */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-24">
                    <div className="bg-brand-100 rounded-[20px] p-2 shadow-[inset_0_0_0_1px_#c4b5fd]">
                        <div className="bg-white rounded-[17px] overflow-hidden border border-white h-full relative">
                            {/* Desktop Table View */}
                            <div className="hidden md:block p-0 overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr>
                                            <th className="p-4 pl-6 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 w-1/4">Feature</th>
                                            <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 w-1/4">Legacy SEO Tools <span className="font-normal normal-case block mt-0.5 text-stone-400/80">(e.g., Surfer SEO)</span></th>
                                            <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 w-1/4">Bulk AI Writers <span className="font-normal normal-case block mt-0.5 text-stone-400/80">(e.g., Byword.ai)</span></th>
                                            <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-brand-600 border-b border-stone-100 bg-brand-50/30 w-1/4">FlipAEO <span className="font-normal normal-case block mt-0.5 opacity-80">(AEO Natively)</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonData.map((row, i) => (
                                            <tr key={i} className="group hover:bg-stone-50/30 transition-colors">
                                                <td className="p-4 pl-6 text-sm font-medium text-stone-900 border-b border-stone-50 group-last:border-0">{row.feature}</td>
                                                <td className="p-4 text-sm text-stone-500 border-b border-stone-50 group-last:border-0 leading-tight">{row.legacy}</td>
                                                <td className="p-4 text-sm text-stone-500 border-b border-stone-50 group-last:border-0 leading-tight border-l border-dashed border-stone-100">{row.bulk}</td>
                                                <td className="p-4 text-sm font-medium text-brand-900 bg-brand-50/10 border-b border-stone-50 group-last:border-0 border-l border-brand-100 leading-tight relative">
                                                    <span className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-brand-400"></span>
                                                    {row.flipaeo}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Grid View */}
                            <div className="md:hidden flex flex-col">
                                <Link href="/compare/flipaeo-vs-surfer-seo" className="group block">
                                    <div className="p-8 rounded-2xl border border-stone-200 bg-white transition-all duration-300 hover:border-brand-300 hover:bg-stone-50 h-full flex flex-col">
                                        <h3 className="text-xl font-bold text-stone-900 mb-2 group-hover:text-brand-600 transition-colors">Legacy SEO Tools</h3>
                                        <p className="text-stone-500 mb-6 flex-grow">Surfer SEO, Clearscope, Frase</p>
                                        <div className="mt-auto">
                                            <div className="text-sm font-medium text-brand-600 flex items-center">
                                                Compare &rarr;
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                <Link href="/compare/flipaeo-vs-bulk-ai-writers" className="group block">
                                    <div className="p-8 rounded-2xl border border-stone-200 bg-white transition-all duration-300 hover:border-brand-300 hover:bg-stone-50 h-full flex flex-col">
                                        <h3 className="text-xl font-bold text-stone-900 mb-2 group-hover:text-brand-600 transition-colors">Bulk AI Writers</h3>
                                        <p className="text-stone-500 mb-6 flex-grow">Byword, Autoblogging.ai, Article Forge</p>
                                        <div className="mt-auto">
                                            <div className="text-sm font-medium text-brand-600 flex items-center">
                                                Compare &rarr;
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                <Link href="/compare/flipaeo-vs-jasper" className="group block">
                                    <div className="p-8 rounded-2xl border border-stone-200 bg-white transition-all duration-300 hover:border-brand-300 hover:bg-stone-50 h-full flex flex-col">
                                        <h3 className="text-xl font-bold text-stone-900 mb-2 group-hover:text-brand-600 transition-colors">General AI Assistants</h3>
                                        <p className="text-stone-500 mb-6 flex-grow">Jasper, Copy.ai, Writesonic</p>
                                        <div className="mt-auto">
                                            <div className="text-sm font-medium text-brand-600 flex items-center">
                                                Compare &rarr;
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Categories */}
                <section className="w-full max-w-5xl mx-auto px-6 space-y-24">

                    {/* Section Header */}
                    <div className="text-center max-w-3xl mx-auto">

                        <h2 className="font-serif text-4xl md:text-5xl text-stone-900 leading-[1.1] mb-6 tracking-tight">
                            Browse Comparisons <br />
                            <span className="italic font-light text-brand-600">by Category</span>
                        </h2>
                        <p className="font-sans text-lg text-stone-500 max-w-2xl mx-auto leading-relaxed text-balance">
                            Whether you're moving away from expensive legacy tools or low-quality bulk generators, we have a detailed comparison for you.
                        </p>
                    </div>

                    {/* Category 1 */}
                    <div>
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 shrink-0">
                                <Target className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold text-stone-900">vs. Bulk AI Writers</h2>
                                <p className="text-stone-500 mt-1">Stop publishing unhelpful content. Start building authority.</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {bulkSpamAlternatives.map((alt) => (
                                <ComparisonCard
                                    key={alt.slug}
                                    name={alt.name}
                                    slug={alt.slug}
                                    description={alt.microCopy}
                                    icon={<Target className="w-5 h-5" />}
                                    color="orange"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Social Proof Injector */}
                    <div className="w-full bg-stone-900 rounded-[20px] p-8 md:p-12 text-center relative overflow-hidden shadow-xl ring-1 ring-white/10">
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-500/10 via-transparent to-transparent opacity-40" />

                        <div className="relative z-10 flex flex-col items-center gap-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-900/50 border border-brand-500/30 text-brand-300 text-xs font-medium uppercase tracking-wider">
                                Case Study
                            </div>
                            <h3 className="font-serif text-3xl md:text-4xl text-white max-w-2xl leading-tight">
                                Why does the switch matter?
                            </h3>
                            <p className="text-stone-300 text-lg md:text-xl max-w-3xl leading-relaxed">
                                We used FlipAEO to build <span className="text-white font-semibold">Bringback.pro</span>. Result: <span className="text-brand-300 font-bold">1.8k Google Clicks</span> and <span className="text-brand-300 font-bold">500+ ChatGPT Citations</span> in 90 Days.
                            </p>
                            <Link
                                href="https://flipaeo.com/blog/aeo-vs-seo-divergence-case-study"
                                className="mt-2 inline-flex items-center gap-2 px-6 py-3 bg-white text-stone-900 rounded-full font-medium hover:bg-brand-50 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200"
                            >
                                Read the Case Study
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Category 2 */}
                    <div>
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                                <PenLine className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold text-stone-900">vs. Legacy SEO Tools</h2>
                                <p className="text-stone-500 mt-1">Blue links are dead. Structure for LLMs.</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {legacyBlueLinkAlternatives.map((alt) => (
                                <ComparisonCard
                                    key={alt.slug}
                                    name={alt.name}
                                    slug={alt.slug}
                                    description={alt.description}
                                    icon={<PenLine className="w-5 h-5" />}
                                    color="blue"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Category 3 */}
                    <div>
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-500 shrink-0">
                                <Zap className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold text-stone-900">vs. Content Generators</h2>
                                <p className="text-stone-500 mt-1">Move beyond chat interfaces to programmatic workflows.</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {promptWrapperAlternatives.map((alt) => (
                                <ComparisonCard
                                    key={alt.slug}
                                    name={alt.name}
                                    slug={alt.slug}
                                    description={alt.description}
                                    icon={<Zap className="w-5 h-5" />}
                                    color="purple"
                                />
                            ))}
                        </div>
                    </div>

                </section>

                {/* FAQs */}
                <section className="w-full max-w-3xl mx-auto px-6 mt-32">
                    <h2 className="font-serif text-3xl text-stone-900 mb-12 text-center text-balance">Frequently Asked Questions</h2>
                    <div className="space-y-4">
                        {faqs.map((faq, idx) => (
                            <div key={idx} className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm leading-relaxed">
                                <h3 className="text-lg font-semibold text-stone-900 mb-3">{faq.question}</h3>
                                <p className="text-stone-600">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </section>

            </main>

            <Footer />
        </div>
    );
}

function ComparisonCard({
    slug,
    name,
    description,
    icon,
    color
}: {
    slug: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: 'orange' | 'blue' | 'purple';
}) {
    const colorStyles = {
        orange: 'text-orange-600 bg-orange-50 border-orange-100 group-hover:border-orange-200',
        blue: 'text-blue-600 bg-blue-50 border-blue-100 group-hover:border-blue-200',
        purple: 'text-purple-600 bg-purple-50 border-purple-100 group-hover:border-purple-200',
    };

    return (
        <Link
            href={`/compare/flipaeo-vs-${slug}`}
            className="block group h-full"
        >
            {/* Outer Shell - Matches Footer/Navbar Aesthetic */}
            <div className="
                h-full w-full
                bg-white
                border border-stone-300/50
                rounded-[15px] p-1
                shadow-xs
                transition-all duration-300
                group-hover:border-brand-200
            ">
                {/* Inner Core */}
                <div className="
                    h-full w-full
                    bg-stone-50/50 
                    rounded-[12px] p-6
                    border border-stone-100
                    flex flex-col
                    group-hover:bg-white transition-colors duration-300
                ">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 font-bold text-lg leading-none pt-0.5 shadow-sm">
                                {name.charAt(0)}
                            </div>
                            <div className="text-stone-300 text-sm italic font-medium -mt-0.5">vs</div>
                            <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg leading-none pt-0.5 shadow-sm">
                                F
                            </div>
                        </div>
                        <div className={`p-2 rounded-lg ${colorStyles[color]} transition-colors`}>
                            {icon}
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-stone-900 mb-2 group-hover:text-brand-600 transition-colors">
                        FlipAEO vs. {name}
                    </h3>
                    <p className="text-stone-500 text-sm leading-relaxed flex-grow">
                        {description}
                    </p>

                    <div className="mt-6 pt-6 border-t border-stone-100 flex items-center justify-between text-sm font-medium">
                        <span className="text-stone-400 group-hover:text-brand-600 transition-colors">Read Comparison</span>
                        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-brand-600 transition-colors -translate-x-1 group-hover:translate-x-0" />
                    </div>
                </div>
            </div>
        </Link>
    );
}
