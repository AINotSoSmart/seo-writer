import React from 'react';
import { Search, Link2, CheckCircle2, ShoppingBag } from 'lucide-react';

import { CornerSquare } from './CornerSquare';

// --- Visual 1: Broad Landscape Search ---
const BroadSearchVisual = () => (
  <div className="w-full h-full flex items-center justify-center p-6">
    <div className="w-full max-w-[240px] bg-white border border-stone-100 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-stone-50 pb-2">
        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Broad Scrape</span>
        <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded animate-pulse">FETCHING</span>
      </div>

      <div className="flex items-end gap-1">
        <span className="text-4xl font-serif text-stone-900 leading-none">24k</span>
        <span className="text-sm text-stone-400 font-medium mb-1">words</span>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[9px] font-medium text-stone-500">
            <span>Competitor 1</span>
            <span>4,200/w</span>
          </div>
          <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div className="w-[85%] h-full bg-stone-300"></div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[9px] font-medium text-stone-500">
            <span>Competitor 2</span>
            <span>3,100/w</span>
          </div>
          <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div className="w-[60%] h-full bg-stone-300"></div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 items-start mt-1">
        <div className="w-3 h-3 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <div className="w-1 h-1 bg-brand-500 rounded-full"></div>
        </div>
        <p className="text-[8px] text-stone-500 leading-snug">
          Ingesting massive real-time SERP context before writing.
        </p>
      </div>
    </div>
  </div>
);

// --- Visual 2: Critic Agent ---
const CriticVisual = () => (
  <div className="w-full h-full flex items-center justify-center p-6">
    <div className="w-full max-w-[240px] bg-stone-900 rounded-lg p-3 shadow-lg flex flex-col gap-2 font-mono text-[8px] leading-relaxed border border-stone-800">
      <div className="flex gap-1.5 mb-1 border-b border-stone-800 pb-2">
        <div className="w-2 h-2 rounded-full bg-red-500"></div>
        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
      </div>

      <div className="text-stone-400">
        <span className="text-blue-400"></span> Analysing 24k Context Words...
      </div>

      <div className="bg-red-500/10 border-l-2 border-red-500 pl-2 py-1 text-red-200 my-1">
        <span className="font-bold">CRITIC AGENT:</span> Missing B2B pricing data. Do not write generic filler.
      </div>

      <div className="text-stone-300 opacity-60">
        Drafting Halted. Awaiting Sniper query.
      </div>
    </div>
  </div>
);

// --- Visual 3: Sniper Search ---
const SniperVisual = () => (
  <div className="w-full h-full flex items-center justify-center p-6">
    <div className="relative w-full max-w-[200px] bg-white border border-stone-100 rounded-lg p-3 shadow-sm flex flex-col gap-0">
      <div className="flex items-center justify-between border-b border-stone-50 pb-2 mb-2">
        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Sniper Search</span>
        <Search size={10} className="text-brand-500" />
      </div>

      <div className="bg-stone-50 border border-stone-100 p-2 rounded mb-3">
        <span className="text-stone-600 font-serif italic text-[10px] leading-none">"B2B SaaS average ROI statistics numerical values exactly 2026"</span>
      </div>

      <div className="relative border-l border-stone-100 ml-1.5 space-y-3 py-1">
        <div className="relative pl-4">
          <div className="absolute -left-[3px] top-1 w-1.5 h-1.5 rounded-full bg-brand-500 ring-2 ring-brand-100 shadow-sm animate-pulse"></div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-stone-800">Target Acquired</span>
            <div className="text-[7px] text-stone-500 mt-0.5">"Average B2B ROI is 342% in Year 1."</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- Visual 4: Semantic Linking ---
const SemanticLinkingVisual = () => (
  <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-stone-50/30">
    <div className="relative w-full max-w-[240px] h-40 flex flex-col items-center justify-center">

      <div className="relative z-10 bg-white border border-stone-200 shadow-md rounded-lg p-2.5 flex items-center gap-2 mb-8">
        <div className="w-6 h-6 bg-stone-900 rounded flex items-center justify-center text-white">
          <Link2 size={12} />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-stone-900">Current Outline</span>
          <span className="text-[7px] text-brand-500">Drafting Section 2...</span>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-8 bg-stone-300"></div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-24 h-8 border-t border-r border-l border-stone-300 rounded-t-lg -mt-[1px]"></div>
      </div>

      <div className="flex gap-4 z-10">
        <div className="bg-white border border-stone-100 shadow-sm rounded px-2 py-1.5 flex flex-col items-center opacity-60">
          <span className="text-[8px] font-serif italic text-stone-500">"What is SEO?"</span>
        </div>

        <div className="bg-white border border-brand-200 shadow-sm rounded px-2 py-1.5 flex flex-col items-center relative group">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-50 text-brand-600 text-[6px] font-bold px-1 rounded border border-brand-100 whitespace-nowrap">
            94% MATCH LINK
          </div>
          <span className="text-[8px] font-serif italic font-bold text-stone-900">"B2B AI ROI"</span>
        </div>

        <div className="bg-white border border-stone-100 shadow-sm rounded px-2 py-1.5 flex flex-col items-center opacity-60">
          <span className="text-[8px] font-serif italic text-stone-500">"Pricing 2025"</span>
        </div>
      </div>

    </div>
  </div>
);

// --- Visual 5: Anti Fluff ---
const AntiFluffVisual = () => (
  <div className="w-full h-full flex items-center justify-center p-6">
    <div className="w-full max-w-[220px] bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      <div className="bg-stone-900 px-3 py-1.5 flex justify-between items-center">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-stone-700"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-stone-700"></div>
        </div>
        <span className="text-[7px] font-mono text-stone-400">AEO_EXECUTION</span>
      </div>

      <div className="p-3 flex flex-col gap-3">
        <div className="border border-brand-200 bg-brand-50/50 rounded p-2">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[7px] font-bold text-stone-800 border-b border-brand-300 pb-0.5">FORMATTING: TABLE</span>
          </div>
          <div className="w-full border border-stone-200 rounded grid grid-cols-2 text-[6px] font-mono overflow-hidden">
             <div className="bg-stone-100 p-1 border-b border-r border-stone-200 text-stone-600 font-bold">Feature</div>
             <div className="bg-stone-100 p-1 border-b border-stone-200 text-stone-600 font-bold">Value</div>
             <div className="p-1 border-r border-stone-200 text-stone-500">Speed</div>
             <div className="p-1 text-stone-500">10ms</div>
          </div>
        </div>

        <div className="bg-stone-50 rounded p-2 space-y-1 relative">
          <div className="w-full h-1 bg-stone-200 rounded-full"></div>
          <div className="w-2/3 h-1 bg-stone-200 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-2 bg-red-50 border border-red-200 text-red-600 shadow-sm text-[5px] font-bold px-1 rounded transform rotate-1 whitespace-nowrap">
            STOP RULE TRIGGERED
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- Visual 6: CMS ---
const CMSVisual = () => (
  <div className="w-full h-full flex items-center justify-center p-6 relative">
    <div className="flex flex-col items-center gap-4 w-full max-w-[200px]">
      <div className="relative z-10 bg-stone-900 text-white px-4 py-2 rounded-lg shadow-lg flex flex-col items-center">
        <span className="text-[8px] font-bold tracking-widest text-brand-400 mb-0.5">SOURCE</span>
        <span className="font-serif font-bold text-lg leading-none">FlipAEO</span>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-4 bg-stone-900"></div>
      </div>

      <div className="w-full h-8 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-stone-300 border-l border-r border-stone-300 border-dashed bg-transparent"></div>
        <div className="absolute top-0 left-1/2 w-20 h-full border-t-2 border-r-2 border-stone-300 rounded-tr-xl border-dashed transform -translate-x-[2px]"></div>
        <div className="absolute top-0 right-1/2 w-20 h-full border-t-2 border-l-2 border-stone-300 rounded-tl-xl border-dashed transform translate-x-[2px]"></div>
      </div>

      <div className="flex justify-between w-full gap-2">
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 bg-white border-2 border-stone-800 rounded-lg flex items-center justify-center shadow-sm group hover:-translate-y-1 transition-transform">
            <span className="font-serif font-bold text-xl text-stone-800">W</span>
          </div>
          <span className="text-[8px] font-bold border border-stone-200 px-1 py-0.5 rounded bg-white">Wordpress</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 bg-green-50 border-2 border-green-600 rounded-lg flex items-center justify-center shadow-sm group hover:-translate-y-1 transition-transform">
            <ShoppingBag size={18} className="text-green-700" />
          </div>
          <span className="text-[8px] font-bold border border-stone-200 px-1 py-0.5 rounded bg-white">Shopify</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 bg-blue-50 border-2 border-blue-600 rounded-lg flex items-center justify-center shadow-sm group hover:-translate-y-1 transition-transform">
            <div className="font-bold text-blue-700 italic text-sm">wf</div>
          </div>
          <span className="text-[8px] font-bold border border-stone-200 px-1 py-0.5 rounded bg-white">Webflow</span>
        </div>
      </div>
    </div>
  </div>
);


const FEATURES = [
  {
    id: '01',
    title: 'Broad Landscape Search',
    description: "Instead of guessing what to write, our agent first reads the top ranking competitor articles for your keyword. It extracts thousands of words of their raw content to understand exactly what information search engines are currently rewarding.",
    visual: BroadSearchVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '02',
    title: 'The "Critic Agent" Gap Analysis',
    description: "A specialized 'Critic' agent scans the competitor data to find exactly what they missed. Rather than summarizing the internet, it hunts for critical gaps like missing pricing tiers, exact statistics, or user reviews. This ensures your article provides unique, high-value answers.",
    visual: CriticVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '03',
    title: 'The "Sniper Search"',
    description: "Once the gaps are identified, a secondary agent fires highly targeted web searches to hunt down the exact missing statistics or facts. This guarantees your final article contains the highest 'Information Gain' possible to outrank generic AI content.",
    visual: SniperVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '04',
    title: 'Smart Outline & Semantic Linking',
    description: "As your outline is built, our engine scans your entire website's history. Whenever a new section matches a topic you've already covered, it automatically injects a natural internal link. This builds a massive, compounding map of topical authority.",
    visual: SemanticLinkingVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '05',
    title: 'The "Anti-Fluff" AEO Writing Loop',
    description: "We write section-by-section using a 'Context Snowball' so the LLM never repeats itself. The engine enforces strict formatting mandates, breaking complex data into Markdown tables, bulleted lists, and bolded entities for maximum machine-readability.",
    visual: AntiFluffVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '06',
    title: 'Ready For Human Review',
    description: "Finalized articles are delivered to your inbox for review, complete with optimized headings, markdown tables, and custom images. We believe AI is powerful, but serious growth requires a personal human touch before exporting to your CMS.",
    visual: CMSVisual,
    colSpan: 'col-span-1'
  }
];

const FeatureCard: React.FC<{ feature: typeof FEATURES[0]; index: number }> = ({ feature, index }) => (
  <div className={`flex flex-col p-8 md:p-12 border-b border-stone-200 group transition-colors hover:bg-stone-50/50 ${index % 2 === 0 ? 'md:border-r' : ''}`}>

    {/* Visual Area */}
    <div className="h-64 w-full relative flex items-center justify-center bg-white border border-stone-100 rounded-lg overflow-hidden mb-8">
      {/* Subtle active grid pattern on hover */}
      <div className="absolute inset-0 opacity-[0.05] transition-opacity duration-500"
        style={{ backgroundImage: 'radial-gradient(#e7e5e4 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
      </div>
      <div className="scale-90 transform transition-transform duration-500 group-hover:scale-100 z-10 w-full h-full flex items-center justify-center">
        {feature.visual && <feature.visual />}
      </div>
    </div>

    {/* Content Area */}
    <div className="flex flex-col mt-auto">
      <div className="flex items-center gap-3 mb-4">
        {/* Feature Number Pill */}
        <span className="flex items-center justify-center h-6 px-2.5 rounded-[4px] border border-brand-200 bg-brand-50 text-[10px] font-bold tracking-wider text-brand-600 shadow-sm transition-colors">
          {feature.id}
        </span>
      </div>

      <h3 className="font-serif text-2xl text-stone-900 leading-tight mb-3">
        {feature.title}
      </h3>

      <p className="font-sans text-sm text-stone-500 leading-relaxed">
        {feature.description}
      </p>
    </div>

  </div>
);

const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="w-full py-24 relative z-10">
      <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

        {/* Horizontal Pattern Bar Above Header */}
        <div className="w-full h-3 sm:h-4 border-y border-stone-200 mb-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}></div>

        {/* Header - Left/Right Premium Setup */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end mb-16 w-full px-4 md:px-8">
          <div className="flex-1">
            <span className="font-sans text-xs font-bold tracking-widest text-brand-500 uppercase mb-4 block">
              Phase 2
            </span>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1]">
              The Daily Autonomous <br /><span className='italic text-stone-500'>AEO Writer</span>
            </h2>
          </div>
          <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
            <p className="font-sans text-stone-500 text-lg leading-relaxed">
              This entire sequence runs automatically in the background every single day. No loading screens. Set it, forget it, and simply get an email when your highly-structured article is ready for human review.
            </p>
          </div>
        </div>

        {/* Horizontal Pattern Bar Top (Grid Boundary) */}
        <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
          <CornerSquare className="-left-[5px] -bottom-[5px]" />
          <CornerSquare className="-right-[5px] -bottom-[5px]" />
        </div>

        {/* 2-Column Grid Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-x border-stone-200  relative bg-stone-50/50">

          {/* Main Grid Corners */}
          <CornerSquare className="-left-[5px] -top-[5px]" />
          <CornerSquare className="-right-[5px] -top-[5px]" />
          <CornerSquare className="-left-[5px] -bottom-[5px]" />
          <CornerSquare className="-right-[5px] -bottom-[5px]" />

          {/* Vertical Divider Junctions (Static Top/Bottom Middle) */}
          <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>
          <div className="hidden md:block absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <CornerSquare className="-left-[4px] -top-[4px]" />
          </div>

          {FEATURES.map((feature, index) => (
            <div key={index} className="relative">
              {/* Dynamic Junction Markers */}
              {index % 2 === 0 && index < FEATURES.length - 2 && (
                <>
                  <CornerSquare className="-left-[5px] -bottom-[5px] z-30 hidden md:block" />
                  <CornerSquare className="-right-[5px] -bottom-[5px] z-30 hidden md:block" />
                </>
              )}
              {index % 2 === 1 && index < FEATURES.length - 2 && (
                <CornerSquare className="-right-[5px] -bottom-[5px] z-30 hidden md:block" />
              )}

              <FeatureCard feature={feature} index={index} />
            </div>
          ))}
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

export default FeaturesSection;