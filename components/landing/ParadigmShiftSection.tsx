import React from 'react';
import { Search, X, CheckCircle2, Sparkles, FolderX, DatabaseZap, Globe, ArrowRight } from 'lucide-react';

const ParadigmShiftSection = () => {
    return (
        <section className="py-24 md:py-32 bg-cream relative overflow-hidden border-b border-ink">
            {/* Background Texture similar to PainSection */}
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">

                {/* Section Header - STRICT PAIN SECTION PATTERN */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-20 border-l-2 border-signal pl-6 md:pl-8">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal flex items-center gap-2">
                                <DatabaseZap size={14} />
                                System_Ultimatum
                            </span>
                            <span className="h-px w-12 bg-signal/30"></span>
                        </div>
                        <h2 className="font-serif text-5xl md:text-6xl font-medium leading-[0.95] text-ink mb-6">
                            The "Ten Blue Links" <br />
                            are <span className="italic relative inline-block z-10">
                                dead.
                                <span className="absolute bottom-2 left-0 w-full h-3 bg-signal/20 -z-10 -rotate-1"></span>
                            </span>
                        </h2>
                    </div>
                    <div className="max-w-sm">
                        <p className="font-mono text-xs md:text-sm text-ink/70 leading-relaxed border-t border-ink/10 pt-4">
                            In 2025, search volume for informational queries collapsed by 40%. Users aren't clicking links; they are asking Claude.
                        </p>
                    </div>
                </div>

                {/* Split Screen Comparison - PAIN SECTION GRID PATTERN */}
                <div className="w-full border border-ink bg-white shadow-brutalist flex flex-col md:flex-row">

                    {/* LEFT SIDE: THE OLD WAY (Deprecated) */}
                    <div className="group flex-1 border-b md:border-b-0 md:border-r border-ink p-8 md:p-12 hover:bg-paper transition-colors relative overflow-hidden bg-gray-50/50">
                        {/* Background Icon */}
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <FolderX size={120} />
                        </div>

                        <div className="flex justify-between items-start mb-12">
                            <div className="font-mono text-[10px] uppercase tracking-widest border border-ink/20 px-2 py-1 bg-white text-ink/50">
                                STRATEGY_DEPRECATED
                            </div>
                            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink group-hover:bg-red-500 group-hover:text-white transition-colors">
                                <X size={16} />
                            </div>
                        </div>

                        {/* Visual: The Google Result */}
                        <div className="bg-white border border-ink/20 p-6 shadow-sm mb-8 opacity-60 grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:opacity-100 relative">
                            {/* Overlay for "Deprecated" feel */}
                            <div className="absolute inset-0 bg-gray-200/20 pointer-events-none"></div>

                            {/* Fake Google Header */}
                            <div className="flex items-center gap-3 mb-4 border-b border-ink/5 pb-2">
                                <Search size={14} className="text-ink/30" />
                                <div className="h-1.5 w-24 bg-ink/10 rounded-sm"></div>
                            </div>

                            {/* Blue Link 1 */}
                            <div className="space-y-2 mb-4">
                                <div className="text-[10px] text-ink/30 mb-0.5 font-mono">www.yoursite.com › blog</div>
                                <div className="text-lg text-blue-900/60 font-serif leading-tight">Top 10 Ways To Do X (Updated)</div>
                                <div className="text-xs text-ink/40 leading-relaxed line-clamp-2">
                                    In this comprehensive guide, we will explore the top 10 ways to achieve your goals...
                                </div>
                            </div>
                        </div>

                        <h3 className="font-serif text-2xl font-bold mb-3 text-ink/60 group-hover:text-ink transition-colors">SEO (2010-2023)</h3>
                        <div className="space-y-3 font-mono text-xs text-ink/50 border-t border-ink/10 pt-4">
                            <div className="flex items-center gap-3 group/item">
                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                <span>Output: 2,000 word "fluff" pieces</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                <span>Goal: Rank for keywords</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                <span>Result: Buried on Page 2</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE: THE NEW WAY (Optimized) */}
                    <div className="group flex-1 p-8 md:p-12 bg-white hover:bg-cream transition-colors relative overflow-hidden">
                        {/* Signal Line */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-signal"></div>

                        {/* Background Icon */}
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Sparkles size={120} />
                        </div>

                        <div className="flex justify-between items-start mb-12">
                            <div className="font-mono text-[10px] uppercase tracking-widest border border-signal/20 px-2 py-1 bg-signal/5 text-signal font-bold">
                                ENTITY_LIVING
                            </div>
                            <div className="w-8 h-8 rounded-full bg-signal/10 flex items-center justify-center text-signal group-hover:bg-signal group-hover:text-white transition-colors">
                                <Sparkles size={16} />
                            </div>
                        </div>

                        {/* Visual: The AI Answer */}
                        <div className="bg-white border border-ink shadow-[4px_4px_0px_0px_#1a1a1a] p-6 mb-8 relative z-10 transition-transform duration-300 group-hover:-translate-y-1">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-5 h-5 rounded-sm bg-ink flex items-center justify-center text-white">
                                    <Sparkles size={10} />
                                </div>
                                <div className="font-mono text-[10px] font-bold text-ink uppercase tracking-wider">Answer Engine</div>
                            </div>
                            <div className="font-serif text-lg text-ink leading-relaxed mb-4">
                                "According to <span className="bg-signal/10 text-signal px-1 font-medium border-b border-signal/20">Your Brand</span>, the most effective method is..."
                            </div>

                            {/* Citations */}
                            <div className="flex gap-2 mt-4 pt-4 border-t border-ink/10">
                                <div className="px-2 py-1 border border-signal text-signal rounded-sm bg-white text-[9px] font-mono flex items-center gap-1 shadow-sm font-bold">
                                    <Globe size={10} /> 1. yourbrand.com
                                </div>
                                <div className="px-2 py-1 border border-ink/10 text-ink/40 rounded-sm bg-gray-50 text-[9px] font-mono flex items-center gap-1">
                                    <Globe size={10} /> 2. wikipedia.org
                                </div>
                            </div>
                        </div>

                        <h3 className="font-serif text-2xl font-bold mb-3 text-ink">AEO (The Future)</h3>
                        <div className="space-y-3 font-mono text-xs text-ink/80 border-t border-ink/10 pt-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 size={14} className="text-signal" />
                                <span>Output: Answer-Engine Ready formats</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle2 size={14} className="text-signal" />
                                <span>Goal: Own the "Entity Space"</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle2 size={14} className="text-signal" />
                                <span>Result: Cited in generate answer</span>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default ParadigmShiftSection;
