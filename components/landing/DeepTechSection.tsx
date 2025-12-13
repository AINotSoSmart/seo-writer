import React from 'react';
import { Bot, BrainCircuit, Database, BookOpen, GraduationCap, ShieldCheck, FileSearch, Network, Server, Microscope } from 'lucide-react';

const DeepTechSection = () => {
    return (
        <section className="py-24 md:py-32 bg-cream relative overflow-hidden border-b border-ink">
            {/* Background Texture - retained as requested */}
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">

                {/* Section Header - STRICT PAIN SECTION PATTERN */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-20 border-l-2 border-signal pl-6 md:pl-8">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal flex items-center gap-2">
                                <Microscope size={14} />
                                Deep_Research_Lite_v2
                            </span>
                            <span className="h-px w-12 bg-signal/30"></span>
                        </div>
                        <h2 className="font-serif text-5xl md:text-6xl font-medium leading-[0.95] text-ink mb-6">
                            Research at the <br />
                            speed of <span className="italic relative inline-block z-10">
                                silicon.
                                <span className="absolute bottom-2 left-0 w-full h-3 bg-signal/20 -z-10 -rotate-1"></span>
                            </span>
                        </h2>
                    </div>
                    <div className="max-w-sm">
                        <p className="font-mono text-xs md:text-sm text-ink/70 leading-relaxed border-t border-ink/10 pt-4">
                            We don't hypothesize. We scrape. Our engine digests 50+ live sources per article to build a citation graph that algorithms cannot ignore.
                        </p>
                    </div>
                </div>

                {/* Feature Grid / Control Panel - REIMAGINED AS "LAB SCHEMATICS" */}
                <div className="grid grid-cols-1 md:grid-cols-3 border border-ink bg-white shadow-brutalist">

                    {/* Feature 1: The Pulse */}
                    <div className="group border-b md:border-b-0 md:border-r border-ink p-8 hover:bg-paper transition-colors relative">
                        {/* Technical Badge */}
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Network size={80} strokeWidth={1} />
                        </div>

                        <div className="flex justify-between items-start mb-8">
                            <div className="font-mono text-[10px] uppercase tracking-widest border border-ink/20 px-2 py-1 bg-white text-ink/50">
                                DATA_INGESTION
                            </div>
                            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink group-hover:bg-signal group-hover:text-white transition-colors">
                                <FileSearch size={16} />
                            </div>
                        </div>

                        <h3 className="font-serif text-2xl font-bold mb-3 text-ink">Reddit & Quora Pulse</h3>
                        <p className="font-mono text-xs text-ink/60 leading-relaxed mb-6">
                            We scan thousands of threads to find the *actual* questions humans are asking—not just what Keyword Planner tells you.
                        </p>

                        <div className="mt-auto pt-4 border-t border-ink/10 flex justify-between items-center">
                            <span className="text-[10px] font-mono text-signal font-bold flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-signal rounded-full animate-pulse"></span>
                                LIVE_FEED_ACTIVE
                            </span>
                            <div className="flex gap-0.5">
                                <span className="w-0.5 h-2 bg-signal"></span>
                                <span className="w-0.5 h-3 bg-signal/50"></span>
                                <span className="w-0.5 h-1 bg-signal/30"></span>
                                <span className="w-0.5 h-2.5 bg-signal/80"></span>
                            </div>
                        </div>
                    </div>

                    {/* Feature 2: Academic Core */}
                    <div className="group border-b md:border-b-0 md:border-r border-ink p-8 hover:bg-paper transition-colors relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <GraduationCap size={80} strokeWidth={1} />
                        </div>

                        <div className="flex justify-between items-start mb-8">
                            <div className="font-mono text-[10px] uppercase tracking-widest border border-ink/20 px-2 py-1 bg-white text-ink/50">
                                SOURCE_VALIDATION
                            </div>
                            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink group-hover:bg-signal group-hover:text-white transition-colors">
                                <BookOpen size={16} />
                            </div>
                        </div>

                        <h3 className="font-serif text-2xl font-bold mb-3 text-ink">Academic Validation</h3>
                        <p className="font-mono text-xs text-ink/60 leading-relaxed mb-6">
                            Claims are cross-referenced against Google Scholar and authoritative domains. Zero hallucinations. 100% Citability.
                        </p>

                        <div className="mt-auto pt-4 border-t border-ink/10 flex justify-between items-center">
                            <span className="text-[10px] font-mono text-ink/40">p_value &lt; 0.05</span>
                            <div className="px-1.5 py-0.5 border border-ink text-[8px] text-ink font-mono font-bold bg-white shadow-sm">
                                VERIFIED
                            </div>
                        </div>
                    </div>

                    {/* Feature 3: Anti-Pattern Defense */}
                    <div className="group p-8 hover:bg-paper transition-colors relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <ShieldCheck size={80} strokeWidth={1} />
                        </div>

                        <div className="flex justify-between items-start mb-8">
                            <div className="font-mono text-[10px] uppercase tracking-widest border border-ink/20 px-2 py-1 bg-white text-ink/50">
                                AI_DETECTION
                            </div>
                            <div className="w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink group-hover:bg-signal group-hover:text-white transition-colors">
                                <Bot size={16} />
                            </div>
                        </div>

                        <h3 className="font-serif text-2xl font-bold mb-3 text-ink">The Anti-Pattern</h3>
                        <p className="font-mono text-xs text-ink/60 leading-relaxed mb-6">
                            We detect common AI writing patterns ("In the rapidly evolving landscape...") and ban them at the token level.
                        </p>

                        <div className="mt-auto pt-4 border-t border-ink/10 flex justify-between items-center">
                            <span className="text-[10px] font-mono text-red-500 font-bold">TOKENS_BLOCKED: 402</span>
                            <div className="w-12 h-1.5 bg-ink/10 rounded-full overflow-hidden">
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
