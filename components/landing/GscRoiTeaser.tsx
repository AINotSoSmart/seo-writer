import React from 'react';
import { CornerSquare } from './CornerSquare';
import { Database, TrendingDown, Target, Zap } from 'lucide-react';

const GscRoiTeaser = () => {
    return (
        <section id="gsc-roi" className="w-full pt-12 pb-24 relative z-10">
            <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

                {/* Horizontal Pattern Bar Above Header */}
                <div className="w-full h-3 sm:h-4 border-y border-stone-200 mb-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}></div>

                {/* Header - Left/Right Premium Setup */}
                <div className="flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end mb-16 w-full px-4 md:px-8">
                    <div className="flex-1">
                        <span className="font-sans text-xs font-bold tracking-widest text-brand-500 uppercase mb-4 block">
                            Phase 1
                        </span>
                        <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1]">
                            The Master <br /><span className='italic text-stone-500'>ROI Engine</span>
                        </h2>
                    </div>
                    <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
                        <p className="font-sans text-stone-500 text-lg leading-relaxed">
                            Connect your Google Search Console securely. In 30 seconds, our engine downloads 60 days of historical data and mathematically diagnoses Cannibalization, Content Decay, and CTR vulnerabilities across your entire site.
                        </p>
                    </div>
                </div>

                {/* Horizontal Pattern Bar Top (Grid Boundary) */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                </div>

                {/* Visual Dashboard Container Grid */}
                <div className="w-full border-x border-stone-200 bg-stone-50/50 p-4 md:p-8 relative flex flex-col md:flex-row items-center justify-between gap-12 overflow-hidden">
                    {/* Main Grid Corners */}
                    <CornerSquare className="-left-[5px] -top-[5px]" />
                    <CornerSquare className="-right-[5px] -top-[5px]" />
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />

                    {/* Left: The "Sync" UI aesthetic */}
                    <div className="flex-1 w-full max-w-sm flex flex-col items-center text-center">
                        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-none bg-stone-100 border border-stone-200 mb-6">
                            <Database className="w-10 h-10 text-stone-900" strokeWidth={1.5} />
                        </div>
                        <h4 className="font-serif text-2xl text-stone-900 mb-2">Syncing Search Data</h4>
                        <div className="w-full max-w-xs h-1 bg-stone-200 rounded-none overflow-hidden relative mt-4">
                            <div className="absolute top-0 left-0 h-full w-1/3 bg-stone-900" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 mt-4 font-mono">
                            1,420 Signals Parsed
                        </span>
                    </div>

                    {/* Right: The Signal Detection Outputs */}
                    <div className="flex-[1.5] w-full flex flex-col gap-3">
                        {/* Signal 1 */}
                        <div className="bg-white border border-stone-200 rounded-none p-4 flex items-start gap-4">
                            <div className="w-10 h-10 bg-red-50 border border-red-200 flex items-center justify-center shrink-0 rounded-none">
                                <TrendingDown className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-stone-900">Content Decay Detected</span>
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded-none border border-red-200 tracking-wider">-42% Traffic Drop</span>
                                </div>
                                <p className="text-xs text-stone-500 font-mono truncate">/blog/what-is-marketing-automation</p>
                            </div>
                        </div>

                        {/* Signal 2 */}
                        <div className="bg-white border border-stone-200 rounded-none p-4 flex items-start gap-4">
                            <div className="w-10 h-10 bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0 rounded-none">
                                <Target className="w-5 h-5 text-orange-600" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-stone-900">Keyword Cannibalization</span>
                                    <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase rounded-none border border-stone-200 tracking-wider">2 Conflicting URLs</span>
                                </div>
                                <p className="text-xs text-stone-500 font-mono truncate">Query: "b2b saas pricing"</p>
                            </div>
                        </div>

                        {/* Signal 3 */}
                        <div className="bg-white border border-stone-200 rounded-none p-4 flex items-start gap-4">
                            <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 rounded-none">
                                <Zap className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-stone-900">Striking Distance Shift</span>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-none border border-emerald-200 tracking-wider">Ranked #14</span>
                                </div>
                                <p className="text-xs text-stone-500 font-mono truncate">Query: "how to reverse image search"</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Horizontal Pattern Bar Bottom (Grid Boundary) */}
                <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
                    <CornerSquare className="-left-[5px] -top-[5px]" />
                    <CornerSquare className="-right-[5px] -top-[5px]" />
                </div>

            </div>
        </section>
    );
};

export default GscRoiTeaser;
