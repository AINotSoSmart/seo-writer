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
              Why Content Fails
            </span>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1]">
              200 posts. <br /><span className='italic text-stone-500'>No pipeline.</span>
            </h2>
          </div>
          <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
            <p className="font-sans text-stone-500 text-lg leading-relaxed">
              This is how it usually goes. Two years of publishing, a respectable archive, and no way to say which posts did anything. The problem was never the volume. It was writing hard in a direction nobody ever checked.
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
                Nobody’s job is content
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm lg:text-base">
                Every SEO playbook assumes a strategist, a writer and an editor. You have four to eight hours a week and a product to ship. The advice isn’t wrong — it’s just written for a team you do not have.
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
                The two real options both hurt
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm lg:text-base">
                Hire an agency at $3,000 to $15,000 a month, forever. Or buy a $19 tool that writes about anything you type and proves none of it. One is unaffordable early; the other is why your archive is full of posts nobody reads.
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
                Nobody shows their working
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm lg:text-base">
                Ask either one where a topic came from and you get a shrug or a model’s guess. You cannot tell a real opportunity from a confident invention, and you are the one who pays to find out which it was.
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