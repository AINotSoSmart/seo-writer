import React from 'react';
import { Bot, BrainCircuit, Database, BookOpen, GraduationCap, ShieldCheck, FileSearch, Network } from 'lucide-react';

const DeepTechSection = () => {
    return (
        <section className="py-24 bg-ink text-cream relative overflow-hidden">
            {/* Dark Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]"></div>

            {/* Radial Gradient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-900/20 blur-[100px] rounded-full pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">

                <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 mb-4 text-signal">
                            <BrainCircuit size={18} />
                            <span className="font-mono text-xs font-bold tracking-widest uppercase">Deep_Research_Lite_v2</span>
                        </div>
                        <h2 className="font-serif text-5xl md:text-6xl text-white leading-[0.95]">
                            Research at the speed <br /> of <span className="italic font-light text-indigo-300">silicon.</span>
                        </h2>
                    </div>
                    <div className="max-w-sm">
                        <p className="font-mono text-sm text-white/60 leading-relaxed border-l border-white/20 pl-4">
                            We don't hypothesize. We scrape. Our engine digests 50+ live sources per article to build a citation graph that algorithms cannot ignore.
                        </p>
                    </div>
                </div>

                {/* Feature Grid / Control Panel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10">

                    {/* Feature 1: The Pulse */}
                    <div className="bg-ink p-8 group hover:bg-white/5 transition-colors relative">
                        <div className="absolute top-4 right-4 text-white/10 group-hover:text-signal/50 transition-colors">
                            <Network size={64} strokeWidth={1} />
                        </div>
                        <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-indigo-300 mb-6 group-hover:scale-110 transition-transform">
                            <FileSearch size={20} />
                        </div>
                        <h3 className="font-mon text-lg font-bold text-white mb-2 uppercase tracking-wide">Reddit & Quora Pulse</h3>
                        <p className="font-mono text-xs text-white/50 leading-relaxed max-w-xs mb-8">
                            We scan thousands of threads to find the *actual* questions humans are asking—not just what Keyword Planner tells you.
                        </p>
                        <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                            <span className="text-[10px] font-mono text-signal">LIVE_FEED_ACTIVE</span>
                            <div className="flex gap-1">
                                <span className="w-1 h-1 bg-signal rounded-full animate-pulse"></span>
                                <span className="w-1 h-1 bg-signal/50 rounded-full"></span>
                                <span className="w-1 h-1 bg-signal/25 rounded-full"></span>
                            </div>
                        </div>
                    </div>

                    {/* Feature 2: Academic Core */}
                    <div className="bg-ink p-8 group hover:bg-white/5 transition-colors relative">
                        <div className="absolute top-4 right-4 text-white/10 group-hover:text-signal/50 transition-colors">
                            <GraduationCap size={64} strokeWidth={1} />
                        </div>
                        <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-indigo-300 mb-6 group-hover:scale-110 transition-transform">
                            <BookOpen size={20} />
                        </div>
                        <h3 className="font-mono text-lg font-bold text-white mb-2 uppercase tracking-wide">Academic Validation</h3>
                        <p className="font-mono text-xs text-white/50 leading-relaxed max-w-xs mb-8">
                            Claims are cross-referenced against Google Scholar and authoritative domains. Zero hallucinations. 100% Citability.
                        </p>
                        <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                            <span className="text-[10px] font-mono text-indigo-300">p_value &lt; 0.05</span>
                            <div className="px-1.5 py-0.5 border border-indigo-500/30 text-[8px] text-indigo-300 font-mono">
                                VERIFIED
                            </div>
                        </div>
                    </div>

                    {/* Feature 3: Anti-Pattern Defense */}
                    <div className="bg-ink p-8 group hover:bg-white/5 transition-colors relative">
                        <div className="absolute top-4 right-4 text-white/10 group-hover:text-signal/50 transition-colors">
                            <ShieldCheck size={64} strokeWidth={1} />
                        </div>
                        <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-indigo-300 mb-6 group-hover:scale-110 transition-transform">
                            <Bot size={20} />
                        </div>
                        <h3 className="font-mono text-lg font-bold text-white mb-2 uppercase tracking-wide">The Anti-Pattern</h3>
                        <p className="font-mono text-xs text-white/50 leading-relaxed max-w-xs mb-8">
                            We detect common AI writing patterns ("In the rapidly evolving landscape...") and ban them at the token level.
                        </p>
                        <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                            <span className="text-[10px] font-mono text-red-400">TOKENS_BLOCKED: 402</span>
                            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="w-2/3 h-full bg-red-500"></div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default DeepTechSection;
