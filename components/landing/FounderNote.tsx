"use client";

import Button from './Button';
import { Quote } from 'lucide-react';
import Link from 'next/link';
import { CornerSquare } from './CornerSquare';

export default function FounderNote() {
    return (
        <section className="w-full py-24 relative z-10">
            <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

                {/* Horizontal Pattern Bar Above Header */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200 mb-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                </div>

                {/* Header - Left/Right Premium Setup */}
                <div className="flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end mb-16 w-full px-4 md:px-8">
                    <div className="flex-1">
                        <span className="font-sans text-xs font-bold tracking-widest text-brand-500 uppercase mb-4 block">
                            The Audit Is On Me
                        </span>
                        <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1]">
                            See the evidence  <br /><span className='italic text-stone-500'>before you pay.</span>
                        </h2>
                    </div>
                    <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
                        <p className="font-sans text-stone-500 text-lg leading-relaxed">
                            The initial audit is free for a reason: you should be able to inspect the opportunity and verify its sources before I ask you to buy the delivery program.
                        </p>
                    </div>
                </div>

                {/* Horizontal Pattern Bar Top (Grid Boundary) */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                </div>

                {/* Premium Wireframe Monolithic Letter Block */}
                <div className="w-full border-x border-stone-200 bg-stone-50/30 p-4 md:p-8 relative flex justify-center">

                    {/* Main Grid Corners */}
                    <CornerSquare className="-left-[5px] -top-[5px]" />
                    <CornerSquare className="-right-[5px] -top-[5px]" />
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />

                    {/* Watermark Icon */}
                    <div className="absolute top-12 left-12 opacity-[0.03] pointer-events-none">
                        <Quote size={200} className="text-stone-900" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center text-center max-w-4xl w-full">

                        {/* The Message */}
                        <blockquote className="mb-20">
                            <p className="font-serif text-3xl md:text-5xl lg:text-[54px] leading-[1.2] text-stone-900 mb-8 tracking-tight">
                                "Your full evidence audit is on me. I want you to see every source-linked content gap before I ask you to pay."
                            </p>
                            <p className="font-serif text-xl md:text-2xl leading-relaxed text-stone-500 italic">
                                "If six clusters qualify, you choose how quickly we deliver them. If they do not, checkout stays closed."
                            </p>
                        </blockquote>

                        {/* Signature Block */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-16 w-full border-t border-stone-200 pt-16">

                            {/* Author Info */}
                            <div className="flex items-center gap-6 text-left">
                                {/* Avatar */}
                                <div className="relative w-16 h-16">
                                    <div className="absolute inset-0 bg-stone-200 rounded-full animate-pulse"></div>
                                    <img
                                        src="/founder.webp"
                                        alt="Harvansh"
                                        className="w-full h-full object-cover rounded-full border border-stone-200 shadow-sm relative z-10"
                                    />
                                    {/* Verified Check */}
                                    <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full z-20 shadow-sm border border-stone-100">
                                        <div className="bg-brand-500 rounded-full p-0.5">
                                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    <div className="font-serif text-2xl text-stone-900 leading-none mb-2">
                                        Harvansh
                                    </div>
                                    <div className="font-sans text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                        Founder of FlipAEO
                                    </div>
                                </div>
                            </div>

                            {/* Divider & Signature (Desktop) */}
                            <div className="hidden md:flex items-center gap-8">
                                <div className="h-12 w-px bg-stone-200"></div>
                                {/* Handwriting Signature */}
                                <div className="font-hand text-5xl text-stone-400 -rotate-[4deg] transform translate-y-2 opacity-80">
                                    Harvansh
                                </div>
                            </div>

                            {/* CTA Action */}
                            <div className="flex flex-col items-center md:items-end gap-3">
                                <Link href="/login?next=/onboarding">
                                    <Button
                                        variant="primary"
                                        className="px-8 py-3.5 text-sm"
                                    >
                                        Find My Content Gaps
                                    </Button>
                                </Link>
                                <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest text-center">
                                    Full audit, free &middot; no credit card
                                </p>
                            </div>

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

