"use client"

import React from 'react';
import Image from 'next/image';
import { CornerSquare } from './CornerSquare';

const PROOF_POINTS = [
    {
        title: "1,300% Organic Growth",
        description: "We started from zero. In 90-100 days, we reached 1.3k+ consistent monthly clicks without spending a dollar on ads.",
        image: "/case-study/proof-1.webp",
        alt: "Google Search Console performance graph showing 1,300% growth in organic clicks for BringBack.pro over 90 days",
        span: "md:col-span-2"
    },
    {
        title: "Ranking on Google page #1",
        description: "We don't just write; we rank. FlipAEO content is outranking major competitors for high-volume, high-intent keywords.",
        image: "/case-study/proof-2.webp",
        alt: "Google Rankings showing BringBack.pro claiming the #1 spot for high-intent keywords like 'combine photos', outranking major competitors",
        align: "object-top",
        span: "md:col-span-2"
    },
    {
        title: "Real AI Traffic",
        description: "The proof is in the data. See ChatGPT referral traffic driving real, high-intent users directly to our site.",
        image: "/case-study/proof-3.webp",
        alt: "Google Analytics data proving significant referral traffic coming directly from ChatGPT to BringBack.pro",
        span: "md:col-span-2"
    },
    {
        title: "Cited by Gemini",
        description: "Not just ChatGPT. Google's own AI model, Gemini, puts BringBack in the Top recommendation when we asked a natural user query.",
        image: "/case-study/proof-4.webp",
        alt: "Google Gemini AI response recommending BringBack.pro as the 'Best All-Around AI Tool' for photo restoration in response to a user query",
        align: "object-top",
        span: "md:col-span-3"
    },
    {
        title: "Cited by ChatGPT ",
        description: "The ultimate proof of quality: ChatGPT mentions bringback ai in their answers to user.",
        image: "/case-study/proof-5.webp",
        alt: "ChatGPT conversation citing BringBack.pro as a verified source in its answer to a user query about photo tools",
        align: "object-top",
        span: "md:col-span-3"
    }
];

export const AICitations: React.FC = () => {
    return (
        <section className="w-full pt-24 relative z-10">

            <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">
                {/* Horizontal separator from Hero */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200 mb-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>

                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end mb-16 w-full px-4 md:px-8">
                    {/* Left: Badge & Title */}
                    <div className="flex-1">
                        <span className="font-sans text-xs font-bold tracking-widest text-stone-400 uppercase mb-4 block">
                            Live Case Study
                        </span>
                        <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1]">
                            We Drink Our<br /><span className='italic text-stone-500'>Own Champagne</span>
                        </h2>
                    </div>

                    {/* Right: Description */}
                    <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
                        <p className="font-sans text-stone-500 text-lg leading-relaxed">
                            We didn’t just build a tool - we proved it. We used FlipAEO to <span className="text-stone-900 font-medium">scale</span> our own SaaS, <a href="https://bringback.pro" target="_blank" className="text-stone-900 font-medium underline decoration-stone-300 hover:decoration-stone-900 transition-all">BringBack.pro</a>, from zero to market leader. No ads, no backlinks - just pure, high-intent authority.
                        </p>
                    </div>
                </div>

                {/* Horizontal Pattern Bar Top */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                    <div className="hidden md:block absolute bottom-0 left-[33.33%] -translate-x-1/2 translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>
                    <div className="hidden md:block absolute bottom-0 left-[66.66%] -translate-x-1/2 translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>
                </div>

                {/* Grid - Border-Only Seamless Style */}
                <div className="grid grid-cols-1 md:grid-cols-6 border-l border-r border-stone-200 relative">


                    {PROOF_POINTS.map((item, i) => (
                        <div key={i} className={`flex flex-col group border-b border-stone-200 ${item.span || "md:col-span-2"} ${i === 2 || i === 4 ? '' : 'md:border-r'} relative`}>

                            {/* Corner Markers for dynamic intersections */}
                            {i === 0 && <CornerSquare className="-left-[5px] -bottom-[5px] hidden md:block" />} { /* Left Edge Mid */}
                            {i === 0 && <CornerSquare className="-right-[5px] -bottom-[5px] hidden md:block" />}
                            {i === 1 && <CornerSquare className="-right-[5px] -bottom-[5px] hidden md:block" />}
                            {i === 2 && <CornerSquare className="-right-[5px] -bottom-[5px] hidden md:block" />} { /* Right Edge Mid */}
                            {i === 3 && <CornerSquare className="-right-[5px] -top-[5px] hidden md:block" />}

                            {/* Image Container */}
                            <div className={`relative w-full aspect-[16/10] overflow-hidden`}>
                                <Image
                                    src={item.image}
                                    alt={item.alt || item.title}
                                    fill
                                    className={`object-contain ${item.align || "object-center"} transition-transform duration-700 group-hover:scale-[1.01]`}
                                />
                            </div>

                            {/* Content */}
                            <div className="space-y-3 p-6 md:p-10 mt-auto border-t border-stone-200">
                                <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-2 sm:gap-0">
                                    <h3 className="font-serif text-xl text-stone-900 tracking-tight">
                                        {item.title}
                                    </h3>

                                </div>
                                <p className="text-stone-500 leading-relaxed text-sm">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Horizontal Pattern Bar Bottom */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -top-[5px]" />
                    <CornerSquare className="-right-[5px] -top-[5px]" />
                    <div className="hidden md:block absolute top-0 left-[50%] -translate-x-1/2 -translate-y-1/2 z-30">
                        <CornerSquare className="-left-[4px] -top-[4px]" />
                    </div>
                </div>



            </div>
        </section>
    );
};
