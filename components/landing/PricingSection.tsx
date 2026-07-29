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

/**
 * The three velocity tiers. Same six clusters in every one — only the delivery
 * speed differs, which is why the scope line is identical across all three.
 */
const TIERS = [
    {
        name: 'Close',
        price: '$249',
        cadence: 'One batch a month',
        finishes: 'Finishes in about 6 months',
        note: 'Steady pace for a single site.',
        featured: false,
    },
    {
        name: 'Accelerate',
        price: '$449',
        cadence: 'Two batches a month',
        finishes: 'Finishes in about 3 months',
        note: 'Most people pick this one.',
        featured: true,
    },
    {
        name: 'Dominate',
        price: '$799',
        cadence: 'Four batches a month',
        finishes: 'Finishes in about 2 months',
        note: 'When the calendar matters more than the spread.',
        featured: false,
    },
];

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
                            Same scope.  <br /><span className='italic text-stone-500'>Three speeds.</span>
                        </h2>
                    </div>
                    <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
                        <p className="font-sans text-stone-500 text-lg leading-relaxed">
                            Every tier delivers the same six batches — 25 to 90 articles, depending on what your audit finds. Paying more doesn&apos;t buy more articles, it buys them sooner. When the sixth batch lands, billing stops by itself.
                        </p>
                    </div>
                </div>

                {/* Horizontal Pattern Bar Top (Grid Boundary) */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                </div>

                {/* Tier Row — three columns in the same wireframe grid */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 border-x border-stone-200 relative">

                    {/* Main Grid Corners */}
                    <CornerSquare className="-left-[5px] -top-[5px]" />
                    <CornerSquare className="-right-[5px] -top-[5px]" />

                    {/* Junctions at the two vertical dividers */}
                    <div className="hidden md:block absolute top-0 left-[33.33%] -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>
                    <div className="hidden md:block absolute top-0 left-[66.66%] -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>
                    <div className="hidden md:block absolute bottom-0 left-[33.33%] -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>
                    <div className="hidden md:block absolute bottom-0 left-[66.66%] -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>

                    {TIERS.map((tier, index) => (
                        <div
                            key={tier.name}
                            className={`flex flex-col p-4 md:p-8 border-b border-stone-200 text-center transition-colors ${index < TIERS.length - 1 ? 'md:border-r' : ''} ${tier.featured ? 'bg-stone-50/70' : 'hover:bg-stone-50/50'}`}
                        >
                            <span className={`inline-block self-center px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-6 border rounded-sm ${tier.featured ? 'bg-brand-50 text-brand-600 border-brand-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                                {tier.name}
                            </span>

                            <div className="flex items-baseline justify-center gap-2 mb-1">
                                <span className="text-[56px] font-serif text-stone-900 tracking-tighter leading-none">
                                    {tier.price}
                                </span>
                                <span className="text-stone-400 text-sm">/mo</span>
                            </div>

                            <p className="text-stone-500 text-[11px] font-bold tracking-widest uppercase mb-6">
                                {tier.cadence}
                            </p>

                            <p className="font-serif text-lg text-stone-900 mb-2">
                                {tier.finishes}
                            </p>
                            <p className="font-sans text-sm text-stone-500 leading-relaxed mb-8">
                                {tier.note}
                            </p>

                            <div className="mt-auto">
                                <Link href="/login" className="w-full block">
                                    <Button
                                        variant={tier.featured ? 'primary' : 'secondary'}
                                        className="w-full px-6 py-3.5"
                                    >
                                        See my scope
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Shared inclusions — everything below applies to all three tiers */}
                <div className="w-full border-x border-b border-stone-200 bg-stone-50/50 p-4 md:p-8 relative">
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />

                    <h3 className="font-sans text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-8 border-b border-stone-200 pb-4 inline-block w-full">
                        Included in every tier
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">
                        <FeatureItem
                            icon={Bot}
                            title="Six complete batches, then it ends"
                            description="Your scope is fixed before you pay. Faster tiers deliver the same six batches sooner, they do not add work. When the last one lands, billing stops on its own."
                        />
                        <FeatureItem
                            icon={Zap}
                            title="A gap list you can fact-check"
                            description="Every topic links to the page or search where we found it, plus the competitor pages already answering it. Click any row and verify it yourself."
                        />
                        <FeatureItem
                            icon={Target}
                            title="Coverage checked against your live pages"
                            description="We read what you have already published and only propose what is genuinely missing. You will not be sold an article you effectively already own."
                        />
                        <FeatureItem
                            icon={Link2}
                            title="Internal links that work on arrival"
                            description="Articles in a batch are linked to each other before delivery, and we verify every link resolves. Nothing ships with dead references."
                        />
                        <FeatureItem
                            icon={ShieldCheck}
                            title="Clear structure for readers and machines"
                            description="Answer-first sections, tables where data belongs, and clean headings. We format for comprehension; we do not promise rankings or citations."
                        />
                        <FeatureItem
                            icon={Globe}
                            title="Publish to WordPress or export"
                            description="Push drafts straight to WordPress, or export and take them anywhere. No plugin on your server and no lock-in."
                        />
                        <FeatureItem
                            icon={ImageIcon}
                            title="Images matched to your brand"
                            description="Every article arrives with visuals in your style, so a batch is ready to review rather than ready to start."
                        />
                        <FeatureItem
                            icon={ShieldCheck}
                            title="We turn down bad fits"
                            description="If your audit cannot fill six real batches, checkout stays closed and we tell you why. A no today is cheaper than a refund in month two."
                        />
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
