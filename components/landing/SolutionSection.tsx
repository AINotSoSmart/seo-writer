import React from 'react';
import { Scan, FileCheck, Swords, ArrowDown, ChevronRight, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

const SolutionSection = () => {
    return (
        <section className="py-24 bg-white relative overflow-hidden border-b border-ink">
            <div className="max-w-7xl mx-auto px-4 relative z-10">

                {/* Header Block */}
                <div className="mb-20">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-ink text-white font-mono text-xs font-bold tracking-widest uppercase mb-6">
                        <span className="w-2 h-2 rounded-full bg-signal"></span>
                        The Protocol
                    </div>

                    <div className="flex flex-col lg:flex-row gap-12 lg:items-end justify-between">
                        <h2 className="font-serif text-5xl md:text-7xl leading-[0.9] text-ink max-w-3xl">
                            We write for <span className="italic font-light">Humans</span> <br />
                            and Modern <span className="text-transparent bg-clip-text bg-gradient-to-r from-ink to-ink/70">AI Search.</span>
                        </h2>
                        <div className="max-w-md">
                            <p className="font-mono text-sm text-ink/70 leading-relaxed border-l-2 border-signal pl-6">
                                FlipAEO doesn't just write articles. We reverse-engineer how AI models think to put your brand inside the answer.
                            </p>
                        </div>
                    </div>
                </div>

                {/* The Protocol Stack - Technical Layout */}
                <div className="flex flex-col border border-ink shadow-brutalist bg-cream">

                    {/* STEP 01 */}
                    <div className="group flex flex-col md:flex-row border-b border-ink relative overflow-hidden">
                        {/* Number Column */}
                        <div className="w-full md:w-24 md:border-r border-ink p-6 flex items-start justify-between md:justify-center bg-white">
                            <span className="font-mono text-4xl font-bold text-ink/20 group-hover:text-signal transition-colors">01</span>
                            <Scan className="md:hidden text-ink/40" />
                        </div>

                        {/* Content Column */}
                        <div className="flex-1 p-8 md:p-10 relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-signal bg-signal/10 px-2 py-1">
                                    Visibility Engine
                                </div>
                                <span className="text-ink/30 text-xs font-mono hidden md:inline-block">// DETECT_GAPS</span>
                            </div>
                            <h3 className="font-serif text-3xl font-bold mb-2">Real-Time Visibility Check</h3>
                            <p className="font-serif italic text-ink/50 text-lg mb-4">The Fix for "Invisible to AI"</p>
                            <p className="font-mono text-xs md:text-sm text-ink/70 leading-relaxed max-w-2xl">
                                We search your brand in ChatGPT, Gemini, and Claude in real-time. We don't just guess where you rank; we tell you exactly where you are missing from citations—and how to insert yourself into the conversation.
                            </p>
                        </div>

                        {/* Visual Column - Light Mode UI Dashboard */}
                        <div className="w-full md:w-80 bg-[#f5f5f5] relative flex items-center justify-center p-8 group-hover:bg-white transition-colors border-t md:border-t-0 md:border-l border-ink">

                            {/* Subtle grid pattern for texture - Moved BEHIND the card */}
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-0"></div>

                            {/* Dashboard Card Container - Added z-10 relative to ensure it sits on top */}
                            <div className="w-64 bg-white border border-ink/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-sm overflow-hidden flex flex-col relative z-10">

                                {/* Card Header */}
                                <div className="h-6 bg-gray-50 border-b border-ink/5 flex items-center px-3 justify-between">
                                    <div className="flex gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-ink/10"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-ink/10"></div>
                                    </div>
                                    <div className="font-mono text-[8px] text-ink/30 tracking-widest uppercase">
                                        VISIBILITY_MONITOR
                                    </div>
                                </div>

                                {/* Main Grid */}
                                <div className="flex-1 grid grid-cols-3 divide-x divide-ink/5">

                                    {/* Column 1: GPT-4 */}
                                    <div className="flex flex-col p-3 gap-2">
                                        <div className="font-mono text-[8px] text-ink/40 text-center mb-1">GPT-4o</div>
                                        {/* Signal Bars */}
                                        <div className="flex-1 flex flex-col justify-end gap-0.5 h-16 px-1">
                                            <div className="h-1 w-full bg-ink/5"></div>
                                            <div className="h-1 w-full bg-ink/5"></div>
                                            <div className="h-1 w-full bg-emerald-500/80"></div>
                                            <div className="h-1 w-full bg-emerald-500/80"></div>
                                            <div className="h-1 w-full bg-emerald-500/80"></div>
                                        </div>
                                        <div className="mt-2 flex justify-center">
                                            <div className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-[6px] font-mono text-emerald-600 rounded-xs flex items-center gap-1">
                                                <CheckCircle2 size={6} /> FOUND
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Claude (The Gap) */}
                                    <div className="flex flex-col p-3 gap-2 bg-red-50/30">
                                        <div className="font-mono text-[8px] text-ink/40 text-center mb-1">CLAUDE</div>
                                        {/* Signal Bars - Empty/Error */}
                                        <div className="flex-1 flex flex-col justify-end gap-0.5 h-16 px-1 relative">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <AlertCircle size={12} className="text-signal animate-pulse" />
                                            </div>
                                            <div className="h-1 w-full bg-ink/5"></div>
                                            <div className="h-1 w-full bg-ink/5"></div>
                                            <div className="h-1 w-full bg-ink/5"></div>
                                        </div>
                                        <div className="mt-2 flex justify-center">
                                            <div className="px-1.5 py-0.5 bg-white border border-signal/20 text-[6px] font-mono text-signal rounded-xs shadow-sm">
                                                MISSING
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 3: Gemini */}
                                    <div className="flex flex-col p-3 gap-2">
                                        <div className="font-mono text-[8px] text-ink/40 text-center mb-1">GEMINI</div>
                                        {/* Signal Bars */}
                                        <div className="flex-1 flex flex-col justify-end gap-0.5 h-16 px-1">
                                            <div className="h-1 w-full bg-ink/5"></div>
                                            <div className="h-1 w-full bg-emerald-500/80"></div>
                                            <div className="h-1 w-full bg-emerald-500/80"></div>
                                            <div className="h-1 w-full bg-emerald-500/80"></div>
                                            <div className="h-1 w-full bg-emerald-500/80"></div>
                                        </div>
                                        <div className="mt-2 flex justify-center">
                                            <div className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-[6px] font-mono text-emerald-600 rounded-xs flex items-center gap-1">
                                                <CheckCircle2 size={6} /> FOUND
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                {/* Card Footer */}
                                <div className="bg-gray-50 border-t border-ink/5 p-2">
                                    <div className="flex items-center justify-between text-[7px] font-mono text-ink/40">
                                        <span>AVG_VISIBILITY</span>
                                        <span className="text-ink font-bold">33%</span>
                                    </div>
                                    <div className="mt-1 h-0.5 w-full bg-ink/5 rounded-full overflow-hidden">
                                        <div className="h-full w-1/3 bg-signal"></div>
                                    </div>
                                </div>

                            </div>

                        </div>
                    </div>

                    {/* STEP 02 */}
                    <div className="group flex flex-col md:flex-row border-b border-ink relative overflow-hidden">
                        <div className="w-full md:w-24 md:border-r border-ink p-6 flex items-start justify-between md:justify-center bg-white">
                            <span className="font-mono text-4xl font-bold text-ink/20 group-hover:text-signal transition-colors">02</span>
                            <FileCheck className="md:hidden text-ink/40" />
                        </div>

                        <div className="flex-1 p-8 md:p-10 relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-signal bg-signal/10 px-2 py-1">
                                    Quality Control
                                </div>
                                <span className="text-ink/30 text-xs font-mono hidden md:inline-block">// FACT_VALIDATION</span>
                            </div>
                            <h3 className="font-serif text-3xl font-bold mb-2">Quality Articles That Beat the Noise</h3>
                            <p className="font-serif italic text-ink/50 text-lg mb-4">The Fix for "Sounding Generic"</p>
                            <p className="font-mono text-xs md:text-sm text-ink/70 leading-relaxed max-w-2xl">
                                Most AI content reads like a Wikipedia summary. Ours reads like a field report. We validate every claim against live sources to ensure your content is technically accurate and impossible to ignore. This is how you build trust with humans while satisfying the search algorithms.
                            </p>
                        </div>

                        <div className="w-full md:w-80 bg-[#f5f5f5] border-t md:border-t-0 md:border-l border-ink relative overflow-hidden flex items-center justify-center p-8 group-hover:bg-white transition-colors">
                            {/* Visual: Field Report / Validation */}
                            <div className="relative w-48 h-48 flex flex-col items-center justify-center">

                                {/* Background Noise (faint) */}
                                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>

                                {/* The Document */}
                                <div className="relative w-32 bg-white border border-ink shadow-sm p-4 z-10 rotate-1 group-hover:rotate-0 transition-transform duration-500">
                                    {/* Header */}
                                    <div className="w-1/3 h-1 bg-ink/20 mb-3"></div>

                                    {/* Lines */}
                                    <div className="space-y-1.5">
                                        <div className="w-full h-1 bg-ink/10"></div>

                                        {/* Highlighted Line */}
                                        <div className="relative w-full h-1 bg-signal/20 flex items-center">
                                            <div className="absolute -left-1 w-0.5 h-full bg-signal"></div>
                                            {/* Connector to Source Bubble */}
                                            <div className="absolute -right-16 -top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity delay-100">
                                                <div className="w-4 h-[1px] bg-signal"></div>
                                                <div className="bg-white border border-signal text-signal text-[6px] font-mono px-1 py-0.5 whitespace-nowrap shadow-sm">
                                                    SOURCE_MATCH
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-5/6 h-1 bg-ink/10"></div>
                                        <div className="w-full h-1 bg-ink/10"></div>
                                        <div className="w-4/5 h-1 bg-ink/10"></div>
                                    </div>

                                    {/* Validated Stamp */}
                                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-[5px] font-mono text-ink/40">VERIFIED</span>
                                    </div>
                                </div>

                                {/* Floating Source Nodes */}
                                <div className="absolute top-10 left-6 w-4 h-4 bg-white border border-ink/20 rounded-full flex items-center justify-center text-[6px] shadow-sm animate-float-slow">
                                    1
                                </div>
                                <div className="absolute bottom-12 right-4 w-4 h-4 bg-white border border-ink/20 rounded-full flex items-center justify-center text-[6px] shadow-sm animate-float-delayed">
                                    2
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STEP 03 */}
                    <div className="group flex flex-col md:flex-row relative overflow-hidden">
                        <div className="w-full md:w-24 md:border-r border-ink p-6 flex items-start justify-between md:justify-center bg-white">
                            <span className="font-mono text-4xl font-bold text-ink/20 group-hover:text-signal transition-colors">03</span>
                            <Swords className="md:hidden text-ink/40" />
                        </div>

                        <div className="flex-1 p-8 md:p-10 relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-signal bg-signal/10 px-2 py-1">
                                    Growth Hacking
                                </div>
                                <span className="text-ink/30 text-xs font-mono hidden md:inline-block">// GAP_EXPLOITATION</span>
                            </div>
                            <h3 className="font-serif text-3xl font-bold mb-2">Competitor Gap Domination</h3>
                            <p className="font-serif italic text-ink/50 text-lg mb-4">The Fix for "No Traffic/Revenue"</p>
                            <p className="font-mono text-xs md:text-sm text-ink/70 leading-relaxed max-w-2xl">
                                Your competitors are winning because they answered the question better. We analyze their content to find the exact "Gaps" they missed—and we exploit them. We don't just publish blogs; we publish better answers to steal their market share.
                            </p>
                        </div>

                        <div className="w-full md:w-80 bg-[#f5f5f5] border-t md:border-t-0 md:border-l border-ink relative overflow-hidden flex items-center justify-center p-8 group-hover:bg-white transition-colors">
                            {/* Visual: Gap Domination */}
                            <div className="relative w-full h-32 flex items-end justify-center gap-3 px-4">

                                {/* Comp 1 */}
                                <div className="w-12 h-16 bg-ink/10 border border-ink/5 relative group-hover:opacity-50 transition-opacity">
                                    <div className="absolute -top-5 left-0 w-full text-[8px] font-mono text-center text-ink/40 uppercase">Comp_A</div>
                                </div>

                                {/* YOU (The Gap Filler) */}
                                <div className="w-16 h-28 bg-white border border-ink shadow-[4px_-4px_0px_0px_#ff4d00] relative z-10 -ml-1 -mr-1 group-hover:scale-105 transition-transform origin-bottom">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-signal"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="font-serif font-bold italic text-ink text-lg">YOU</span>
                                    </div>
                                    {/* Floating Badge */}
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ink text-white text-[7px] font-mono px-1.5 py-0.5 whitespace-nowrap z-20">
                                        GAP_FILLED
                                    </div>
                                </div>

                                {/* Comp 2 */}
                                <div className="w-12 h-20 bg-ink/10 border border-ink/5 relative group-hover:opacity-50 transition-opacity">
                                    <div className="absolute -top-5 left-0 w-full text-[8px] font-mono text-center text-ink/40 uppercase">Comp_B</div>
                                </div>

                                {/* Grid Lines background */}
                                <div className="absolute inset-0 bg-[linear-gradient(to_top,#00000005_1px,transparent_1px)] bg-[size:100%_8px] pointer-events-none -z-10"></div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default SolutionSection;