import {
  Search, Link2, CheckCircle2, ShoppingBag, Database, Sparkles, FileText, MousePointer2,
  LayoutGrid, MessageSquare, History, Settings2, GitPullRequest, Cpu, ShieldAlert, Target
} from 'lucide-react';

import { CornerSquare } from './CornerSquare';

// --- Visual 1: Broad Landscape Search ---
const BroadSearchVisual = () => (
  <div className="w-full h-full relative flex items-center justify-center overflow-hidden pointer-events-none">

    {/* Very subtle glow underneath just for ambient contrast */}
    <div className="absolute top-[80%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-[#A78BFA]/10 blur-2xl z-0"></div>

    {/* Connecting SVG Lines (Strict geometric mapping) */}
    <svg className="absolute inset-0 w-full h-full z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
      {/* Top flow */}
      <line x1="50" y1="20" x2="25" y2="50" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <line x1="50" y1="20" x2="50" y2="50" stroke="#e7e5e4" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="opacity-60" />
      <line x1="50" y1="20" x2="75" y2="50" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />

      {/* Bottom flow */}
      <line x1="25" y1="50" x2="50" y2="80" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" className="opacity-80" />
      <line x1="50" y1="50" x2="50" y2="80" stroke="#e7e5e4" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <line x1="75" y1="50" x2="50" y2="80" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" className="opacity-80" />
    </svg>

    {/* Step 1: Target Keyword Search Bar (Recessed) */}
    <div className="absolute top-[20%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[140px] bg-stone-50 border border-stone-200/50 rounded-md shadow-inner flex items-center px-3 py-1.5 gap-2 z-10">
      <Search size={11} className="text-stone-400 font-bold" strokeWidth={3} />
      <div className="flex-1 flex items-center border-l border-stone-200 pl-2">
        <span className="text-[10px] font-bold text-stone-700 tracking-wide pt-[1px]">Target Keyword</span>
        <span className="w-[1.5px] h-3 bg-stone-400 ml-1 block animate-pulse"></span>
      </div>
    </div>

    {/* Step 2: Top Ranking Competitor Articles */}
    {/* Rank #1 */}
    <div className="absolute top-[50%] left-[25%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-[#1C1C1C] border border-[#2A2A2A] rounded-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] px-2.5 py-1.5 z-10 transform -rotate-[4deg]">
      <FileText size={9} className="text-stone-400" strokeWidth={2.5} />
      <span className="text-[10px] font-bold text-stone-300 tracking-wide leading-none pt-[1px] pr-0.5">Rank #1</span>
    </div>

    {/* Rank #2 */}
    <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/50 rounded-md shadow-[inset_0_2px_4px_rgba(99,102,241,0.1)] px-2.5 py-1.5 z-10 transform rotate-[2deg]">
      <FileText size={9} className="text-indigo-500" strokeWidth={2.5} />
      <span className="text-[10px] font-bold text-indigo-800 tracking-wide leading-none pt-[1px] pr-0.5">Rank #2</span>
    </div>

    {/* Rank #3 */}
    <div className="absolute top-[50%] left-[75%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-stone-50 border border-stone-200/50 rounded-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] px-2.5 py-1.5 z-10 transform -rotate-[3deg]">
      <FileText size={9} className="text-stone-400" strokeWidth={2.5} />
      <span className="text-[10px] font-bold text-stone-600 tracking-wide leading-none pt-[1px] pr-0.5">Rank #3</span>
    </div>

    {/* Step 3: Raw Context Extractor */}
    <div className="absolute top-[80%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-2 bg-[#A78BFA] border border-[#8B5CF6] rounded-md shadow-[inset_0_3px_6px_rgba(0,0,0,0.2)] px-3.5 py-2 z-10">
      <Database size={11} className="text-white" strokeWidth={2.5} />
      <span className="text-[10px] font-bold text-white tracking-wide leading-none pt-[1px]">Raw Content Extracted</span>


    </div>

  </div>
);

// --- Visual 2: Critic Agent ---
const CriticVisual = () => (
  <div className="w-full h-full relative overflow-hidden flex items-center justify-center pointer-events-none">
    
    {/* Subtle ambient glow matching BroadSearchVisual */}
    <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-stone-200/20 blur-2xl z-0"></div>

    {/* Layer 0: Competitor Data Window - Stone palette, soft borders */}
    <div className="absolute w-[280px] bg-stone-50 border border-stone-200 rounded-md shadow-inner transform -rotate-[5deg] -translate-x-10 -translate-y-6 z-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-stone-100">
        <div className="flex items-center gap-1 opacity-40">
          <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />
          <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />
        </div>
        <span className="font-mono text-[7px] text-stone-400 uppercase tracking-widest">competitor_data.raw</span>
      </div>
      <div className="p-3 space-y-1.5 opacity-30">
        <div className="h-1 w-full bg-stone-200" />
        <div className="h-1 w-5/6 bg-stone-200" />
        <div className="h-1 w-4/6 bg-stone-200" />
        <div className="h-1 w-full bg-stone-200" />
      </div>
    </div>

    {/* Main Critic Review Window - Clean, professional, stone-based */}
    <div className="absolute w-[300px] bg-white border border-stone-200 rounded-md shadow-sm transform translate-x-4 translate-y-2 z-10 flex flex-col">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-stone-50/50">
        <div className="flex items-center gap-2.5 text-stone-300">
          <LayoutGrid size={12} />
          <MessageSquare size={12} />
        </div>
        <div className="flex items-center gap-2">
          <div className="px-1.5 py-0.5 text-[8px] font-bold text-stone-500 border border-stone-200 uppercase tracking-tighter bg-white">
            Audit v1.4
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold text-stone-700 bg-stone-100 border border-stone-200">
            <Sparkles size={10} className="text-stone-500" />
            CRITIC
          </div>
        </div>
      </div>

      {/* Review Findings List - Soft, descriptive */}
      <div className="p-1">
        <div className="flex items-center justify-between p-2.5 opacity-40">
          <div className="flex items-center gap-2.5">
            <Link2 size={12} className="text-stone-400" />
            <h4 className="text-[10px] font-bold text-stone-500">Website Citations</h4>
          </div>
          <span className="text-[7px] font-mono text-stone-400 border border-stone-100 px-1 py-0.5">COVERED</span>
        </div>

        <div className="flex items-center justify-between p-2.5 opacity-40 border-t border-stone-50">
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={12} className="text-stone-400" />
            <h4 className="text-[10px] font-bold text-stone-500">Product Comparison</h4>
          </div>
          <span className="text-[7px] font-mono text-stone-400 border border-stone-100 px-1 py-0.5">COVERED</span>
        </div>

        {/* The GAP - Highlighted with brand accent logic */}
        <div className="m-1 p-2.5 bg-stone-50 border border-stone-200 rounded shadow-inner" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(245, 245, 244, 0.5) 10px, rgba(245, 245, 244, 0.5) 11px)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={12} className="text-stone-700" />
              <h4 className="text-[10px] font-bold text-stone-800 uppercase tracking-tight">B2B Pricing Data</h4>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-stone-800 text-white text-[8px] font-bold tracking-tighter">
              GAP <Target size={8} />
            </div>
          </div>
          <p className="text-[9px] text-stone-500 leading-tight italic">Differential engine detected zero competitor pricing data.</p>
          <div className="mt-2 text-[7px] font-mono text-stone-400 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 shadow-[0_0_4px_rgba(34,197,94,0.4)]" />
             SNIPER QUERY TRIGGERED
          </div>
        </div>
      </div>

    </div>
  </div>
);


// --- Visual 3: Sniper Search ---
const SniperVisual = () => (
  <div className="w-full h-full relative overflow-hidden flex items-center justify-center pointer-events-none">
    
    {/* Background layer: Subtle data noise in stone palette */}
    <div className="absolute inset-0 opacity-[0.03] grayscale flex flex-col gap-4 p-8 scale-110">
      {Array(8).fill(0).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="h-1 w-1/3 bg-stone-900" />
          <div className="h-1 w-full bg-stone-900" />
        </div>
      ))}
    </div>

    {/* The Sniper Viewfinder - SVG Overlay (Softened) */}
    <svg className="absolute inset-0 w-full h-full z-10 opacity-[0.05]" viewBox="0 0 100 100">
      <path d="M 35 15 L 15 15 L 15 35" fill="none" stroke="#000" strokeWidth="0.5" />
      <path d="M 65 15 L 85 15 L 85 35" fill="none" stroke="#000" strokeWidth="0.5" />
      <path d="M 35 85 L 15 85 L 15 65" fill="none" stroke="#000" strokeWidth="0.5" />
      <path d="M 65 85 L 85 85 L 85 65" fill="none" stroke="#000" strokeWidth="0.5" />
    </svg>

    {/* Primary UI Window - Recessed style matching BroadSearch */}
    <div className="relative w-[80%] bg-white border border-stone-200 rounded-md shadow-sm z-20 flex flex-col">
      
      {/* Top Bar - Clean, Stone-based */}
      <div className="flex items-center justify-between px-3 py-2 bg-stone-50 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Target size={11} className="text-stone-400 font-bold" />
          <span className="font-mono text-[8px] font-bold text-stone-500 uppercase tracking-widest">Sniper_Search.log</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-stone-300" />
          <span className="font-mono text-[7px] text-stone-400">ACTIVE</span>
        </div>
      </div>

      <div className="p-3">
        {/* The Query being targeted */}
        <div className="bg-stone-50 border border-stone-100 rounded p-2 mb-3 shadow-inner">
          <div className="flex items-center gap-1.5 mb-1 opacity-50">
             <Search size={9} className="text-stone-400" />
             <span className="text-[7px] font-mono text-stone-500 uppercase">Target Query</span>
          </div>
          <p className="text-[10px] font-serif italic text-stone-700 leading-tight">
            "Exact ROI of B2B SaaS 2026 comparison statistics"
          </p>
        </div>

        {/* The Extraction Result */}
        <div className="space-y-2">
          <div className="flex justify-between items-end border-b border-stone-50 pb-1.5">
            <div className="flex flex-col">
               <span className="text-[7px] font-mono text-stone-300 uppercase tracking-widest">Extracted</span>
               <span className="text-[10px] font-bold text-stone-800">ROI: 342.5%</span>
            </div>
            <div className="text-[8px] font-mono text-stone-400 px-1 border border-stone-100 rounded">98% Match</div>
          </div>
          
          {/* Metrics - Soft progress bars */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="h-[2px] w-full bg-stone-100">
                <div className="h-full w-full bg-stone-400" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="h-[2px] w-full bg-stone-100">
                <div className="h-full w-1/3 bg-stone-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    {/* Floating Identifier - Bottom matching brand accent logic */}
    <div className="absolute top-[15%] right-[5%] z-30">
       <div className="bg-stone-800 text-white font-mono text-[7px] px-2 py-0.5 shadow-sm transform rotate-4">
          SNIPER_ID_482
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
          <div className="w-10 h-10 bg-stone-50 border-2 border-stone-500 rounded-lg flex items-center justify-center shadow-sm group hover:-translate-y-1 transition-transform">
            <FileText size={18} className="text-stone-700" />
          </div>
          <span className="text-[8px] font-bold border border-stone-200 px-1 py-0.5 rounded bg-white">Copy / Export</span>
        </div>
      </div>
    </div>
  </div>
);


const FEATURES = [
  {
    id: '01',
    title: 'Observed Query Harvest',
    description: "The plan starts with queries observed in autocomplete, ranking pages, and competitor sites. Each row keeps its source URL, so the input pool can be inspected instead of trusted blindly.",
    visual: BroadSearchVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '02',
    title: 'Evidence-Checked Coverage',
    description: "Retrieval finds the most relevant pages, then a second evidence check verifies that a page actually answers the query. Topic similarity alone never counts as coverage.",
    visual: CriticVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '03',
    title: 'Source-Backed Article Research',
    description: "Once a verified gap becomes an article, focused live research gathers the facts, examples, and citations needed to answer it completely.",
    visual: SniperVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '04',
    title: 'Cluster-Wide Internal Linking',
    description: "Related articles are planned and shipped as a complete cluster, so their internal links can resolve together instead of pointing at pages that do not exist yet.",
    visual: SemanticLinkingVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '05',
    title: 'Publication-Ready Writing',
    description: "The writing loop uses the accumulated research and brand profile to create answer-first sections, useful tables, lists, citations, and custom images without padding a word count.",
    visual: AntiFluffVisual,
    colSpan: 'col-span-1'
  },
  {
    id: '06',
    title: 'Ready For Human Review',
    description: "Finalized articles are delivered for review with headings, tables, citations, internal links, and images. Publish to WordPress or copy the finished draft into any CMS.",
    visual: CMSVisual,
    colSpan: 'col-span-1'
  }
];

const FeatureCard: React.FC<{ feature: typeof FEATURES[0]; index: number }> = ({ feature, index }) => (
  <div className={`flex flex-col p-4 md:p-6 border-b border-stone-200 group transition-colors hover:bg-stone-50/50 ${index % 2 === 0 ? 'md:border-r' : ''}`}>

    {/* Visual Area */}
    <div className="h-80 w-full relative flex items-center justify-center bg-stone-100 border border-stone-200/40 rounded-lg overflow-hidden mb-8">
      {/* Subtle active grid pattern on hover */}
      <div className="absolute inset-0 opacity-[0.05] transition-opacity duration-500"
        style={{ backgroundImage: 'radial-gradient(#e7e5e4 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
      </div>
      <div className="z-10 w-full h-full flex items-center justify-center">
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
              The Cluster Delivery <br /><span className='italic text-stone-500'>Content Engine</span>
            </h2>
          </div>
          <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
            <p className="font-sans text-stone-500 text-lg leading-relaxed">
              Your audit discloses the finish line. FlipAEO then researches, writes,
              links, and delivers whole clusters at the velocity you selected.
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
