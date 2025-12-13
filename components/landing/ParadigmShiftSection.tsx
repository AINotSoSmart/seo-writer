import React from 'react';
import { Archive, ArrowRight, SearchX, Sparkles, TrendingDown, TrendingUp, MousePointer2, MessageSquare, Target } from 'lucide-react';

const ParadigmShiftSection = () => {
    return (
        <section className="py-24 bg-white border-b border-ink relative overflow-hidden">
            {/* Background Texture */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">

                {/* Header Block */}
                <div className="flex flex-col md:flex-row gap-12 md:items-end justify-between mb-20">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-ink text-white font-mono text-xs font-bold tracking-widest uppercase mb-6 shadow-brutalist-sm">
                            <Archive size={12} />
                            Market Shift
                        </div>
                        <h2 className="font-serif text-5xl md:text-7xl leading-[0.9] text-ink">
                            The "Ten Blue Links" <br />
                            <span className="italic font-light text-ink/70">are dead.</span>
                        </h2>
                    </div>
                    <div className="max-w-sm">
                        <p className="font-mono text-sm text-ink/70 leading-relaxed border-l-2 border-red-500 pl-6">
                            <span className="font-bold text-red-600 block mb-1">CRITICAL ALERT:</span>
                            Search volume for informational queries collapsed by 40% in 2025. Users aren't clicking links; they are asking Claude.
                        </p>
                    </div>
                </div>

                {/* Comparison Chassis */}
                <div className="w-full border border-ink shadow-brutalist flex flex-col">

                    {/* Protocol Header */}
                    <div className="flex border-b border-ink bg-[#f5f5f5]">
                        <div className="flex-1 p-3 border-r border-ink flex items-center justify-between opacity-50">
                            <span className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline">PROTOCOL: SEO_LEGACY</span>
                            <span className="font-mono text-[10px] uppercase tracking-widest sm:hidden">SEO_LEGACY</span>
                            <div className="px-1.5 py-0.5 border border-ink/20 text-[8px] font-mono uppercase bg-gray-200 text-ink/50">Deprecated</div>
                        </div>
                        <div className="flex-1 p-3 flex items-center justify-between bg-white">
                            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-signal hidden sm:inline">PROTOCOL: AEO_MODERN</span>
                            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-signal sm:hidden">AEO_MODERN</span>
                            <div className="px-1.5 py-0.5 border border-signal/20 text-[8px] font-mono uppercase bg-signal/5 text-signal font-bold animate-pulse">Active</div>
                        </div>
                    </div>

                    {/* Main Split View */}
                    <div className="flex flex-col md:flex-row h-auto min-h-[500px]">

                        {/* LEFT SIDE: The Graveyard (SEO) */}
                        <div className="flex-1 bg-[#f0f0f0] relative p-6 md:p-12 flex flex-col border-b md:border-b-0 md:border-r border-ink overflow-hidden group/old">
                            {/* Background Noise */}
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>

                            <div className="relative z-10 flex-1 flex flex-col justify-center opacity-60 grayscale group-hover/old:grayscale-0 transition-all duration-500">
                                {/* Mock Google Result */}
                                <div className="bg-white p-6 shadow-sm border border-ink/10 mb-8 max-w-md mx-auto w-full rotate-1 group-hover/old:rotate-0 transition-transform">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-4 h-4 rounded-full bg-gray-200"></div>
                                        <div className="text-xs text-ink/60 font-sans">www.yoursite.com › blog</div>
                                    </div>
                                    <h3 className="text-xl text-[#1a0dab] font-serif hover:underline mb-1 cursor-not-allowed">
                                        Top 10 Ways To Do X (Updated 2023)
                                    </h3>
                                    <p className="text-sm text-ink/60 leading-snug">
                                        In this comprehensive guide, we will explore the top 10 ways to achieve your goals. Read more to find out...
                                    </p>
                                </div>

                                {/* Metrics of Failure - Refined Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto w-full">
                                    <div className="border border-dashed border-ink/30 p-5 bg-ink/5">
                                        <div className="flex items-center gap-2 text-ink/40 mb-3">
                                            <Target size={14} />
                                            <span className="font-mono text-[9px] uppercase tracking-wider">Goal</span>
                                        </div>
                                        <div className="font-serif text-lg text-ink/40 line-through decoration-ink/20 decoration-2">Rank for Keywords</div>
                                    </div>
                                    <div className="border border-dashed border-ink/30 p-5 bg-ink/5">
                                        <div className="flex items-center gap-2 text-ink/40 mb-3">
                                            <TrendingDown size={14} />
                                            <span className="font-mono text-[9px] uppercase tracking-wider">Result</span>
                                        </div>
                                        <div className="font-serif text-lg text-ink/40">Buried on Page 2</div>
                                    </div>
                                </div>
                            </div>

                            {/* Deprecated Stamp */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-ink/10 text-ink/10 font-mono font-bold text-5xl md:text-6xl uppercase p-8 -rotate-12 pointer-events-none whitespace-nowrap z-0">
                                OBSOLETE
                            </div>
                        </div>


                        {/* RIGHT SIDE: The Future (AEO) */}
                        <div className="flex-1 bg-white relative p-6 md:p-12 flex flex-col group/new">

                            <div className="relative z-10 flex-1 flex flex-col justify-center">
                                {/* Mock AI Answer */}
                                <div className="bg-white p-6 shadow-brutalist border border-ink mb-12 max-w-md mx-auto w-full scale-100 group-hover/new:scale-105 transition-transform duration-500">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-sm bg-signal flex items-center justify-center text-white">
                                                <Sparkles size={14} fill="currentColor" />
                                            </div>
                                            <span className="font-mono text-xs font-bold">ANSWER ENGINE</span>
                                        </div>
                                        <span className="font-mono text-[9px] text-ink/40">GEN_ID: #9942X</span>
                                    </div>

                                    <p className="font-serif text-lg leading-relaxed mb-4">
                                        "According to <span className="bg-signal/10 px-1 font-bold text-ink border-b-2 border-signal">Your Brand</span>, the most effective method involves a proprietary 3-step process..."
                                    </p>

                                    <div className="bg-[#fafafa] border border-ink/5 p-3 rounded-sm">
                                        <div className="text-[9px] font-mono text-ink/40 uppercase mb-2">Sources Cited</div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 bg-ink text-white flex items-center justify-center font-serif text-[8px] italic">Y</div>
                                            <span className="text-xs font-bold underline decoration-signal decoration-2 underline-offset-2">1. yourbrand.com</span>
                                            <span className="text-xs text-ink/40 ml-2">2. wikipedia.org</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Metrics of Success - Engineered Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto w-full">
                                    {/* Card 1 */}
                                    <div className="border border-ink p-5 bg-[#fffdf5] shadow-[4px_4px_0px_0px_#1a1a1a] relative group/card transition-transform hover:-translate-y-1">
                                        <div className="flex items-center gap-2 text-signal mb-3">
                                            <Target size={14} strokeWidth={2.5} />
                                            <span className="font-mono text-[9px] uppercase tracking-wider font-bold">Goal</span>
                                        </div>
                                        <div className="font-serif text-xl md:text-2xl font-bold text-ink leading-none">
                                            Own the <br className="hidden md:block" /> Entity
                                        </div>
                                    </div>
                                    {/* Card 2 */}
                                    <div className="border border-ink p-5 bg-[#fffdf5] shadow-[4px_4px_0px_0px_#1a1a1a] relative group/card transition-transform hover:-translate-y-1">
                                        <div className="flex items-center gap-2 text-signal mb-3">
                                            <TrendingUp size={14} strokeWidth={2.5} />
                                            <span className="font-mono text-[9px] uppercase tracking-wider font-bold">Result</span>
                                        </div>
                                        <div className="font-serif text-xl md:text-2xl font-bold text-ink leading-none">
                                            Cited in <br className="hidden md:block" /> Answer
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Background Element */}
                            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-signal/5 rounded-full blur-3xl pointer-events-none"></div>
                        </div>

                    </div>

                    {/* Footer Analysis Bar - Mobile Optimized */}
                    <div className="border-t border-ink bg-ink text-white p-6 flex  justify-center gap-6 md:gap-0 text-sm font-mono">
                        <span className="opacity-50 uppercase tracking-widest">Market_Analysis:</span>
                        <span className="border-l-0 md:border-l border-white/20 pl-0 md:pl-4">
                            Traditional SEO ROI is <span className="text-red-400">down 62% YoY</span>.
                        </span>



                    </div>

                </div>

            </div>
        </section>
    );
};

export default ParadigmShiftSection;