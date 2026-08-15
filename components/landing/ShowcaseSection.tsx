import React from 'react';
import { ArrowUpRight, Rocket, Image as ImageIcon, Zap, Camera, Globe } from 'lucide-react';
import Button from './Button';

const EXAMPLES = [
    {
        domain: 'launchdirectories.com',
        icon: Rocket,
        title: 'How to Promote Your Chrome Extension Online',
    },
    {
        domain: 'bringback.pro',
        icon: ImageIcon,
        title: 'Can You Animate Photos of Deceased Relatives Safely?',
    },
    {
        domain: 'flipaeo.com',
        icon: Zap,
        title: 'The Complete Guide to AI SEO & AEO in 2026',
    },
    {
        domain: 'unrealshot.com',
        icon: Camera,
        title: 'How to Use AI Headshots to Level Up Your Resume',
    },
];

interface ExampleCardProps {
    example: typeof EXAMPLES[0];
}

const ExampleCard: React.FC<ExampleCardProps> = ({ example }) => (
    <div className="w-full bg-brand-200 rounded-[20px] p-1.5 shadow-[inset_0_0_0_1px_#c4b5fd] group cursor-pointer transition-transform duration-300 hover:-translate-y-1">

        <div className="h-full bg-white rounded-[17px] p-8 flex flex-col justify-between border border-brand-100/50 relative overflow-hidden">

            {/* Top Row: Domain & Icon */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    {/* Monotone Brand Icon */}
                    <div className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-900 group-hover:bg-orange-50 group-hover:border-brand-100 group-hover:text-brand-600 transition-colors duration-300">
                        <example.icon size={20} strokeWidth={1.5} />
                    </div>
                    <span className="font-sans text-xs font-bold text-stone-900 tracking-wider uppercase border-b border-transparent group-hover:border-brand-200 transition-colors">
                        {example.domain}
                    </span>
                </div>

                {/* Arrow Icon */}
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-transparent group-hover:bg-stone-50 transition-colors text-stone-300 group-hover:text-stone-900">
                    <ArrowUpRight size={18} strokeWidth={2} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
            </div>

            {/* Middle: Title */}
            <div className="mb-8 relative z-10">
                <h3 className="font-serif text-2xl md:text-3xl text-stone-900 leading-tight group-hover:text-brand-600 transition-colors duration-300">
                    {example.title}
                </h3>
            </div>

            {/* Bottom: 'Read Article' Indicator */}
            <div className="mt-auto pt-6 border-t border-stone-100 flex items-center gap-2">
                <div className="h-px w-4 bg-stone-300 group-hover:w-8 group-hover:bg-brand-400 transition-all duration-300"></div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest group-hover:text-stone-900 transition-colors">
                    Read Article
                </span>
            </div>

        </div>
    </div>
);

const ShowcaseSection: React.FC = () => {
    return (
        <section className="w-full max-w-5xl mx-auto px-6 py-20 md:py-24">

            {/* Section Header */}
            <div className="flex flex-col items-center text-center mb-16">

                <h2 className="font-serif text-4xl md:text-6xl text-stone-900 mb-6 tracking-tight font-normal">
                    See real examples of blogs  <br /><span className='italic'>written by our AI</span>
                </h2>

                <p className="font-sans text-stone-500 text-lg leading-relaxed max-w-2xl">
                    See what our AI writes when you're not looking. Full articles published on real domains, completely untouched by human editors.
                </p>
            </div>

            {/* The Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                {EXAMPLES.map((example, index) => (
                    <ExampleCard key={index} example={example} />
                ))}
            </div>


            {/* CTA */}
            <div className="flex justify-center">
                <Button variant="primary" className="px-10 py-4 text-lg">
                    Start Creating Content Like This
                </Button>
            </div>

        </section>
    );
};

export default ShowcaseSection;