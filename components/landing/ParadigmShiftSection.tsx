import React from 'react';
import { Search, ArrowRight, X, CheckCircle2, Globe, Sparkles, AlertCircle } from 'lucide-react';

const ParadigmShiftSection = () => {
    return (
        <section className="py-24 bg-cream border-b border-ink relative overflow-hidden">
            {/* Background accents */}
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">

                {/* Section Header */}
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-ink/5 border border-ink/10 rounded-full mb-6">
                        <span className="w-2 h-2 rounded-full bg-signal animate-pulse"></span>
                        <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-ink/70">System_Ultimatum</span>
                    </div>
                    <h2 className="font-serif text-5xl md:text-6xl text-ink leading-[0.9] mb-6">
                        The "Ten Blue Links" <br /> are <span className="italic text-ink/40 line-through decoration-signal decoration-2">dead</span>.
                    </h2>
                    <p className="font-mono text-sm text-ink/70 leading-relaxed max-w-xl mx-auto">
                        In 2025, search volume for informational queries collapsed by 40%. Users aren't clicking links; they are asking Claude.
                    </p>
                </div>

                {/* Split Screen Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 border border-ink shadow-brutalist bg-white">

                    {/* LEFT SIDE: THE OLD WAY (Deprecated) */}
                    <div className="relative p-8 md:p-12 border-b md:border-b-0 md:border-r border-ink bg-gray-50/50 overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-ink/20"></div>
                        <div className="absolute inset-0 bg-ink/5 mix-blend-multiply opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                        {/* Status Badge */}
                        <div className="inline-flex items-center gap-2 mb-8 px-2 py-1 bg-gray-200 border border-ink/10 text-[10px] font-mono font-bold text-ink/50 uppercase tracking-wider">
                            <X size={12} /> Deprecated Strategy
                        </div>

                        {/* Visual: The Google Result */}
                        <div className="bg-white border border-ink/20 p-6 shadow-sm mb-8 opacity-70 grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:opacity-100">
                            {/* Fake Google Header */}
                            <div className="flex items-center gap-3 mb-4 border-b border-ink/5 pb-2">
                                <Search size={16} className="text-ink/40" />
                                <div className="h-2 w-24 bg-ink/10 rounded-full"></div>
                            </div>

                            {/* Blue Link 1 */}
                            <div className="space-y-2 mb-4">
                                <div className="text-xs text-ink/40 mb-1">www.yoursite.com › blog › keywor...</div>
                                <div className="text-lg text-blue-800 font-serif hover:underline decoration-blue-800/30">Top 10 Ways To Do X (Updated 2023)</div>
                                <div className="text-xs text-ink/60 leading-relaxed">
                                    In this comprehensive guide, we will explore the top 10 ways to...
                                </div>
                            </div>

                            {/* Blue Link 2 */}
                            <div className="space-y-2">
                                <div className="text-xs text-ink/40 mb-1">www.competitor.com › guides</div>
                                <div className="text-lg text-blue-800 font-serif hover:underline decoration-blue-800/30">The Ultimate Guide to X</div>
                                <div className="text-xs text-ink/60 leading-relaxed">
                                    Learn everything you need to know about X in this ultimate...
                                </div>
                            </div>
                        </div>

                        <h3 className="font-serif text-3xl font-bold text-ink/40 mb-4 group-hover:text-ink transition-colors">SEO (2010-2023)</h3>
                        <ul className="space-y-3 font-mono text-xs text-ink/50">
                            <li className="flex items-center gap-3">
                                <X size={14} className="text-red-400" />
                                <span>Output: 2,000 word "fluff" pieces</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <X size={14} className="text-red-400" />
                                <span>Goal: Rank for keywords</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <X size={14} className="text-red-400" />
                                <span>Result: Buried on Page 2</span>
                            </li>
                        </ul>
                    </div>

                    {/* RIGHT SIDE: THE NEW WAY (Optimized) */}
                    <div className="relative p-8 md:p-12 bg-white overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-signal"></div>

                        {/* Status Badge */}
                        <div className="inline-flex items-center gap-2 mb-8 px-2 py-1 bg-signal/10 border border-signal/20 text-[10px] font-mono font-bold text-signal uppercase tracking-wider">
                            <Sparkles size={12} /> Living Entity
                        </div>

                        {/* Visual: The AI Answer */}
                        <div className="bg-cream border border-ink shadow-[4px_4px_0px_0px_#1a1a1a] p-6 mb-8 relative z-10 transition-transform duration-300 group-hover:-translate-y-1">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 rounded-sm bg-ink flex items-center justify-center text-white">
                                    <Sparkles size={14} />
                                </div>
                                <div className="font-mono text-xs font-bold text-ink">Answer Engine</div>
                            </div>
                            <div className="font-serif text-lg text-ink leading-relaxed mb-4">
                                "According to <span className="bg-signal/20 px-1 border-b border-signal">Your Brand</span>, the most effective method is..."
                            </div>

                            {/* Citations */}
                            <div className="flex gap-2 mt-4 pt-4 border-t border-ink/10">
                                <div className="px-2 py-1 border border-ink/20 rounded-sm bg-white text-[10px] font-mono flex items-center gap-1 hover:border-signal transition-colors cursor-help">
                                    <Globe size={10} className="text-ink/40" /> 1. yourbrand.com
                                </div>
                                <div className="px-2 py-1 border border-ink/20 rounded-sm bg-white text-[10px] font-mono flex items-center gap-1 opacity-50">
                                    <Globe size={10} className="text-ink/40" /> 2. wikipedia.org
                                </div>
                            </div>
                        </div>

                        <h3 className="font-serif text-3xl font-bold text-ink mb-4">AEO (The Future)</h3>
                        <ul className="space-y-3 font-mono text-xs text-ink/80">
                            <li className="flex items-center gap-3">
                                <CheckCircle2 size={14} className="text-signal" />
                                <span>Output: Answer-Engine Ready formats</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <CheckCircle2 size={14} className="text-signal" />
                                <span>Goal: Own the "Entity Space"</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <CheckCircle2 size={14} className="text-signal" />
                                <span>Result: Cited in the generated answer</span>
                            </li>
                        </ul>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default ParadigmShiftSection;
