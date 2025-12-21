
import React from 'react';
import { Button } from './Button';
import Link from 'next/link';
import { Bot, Zap, Globe, Image as ImageIcon, Link as LinkIcon, Sparkles } from 'lucide-react';

export const PricingSection: React.FC = () => {
    return (
        <section className="w-full py-24 px-4 flex flex-col items-center relative overflow-hidden" id="pricing">

            {/* Background Decorative Elements */}
            <div className="absolute top-1/2 -left-12 w-64 h-64 bg-brand-yellow rounded-full border-2 border-black opacity-10 blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-12 -right-12 w-80 h-80 bg-brand-orange rounded-full border-2 border-black opacity-10 blur-3xl pointer-events-none"></div>

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-16 max-w-3xl relative z-10">
                <div className="inline-block bg-black text-white border-2 border-black shadow-neo-sm px-4 py-1.5 mb-6 transform -rotate-2 hover:rotate-0 transition-transform">
                    <span className="font-display font-bold text-xs uppercase tracking-widest">Simple Pricing</span>
                </div>
                <h2 className="font-display text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black text-5xl md:text-7xl leading-[0.9] mb-6 uppercase">
                    One Plan.<br />Unlimited Potential.
                </h2>
                <p className="font-sans text-gray-600 text-lg md:text-xl leading-relaxed max-w-2xl">
                    Everything you need to turn search into your biggest growth channel. No hidden fees. No complicated tiers.
                </p>
            </div>

            {/* The Master Card */}
            <div className="w-full max-w-5xl relative z-10">

                {/* Card Container */}
                <div className="bg-white border-2 md:border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] flex flex-col lg:flex-row relative">

                    {/* Absolute Badge for Launch */}
                    <div className="absolute -top-5 -right-2 md:-right-4 z-20">
                        <div className="bg-[#FF5F57] text-white border-2 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform rotate-3 flex flex-col items-center animate-in slide-in-from-top-4 fade-in duration-700">
                            <span className="font-display font-black text-lg uppercase leading-none">Launch Offer</span>
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Limited Time</span>
                        </div>
                    </div>

                    {/* Left Side: The Offer */}
                    <div className="w-full lg:w-[40%] bg-[#FAFA9D] border-b-2 lg:border-b-0 lg:border-r-2 md:border-r-4 border-black p-8 md:p-12 flex flex-col relative overflow-hidden">
                        {/* Texture Overlay */}
                        <div className="absolute inset-0 bg-dot-pattern opacity-10 pointer-events-none"></div>

                        <div className="relative z-10 flex-grow flex flex-col justify-center">
                            <h3 className="font-display font-black text-4xl md:text-5xl mb-2 uppercase">All in One</h3>
                            <p className="font-sans font-bold text-black/60 mb-10 text-lg">For ambitious entrepreneurs</p>

                            <div className="mb-10 p-6 bg-white border-2 border-black shadow-neo-sm rounded-xl relative">
                                <div className="absolute -top-3 -left-3">
                                    <Sparkles className="w-8 h-8 text-black fill-brand-orange" />
                                </div>
                                <div className="flex flex-col items-center text-center">
                                    <span className="font-sans font-bold text-gray-400 line-through text-lg decoration-2 decoration-red-500 mb-1">$79 original price</span>
                                    <div className="flex items-start gap-1">
                                        <span className="font-sans font-bold text-2xl mt-2">$</span>
                                        <span className="font-display font-black text-7xl md:text-8xl tracking-tighter leading-none">59</span>
                                    </div>
                                    <span className="font-sans font-bold text-black/40 text-sm uppercase tracking-wider mt-2">Per Month</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 mt-auto">
                            <Link href="/subscribe">
                                <Button fullWidth variant="primary" size="lg" className="h-16 text-xl border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-black hover:bg-gray-800">
                                    Win The AEO RACE
                                </Button>
                            </Link>
                            <p className="text-center font-sans text-xs font-bold mt-4 opacity-50 uppercase tracking-wide">14-day money-back guarantee</p>
                        </div>
                    </div>

                    {/* Right Side: Features */}
                    <div className="w-full lg:w-[60%] p-8 md:p-12 bg-white flex flex-col justify-center relative">

                        {/* Decorative Window Controls */}
                        <div className="absolute top-4 right-4 flex gap-2">
                            <div className="w-3 h-3 rounded-full border-2 border-black bg-white"></div>
                            <div className="w-3 h-3 rounded-full border-2 border-black bg-white"></div>
                        </div>

                        <h4 className="font-display font-black text-2xl uppercase mb-10 flex items-center gap-3">
                            <span className="bg-black text-white px-2 py-0.5 text-lg">Included</span>
                            <span>Powerhouse Access</span>
                        </h4>

                        <div className="space-y-6">
                            <FeatureRow
                                icon={<Bot className="w-6 h-6" />}
                                title="30 Articles / Month"
                                description="Generated and published on auto-pilot. High quality, human-like output."
                            />
                            <FeatureRow
                                icon={<Zap className="w-6 h-6" />}
                                title="Auto Content Strategy"
                                description="Hands-free planning based on competitor gaps and search intent."
                            />
                            <FeatureRow
                                icon={<Globe className="w-6 h-6" />}
                                title="CMS Integration"
                                description="Connects directly with WordPress, Webflow, and Shopify on the go."
                            />
                            <FeatureRow
                                icon={<ImageIcon className="w-6 h-6" />}
                                title="On-Brand AI Images"
                                description="Visuals generated to match your brand's unique style automatically."
                            />
                            <FeatureRow
                                icon={<LinkIcon className="w-6 h-6" />}
                                title="Smart Interlinking"
                                description="Powerful suggestions to boost site structure and authority."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

interface FeatureRowProps {
    icon: React.ReactElement<{ className?: string }>;
    title: string;
    description: string;
}

const FeatureRow: React.FC<FeatureRowProps> = ({ icon, title, description }) => (
    <div className="flex items-start gap-5 group">
        <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center flex-shrink-0 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] group-hover:bg-[#D6F5F2] group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
            {React.cloneElement(icon, { className: "w-6 h-6 text-black stroke-[2px]" })}
        </div>
        <div>
            <h5 className="font-display font-bold text-lg uppercase leading-none mb-2 pt-1">{title}</h5>
            <p className="font-sans text-gray-600 text-sm font-medium leading-relaxed max-w-sm">{description}</p>
        </div>
    </div>
);
