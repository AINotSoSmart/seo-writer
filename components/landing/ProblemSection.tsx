import React from 'react';
import { CornerSquare } from './CornerSquare';

const DotGridIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-brand-300">
    <circle cx="4" cy="4" r="2.5" fill="currentColor" />
    <circle cx="14" cy="4" r="2.5" fill="currentColor" />
    <circle cx="24" cy="4" r="2.5" fill="currentColor" />

    <circle cx="4" cy="14" r="2.5" fill="currentColor" />
    <circle cx="14" cy="14" r="2.5" fill="currentColor" />
    <circle cx="24" cy="14" r="2.5" fill="currentColor" />

    <circle cx="4" cy="24" r="2.5" fill="currentColor" />
    <circle cx="14" cy="24" r="2.5" fill="currentColor" />
    <circle cx="24" cy="24" r="2.5" fill="currentColor" />
  </svg>
);

const ProblemSection: React.FC = () => {
  return (
    <section className="w-full pb-24 relative z-10">
      <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

        {/* Header - Left/Right Premium Setup */}
        <div className="border-t border-stone-200 flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end py-16 w-full px-4 md:px-8">
          <div className="flex-1">
            <span className="font-sans text-xs font-bold tracking-widest text-stone-400 uppercase mb-4 block">
              The Hard Reality
            </span>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1]">
              Why AI Engines are <br /><span className='italic text-stone-500'>Ghosting Your Brand</span>
            </h2>
          </div>
          <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
            <p className="font-sans text-stone-500 text-lg leading-relaxed">
              You’re publishing more than ever, yet your brand is nowhere to be found in ChatGPT, Perplexity, or Gemini. You aren’t just losing rankings; you’re losing the trust of the engines that control the answers.
            </p>
          </div>
        </div>

        {/* Horizontal Pattern Bar Top (Grid Boundary) */}
        <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
          <CornerSquare className="-left-[5px] -bottom-[5px]" />
          <CornerSquare className="-right-[5px] -bottom-[5px]" />
        </div>

        {/* Problem Grid - Bordered Bento Style */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-l border-r border-stone-200 relative">



          {/* Junctions */}
          <div className="hidden md:block absolute top-0 left-[33.33%] -translate-x-1/2 -translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>
          <div className="hidden md:block absolute top-0 left-[66.66%] -translate-x-1/2 -translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>
          <div className="hidden md:block absolute bottom-0 left-[33.33%] -translate-x-1/2 -translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>
          <div className="hidden md:block absolute bottom-0 left-[66.66%] -translate-x-1/2 -translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>

          {/* Item 1 */}
          <div className="flex flex-col group p-4 md:p-8 md:border-r border-b border-stone-200 transition-colors hover:bg-stone-50/50">
            <div className="mb-8">
              <DotGridIcon />
            </div>
            <div className="mt-auto">
              <h3 className="font-serif text-2xl text-stone-900 mb-4 tracking-tight">
                Tracking your failure won't fix it
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm lg:text-base">
                Knowing you are invisible in a "Visibility Tracker" is like weighing yourself every hour while you're starving. A scorecard doesn't tell you how to be found, it just confirms you’re being ignored while your competitors take the traffic.
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex flex-col group p-4 md:p-8 md:border-r border-b border-stone-200 transition-colors hover:bg-stone-50/50">
            <div className="mb-8">
              <DotGridIcon />
            </div>
            <div className="mt-auto">
              <h3 className="font-serif text-2xl text-stone-900 mb-4 tracking-tight">
                Your Authority has "Holes."
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm lg:text-base">
                AI search engines ignore you because your topical coverage is incomplete. When a user asks a real question, the LLM spots a "semantic gap" in your content and recommends a competitor who sounds more like an expert. You’re a partial source in a world that only cites the "Guru".
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex flex-col group p-4 md:p-8 border-b border-stone-200 transition-colors hover:bg-stone-50/50">
            <div className="mb-8">
              <DotGridIcon />
            </div>
            <div className="mt-auto">
              <h3 className="font-serif text-2xl text-stone-900 mb-4 tracking-tight">
                Generic content is just background noise.
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm lg:text-base">
                One-click AI articles that read like Wikipedia summaries are killing your growth. They have no unique data, no brand voice, and no "soul". LLMs spot generic bot-filler in 3 seconds and skip you for content that actually provides a real answer.
              </p>
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

export default ProblemSection;