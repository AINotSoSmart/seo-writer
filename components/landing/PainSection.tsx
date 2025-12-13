import React from 'react';
import { EyeOff, Activity, Target, AlertTriangle, FileWarning, SearchX } from 'lucide-react';

const PainSection = () => {
    return (
        <section className="py-24 md:py-32 bg-cream relative overflow-hidden border-b border-ink">
            {/* Subtle background noise/grid inherited from body, adding a specific accent here */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-signal/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">

                {/* Section Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-20 border-l-2 border-signal pl-6 md:pl-8">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal flex items-center gap-2">
                                <AlertTriangle size={14} />
                                Market Audit
                            </span>
                            <span className="h-px w-12 bg-signal/30"></span>
                        </div>
                        <h2 className="font-serif text-5xl md:text-6xl font-medium leading-[0.95] text-ink mb-6">
                            One-click AI content is <br />
                            <span className="italic relative inline-block z-10">
                                quietly killing
                                <span className="absolute bottom-2 left-0 w-full h-3 bg-signal/20 -z-10 -rotate-1"></span>
                            </span> your growth.
                        </h2>
                    </div>
                    <div className="max-w-sm">
                        <p className="font-mono text-xs md:text-sm text-ink/70 leading-relaxed border-t border-ink/10 pt-4">
                            You’re publishing more than ever, yet traffic stays flat. Modern search engines can tell the difference between real answers and mass-produced content.
                        </p>
                    </div>
                </div>

                {/* The 3 Silent Killers - Contiguous Grid Layout */}
                <div className="w-full border border-ink bg-white shadow-brutalist flex flex-col md:flex-row">

                    {/* CARD 1: Invisibility */}
                    <div className="group flex-1 border-b md:border-b-0 md:border-r border-ink p-8 hover:bg-paper transition-colors relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <SearchX size={120} />
                        </div>

                        <div className="flex justify-between items-start mb-12">
                            <div className="font-mono text-[10px] uppercase tracking-widest border border-ink/20 px-2 py-1 bg-white text-ink/50">
                                Error_001
                            </div>
                            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink group-hover:bg-signal group-hover:text-white transition-colors">
                                <EyeOff size={16} />
                            </div>
                        </div>

                        <h3 className="font-serif text-2xl font-bold mb-3 pr-8">AI search ignores you</h3>
                        <p className="font-mono text-xs leading-relaxed text-ink/60 mb-6">
                            You write 100 blogs, but ChatGPT and Claude don’t know who you are. When founders search for your category, the AI recommends your competitors.
                        </p>

                        <div className="mt-auto inline-flex items-center gap-2 text-[10px] font-mono font-bold text-red-600 bg-red-50 px-2 py-1 border border-red-100">
                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                            NOT IN TRAINING DATA
                        </div>
                    </div>

                    {/* CARD 2: Beige Trap */}
                    <div className="group flex-1 border-b md:border-b-0 md:border-r border-ink p-8 hover:bg-paper transition-colors relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <FileWarning size={120} />
                        </div>

                        <div className="flex justify-between items-start mb-12">
                            <div className="font-mono text-[10px] uppercase tracking-widest border border-ink/20 px-2 py-1 bg-white text-ink/50">
                                Error_002
                            </div>
                            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink group-hover:bg-signal group-hover:text-white transition-colors">
                                <Activity size={16} />
                            </div>
                        </div>

                        <h3 className="font-serif text-2xl font-bold mb-3">You sound like a bot</h3>
                        <p className="font-mono text-xs leading-relaxed text-ink/60 mb-6">
                            Google smells "Default GPT-4" content in 3 seconds. It has no brand voice, no unique data, and no soul. It doesn't build authority; it just adds to the noise.
                        </p>

                        <div className="mt-auto inline-flex items-center gap-2 text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-2 py-1 border border-orange-100">
                            <span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span>
                            FILTERED AS SPAM
                        </div>
                    </div>

                    {/* CARD 3: Blind Strategy */}
                    <div className="group flex-1 p-8 hover:bg-paper transition-colors relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Target size={120} />
                        </div>

                        <div className="flex justify-between items-start mb-12">
                            <div className="font-mono text-[10px] uppercase tracking-widest border border-ink/20 px-2 py-1 bg-white text-ink/50">
                                Error_003
                            </div>
                            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink group-hover:bg-signal group-hover:text-white transition-colors">
                                <Target size={16} />
                            </div>
                        </div>

                        <h3 className="font-serif text-2xl font-bold mb-3">Impressions but zero clicks</h3>
                        <p className="font-mono text-xs leading-relaxed text-ink/60 mb-6">
                            You are ranking for keywords that don't convert. Without GSC data dictating your roadmap, you are just guessing while competitors win the real answers.
                        </p>

                        <div className="mt-auto inline-flex items-center gap-2 text-[10px] font-mono font-bold text-ink/60 bg-gray-50 px-2 py-1 border border-gray-200">
                            <span className="w-1.5 h-1.5 bg-ink/40 rounded-full"></span>
                            ROI UNDEFINED
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default PainSection;