import React from 'react';
import { CornerSquare } from './CornerSquare';

const SitemapVisual = () => (
  <div className="w-full h-[220px] bg-stone-50/20 border-none relative flex justify-center items-end overflow-hidden pt-8 px-2 group/card">

    {/* Stacked Cards */}
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[65%] h-full bg-stone-100/50 border border-stone-200/40 rounded-t-[1.5rem] z-0 transition-transform duration-700 ease-out group-hover/card:-translate-y-0.5 shadow-sm"></div>
    <div className="absolute top-[22px] left-1/2 -translate-x-1/2 w-[80%] h-full bg-stone-50/80 border border-stone-200/40 rounded-t-[1.5rem] z-10 transition-transform duration-700 ease-out delay-75 group-hover/card:-translate-y-1 shadow-sm"></div>

    {/* Main Card */}
    <div className="relative z-20 w-[94%] bg-white ring-1 ring-stone-200/50 rounded-t-[1.5rem] shadow-[0_4px_24px_rgb(0,0,0,0.03)] p-4 flex flex-col gap-2.5 h-[180px] transition-transform duration-700 ease-out delay-150 group-hover/card:-translate-y-1.5">

      <div className="w-full bg-stone-50/50 border border-stone-100/50 rounded-xl p-2.5 flex justify-between items-center mb-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex gap-1.5 items-center">
          <svg className="w-3.5 h-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          <div className="text-stone-500 text-[10px] font-mono tracking-widest uppercase">DOMAIN SYNC</div>
        </div>
        <div className="text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">Live</div>
      </div>

      <div className="flex flex-col gap-1.5 opacity-90">
        {/* Row 1 */}
        <div className="flex justify-between items-center p-2 rounded-lg bg-white border border-stone-100 relative overflow-hidden group/item">
          <div className="absolute right-0 top-0 w-16 h-16 bg-blue-500/5 blur-xl rounded-full"></div>
          <div className="flex flex-col gap-0.5 z-10">
            <span className="text-stone-800 font-medium text-[11px] font-serif pr-2 line-clamp-1">/blog/ai-search</span>
            <span className="text-stone-400 text-[9px] font-mono opacity-80">v_embed: [0.42, 0.91...]</span>
          </div>
          <svg className="w-3 h-3 text-blue-500 shrink-0 z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
        </div>

        {/* Row 2 */}
        <div className="flex justify-between items-center p-2 rounded-lg bg-white border border-stone-100 relative overflow-hidden group/item">
          <div className="flex flex-col gap-0.5 z-10">
            <span className="text-stone-800 font-medium text-[11px] font-serif pr-2 line-clamp-1">/pricing-2026</span>
            <span className="text-stone-400 text-[9px] font-mono opacity-80">v_embed: [0.81, 0.12...]</span>
          </div>
          <svg className="w-3 h-3 text-blue-500 shrink-0 z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
        </div>
      </div>


    </div>
  </div>
);

const GapMatrixVisual = () => (
  <div className="w-full h-[220px] bg-stone-50/20 border-none relative flex justify-center items-end overflow-hidden pt-8 px-2 group/card">

    {/* Stacked Cards */}
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[65%] h-full bg-stone-100/50 border border-stone-200/40 rounded-t-[1.5rem] z-0 transition-transform duration-700 ease-out group-hover/card:-translate-y-0.5 shadow-sm"></div>
    <div className="absolute top-[22px] left-1/2 -translate-x-1/2 w-[80%] h-full bg-stone-50/80 border border-stone-200/40 rounded-t-[1.5rem] z-10 transition-transform duration-700 ease-out delay-75 group-hover/card:-translate-y-1 shadow-sm"></div>

    {/* Main Card */}
    <div className="relative z-20 w-[94%] bg-white ring-1 ring-stone-200/50 rounded-t-[1.5rem] shadow-[0_4px_24px_rgb(0,0,0,0.03)] p-4 flex flex-col gap-2 h-[180px] transition-transform duration-700 ease-out delay-150 group-hover/card:-translate-y-1.5">

      <div className="flex justify-between items-center p-2 rounded-lg bg-white border border-stone-100/60 shadow-[0_2px_8px_rgba(0,0,0,0.01)] mt-2">
        <div className="text-stone-600 font-medium text-[11px] line-clamp-1 pr-1 truncate">"AEO vs SEO ROI"</div>
        <div className="flex items-center gap-1 text-[8px] font-semibold text-stone-500 bg-stone-100/80 px-1.5 py-0.5 rounded shrink-0">
          <svg className="w-2.5 h-2.5 text-stone-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
          COVERED
        </div>
      </div>

      <div className="flex flex-col gap-1.5 p-2 mt-1 rounded-lg bg-gradient-to-b from-white to-brand-50/30 border border-brand-200/50 shadow-[0_4px_12px_rgba(249,115,22,0.04)] relative overflow-hidden group/item">
        <div className="absolute right-0 top-0 w-20 h-20 bg-brand-500/5 blur-2xl rounded-full"></div>
        <div className="flex justify-between items-center relative z-10">
          <div className="text-stone-900 font-bold font-serif italic text-[11px] truncate pr-1">"Optimize for Perplexity"</div>
          <div className="text-[8px] font-bold text-brand-600 bg-white border border-brand-100 px-1.5 py-0.5 rounded-md flex gap-1 items-center shadow-[0_2px_6px_rgba(249,115,22,0.08)] shrink-0">
            <svg className="w-2.5 h-2.5 text-brand-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M11 2v4.25a.75.75 0 01-1.5 0V2h1.5zm0 15.75V22h1.5v-4.25a.75.75 0 01-1.5 0zM4.12 6.24l2.12 2.12a.75.75 0 11-1.06 1.06L3.06 7.3a.75.75 0 011.06-1.06zm13.64 12.58l-2.12-2.12a.75.75 0 011.06-1.06l2.12 2.12a.75.75 0 01-1.06 1.06z" /></svg>
            GAP
          </div>
        </div>
        <div className="text-[9px] text-stone-500 leading-snug relative z-10 pr-2 pb-0.5">
          SurferSEO ranking. You have 0 coverage.
        </div>
      </div>

      <div className="flex justify-between items-center p-2 rounded-lg bg-white border border-stone-100/60 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
        <div className="text-stone-600 font-medium text-[11px] line-clamp-1 pr-1 truncate">"What is an LLM?"</div>
        <div className="flex items-center gap-1 text-[8px] font-semibold text-stone-400 bg-stone-50/50 border border-stone-100 px-1.5 py-0.5 rounded shrink-0">
          CLUTTERED
        </div>
      </div>

    </div>
  </div>
);

const PillarVisual = () => (
  <div className="w-full h-[220px] bg-stone-50/20 border-none relative flex justify-center items-end overflow-hidden pt-8 px-2 group/card">
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[65%] h-full bg-stone-100/50 border border-stone-200/40 rounded-t-[1.5rem] z-0 transition-transform duration-700 ease-out group-hover/card:-translate-y-0.5 shadow-sm"></div>
    <div className="absolute top-[22px] left-1/2 -translate-x-1/2 w-[80%] h-full bg-stone-50/80 border border-stone-200/40 rounded-t-[1.5rem] z-10 transition-transform duration-700 ease-out delay-75 group-hover/card:-translate-y-1 shadow-sm"></div>

    <div className="relative z-20 w-[94%] bg-white ring-1 ring-stone-200/50 rounded-t-[1.5rem] shadow-[0_4px_24px_rgb(0,0,0,0.03)] p-4 flex flex-col gap-0 h-[180px] transition-transform duration-700 ease-out delay-150 group-hover/card:-translate-y-1.5">

      <div className="font-bold text-stone-800 text-[11px] font-serif mb-3 tracking-tight">
        Target <span className="text-brand-600 italic">"AI Search SEO"</span>
      </div>

      <div className="flex w-full h-3 bg-stone-50 ring-1 ring-stone-200/60 rounded-full overflow-hidden relative mb-5 group/bar shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="w-[45%] h-full bg-gradient-to-r from-brand-600 to-brand-400 flex items-center justify-center text-[7px] text-white font-bold tracking-widest relative z-10">
          DAY 1
        </div>
        <div className="w-[55%] h-full bg-stone-100/80 border-l border-white flex items-center justify-center text-[7px] text-stone-400 font-bold tracking-widest" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #f5f5f4, #f5f5f4 2px, transparent 2px, transparent 6px)' }}>
          QUEUED
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="w-5 h-5 rounded flex shrink-0 items-center justify-center ring-1 ring-brand-200 bg-brand-50 relative">
            <svg className="w-2.5 h-2.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="flex flex-col pt-0.5 max-w-full overflow-hidden">
            <div className="text-[10px] font-bold text-stone-800 leading-tight mb-0.5 truncate">Definitive Guide to GEO</div>
            <div className="text-[8px] text-stone-400 truncate">Pillar foundation</div>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="w-5 h-5 rounded flex shrink-0 items-center justify-center ring-1 ring-stone-200/80 bg-white">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-400 shadow-[0_0_4px_rgba(249,115,22,0.4)] animate-pulse"></div>
          </div>
          <div className="flex flex-col pt-0.5 max-w-full overflow-hidden">
            <div className="text-[10px] font-bold text-stone-800 leading-tight mb-0.5 truncate">How Perplexity Ranks Content</div>
            <div className="text-[8px] text-stone-400 truncate">Strategic cluster branch</div>
          </div>
        </div>
      </div>

    </div>
  </div>
);

const DeduplicationVisual = () => (
  <div className="w-full h-[220px] bg-stone-50/20 border-none relative flex justify-center items-end overflow-hidden pt-8 px-2 group/card">

    {/* Stacked Cards */}
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[65%] h-full bg-stone-100/50 border border-stone-200/40 rounded-t-[1.5rem] z-0 transition-transform duration-700 ease-out group-hover/card:-translate-y-0.5 shadow-sm"></div>
    <div className="absolute top-[22px] left-1/2 -translate-x-1/2 w-[80%] h-full bg-stone-50/80 border border-stone-200/40 rounded-t-[1.5rem] z-10 transition-transform duration-700 ease-out delay-75 group-hover/card:-translate-y-1 shadow-sm"></div>

    {/* Main Card */}
    <div className="relative z-20 w-[94%] bg-white ring-1 ring-stone-200/50 rounded-t-[1.5rem] shadow-[0_4px_24px_rgb(0,0,0,0.03)] p-4 flex flex-col gap-2 h-[180px] transition-transform duration-700 ease-out delay-150 group-hover/card:-translate-y-1.5">

      <div className="mb-1 text-center font-mono text-[9px] text-stone-400 font-bold tracking-widest uppercase border-b border-stone-100 pb-2">
        Vector Comparison
      </div>

      {/* Top box: Proposed topic */}
      <div className="bg-stone-50 border border-stone-200 rounded p-2 text-center relative z-10">
        <span className="text-[10px] text-stone-800 font-serif italic block truncate">"What is AI Search Engine Optimization?"</span>
      </div>

      {/* Visual links / overlap indicator */}
      <div className="w-full h-4 flex items-center justify-center relative -my-1 z-0">
        <div className="absolute w-px h-full bg-red-300"></div>
        <div className="absolute w-6 h-6 rounded-full bg-white ring-1 ring-red-200 flex items-center justify-center z-10 shadow-sm">
          <span className="text-[7px] font-bold text-red-600">89%</span>
        </div>
      </div>

      {/* Bottom box: Exsiting topic */}
      <div className="bg-stone-50 border border-stone-200 rounded p-2 text-center relative z-10 opacity-70">
        <span className="text-[10px] text-stone-600 font-serif italic block truncate">"The Guide to AI SEO"</span>
      </div>



    </div>
  </div>
);


const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="w-full py-24 relative z-10">
      <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

        {/* Horizontal Pattern Bar Above Header */}
        <div className="w-full h-3 sm:h-4 border-y border-stone-200 mb-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}></div>

        {/* Header - Left/Right Premium Setup */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end mb-16 w-full px-4 md:px-8">
          <div className="flex-1">
            <span className="font-sans text-xs font-bold tracking-widest text-brand-500 uppercase mb-4 block">
              Phase 1
            </span>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1.1]">
              The Topical <br /><span className='italic text-stone-500'>Authority Engine</span>
            </h2>
          </div>
          <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
            <p className="font-sans text-stone-500 text-lg leading-relaxed">
              AI search engines only cite authoritative domain clusters. Here is exactly how we build a mathematically perfect content roadmap for your domain before writing a single word.
            </p>
          </div>
        </div>

        {/* Horizontal Pattern Bar Top (Grid Boundary) */}
        <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
          <CornerSquare className="-left-[5px] -bottom-[5px]" />
          <CornerSquare className="-right-[5px] -bottom-[5px]" />
        </div>

        {/* Premium Wireframe Grid - 4 Columns */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-x border-stone-200 relative bg-stone-50/50">

          {/* Main Grid Corners */}
          <CornerSquare className="-left-[5px] -top-[5px]" />
          <CornerSquare className="-right-[5px] -top-[5px]" />
          <CornerSquare className="-left-[5px] -bottom-[5px]" />
          <CornerSquare className="-right-[5px] -bottom-[5px]" />

          {/* --- Step 1 Card --- */}
          <div className="w-full p-4 lg:p-6 border-b sm:border-r lg:border-b-0 border-stone-200 flex flex-col gap-6 group hover:bg-stone-50/80 transition-colors">
            <SitemapVisual />
            <div className="flex flex-col gap-3 mt-auto">
              <div className="flex items-center">
                <div className="px-2.5 py-1 rounded bg-white shadow-sm ring-1 ring-stone-200 text-stone-500 text-[9px] font-bold uppercase tracking-widest">
                  Step 1
                </div>
              </div>
              <h3 className="font-serif text-xl text-stone-900 leading-tight">
                Sitemap Sync & Embedding
              </h3>
              <p className="font-sans text-stone-500 text-[13px] leading-relaxed">
                We crawl your live website, convert your existing articles into vector embeddings, and guarantee we never suggest writing a duplicate topic (AEO penalizes redundancy).
              </p>
            </div>
          </div>

          {/* --- Step 2 Card --- */}
          <div className="w-full p-4 lg:p-6 border-b sm:border-r-0 lg:border-r lg:border-b-0 border-stone-200 flex flex-col gap-6 group hover:bg-stone-50/80 transition-colors">
            <GapMatrixVisual />
            <div className="flex flex-col gap-3 mt-auto">
              <div className="flex items-center">
                <div className="px-2.5 py-1 rounded border border-brand-200 bg-brand-50 text-brand-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] text-[9px] font-bold uppercase tracking-widest">
                  Step 2
                </div>
              </div>
              <h3 className="font-serif text-xl text-stone-900 leading-tight">
                The "Gap Matrix" Audit
              </h3>
              <p className="font-sans text-stone-500 text-[13px] leading-relaxed">
                We scan the entire SERP landscape to uncover exactly where your competitors are dominating, the gaps they’ve left wide open, and the high-intent keywords you're completely missing out on.              </p>
            </div>
          </div>

          {/* --- Step 3 Card --- */}
          <div className="w-full p-4 lg:p-6 border-b sm:border-r sm:border-b-0 lg:border-r border-stone-200 flex flex-col gap-6 group hover:bg-stone-50/80 transition-colors">
            <PillarVisual />
            <div className="flex flex-col gap-3 mt-auto">
              <div className="flex items-center">
                <div className="px-2.5 py-1 rounded bg-white shadow-sm ring-1 ring-stone-200 text-stone-500 text-[9px] font-bold uppercase tracking-widest">
                  Step 3
                </div>
              </div>
              <h3 className="font-serif text-xl text-stone-900 leading-tight">
                Pillar Page Strategy
              </h3>
              <p className="font-sans text-stone-500 text-[13px] leading-relaxed">
                Not all topics are created equal. We prescribe exactly which foundational "Pillar Pages" you must build to establish domain authority before we start writing long-tail content.
              </p>
            </div>
          </div>

          {/* --- Step 4 Card --- */}
          <div className="w-full p-4 lg:p-6 sm:border-b-0 border-stone-200 flex flex-col gap-6 group hover:bg-stone-50/80 transition-colors">
            <DeduplicationVisual />
            <div className="flex flex-col gap-3 mt-auto">
              <div className="flex items-center">
                <div className="px-2.5 py-1 rounded border border-brand-200 bg-brand-50 text-brand-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] text-[9px] font-bold uppercase tracking-widest">
                  Step 4
                </div>
              </div>
              <h3 className="font-serif text-xl text-stone-900 leading-tight">
                The Deduplication Loop
              </h3>
              <p className="font-sans text-stone-500 text-[13px] leading-relaxed">
                The generated 30-article roadmap is aggressively checked against your sitemap vectors. If an LLM suggests a covered topic, it's rejected until the plan is 100% net-new value.
              </p>
            </div>
          </div>

        </div>

        {/* Abstract Horizontal Pattern Bar Bottom (Grid Boundary) */}
        <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
          <CornerSquare className="-left-[5px] -top-[5px]" />
          <CornerSquare className="-right-[5px] -top-[5px]" />
        </div>

      </div>
    </section>
  );
};

export default HowItWorksSection;