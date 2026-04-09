import React from 'react';
import { Metadata } from 'next';
import Image from 'next/image';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { GridBackground } from "@/components/landing/GridBackground";
import CTASection from '@/components/landing/CTASection';
import { CornerSquare } from '@/components/landing/CornerSquare';

export const metadata: Metadata = {
    title: 'Case Study: We Drink Our Own Champagne | FlipAEO',
    description: 'Learn how we used FlipAEO to scale BringBack.pro by 1,300% in 90 days without spending a dollar on ads.',
}

export default function BringBackCaseStudy() {
    return (
        <div className="relative min-h-screen w-full flex flex-col overflow-x-hidden font-sans">
            <div className="absolute inset-0 z-0">
                <GridBackground />
            </div>
            
            <HeaderWrapper />

            <main className="flex-grow flex flex-col items-center w-full z-10 pt-20 pb-12">
                <article className="w-full max-w-[1000px] mx-auto px-4 sm:px-6 flex flex-col gap-24">

                    {/* Section 1: The Hook (Hero) */}
                    <section className="flex flex-col items-center text-center pt-12 md:pt-20">
                        <span className="font-sans text-xs font-bold tracking-widest text-stone-400 uppercase mb-6 block border border-stone-200 px-3 py-1 rounded-full bg-white/50 backdrop-blur-sm">
                            Live Case Study
                        </span>
                        <h1 className="font-serif text-5xl md:text-7xl text-stone-900 tracking-tight font-normal leading-[1.1] mb-8 max-w-4xl">
                            From 0 to 1,300 Clicks/Month in <span className="italic text-stone-500">90 Days</span>
                        </h1>
                        <p className="font-sans text-stone-500 text-lg md:text-xl leading-relaxed max-w-2xl mb-16">
                            We didn’t just build FlipAEO; we used it to blindly scale our own SaaS—<a href="https://bringback.pro" target="_blank" className="text-stone-900 font-medium underline decoration-stone-300 hover:decoration-stone-900 transition-all">BringBack.pro</a>—from zero. No paid ads, no link-building campaigns. Just pure, programmatic AEO.
                        </p>

                        <div className="w-full aspect-[16/10] sm:aspect-[21/9] relative rounded-2xl overflow-hidden border border-stone-200 shadow-sm bg-white p-2">
                            <div className="w-full h-full relative rounded-xl overflow-hidden bg-stone-50/50">
                                <Image
                                    src="/case-study/proof-1.webp"
                                    alt="Google Search Console performance graph showing 1,300% growth in organic clicks for BringBack.pro over 90 days"
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2: The Context (Problem) */}
                    <section className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-stone-200 hidden md:block"></div>
                        <div className="md:pl-12 flex flex-col md:flex-row gap-12">
                            <div className="md:w-1/3">
                                <h2 className="font-serif text-3xl text-stone-900 tracking-tight mb-4">The Challenge</h2>
                            </div>
                            <div className="md:w-2/3 space-y-6 text-stone-600 text-lg leading-relaxed">
                                <p>
                                    BringBack.pro is an AI photo restoration tool. When we launched, we entered a deeply saturated market dominated by massive legacy tech companies with Domain Authorities near 90+.
                                </p>
                                <p>
                                    Trying to rank for broad terms like "photo editor" or "restore photos" using traditional SEO meant competing in a massive ocean where we had absolutely zero leverage. We didn't have the budget to buy backlinks, and publishing generic AI articles was a guaranteed death sentence against the helpful content update.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Horizontal Divider */}
                    <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                        <CornerSquare className="-left-[5px] -top-[5px]" />
                        <CornerSquare className="-right-[5px] -top-[5px]" />
                    </div>

                    {/* Section 3: The Execution */}
                    <section className="relative">
                        <div className="md:pl-0 flex flex-col gap-12">
                            <div className="max-w-3xl">
                                <h2 className="font-serif text-4xl text-stone-900 tracking-tight mb-6 mt-4">The Strategy: FlipAEO in Action</h2>
                                <p className="text-stone-600 text-lg leading-relaxed">
                                    Instead of fighting Goliath, we decided to dominate the long-tail intent gaps where the large competitors couldn't bother to compete. We let FlipAEO take the wheel.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-sm">
                                    <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-6 border border-stone-200 text-stone-600 font-serif text-xl">1</div>
                                    <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-4">Discovering Critical Gaps</h3>
                                    <p className="text-stone-500 leading-relaxed">
                                        We ran the FlipAEO Audit Console to find hyper-specific, high-intent gaps. We discovered that users weren't just searching for generic editors, they were asking specific questions like <em>"how to combine photos of deceased loved ones."</em> Long-tail, emotional, and poorly answered by competitors.
                                    </p>
                                </div>
                                <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] shadow-sm">
                                    <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center mb-6 border border-brand-200 text-brand-700 font-serif text-xl">2</div>
                                    <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-4">Autonomous Generation</h3>
                                    <p className="text-stone-500 leading-relaxed">
                                        Once the intent was clear, we deployed FlipAEO's Critic Agent. It independently researched the queries, analyzed the competitor flaws, and automatically structured deeply optimized, entity-rich AEO pages that directly captured the exact problem.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Horizontal Divider */}
                    <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                        <CornerSquare className="-left-[5px] -bottom-[5px]" />
                        <CornerSquare className="-right-[5px] -bottom-[5px]" />
                    </div>

                    {/* Section 4: The Proof */}
                    <section className="flex flex-col gap-16">
                        <div className="max-w-2xl text-center mx-auto">
                            <h2 className="font-serif text-4xl text-stone-900 tracking-tight mb-4">The Undeniable Proof</h2>
                            <p className="text-stone-500 text-lg">We didn't just target the keywords; we won them completely.</p>
                        </div>

                        {/* Proof Feature 1 */}
                        <div className="flex flex-col md:flex-row gap-8 items-center bg-white border border-stone-200 rounded-[2rem] p-4 shadow-sm">
                            <div className="w-full md:w-1/2 aspect-[4/3] relative rounded-xl overflow-hidden bg-stone-50">
                                <Image
                                    src="/case-study/proof-2.webp"
                                    alt="Ranking #1 against giants"
                                    fill
                                    className="object-contain object-left-top p-6"
                                />
                            </div>
                            <div className="w-full md:w-1/2 p-6 md:pr-12">
                                <h3 className="font-serif text-3xl text-stone-900 tracking-tight mb-4">Ranking #1 against Goliath</h3>
                                <p className="text-stone-500 leading-relaxed text-lg">
                                    By building perfectly structured topical authority on exact intent gaps, we leapfrogged major billion-dollar competitors to claim the absolute #1 spot for high-intent queries like 'combine photos'.
                                </p>
                            </div>
                        </div>

                        {/* Proof Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col group border border-stone-200 rounded-3xl bg-white overflow-hidden shadow-sm">
                                <div className="relative w-full aspect-[4/3] overflow-hidden bg-stone-50 border-b border-stone-100">
                                    <Image
                                        src="/case-study/proof-4.webp"
                                        alt="Cited by Gemini"
                                        fill
                                        className="object-contain object-top p-6 transition-transform duration-700 group-hover:scale-[1.02]"
                                    />
                                </div>
                                <div className="p-8">
                                    <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">Cited by Google Gemini</h3>
                                    <p className="text-stone-500 leading-relaxed">
                                        Because FlipAEO structured the pages with flawless Answer Engine Optimization, Google's Gemini naturally cited BringBack as the top tool for users.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col group border border-stone-200 rounded-3xl bg-white overflow-hidden shadow-sm">
                                <div className="relative w-full aspect-[4/3] overflow-hidden bg-stone-50 border-b border-stone-100">
                                    <Image
                                        src="/case-study/proof-3.webp"
                                        alt="Real AI Traffic"
                                        fill
                                        className="object-contain p-6 transition-transform duration-700 group-hover:scale-[1.02]"
                                    />
                                </div>
                                <div className="p-8">
                                    <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">Direct AI Traffic</h3>
                                    <p className="text-stone-500 leading-relaxed">
                                        The proof is in GA4. We saw an immediate influx of direct, high-intent referal traffic coming straight from ChatGPT and Gemini prompts.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </section>

                </article>
            </main>

            <CTASection />
            <Footer />
        </div>
    );
}

// A quick wrapper for Navbar to sit nicely
function HeaderWrapper() {
    return (
        <div className="relative z-50">
            <Navbar />
        </div>
    )
}
