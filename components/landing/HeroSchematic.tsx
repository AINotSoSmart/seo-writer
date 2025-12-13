import React from 'react';
import { Target, Zap, Cpu, Search, Database, Fingerprint } from 'lucide-react';

const HeroSchematic = () => {
    return (
        <div className="w-full max-w-4xl mx-auto mt-8 mb-12">

            {/* Main Schematic Container */}
            <div className="relative bg-white border border-ink shadow-brutalist p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-12 md:gap-0 overflow-hidden">

                {/* Background Grid - Subtle */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

                {/* Left Satellite: The LLMs */}
                <div className="flex flex-col gap-6 relative z-10 w-full md:w-auto">
                    {/* Node 1 */}
                    <div className="flex items-center gap-4 group cursor-default">
                        <div className="w-10 h-10 border border-ink bg-white shadow-[2px_2px_0px_0px_#1a1a1a] flex items-center justify-center group-hover:-translate-y-0.5 transition-transform">
                            <Zap size={18} className="text-ink" />
                        </div>
                        <div className="font-mono text-xs uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
                            ChatGPT_4o
                        </div>
                    </div>
                    {/* Node 2 */}
                    <div className="flex items-center gap-4 group cursor-default pl-0 md:pl-8">
                        <div className="w-10 h-10 border border-ink bg-white shadow-[2px_2px_0px_0px_#1a1a1a] flex items-center justify-center group-hover:-translate-y-0.5 transition-transform">
                            <Cpu size={18} className="text-ink" />
                        </div>
                        <div className="font-mono text-xs uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
                            Claude_3.5
                        </div>
                    </div>
                    {/* Node 3 */}
                    <div className="flex items-center gap-4 group cursor-default">
                        <div className="w-10 h-10 border border-ink bg-white shadow-[2px_2px_0px_0px_#1a1a1a] flex items-center justify-center group-hover:-translate-y-0.5 transition-transform">
                            <Search size={18} className="text-ink" />
                        </div>
                        <div className="font-mono text-xs uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
                            Perplexity
                        </div>
                    </div>
                </div>

                {/* Center Connection Visual - Desktop Only */}
                <div className="hidden md:flex flex-1 items-center justify-center relative px-8">
                    {/* Connecting Lines */}
                    <div className="absolute top-1/2 left-0 w-full h-px bg-ink/20 transform -translate-y-1/2"></div>

                    {/* Data Packets Animation */}
                    <div className="absolute top-1/2 left-0 w-2 h-2 bg-signal rounded-full animate-ping [animation-duration:3s]"></div>
                    <div className="absolute top-1/2 right-0 w-2 h-2 bg-signal rounded-full animate-ping [animation-duration:3s] [animation-delay:1.5s]"></div>

                    {/* Central Processor Icon (Abstract) */}
                    <div className="relative z-10 w-16 h-16 border border-ink bg-white rotate-45 flex items-center justify-center shadow-brutalist">
                        <div className="-rotate-45">
                            <Database size={24} className="text-ink" />
                        </div>
                    </div>
                </div>

                {/* Center Connection Visual - Mobile Only (Vertical Line) */}
                <div className="md:hidden h-16 w-px bg-ink/20 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-signal rounded-full animate-bounce"></div>
                </div>


                {/* Right Node: The Brand (You) */}
                <div className="relative z-10 w-full md:w-auto flex flex-col items-center md:items-end text-center md:text-right">
                    <div className="w-20 h-20 border-2 border-signal bg-white shadow-[4px_4px_0px_0px_#ff4d00] flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-500">
                        <Fingerprint size={32} className="text-signal" />
                    </div>
                    <div className="font-serif text-xl font-bold text-ink mb-1">
                        Your Brand
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-signal bg-signal/5 px-2 py-1 rounded-sm border border-signal/20">
                        Entity_Verified
                    </div>
                </div>

                {/* Decorative Status Bar */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-ink/5">
                    <div className="h-full w-1/3 bg-signal/50 animate-pulse"></div>
                </div>

            </div>
        </div>
    );
};

export default HeroSchematic;
