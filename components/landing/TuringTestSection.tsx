"use client";

import React, { useState } from 'react';
import { User, Bot, ThumbsDown, ThumbsUp, RefreshCw, Cpu, Fingerprint } from 'lucide-react';

const TuringTestSection = () => {
    const [activeTab, setActiveTab] = useState<'standard' | 'flipaeo'>('standard');

    return (
        <section className="py-24 bg-paper border-b border-ink relative overflow-hidden">

            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px] opacity-5 pointer-events-none"></div>

            <div className="max-w-6xl mx-auto px-4 relative z-10">

                <div className="text-center mb-16">
                    <h2 className="font-serif text-5xl md:text-6xl text-ink leading-[0.9] mb-6">
                        Pass the Reader's <br /> <span className="italic text-signal">Turing Test.</span>
                    </h2>
                    <p className="font-mono text-sm text-ink/70 leading-relaxed max-w-xl mx-auto">
                        Can you tell the difference? Neither can your customers. But they can <span className="italic">feel</span> it.
                    </p>
                </div>

                {/* The Turing Test Interface */}
                <div className="flex flex-col md:flex-row gap-8 items-stretch">

                    {/* OPTION A: STANDARD AI */}
                    <div className="flex-1 bg-white border border-ink shadow-brutalist relative group overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gray-200"></div>

                        {/* Header */}
                        <div className="p-6 border-b border-ink/10 bg-gray-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white border border-ink/10 rounded-sm">
                                    <Bot size={18} className="text-ink/60" />
                                </div>
                                <div className="font-mono text-xs font-bold uppercase text-ink/50">Standard LLM (GPT-4)</div>
                            </div>
                            <div className="px-2 py-0.5 bg-red-50 text-red-500 border border-red-100 text-[10px] font-mono font-bold rounded-sm">
                                DETECTED
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8">
                            <p className="font-serif text-xl text-ink/60 leading-relaxed italic mb-6">
                                "In today's rapidly evolving digital landscape, content is king. Businesses must leverage strategic frameworks to optimize their synergy and drive robust growth..."
                            </p>

                            {/* Analysis Footer */}
                            <div className="pt-6 border-t border-ink/5 space-y-3">
                                <div className="flex justify-between items-center text-xs font-mono text-ink/40">
                                    <span>BOREDOM_SCORE</span>
                                    <span className="text-red-500 font-bold">99%</span>
                                </div>
                                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="w-[99%] h-full bg-red-500"></div>
                                </div>
                                <div className="flex items-center gap-2 text-red-500 text-xs font-bold mt-2">
                                    <ThumbsDown size={14} /> <span>Verdict: IGNORED</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* VS BADGE */}
                    <div className="hidden md:flex items-center justify-center -mx-4 z-20">
                        <div className="w-12 h-12 bg-ink text-white rounded-full flex items-center justify-center font-bold font-mono border-4 border-paper">
                            VS
                        </div>
                    </div>


                    {/* OPTION B: FLIPAEO */}
                    <div className="flex-1 bg-white border border-ink shadow-brutalist relative group overflow-hidden scale-105 z-10 ring-4 ring-signal/10">
                        <div className="absolute top-0 left-0 w-full h-1 bg-signal"></div>

                        {/* Header */}
                        <div className="p-6 border-b border-ink/10 bg-cream flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-ink text-white border border-ink rounded-sm">
                                    <Fingerprint size={18} />
                                </div>
                                <div className="font-mono text-xs font-bold uppercase text-ink">FlipAEO Engine</div>
                            </div>
                            <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-mono font-bold rounded-sm flex items-center gap-1">
                                <Cpu size={10} /> HUMAN_LIKE
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8">
                            <p className="font-serif text-xl text-ink leading-relaxed mb-6">
                                "Content isn't about volume anymore; it's about <span className="bg-signal/10 text-signal px-1 font-semibold">signal</span>. If you aren't visible in the citation layer of Perplexity, you effectively don't exist."
                            </p>

                            {/* Analysis Footer */}
                            <div className="pt-6 border-t border-ink/5 space-y-3">
                                <div className="flex justify-between items-center text-xs font-mono text-ink/40">
                                    <span>HUMANITY_SCORE</span>
                                    <span className="text-emerald-500 font-bold">98%</span>
                                </div>
                                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="w-[98%] h-full bg-emerald-500"></div>
                                </div>
                                <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold mt-2">
                                    <ThumbsUp size={14} /> <span>Verdict: ENGAGED</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default TuringTestSection;
