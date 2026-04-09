import React from 'react';
import { Bot, Zap, Globe, Image as ImageIcon, Link2, ShieldCheck, Target } from 'lucide-react';
import Button from './Button';
import Link from 'next/link';
import { CornerSquare } from './CornerSquare';

const FeatureItem = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="flex gap-4 items-start group">
        <div className="flex-shrink-0 w-10 h-10 rounded-[6px] bg-stone-50 border border-stone-200 flex items-center justify-center text-">
            <Icon size={20} strokeWidth={1.5} />
        </div>
        <div className="flex-1">
            <h4 className="font-serif text-lg text-stone-900 leading-tight mb-1">
                {title}
            </h4>
            <p className="font-sans text-sm text-stone-500 leading-relaxed">
                {description}
            </p>
        </div>
    </div>
);

const PricingSection: React.FC = () => {
    return (
        <section id="pricing" className="w-full py-24 relative z-10">
            <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

                {/* Horizontal Pattern Bar Above Header */}
                <div className="w-full h-3 sm:h-4 border-y border-stone-200 mb-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}></div>

                {/* Header - Left/Right Premium Setup */}
                <div className="flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end mb-16 w-full px-4 md:px-8">
                    <div className="flex-1">
                        <span className="font-sans text-xs font-bold tracking-widest text-brand-500 uppercase mb-4 block">
                            Pricing
                        </span>
                        <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1]">
                            Stop Renting SEO Writers.  <br /><span className='italic text-stone-500'>Own an AI Engine.</span>
                        </h2>
                    </div>
                    <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
                        <p className="font-sans text-stone-500 text-lg leading-relaxed">
                            Get the output of a $2,500/mo SEO Agency for the price of a dinner. We don't just write 'blogs'—we build the Strategic Content Infrastructure your brand needs.
                        </p>
                    </div>
                </div>

                {/* Horizontal Pattern Bar Top (Grid Boundary) */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                </div>

                {/* Premium Wireframe Grid */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 border-x border-stone-200  relative">

                    {/* Main Grid Corners */}
                    <CornerSquare className="-left-[5px] -top-[5px]" />
                    <CornerSquare className="-right-[5px] -top-[5px]" />
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />

                    {/* Junctions */}
                    <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>
                    <div className="hidden md:block absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>

                    {/* Left Side: Pricing & CTA */}
                    <div className="w-full border-b md:border-b-0 md:border-r border-stone-200 p-4 md:p-8 flex flex-col justify-center items-center text-center ">

                        <div className="mb-8">
                            <span className="inline-block px-3 py-1 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-widest mb-6 border border-stone-200 rounded-sm">
                                All In One
                            </span>
                            <h3 className="font-serif text-3xl md:text-4xl lg:text-5xl text-stone-900 leading-none">
                                The Authority Engine
                            </h3>
                        </div>

                        <div className="flex items-baseline justify-center gap-4 mb-2">
                            <span className="text-2xl text-stone-400 line-through decoration-stone-300 decoration-2">
                                $149
                            </span>
                            <span className="text-[80px] font-serif text-stone-900 tracking-tighter leading-none">
                                $79
                            </span>
                        </div>
                        <p className="text-stone-500 text-sm font-bold tracking-widest uppercase mb-12">per month</p>


                        <div className="flex flex-col items-center w-full max-w-sm">
                            <Link href="/login" className="w-full">
                                <Button variant="primary" className="w-full px-10 py-5 text-lg">
                                    Deploy My Content Engine
                                </Button>
                            </Link>

                            <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                <ShieldCheck size={14} className="text-stone-400" />
                                14-day money-back guarantee
                            </div>
                        </div>

                    </div>

                    {/* Right Side: Features */}
                    <div className="w-full p-4 md:p-8 border-b border-stone-200 bg-stone-50/50">
                        <h3 className="font-sans text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-8 border-b border-stone-100 pb-4 inline-block w-full">
                            Included Powerhouse Access
                        </h3>
                        <div className="space-y-8 mt-4">
                            <FeatureItem
                                icon={Bot}
                                title="30 Citation-Optimized Authority Articles"
                                description="Generated and published on auto-pilot. High quality, human-like output that passes AI detection."
                            />
                            <FeatureItem
                                icon={Zap}
                                title="Competitor Research & Gap-Analysis"
                                description="Hands-free planning based on competitor gaps and real-time search intent analysis."
                            />
                            <FeatureItem
                                icon={Target}
                                title="The GSC Strategic Action Board"
                                description="While we handle the complex math in the background, you get clear, actionable directives to fix cannibalization and reverse traffic decay."
                            />
                            <FeatureItem
                                icon={Link2}
                                title="Semantic Internal Linking"
                                description="Powerful semantic suggestions to boost site structure and topical authority."
                            />
                            <FeatureItem
                                icon={ShieldCheck}
                                title="Google and LLM-Ready Structure"
                                description="Answer-first content optimized for Perplexity, ChatGPT, and Google featured snippets."
                            />
                            <FeatureItem
                                icon={Globe}
                                title="1-Click CMS Publishing"
                                description="Connects directly with WordPress, Webflow, and Shopify. We handle the formatting."
                            />
                            <FeatureItem
                                icon={ImageIcon}
                                title="On-Brand AI Images"
                                description="Visuals generated to match your brand's unique style automatically for every post." />
                        </div>
                    </div>

                </div>

                {/* Horizontal Pattern Bar Bottom (Grid Boundary) */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -top-[5px]" />
                    <CornerSquare className="-right-[5px] -top-[5px]" />
                </div>

            </div>
        </section>
    );
};

export default PricingSection;
