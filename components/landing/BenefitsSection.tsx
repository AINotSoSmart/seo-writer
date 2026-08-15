import React from 'react';
import { ArrowRight, Check, Zap, Sparkles, TrendingUp } from 'lucide-react';
import Button from './Button';
import Link from 'next/link';


// --- Custom High-Fidelity Visuals ---

const AnalysisVisual = () => (
  <div className="w-full mt-8 px-2 md:px-4 pb-2">
    <div className="relative flex flex-col gap-3">
      {/* Decorative connecting line */}
      <div className="absolute left-[19.5px] top-4 bottom-8 w-0 border-l border-dashed border-stone-300 z-0"></div>
 
       {/* Competitor 1 (Background) */}
       <div className="relative flex items-center gap-4 opacity-70">
         <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-400 font-serif text-sm relative z-10 shadow-sm">
           2
         </div>
         <div className="flex-1 h-10 bg-stone-50 border border-stone-100 rounded-lg p-3 flex items-center">
            <div className="w-2/3 h-1.5 bg-stone-200/50 rounded-full"></div>
         </div>
       </div>
 
       {/* Competitor 2 (Background) */}
       <div className="relative flex items-center gap-4 opacity-70">
         <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-400 font-serif text-sm relative z-10 shadow-sm">
           3
         </div>
         <div className="flex-1 h-10 bg-stone-50 border border-stone-100 rounded-lg p-3 flex items-center">
            <div className="w-1/2 h-1.5 bg-stone-200/50 rounded-full"></div>
         </div>
       </div>

      {/* Hero Card (Your Brand) */}
      <div className="relative flex items-center gap-4 mt-1">
        {/* Premium Badge */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-b from-brand-400 to-brand-500 flex items-center justify-center text-white font-serif text-lg font-bold relative z-10 shadow-lg ring-4 ring-white">
          1
        </div>

        {/* Main Content Card */}
        <div className="flex-1 bg-white border border-brand-100 rounded-xl p-3.5 shadow-hero flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wide">Brand Authority</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-1 font-medium">Top AI Recommendation Source</div>
          </div>

          {/* Score Pill */}
          <div className="px-2.5 py-1 bg-brand-50 border border-brand-100 rounded-md text-brand-700 font-bold text-xs flex flex-col items-end leading-none gap-0.5">
            <span>98%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const GapVisual = () => (
  <div className="relative h-32 w-full flex items-center justify-center mt-4">
    {/* Solid Donut Chart */}
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 100 100" className="w-full h-full rotate-[-90deg]">
        {/* Track */}
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f5f5f4" strokeWidth="16" />
        {/* Filled Section */}
        <circle cx="50" cy="50" r="40" fill="none" stroke="#c4b5fd" strokeWidth="16" strokeDasharray="251" strokeDashoffset="100" strokeLinecap="round" />
        {/* Highlight Section */}
        <circle cx="50" cy="50" r="40" fill="none" stroke="#8b5cf6" strokeWidth="16" strokeDasharray="251" strokeDashoffset="210" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-serif font-bold text-stone-900">3x</span>
        <span className="text-[8px] font-bold text-stone-400 uppercase tracking-wider">Reach</span>
      </div>
    </div>
  </div>
);

const NetworkVisual = () => (
  <div className="relative w-full h-32 mt-4 flex items-center justify-center">
    <div className="relative w-48 h-full">
      {/* Connecting Lines */}
      <svg className="absolute inset-0 w-full h-full text-stone-300">
        <line x1="50%" y1="50%" x2="20%" y2="30%" stroke="currentColor" strokeWidth="1.5" />
        <line x1="50%" y1="50%" x2="80%" y2="30%" stroke="currentColor" strokeWidth="1.5" />
        <line x1="50%" y1="50%" x2="20%" y2="70%" stroke="currentColor" strokeWidth="1.5" />
        <line x1="50%" y1="50%" x2="80%" y2="70%" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      {/* Center Hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white border-2 border-brand-100 rounded-full flex items-center justify-center shadow-md z-10">
        <div className="w-5 h-5 bg-stone-800 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-brand-400 rounded-full"></div>
        </div>
      </div>

      {/* Satellite Nodes */}
      {[
        { top: '30%', left: '20%' },
        { top: '30%', left: '80%' },
        { top: '70%', left: '20%' },
        { top: '70%', left: '80%' }
      ].map((pos, i) => (
        <div key={i} className="absolute w-7 h-7 bg-white border border-stone-200 rounded-full flex items-center justify-center shadow-sm z-10" style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}>
          <div className="w-2.5 h-2.5 bg-brand-200 rounded-full"></div>
        </div>
      ))}
    </div>
  </div>
);

const ComparisonVisual = () => (
  <div className="relative w-full h-36 mt-4 flex items-center justify-center gap-6">
    {/* Comparison Stack */}
    <div className="relative w-full max-w-[280px] h-full flex items-center">

      {/* Back Card (Generic) */}
      <div className="absolute left-0 top-4 bottom-4 w-[60%] bg-stone-50 border border-stone-200 rounded-lg p-3 flex flex-col gap-2 opacity-60 scale-95 origin-right">
        <div className="w-12 h-2 bg-stone-200 rounded-full mb-1"></div>
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-stone-200 rounded-full"></div>
          <div className="w-3/4 h-1.5 bg-stone-200 rounded-full"></div>
        </div>
      </div>

      {/* Front Card (Premium) */}
      <div className="absolute right-0 top-0 bottom-0 w-[65%] bg-white border border-brand-100 rounded-xl shadow-hero p-4 flex flex-col justify-between z-10">
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="w-16 h-2 bg-stone-800 rounded-full"></div>
            <Check size={12} className="text-green-500 stroke-[3]" />
          </div>
          <div className="space-y-1.5 opacity-80">
            <div className="w-full h-1.5 bg-stone-100 rounded-full"></div>
            <div className="w-full h-1.5 bg-stone-100 rounded-full"></div>
            <div className="w-2/3 h-1.5 bg-stone-100 rounded-full"></div>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="px-1.5 py-0.5 bg-brand-50 text-[8px] font-bold text-brand-600 rounded uppercase tracking-wider">
            Cited
          </span>
        </div>
      </div>
    </div>
  </div>
)

const ROIGraphVisual = () => (
  <div className="relative w-full h-32 mt-auto flex items-end px-6 gap-3 pb-2">
    {/* Grid Lines */}
    <div className="absolute inset-x-4 bottom-2 top-4 border-b border-stone-100 flex flex-col justify-between z-0">
      <div className="w-full h-px bg-stone-100 border-t border-dashed border-stone-200"></div>
      <div className="w-full h-px bg-stone-100 border-t border-dashed border-stone-200"></div>
      <div className="w-full h-px bg-stone-100 border-t border-dashed border-stone-200"></div>
    </div>

    {/* Bars */}
    <div className="relative z-10 w-1/4 h-[35%] bg-stone-200 rounded-t-sm"></div>
    <div className="relative z-10 w-1/4 h-[50%] bg-stone-300 rounded-t-sm"></div>
    <div className="relative z-10 w-1/4 h-[65%] bg-stone-400 rounded-t-sm"></div>

    {/* The Hero Bar */}
    <div className="relative z-10 w-1/4 h-[90%] bg-gradient-to-t from-brand-500 to-brand-300 rounded-t-md shadow-lg flex items-start justify-center pt-2">
      <div className="bg-white/90 backdrop-blur-sm text-[8px] font-bold px-1.5 py-0.5 rounded text-brand-700 shadow-sm border border-brand-100">
        ROI
      </div>
    </div>
  </div>
);

const VelocityVisual = () => (
  <div className="relative w-full h-full min-h-[160px] flex items-center justify-center md:justify-end md:pr-10 overflow-hidden">
    {/* Abstract 'Speed' Lines Background */}
    <div className="absolute inset-y-0 right-0 w-1/2 opacity-[0.03] bg-[linear-gradient(45deg,transparent_25%,#000_25%,#000_50%,transparent_50%,transparent_75%,#000_75%,#000_100%)] bg-[length:20px_20px]"></div>

    {/* The Widget */}
    <div className="relative z-10 w-64 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-stone-100 p-4 transform transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Publishing Queue</span>
        </div>
        <div className="px-1.5 py-0.5 rounded bg-green-50 text-[9px] font-semibold text-green-600 border border-green-100">
          Active
        </div>
      </div>

      {/* Timeline Items */}
      <div className="relative space-y-3 pl-3">
        {/* Vertical Line */}
        <div className="absolute left-0 top-1 bottom-1 w-px bg-stone-100"></div>

        {/* Item 1 */}
        <div className="relative flex items-center justify-between group">
          <div className="absolute -left-[14px] w-1.5 h-1.5 rounded-full bg-stone-200 ring-2 ring-white"></div>
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-24 bg-stone-200 rounded-full group-hover:bg-stone-300 transition-colors"></div>
            <div className="h-1 w-16 bg-stone-100 rounded-full"></div>
          </div>
          <Check size={12} className="text-stone-300" />
        </div>

        {/* Item 2 (Active) */}
        <div className="relative flex items-center justify-between group">
          <div className="absolute -left-[14px] w-1.5 h-1.5 rounded-full bg-brand-400 ring-2 ring-white shadow-sm"></div>
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-20 bg-stone-800 rounded-full"></div>
            <div className="h-1 w-12 bg-stone-200 rounded-full"></div>
          </div>
          <div className="text-[9px] font-medium text-brand-500">
            Just now
          </div>
        </div>

        {/* Item 3 */}
        <div className="relative flex items-center justify-between opacity-50">
          <div className="absolute -left-[14px] w-1.5 h-1.5 rounded-full bg-stone-200 ring-2 ring-white"></div>
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-24 bg-stone-200 rounded-full"></div>
          </div>
          <span className="text-[8px] text-stone-400">Queue</span>
        </div>
      </div>
    </div>
  </div>
)

import { CornerSquare } from './CornerSquare';

const SolutionSection: React.FC = () => {
  return (
    <section id="benefits" className="w-full py-24 relative z-10">
      <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

        {/* Horizontal Pattern Bar Above Header */}
        <div className="w-full h-3 sm:h-4 border-y border-stone-200 mb-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}></div>

        {/* Header - Left/Right Premium Setup */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end mb-16 w-full px-4 md:px-8">
          <div className="flex-1">
            <span className="font-sans text-xs font-bold tracking-widest text-brand-500 uppercase mb-4 block">
              The Outcomes
            </span>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-tight">
              Drive Real ROI from your  <br /><span className='italic text-stone-500'>Content Strategy.</span>
            </h2>
          </div>
          <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
            <p className="font-sans text-stone-500 text-lg leading-relaxed">
              FlipAEO doesn't just write articles. We build an automated pipeline that turns organic search into sustainable revenue.
            </p>
            {/* Premium Layout: CTA right under the descriptive text */}
            <div className="mt-8">
              <Link href="/login">
                <Button variant="primary" className="px-8 py-3 text-sm">
                  Build My Winning Strategy
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Horizontal Pattern Bar Top (Grid Boundary) */}
        <div className="w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}></div>

        {/* Premium Wireframe Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-6 border-x border-stone-200 relative">

          {/* Main Grid Corners */}
          <CornerSquare className="-left-[5px] -top-[5px]" />
          <CornerSquare className="-right-[5px] -top-[5px]" />
          <CornerSquare className="-left-[5px] -bottom-[5px]" />
          <CornerSquare className="-right-[5px] -bottom-[5px]" />

          {/* Top Junctions */}
          <div className="hidden md:block absolute top-0 left-[66.66%] -translate-x-1/2 -translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>
          <div className="hidden md:block absolute bottom-0 left-[66.66%] -translate-x-1/2 translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>

          {/* Card 1: Clear Visibility (Large 2/3 width) */}
          <div className="md:col-span-4 bg-stone-50/30 p-8 md:p-12 flex flex-col justify-between relative md:border-r border-b border-stone-200 group transition-colors hover:bg-transparent">
            {/* Junctions at bottom of Card 1 */}
            <CornerSquare className="-left-[5px] -bottom-[5px] z-30 hidden md:block" /> { /* Edge Left Junction */}
            <CornerSquare className="-right-[5px] -bottom-[5px] z-30 hidden md:block" /> { /* Intersection Card 1, 2, 4 */}

            <div className="max-w-lg z-10 relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-md text-brand-500">
                  <Sparkles size={14} />
                </div>
                <div className="text-[10px] font-bold tracking-widest text-brand-500 uppercase">Visibility</div>
              </div>
              <h3 className="font-serif text-2xl md:text-3xl text-stone-900 mb-3 leading-tight">
                Rank in <span className="italic text-stone-500">AI Overviews</span> & Search
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm max-w-sm">
                Stop guessing what AI and search engines want. We reverse-engineer the exact answers they look for, putting your brand at the top of the results.
              </p>
            </div>
            <AnalysisVisual />
          </div>

          {/* Card 2: Competitor Gap (Small 1/3 width) */}
          <div className="md:col-span-2 bg-stone-50/30 p-8 flex flex-col items-center text-center border-b border-stone-200 group transition-colors hover:bg-stone-50/50 relative">
            <CornerSquare className="-right-[5px] -bottom-[5px] z-30 hidden md:block" /> { /* Edge Right Junction */}
            <div className="mb-auto w-full">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-md text-brand-500">
                  <TrendingUp size={14} />
                </div>
                <div className="text-[10px] font-bold tracking-widest text-brand-500 uppercase">Market Share</div>
              </div>
              <h3 className="font-serif text-2xl md:text-3xl text-stone-900 leading-tight mb-3">
                Steal Competitor Traffic
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm px-2">
                Find the lucrative search gaps your competitors are ignoring and capture their missed audience with content that perfectly matches user intent.
              </p>
            </div>
            <GapVisual />
          </div>

          {/* Card 3: Authority Building (Small 1/3 width) */}
          <div className="md:col-span-2 p-8 flex flex-col md:border-r border-b border-stone-200 group transition-colors hover:bg-stone-50/50 relative">
            <CornerSquare className="-right-[5px] -top-[5px] z-30 hidden md:block" /> { /* Row 1/2 junction at 33.3% */}
            <CornerSquare className="-left-[5px] -bottom-[5px] z-30 hidden md:block" /> { /* Edge Left Junction Row 2/3 */}
            <CornerSquare className="-right-[5px] -bottom-[5px] z-30 hidden md:block" /> { /* Intersection Card 3, 4, 5 */}
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-md text-brand-500">
                <Check size={14} />
              </div>
              <div className="text-[10px] font-bold tracking-widest text-brand-500 uppercase">Authority</div>
            </div>
            <h3 className="font-serif text-2xl md:text-3xl text-stone-900 leading-tight mb-3">
              Become the Industry Guide
            </h3>
            <p className="font-sans text-sm text-stone-500 leading-relaxed mb-4">
              Build unshakable brand trust. Content compounds over time, making your site the definitive, go-to resource in your specific niche.
            </p>
            <NetworkVisual />
          </div>

          {/* Card 4: Articles that Answer (Large 2/3 width) */}
          <div className="md:col-span-4 bg-stone-50/30 p-8 flex flex-col md:flex-row gap-8 items-center border-b border-stone-200 group transition-colors hover:bg-transparent relative">
            <CornerSquare className="-right-[5px] -bottom-[5px] z-30 hidden md:block" /> { /* Edge Right Junction Row 2/3 */}
            <div className="flex-1 order-2 md:order-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-md text-brand-500">
                  <Check size={14} />
                </div>
                <div className="text-[10px] font-bold tracking-widest text-brand-500 uppercase">Conversion</div>
              </div>
              <h3 className="font-serif text-2xl md:text-3xl text-stone-900 mb-3 leading-tight">
                Build Trust & <span className="italic text-stone-500">Convert Readers</span>
              </h3>
              <p className="text-stone-500 leading-relaxed text-sm mb-4">
                Every article fully resolves the reader's question with authority, gently guiding them towards becoming a loyal customer.
              </p>
            </div>
            <div className="flex-1 w-full order-1 md:order-2">
              <ComparisonVisual />
            </div>
          </div>

          {/* Card 6: Friction / Velocity (Wide Bottom Strip) */}
          <div className="md:col-span-4 bg-stone-50/30 p-8 flex flex-col md:flex-row items-center justify-between group md:border-r border-b border-stone-200 transition-colors hover:bg-transparent relative">
            <CornerSquare className="-right-[5px] -top-[5px] z-30 hidden md:block" /> { /* Row 2/3 junction at 66.6% */}
            <div className="relative z-10 pr-6 flex-1 mb-6 md:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-md text-brand-500">
                  <Zap size={14} fill="currentColor" />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-brand-500 uppercase">Time Savings</span>
              </div>
              <h3 className="font-serif text-2xl md:text-3xl text-stone-900 mb-3 leading-tight">
                Save 40+ Hours Every Single Month
              </h3>
              <p className="text-stone-500 text-sm max-w-md leading-relaxed">
                Eliminate the endless friction of planning, writing, formatting, and publishing. Put your entire SEO engine on autopilot and focus on growing your business.
              </p>
            </div>
            <div className="relative z-10 w-full md:w-auto flex-1">
              <VelocityVisual />
            </div>
          </div>

          {/* Card 5: ROI (Small 1/3 width) */}
          <div className="md:col-span-2 bg-stone-50/30 p-8 flex flex-col border-b border-stone-200 group transition-colors hover:bg-stone-50/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-md text-brand-500">
                <Sparkles size={14} />
              </div>
              <div className="text-[10px] font-bold tracking-widest text-brand-500 uppercase">Pipeline</div>
            </div>
            <h3 className="font-serif text-2xl md:text-3xl text-stone-900 mb-3 leading-tight">
              Measure Real Revenue Impact
            </h3>
            <p className="font-sans text-sm text-stone-500 leading-relaxed mb-4">
              Vanity traffic doesn't pay bills. We target high-intent topics that bring buyers directly to your acquisition pages.
            </p>
            <ROIGraphVisual />
          </div>

        </div>

        {/* Horizontal Pattern Bar Bottom (Grid Boundary) */}
        <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
          <CornerSquare className="-left-[5px] -top-[5px]" />
          <CornerSquare className="-right-[5px] -top-[5px]" />
          <div className="hidden md:block absolute top-0 left-[66.66%] -translate-x-1/2 -translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>
        </div>

      </div>

    </section>
  );
};

export default SolutionSection;