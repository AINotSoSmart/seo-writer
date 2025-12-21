import React from 'react';
import {
  BrainCircuit,
  Fingerprint,
  Check,
  X,
  Sparkles,
  AlertCircle,
  Database,
  Bot,
  FileText
} from 'lucide-react';

// --- VISUAL GRAPHICS COMPONENTS (Defined BEFORE usage to avoid hoisting errors) ---

const VisibilityScanGraphic = () => (
  <div className="w-full max-w-sm bg-white border-2 border-black shadow-neo overflow-hidden flex flex-col relative min-h-[300px]">
    {/* Header */}
    <div className="h-10 border-b-2 border-black bg-gray-50 flex items-center justify-between px-4">
      <span className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-wider">Category_Intelligence.json</span>
      <div className="flex gap-1.5">
        <div className="w-2 h-2 rounded-full bg-gray-300 border border-black"></div>
        <div className="w-2 h-2 rounded-full bg-gray-300 border border-black"></div>
      </div>
    </div>

    {/* Dashboard Content */}
    <div className="p-6 flex flex-col gap-6 bg-white">
      {/* Score Card */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">AI Readiness Score</div>
          <div className="font-display font-black text-4xl">42<span className="text-xl text-gray-400">/100</span></div>
        </div>
        <div className="px-2 py-1 bg-red-100 border border-black text-[10px] font-bold text-red-700 rounded">
          CRITICAL GAPS
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="space-y-3">
        {/* Metric 1 */}
        <div className="flex items-center justify-between p-3 border border-gray-100 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white border border-black flex items-center justify-center">
              <Database className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-900">Brand Mentions</div>
              <div className="text-[9px] text-gray-500">In top 10 search results</div>
            </div>
          </div>
          <div className="font-mono font-bold text-sm">0/10</div>
        </div>

        {/* Metric 2 */}
        <div className="flex items-center justify-between p-3 border border-gray-100 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white border border-black flex items-center justify-center">
              <Bot className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-900">Competitor Dominance</div>
              <div className="text-[9px] text-gray-500">Share of voice</div>
            </div>
          </div>
          <div className="font-mono font-bold text-sm">High</div>
        </div>
      </div>

      {/* Footer Insight */}
      <div className="mt-auto border-t border-dashed border-gray-200 pt-4">
        <div className="flex gap-2 text-[10px]">
          <AlertCircle className="w-4 h-4 text-brand-orange" />
          <span className="font-medium text-gray-600 leading-tight">Your brand is missing from 85% of informational queries in this category.</span>
        </div>
      </div>
    </div>
  </div>
);

const BrandVoiceGraphic = () => (
  <div className="w-full max-w-[260px] bg-white border-2 border-black p-6 shadow-neo">
    <div className="space-y-4">
      {/* Slider 1 */}
      <div>
        <div className="flex justify-between text-xs font-bold mb-1">
          <span>PROFESSIONAL</span>
          <span>85%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 border-2 border-black rounded-full relative">
          <div className="absolute top-0 left-0 bottom-0 w-[85%] bg-[#C8FFC8] border-r-2 border-black rounded-l-full"></div>
          <div className="absolute top-1/2 left-[85%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-black rounded-full shadow-sm"></div>
        </div>
      </div>
      {/* Slider 2 */}
      <div>
        <div className="flex justify-between text-xs font-bold mb-1">
          <span>WITTY</span>
          <span>40%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 border-2 border-black rounded-full relative">
          <div className="absolute top-0 left-0 bottom-0 w-[40%] bg-brand-yellow border-r-2 border-black rounded-l-full"></div>
          <div className="absolute top-1/2 left-[40%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-black rounded-full shadow-sm"></div>
        </div>
      </div>
      {/* Slider 3 */}
      <div>
        <div className="flex justify-between text-xs font-bold mb-1">
          <span>TECHNICAL</span>
          <span>90%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 border-2 border-black rounded-full relative">
          <div className="absolute top-0 left-0 bottom-0 w-[90%] bg-black border-r-2 border-black rounded-l-full"></div>
          <div className="absolute top-1/2 left-[90%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-black rounded-full shadow-sm"></div>
        </div>
      </div>
    </div>
  </div>
);

const ResearchGraphic = () => (
  <div className="w-full max-w-[300px] bg-white border-2 border-black p-4 shadow-neo flex flex-col gap-3 relative">
    {/* Header */}
    <div className="flex items-center justify-between border-b-2 border-black pb-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-red-500 rounded-full border border-black"></div>
        <span className="font-mono text-[10px] font-bold">DEEP_RESEARCH.logs</span>
      </div>
    </div>

    {/* Content */}
    <div className="space-y-2 font-mono text-[10px]">
      <div className="bg-gray-50 p-2 border border-dashed border-black/20 text-gray-400">
        &gt; Initial Scan... Found 12 generic articles.
      </div>
      <div className="bg-red-50 p-2 border border-black text-red-800 font-medium animate-pulse">
        &gt; CRITIC: Missing pricing data.
      </div>
      <div className="bg-blue-50 p-2 border border-black text-blue-800">
        &gt; AGENT: Hunting specific pricing tables...
      </div>
      <div className="bg-green-50 p-2 border-2 border-black text-green-800 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        &gt; ACQUIRED: 2025 Benchmarks found.
      </div>
    </div>
  </div>
);

const InternalLinkGraphic = () => (
  <div className="relative w-full max-w-[280px] h-[220px] bg-white border-2 border-black p-4 shadow-neo flex items-center justify-center">
    {/* Nodes */}
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-12 w-full justify-center">
      <div className="w-12 h-12 bg-gray-100 border-2 border-black rounded-lg flex items-center justify-center opacity-60">
        <FileText className="w-5 h-5 text-gray-400" />
      </div>
      <div className="w-12 h-12 bg-gray-100 border-2 border-black rounded-lg flex items-center justify-center opacity-60">
        <FileText className="w-5 h-5 text-gray-400" />
      </div>
    </div>

    {/* Center New Node */}
    <div className="w-16 h-16 bg-[#E8C8FF] border-2 border-black rounded-lg flex items-center justify-center z-20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
      <div className="absolute -top-3 -right-3 bg-black text-white text-[9px] font-bold px-1.5 py-0.5 border border-black transform rotate-6">NEW</div>
      <Check className="w-8 h-8 text-black" />
    </div>

    {/* Connection Lines (SVG) */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
      {/* Dynamic connecting lines */}
      <path d="M140 110 L90 50" stroke="black" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_1s_linear_infinite]" />
      <path d="M140 110 L190 50" stroke="black" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_1s_linear_infinite]" />
    </svg>

    <div className="absolute bottom-4 text-center w-full">
      <span className="font-mono text-[9px] bg-black text-white px-2 py-0.5">CONTEXTUAL_LINKING: ACTIVE</span>
    </div>
  </div>
);

const CitationsGraphic = () => (
  <div className="w-full max-w-[300px] h-48 bg-gray-50 border-2 border-black p-0 shadow-neo relative overflow-hidden flex flex-col">
    {/* Browser Bar */}
    <div className="bg-white border-b-2 border-black px-3 py-2 flex items-center gap-2">
      <div className="w-2 h-2 rounded-full border border-black bg-gray-200"></div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full border border-black/10"></div>
    </div>

    {/* Content Area */}
    <div className="p-4 relative">
      <div className="w-3/4 h-2 bg-gray-200 mb-2"></div>
      <div className="w-full h-2 bg-gray-200 mb-2"></div>

      {/* Highlighted Citation */}
      <div className="inline-block relative group cursor-help">
        <span className="bg-[#C8D6FF] border-b-2 border-blue-400 px-0.5 font-bold text-xs">According to Statista (2024),</span>

        {/* Tooltip Popup */}
        <div className="absolute bottom-full mb-2 left-0 w-48 bg-black text-white p-2 rounded text-[9px] border-2 border-white shadow-lg z-20">
          <div className="font-bold text-[#C8D6FF] mb-1">VERIFIED SOURCE</div>
          <div className="opacity-80 truncate">statista.com/stats/market-share...</div>
          <div className="mt-1 flex gap-1">
            <span className="bg-green-500 text-black px-1 rounded-[1px] font-bold">DR 92</span>
            <span className="bg-green-500 text-black px-1 rounded-[1px] font-bold">TRUSTED</span>
          </div>
          {/* Tooltip Arrow */}
          <div className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black"></div>
        </div>
      </div>

      <span className="inline-block w-1/3 h-2 bg-gray-200 ml-1"></span>
    </div>
  </div>
);

const AuthorityPlanGraphic = () => (
  <div className="flex items-center justify-center gap-2 md:gap-4 w-full">
    {/* Day 1 */}
    <div className="flex flex-col items-center gap-2">
      <div className="w-16 h-20 bg-white border-2 border-black shadow-sm flex flex-col items-center justify-center p-2 relative">
        <div className="text-[10px] font-bold text-gray-400">DAY 01</div>
        <div className="w-full h-1 bg-gray-200 my-1"></div>
        <div className="w-2/3 h-1 bg-gray-200"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#D6F5F2] border-2 border-black rounded-full flex items-center justify-center">
          <Check className="w-2 h-2" />
        </div>
      </div>
    </div>
    {/* Arrow */}
    <div className="h-0.5 w-8 bg-black"></div>
    {/* Day 2 */}
    <div className="flex flex-col items-center gap-2 transform -translate-y-4">
      <div className="w-16 h-20 bg-[#D6F5F2] border-2 border-black shadow-neo flex flex-col items-center justify-center p-2">
        <div className="text-[10px] font-bold text-black">DAY 02</div>
        <div className="w-full h-1 bg-black/10 my-1"></div>
        <div className="w-2/3 h-1 bg-black/10"></div>
      </div>
    </div>
    {/* Arrow */}
    <div className="h-0.5 w-8 bg-black"></div>
    {/* Day 3 */}
    <div className="flex flex-col items-center gap-2">
      <div className="w-16 h-20 bg-white border-2 border-black border-dashed flex flex-col items-center justify-center p-2 opacity-50">
        <div className="text-[10px] font-bold text-gray-400">DAY 03</div>
        <div className="w-full h-1 bg-gray-200 my-1"></div>
      </div>
    </div>
  </div>
);

const AnswerFirstGraphic = () => (
  <div className="relative w-full max-w-[300px]">
    {/* Document */}
    <div className="bg-white border-2 border-black p-6 shadow-neo rotate-2 relative z-10">
      <div className="w-3/4 h-4 bg-black/10 mb-4"></div>
      <div className="space-y-2 mb-6">
        <div className="w-full h-2 bg-gray-200"></div>
        <div className="w-full h-2 bg-gray-200"></div>
        <div className="w-2/3 h-2 bg-gray-200"></div>
      </div>
      {/* Highlight Box */}
      <div className="border-2 border-brand-orange bg-orange-50 p-3 relative">
        <div className="absolute -top-3 -right-3 bg-brand-orange border-2 border-black p-1 rounded-full">
          <Sparkles className="w-4 h-4 text-black" />
        </div>
        <div className="w-full h-2 bg-brand-orange/20 mb-2"></div>
        <div className="w-1/2 h-2 bg-brand-orange/20"></div>
      </div>
    </div>
    {/* Badge */}
    <div className="absolute -bottom-4 -left-4 z-20 bg-black text-white px-3 py-1 text-xs font-bold border-2 border-white shadow-lg">
      STRUCTURE_OPTIMIZED
    </div>
  </div>
);

const CMSGraphic = () => (
  <div className="flex items-center gap-4">
    {/* Source */}
    <div className="w-20 h-24 bg-white border-2 border-black shadow-sm flex flex-col items-center justify-center p-2">
      <div className="w-8 h-8 bg-black rounded-full mb-2"></div>
      <div className="w-10 h-1 bg-gray-200"></div>
    </div>

    {/* Arrow */}
    <div className="flex flex-col items-center gap-1">
      <div className="w-12 h-1 bg-black relative">
        <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-black transform rotate-45"></div>
      </div>
      <span className="text-[10px] font-bold uppercase bg-green-100 px-1 border border-black">Synced</span>
    </div>

    {/* Targets */}
    <div className="flex flex-col gap-2">
      <div className="w-32 h-10 bg-gray-100 border-2 border-black flex items-center px-3 gap-2">
        <div className="w-4 h-4 rounded-full bg-blue-500 border border-black"></div>
        <span className="text-xs font-bold">WordPress</span>
      </div>
      <div className="w-32 h-10 bg-gray-100 border-2 border-black flex items-center px-3 gap-2">
        <div className="w-4 h-4 rounded-full bg-blue-300 border border-black"></div>
        <span className="text-xs font-bold">Webflow</span>
      </div>
    </div>
  </div>
);

// --- MAIN FEATURE COMPONENT ---

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      id: "01",
      title: "AI Readiness & Category Intelligence",
      description: "We analyze how search engines and AI models understand your category. Find the exact gaps where competitors are winning and your brand is invisible.",
      color: "bg-[#FAFA9D]", // Yellow
      Graphic: VisibilityScanGraphic
    },
    {
      id: "02",
      title: "Brand Voice Consistency",
      description: "Your tone, positioning, and language stay consistent across every article. No generic AI voice. No reset every month.",
      color: "bg-[#C8FFC8]", // Soft Green
      Graphic: BrandVoiceGraphic
    },
    {
      id: "03",
      title: "Multi-Stage 'Expert' Research",
      description: "Most tools guess. Ours digs deep. We uncover the specific details, expert nuances, and data points that make your content genuinely helpful—and impossible for generic AI to replicate.",
      color: "bg-[#FFC8C8]", // Soft Red
      Graphic: ResearchGraphic
    },
    {
      id: "04",
      title: "Semantic Internal Linking",
      description: "We automatically weave your new articles into your existing content ecosystem. No orphan pages, just a perfectly interconnected site structure that Google loves.",
      color: "bg-[#E8C8FF]", // Soft Purple
      Graphic: InternalLinkGraphic
    },
    {
      id: "05",
      title: "Instant Credibility & Trust",
      description: "We validate our content with real-time links to authoritative sources. Your articles come pre-loaded with the trust signals needed to rank and convert.",
      color: "bg-[#C8D6FF]", // Soft Blue
      Graphic: CitationsGraphic
    },
    {
      id: "06",
      title: "30-Day Authority-Driven Content Plan",
      description: "A structured plan where each article supports the next. Designed to build topical authority instead of publishing disconnected posts.",
      color: "bg-[#D6F5F2]", // Teal
      Graphic: AuthorityPlanGraphic
    },
    {
      id: "07",
      title: "Answer-First Generation",
      description: "Articles are written to explain clearly and completely, not to pad keywords. Built for how humans read and how AI systems evaluate trust.",
      color: "bg-[#FFD8A8]", // Orange
      Graphic: AnswerFirstGraphic
    },
    {
      id: "08",
      title: "WordPress & Webflow Publishing",
      description: "Publish directly or export clean markdown. No formatting fixes. No workflow friction.",
      color: "bg-gray-100", // Gray
      Graphic: CMSGraphic
    }
  ];

  return (
    <section className="w-full py-24 px-4 flex flex-col items-center relative overflow-hidden">


      {/* Header */}
      <div className="flex flex-col items-center text-center mb-20 md:mb-32 max-w-4xl mx-auto relative z-10">
        <div className="inline-block bg-white border-2 border-black shadow-neo-sm px-4 py-1 mb-6 transform rotate-1 hover:rotate-0 transition-transform">
          <span className="font-display font-black text-xs uppercase tracking-widest">Features</span>
        </div>
        <h2 className="font-display text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black text-4xl md:text-6xl leading-tight mb-6 uppercase">
          How we make you win<br />modern AI search
        </h2>
        <p className="font-sans text-gray-600 text-lg md:text-xl leading-relaxed max-w-2xl">
          A focused set of capabilities designed around clarity, authority, and compounding growth. No bloated SEO suite. No distractions.
        </p>
      </div>

      {/* Features List - Zig Zag Layout */}
      <div className="w-full max-w-6xl flex flex-col gap-24 md:gap-32 relative z-10">
        {features.map((feature, index) => (
          <FeatureRow
            key={feature.id}
            feature={feature}
            isReversed={index % 2 !== 0}
          />
        ))}
      </div>

    </section>
  );
};

interface FeatureRowProps {
  feature: {
    id: string;
    title: string;
    description: string;
    color: string;
    Graphic: React.FC;
  };
  isReversed: boolean;
}

const FeatureRow: React.FC<FeatureRowProps> = ({ feature, isReversed }) => {
  const { Graphic } = feature;

  return (
    <div className={`flex flex-col md:flex-row items-center gap-12 md:gap-24 ${isReversed ? 'md:flex-row-reverse' : ''}`}>

      {/* Text Side */}
      <div className="flex-1 flex flex-col items-start text-left">
        <div className={`inline-flex items-center justify-center h-10 px-3 mb-6 border-2 border-black ${feature.color} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
          <span className="font-mono font-bold text-sm uppercase tracking-wider">Feature {feature.id}</span>
        </div>
        <h3 className="font-display font-black text-3xl md:text-4xl mb-6 uppercase leading-tight">
          {feature.title}
        </h3>
        <p className="font-sans text-gray-600 text-lg leading-relaxed font-medium max-w-xl">
          {feature.description}
        </p>
      </div>

      {/* Graphic Side */}
      <div className="flex-1 w-full relative">
        <div className={`relative w-full aspect-[4/3] md:aspect-square lg:aspect-[4/3] border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex items-center justify-center group`}>
          {/* Background Pattern */}
          <div className={`absolute inset-0 ${feature.color} opacity-20 bg-dot-pattern`}></div>

          {/* Graphic Content */}
          <div className="relative w-full h-full p-8 md:p-12 flex items-center justify-center">
            <Graphic />
          </div>

          {/* Hover Effect overlay */}
          <div className="absolute inset-0 border-4 border-transparent group-hover:border-black/5 transition-all duration-300 pointer-events-none rounded-xl"></div>
        </div>
      </div>

    </div>
  );
};
