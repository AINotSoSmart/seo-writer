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
 * Every tier buys the identical six clusters. `clustersPerMonth` must divide 6
 * exactly so the subscription ends on a whole billing period — see
 * config/product-truth.ts. Per-cluster price is shown, never charged: billing
 * is a plain fixed monthly subscription.
 */
const TIERS = [
    {
        name: 'Close',
        price: 249,
        perMonth: '1 cluster a month',
        payments: 6,
        total: 1494,
        perCluster: '$249',
        note: 'Smallest monthly commitment. Stop after any cluster.',
        featured: false,
    },
    {
        name: 'Accelerate',
        price: 449,
        perMonth: '2 clusters a month',
        payments: 3,
        total: 1347,
        perCluster: '$224.50',
        note: 'Half the wait, and cheaper overall than Close.',
        featured: true,
    },
    {
        name: 'Dominate',
        price: 599,
        perMonth: '3 clusters a month',
        payments: 2,
        total: 1198,
        perCluster: '$199.67',
        note: 'Lowest total cost. Biggest monthly cheque.',
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
                            Everyone gets six clusters.  <br /><span className='italic text-stone-500'>You choose how fast.</span>
                        </h2>
                    </div>
                    <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
                        <p className="font-sans text-stone-500 text-lg leading-relaxed">
                            The tiers below change one thing: delivery speed. The work is identical, the total is fixed, and you see your exact article count in the free audit before you pay anything.
                        </p>
                    </div>
                </div>

                {/* --- The three facts that remove all the confusion --- */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 border-x border-b border-stone-200 relative bg-stone-50/50">
                    <div className="hidden md:block absolute top-0 left-[33.33%] -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>
                    <div className="hidden md:block absolute top-0 left-[66.66%] -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>

                    <div className="p-4 md:p-8 md:border-r border-b md:border-b-0 border-stone-200">
                        <span className="font-sans text-[10px] font-bold text-brand-500 uppercase tracking-widest">What you buy</span>
                        <p className="font-serif text-2xl text-stone-900 mt-3 mb-2">6 clusters</p>
                        <p className="text-sm text-stone-500 leading-relaxed">
                            A cluster is a pillar article plus its supporting articles, all interlinked. Every tier delivers the same six.
                        </p>
                    </div>
                    <div className="p-4 md:p-8 md:border-r border-b md:border-b-0 border-stone-200">
                        <span className="font-sans text-[10px] font-bold text-brand-500 uppercase tracking-widest">How many articles</span>
                        <p className="font-serif text-2xl text-stone-900 mt-3 mb-2">48&ndash;90</p>
                        <p className="text-sm text-stone-500 leading-relaxed">
                            Between 8 and 15 per cluster, decided by what your niche actually contains. Your free audit shows the exact number per cluster before you pay.
                        </p>
                    </div>
                    <div className="p-4 md:p-8">
                        <span className="font-sans text-[10px] font-bold text-brand-500 uppercase tracking-widest">When it ends</span>
                        <p className="font-serif text-2xl text-stone-900 mt-3 mb-2">After cluster 6</p>
                        <p className="text-sm text-stone-500 leading-relaxed">
                            The subscription cancels itself. There is no seventh payment, and nothing to remember to switch off.
                        </p>
                    </div>
                </div>

                {/* Horizontal Pattern Bar Top (Tier Grid Boundary) */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200 mt-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                </div>

                {/* Tier Row */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 border-x border-stone-200 relative">

                    <CornerSquare className="-left-[5px] -top-[5px]" />
                    <CornerSquare className="-right-[5px] -top-[5px]" />

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
                            className={`flex flex-col p-4 md:p-8 border-b border-stone-200 transition-colors ${index < TIERS.length - 1 ? 'md:border-r' : ''} ${tier.featured ? 'bg-stone-50/70' : 'hover:bg-stone-50/50'}`}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <span className={`inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest border rounded-sm ${tier.featured ? 'bg-brand-50 text-brand-600 border-brand-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                                    {tier.name}
                                </span>
                                {tier.featured && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
                                        Most chosen
                                    </span>
                                )}
                            </div>

                            {/* The number they actually pay, up front */}
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[54px] font-serif text-stone-900 tracking-tighter leading-none">
                                    ${tier.price}
                                </span>
                                <span className="text-stone-400 text-sm">/month</span>
                            </div>
                            <p className="text-stone-500 text-[11px] font-bold tracking-widest uppercase mb-6">
                                {tier.perMonth}
                            </p>

                            {/* Plain-English maths so nobody has to do it themselves */}
                            <div className="border-t border-stone-200 pt-4 space-y-2 text-sm mb-6">
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Payments</span>
                                    <span className="text-stone-900 font-medium">{tier.payments} &times; ${tier.price}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Total you pay</span>
                                    <span className="font-serif text-lg text-stone-900">${tier.total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Works out at</span>
                                    <span className="text-stone-900 font-medium">{tier.perCluster} / cluster</span>
                                </div>
                            </div>

                            <p className="font-sans text-sm text-stone-500 leading-relaxed mb-8">
                                {tier.note}
                            </p>

                            <div className="mt-auto">
                                <Link href="/login" className="w-full block">
                                    <Button
                                        variant={tier.featured ? 'primary' : 'secondary'}
                                        className="w-full px-6 py-3.5"
                                    >
                                        Start with the free audit
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Shared inclusions */}
                <div className="w-full border-x border-b border-stone-200 bg-stone-50/50 p-4 md:p-8 relative">
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />

                    <h3 className="font-sans text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-8 border-b border-stone-200 pb-4 inline-block w-full">
                        Included in every tier
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7">
                        <FeatureItem
                            icon={Bot}
                            title="The same six clusters, whichever tier"
                            description="Paying more never buys more articles. It buys them sooner, at a lower price per cluster. Your scope is fixed before the first payment."
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
                            description="Articles in a cluster are linked to each other before delivery, and we verify every link resolves. Nothing ships with dead references."
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
                            description="Every article arrives with visuals in your style, so a cluster is ready to review rather than ready to start."
                        />
                        <FeatureItem
                            icon={ShieldCheck}
                            title="We turn down bad fits"
                            description="If your audit cannot fill six real clusters, checkout stays closed and we tell you why. A no today is cheaper than a refund in month two."
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
