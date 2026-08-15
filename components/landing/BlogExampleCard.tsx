import React from 'react';
import Link from 'next/link';

interface BlogExampleCardProps {
    title: string;
    category: string;
    imageSrc: string;
    href: string;
    className?: string;
}

const BlogExampleCard: React.FC<BlogExampleCardProps> = ({ title, category, imageSrc, href, className }) => {
    return (
        <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`relative block group cursor-pointer w-[300px] sm:w-[350px] flex-shrink-0 ${className}`}
        >
            {/* Container Aspect Ratio */}
            <div className="aspect-[4/3] w-full relative perspective-1000">

                {/* LAYER 1: Back Card (The Folder Back) */}
                <div className="absolute inset-0 bg-brand-50 rounded-[2rem] border border-brand-200 origin-bottom" />

                {/* IMAGE LAYER */}
                {/* Peeking out from the pocket */}
                <div className="absolute top-[8%] left-[6%] right-[6%] bottom-[20%] z-10 transition-all duration-700 ease-out group-hover:-translate-y-6 group-hover:scale-[1.02]">
                    <div className="w-full h-full rounded-xl overflow-hidden shadow-md bg-white border border-stone-100/50 relative">
                        <img
                            src={imageSrc}
                            alt={title}
                            className="w-full h-full object-cover object-top opacity-95 group-hover:opacity-100 transition-opacity"
                        />
                        {/* Glass Reflection Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none mix-blend-overlay"></div>
                    </div>
                </div>

                {/* LAYER 2: Front Folder Pocket */}
                <div className="absolute bottom-0 left-0 right-0 h-[48%] z-20 drop-shadow-xs transition-transform duration-500 ease-out group-hover:translate-y-2">

                    {/* The Tab Section - Sophisticated Envelope Shape */}
                    <div className="absolute -top-8 left-0 w-[42%] h-8 bg-brand-50 rounded-t-2xl border-t border-l border-white/60">
                        {/* The Curve Connector */}
                        <div className="absolute bottom-0 -right-6 w-6 h-6 text-brand-50">
                            <svg className="w-full h-full fill-current" viewBox="0 0 24 24" preserveAspectRatio="none">
                                <path d="M0,0 Q0,24 24,24 L0,24 Z" />
                            </svg>
                        </div>
                    </div>

                    {/* The Main Body of the Pocket */}
                    <div className="absolute inset-0 bg-brand-50 rounded-b-[2rem] rounded-tr-[2rem] border-b border-x border-white/60 p-6 flex flex-col justify-center items-start gap-2">

                        {/* Badge */}
                        <div className="relative mb-1">
                            <div className="absolute inset-0 bg-brand-200 blur-sm opacity-30 rounded-full"></div>
                            <div className="relative px-3 py-1 bg-gradient-to-b from-brand-50 to-brand-100 border border-brand-200/60 rounded-lg shadow-[0_1px_2px_rgba(251,146,60,0.1)]">
                                <span className="font-serif text-brand-700/90 italic font-medium text-xs">
                                    {category}
                                </span>
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="w-full">
                            <h3 className="font-serif text-xl sm:text-xl text-stone-800 tracking-tight  line-clamp-2">
                                {title}
                            </h3>
                        </div>

                    </div>
                </div>

            </div>
        </Link>
    );
};

export default BlogExampleCard;