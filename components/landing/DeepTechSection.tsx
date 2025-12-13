import React from 'react';
import { Bot, ShieldCheck, Ban, Network, Database, Globe, Cpu, Search, Activity, FileSearch, Layers, ScanSearch } from 'lucide-react';

const DeepTechSection = () => {
    return (
        <section className="py-24 bg-cream text-ink relative overflow-hidden border-b border-ink">

            {/* Background Texture*/}
            <div className="absolute inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-30 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 relative z-10">

                {/* Header Block */}
                <div className="flex flex-col md:flex-row gap-12 md:items-end justify-between mb-20">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-ink text-ink font-mono text-xs font-bold tracking-widest uppercase mb-6 shadow-[2px_2px_0px_0px_#1a1a1a]">
                            <Cpu size={12} />
                            The Research Engine
                        </div>
                        <h2 className="font-serif text-5xl md:text-7xl leading-[0.9] text-ink">
                            Research at the <br />
                            <span className="italic font-light text-ink/70">speed of silicon.</span>
                        </h2>
                    </div>
                    <div className="max-w-sm">
                        <p className="font-mono text-sm text-ink/70 leading-relaxed border-l-2 border-signal pl-6">
                            We don't hypothesize. We scrape. Our engine digests 50+ live sources — from competitors to databases — to build a citation graph that algorithms cannot ignore.
                        </p>
                    </div>
                </div>

                {/* The Control Panel - Technical Schematic Aesthetic */}
                <div className="w-full bg-white border border-ink shadow-brutalist flex flex-col">

                    {/* Top Bar / Status Line */}
                    <div className="h-10 border-b border-ink bg-[#f5f5f5] flex items-center px-4 justify-between">
                        <div className="flex gap-2">
                            <div className="w-2 h-2 rounded-full bg-signal animate-pulse"></div>
                            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/60">System_Status: ACTIVE</span>
                        </div>
                        <div className="font-mono text-[10px] text-ink/40">
                            V.2.0.4 [STABLE]
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12">

                        {/* FEATURE 1: Live Web Extraction */}
                        <div className="col-span-12 md:col-span-7 border-b md:border-b-0 md:border-r border-ink p-8 md:p-12 relative overflow-hidden group hover:bg-paper transition-colors">

                            {/* Background Icon */}
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                <Layers size={180} />
                            </div>

                            <div className="flex items-start justify-between mb-8">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-1.5 h-1.5 bg-ink rounded-full"></span>
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/50">Multi-Source Ingestion</span>
                                    </div>
                                    <h3 className="font-serif text-3xl font-bold mb-2">Live Web Extraction</h3>
                                    <p className="font-mono text-xs text-ink/60 max-w-sm leading-relaxed">
                                        We don't limit ourselves to one source. We scan top SERP results, competitor blogs, and niche databases to construct the definitive answer for your entity.
                                    </p>
                                </div>
                                <div className="w-10 h-10 border border-ink bg-white flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1a1a]">
                                    <ScanSearch size={20} />
                                </div>
                            </div>

                            {/* VISUAL: Live Ingest Feed */}
                            <div className="w-full border border-ink bg-white shadow-sm p-1">
                                <div className="bg-ink text-white px-3 py-2 font-mono text-[10px] flex justify-between uppercase tracking-wider">
                                    <span>Live_Source_Feed</span>
                                    <span>Status: Parsed</span>
                                </div>
                                <div className="divide-y divide-ink/10 font-mono text-[10px]">
                                    <div className="px-3 py-2 flex items-center justify-between group/row hover:bg-zinc-50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-ink/30">seq_01</span>
                                            <span className="font-bold text-ink">Init_Vector_Search: "Programmatic SEO"</span>
                                        </div>
                                        <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-sm">VECTOR_SCAN</span>
                                    </div>
                                    <div className="px-3 py-2 flex items-center justify-between group/row hover:bg-blue-50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-ink/30">seq_02</span>
                                            <span className="font-bold text-ink">Global_Index_Retrieval: [Top 20 Results]</span>
                                        </div>
                                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-sm">WEB_CRAWL</span>
                                    </div>
                                    <div className="px-3 py-2 flex items-center justify-between group/row hover:bg-red-50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-ink/30">seq_03</span>
                                            <span className="font-bold text-ink">Authority_Filter: "Discarding Low-Quality Nodes"</span>
                                        </div>
                                        <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-sm">FILTER</span>
                                    </div>
                                    <div className="px-3 py-2 flex items-center justify-between group/row hover:bg-purple-50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-ink/30">seq_04</span>
                                            <span className="font-bold text-ink">Analyzing_Gap: "Missing Implementation Details"</span>
                                        </div>
                                        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-sm">LLM_REASONING</span>
                                    </div>
                                    <div className="px-3 py-2 flex items-center justify-between group/row hover:bg-orange-50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-ink/30">seq_05</span>
                                            <span className="font-bold text-ink">Recursive_Query: "Next.js Sitemap Config"</span>
                                        </div>
                                        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-sm">DEEP_DIVE</span>
                                    </div>
                                    <div className="px-3 py-2 flex items-center justify-between group/row hover:bg-green-50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-ink/30">seq_06</span>
                                            <span className="font-bold text-ink">Fact_Verification: "Cross-Referencing Claims"</span>
                                        </div>
                                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-sm">VERIFY</span>
                                    </div>
                                    <div className="px-3 py-2 flex items-center gap-2 opacity-50 bg-[#fafafa]">
                                        <div className="w-2 h-2 border-2 border-ink border-t-transparent rounded-full animate-spin"></div>
                                        <span>Constructing Answer Graph...</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column Stack */}
                        <div className="col-span-12 md:col-span-5 flex flex-col">

                            {/* FEATURE 2: Fact & Entity Verification */}
                            <div className="flex-1 border-b border-ink p-8 relative group hover:bg-paper transition-colors">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-serif text-2xl font-bold mb-1">Fact Verification</h3>
                                        <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest">Ground-Truth Check</p>
                                    </div>
                                    <div className="w-8 h-8 border border-ink bg-white flex items-center justify-center">
                                        <ShieldCheck size={16} />
                                    </div>
                                </div>

                                <p className="font-mono text-xs text-ink/60 mb-6 leading-relaxed">
                                    We cross-reference every claim against live web data to ensure accuracy and build a citation graph algorithms trust.
                                </p>

                                {/* Visual: Citation Card */}
                                <div className="bg-white border border-ink p-3 shadow-[2px_2px_0px_0px_#1a1a1a] relative">
                                    <div className="absolute -top-2 -left-2 bg-green-500 border border-ink w-4 h-4 rounded-full flex items-center justify-center text-white z-10">
                                        <CheckCircle2 size={10} />
                                    </div>
                                    <div className="font-serif italic text-sm text-ink/80 mb-3 border-l-2 border-ink/20 pl-3">
                                        "...demonstrating a 40% increase in entity visibility..."
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-dashed border-ink/20">
                                        <div className="p-1 bg-ink/5 border border-ink/10">
                                            <Database size={10} className="text-ink/50" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-mono text-[9px] font-bold uppercase">Cross-Referenced</span>
                                            <span className="font-mono text-[8px] text-ink/40">Authority Domain • Match: 99.8%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FEATURE 3: The Anti-Pattern */}
                            <div className="flex-1 p-8 relative group hover:bg-paper transition-colors">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-serif text-2xl font-bold mb-1">The Anti-Pattern</h3>
                                        <p className="font-mono text-[10px] text-ink/50 uppercase tracking-widest">Bot Detection</p>
                                    </div>
                                    <div className="w-8 h-8 border border-ink bg-white flex items-center justify-center">
                                        <Ban size={16} />
                                    </div>
                                </div>

                                <p className="font-mono text-xs text-ink/60 mb-6 leading-relaxed">
                                    We detect common AI writing patterns ("In the rapidly evolving landscape") and ban them to ensure human-grade resonance.
                                </p>

                                {/* Visual: Diff Checker */}
                                <div className="bg-white border border-ink font-mono text-[10px] p-1">
                                    <div className="flex items-center justify-between px-2 py-1 bg-[#f5f5f5] border-b border-ink/10 mb-1">
                                        <span>AI_CONTENT_DETECTION</span>
                                        <span className="text-red-500 font-bold">-2</span>
                                    </div>
                                    <div className="space-y-0.5 p-1">
                                        <div className="bg-red-50 text-red-900 line-through decoration-red-400 px-2 py-1 flex justify-between">
                                            "In the digital landscape..."
                                            <span className="font-bold">BAN</span>
                                        </div>
                                        <div className="bg-green-50 text-green-900 px-2 py-1 flex justify-between border border-green-200 mt-1">
                                            "Founders often ignore..."
                                            <span className="font-bold">KEEP</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Footer / Connection Ports */}
                    <div className="border-t border-ink bg-[#f5f5f5] p-3 flex justify-center gap-8">
                        <div className="flex flex-col items-center gap-1 opacity-40">
                            <div className="w-2 h-2 border border-ink bg-white"></div>
                            <span className="font-mono text-[8px] uppercase">CUSTOM_CRAWLER</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 opacity-40">
                            <div className="w-2 h-2 border border-ink bg-white"></div>
                            <span className="font-mono text-[8px] uppercase">SERP_API_V3</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 opacity-40">
                            <div className="w-2 h-2 border border-ink bg-white"></div>
                            <span className="font-mono text-[8px] uppercase">VECTOR_DB</span>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};

// Helper Icon Component for internal use
const CheckCircle2 = ({ size }: { size: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default DeepTechSection;