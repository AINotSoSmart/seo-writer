
import React from 'react';
import {

  BrainCircuit,
  Fingerprint,
  Check,
  X,

  Sparkles,
  AlertCircle,
  Database,
  Bot
} from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      id: "01",
      title: "AI Search Visibility Scan",
      description: "See how ChatGPT, Gemini, and Claude answer questions in your category and whether your brand appears at all. Understand where you’re invisible and which conversations you need to enter.",
      color: "bg-[#FAFA9D]", // Yellow
      Graphic: VisibilityScanGraphic
    },
    {
      id: "02",
      title: "Answer-First Generation",
      description: "Articles are written to explain clearly and completely, not to pad keywords. Built for how humans read and how AI systems evaluate trust.",
      color: "bg-[#FFD8A8]", // Orange
      Graphic: AnswerFirstGraphic
    },
    {
      id: "03",
      title: "30-Day Authority-Driven Content Plan",
      description: "A structured plan where each article supports the next. Designed to build topical authority instead of publishing disconnected posts.",
      color: "bg-[#D6F5F2]", // Teal
      Graphic: AuthorityPlanGraphic
    },
    {
      id: "04",
      title: "Competitor Gap Analysis",
      description: "Identify where competitors fall short in their explanations. Create content that wins by being more useful, not louder.",
      color: "bg-[#FFC8C8]", // Soft Red
      Graphic: GapAnalysisGraphic
    },
    {
      id: "05",
      title: "Optional Google Search Console Layer",
      description: "Use real impressions and near-ranking queries to sharpen decisions. Focus effort where you’re already close to winning.",
      color: "bg-[#C8D6FF]", // Soft Blue
      Graphic: GSCGraphic
    },
    {
      id: "06",
      title: "WordPress & Webflow Publishing",
      description: "Publish directly or export clean markdown. No formatting fixes. No workflow friction.",
      color: "bg-gray-100", // Gray
      Graphic: CMSGraphic
    },
    {
      id: "07",
      title: "Topic Memory & De-Duplication",
      description: "Never repeat the same idea twice. Each new plan builds on what’s already been published.",
      color: "bg-[#E8C8FF]", // Soft Purple
      Graphic: TopicMemoryGraphic
    },
    {
      id: "08",
      title: "Brand Voice Consistency",
      description: "Your tone, positioning, and language stay consistent across every article. No generic AI voice. No reset every month.",
      color: "bg-[#C8FFC8]", // Soft Green
      Graphic: BrandVoiceGraphic
    }
  ];

  return (
    <section className="w-full py-24 px-4 flex flex-col items-center bg-white border-b-2 border-black relative overflow-hidden">

      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col items-center text-center mb-20 md:mb-32 max-w-4xl mx-auto relative z-10">
        <div className="inline-block bg-white border-2 border-black shadow-neo-sm px-4 py-1 mb-6 transform rotate-1 hover:rotate-0 transition-transform">
          <span className="font-display font-black text-xs uppercase tracking-widest">Features</span>
        </div>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-tight mb-6 uppercase">
          How we make you win<br />modern AI search
        </h2>
        <p className="font-sans text-gray-600 text-lg md:text-xl leading-relaxed max-w-2xl">
          A focused set of capabilities designed around clarity, authority, and compounding growth. No bloated SEO suite. No distractions.
        </p>
      </div>

      {/* Features List - Zig Zag Layout */}
      <div className="w-full max-w-7xl flex flex-col gap-24 md:gap-32 relative z-10">
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
        <div className={`relative w-full aspect-[4/3] md:aspect-square lg:aspect-[4/3] rounded-xl border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex items-center justify-center group`}>
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

// --- VISUAL GRAPHICS COMPONENTS ---

const VisibilityScanGraphic = () => (
  <div className="w-full max-w-sm bg-white border-2 border-black shadow-neo rounded-xl overflow-hidden flex flex-col relative min-h-[300px]">
    {/* Radar Screen Background */}
    <div className="absolute inset-0 bg-dot-pattern opacity-50 z-0"></div>

    {/* Header */}
    <div className="relative z-10 h-10 border-b-2 border-black bg-gray-50 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400 border border-black"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-black"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-green-400 border border-black"></div>
      </div>
      <div className="font-mono text-[10px] font-bold text-gray-400">SCAN_ID: 8X-29</div>
    </div>

    {/* Radar Content */}
    <div className="relative z-10 p-6 flex flex-col items-center justify-center flex-grow">

      {/* Scanning Line Animation */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="w-[200%] h-full absolute top-0 left-[-100%] bg-gradient-to-r from-transparent via-brand-yellow/30 to-transparent animate-[scan_3s_linear_infinite]"></div>
      </div>

      {/* Central Hub (Your Brand) */}
      <div className="relative z-20 mb-8">
        <div className="w-16 h-16 bg-brand-yellow border-2 border-black rounded-full flex items-center justify-center shadow-neo relative">
          <div className="absolute inset-0 bg-brand-yellow rounded-full animate-ping opacity-20"></div>
          <Database className="w-8 h-8 text-black" />
        </div>
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-black">YOUR BRAND</span>
        </div>
      </div>

      {/* Orbiting Satellites */}
      <div className="w-full grid grid-cols-3 gap-2 mt-4">
        {/* ChatGPT */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 bg-[#D6F5F2] border-2 border-black rounded-full flex items-center justify-center shadow-sm z-20 transition-transform hover:scale-110">
            <Bot className="w-5 h-5 text-black" />
          </div>
          <div className="text-[10px] font-bold bg-green-100 text-green-700 border border-black px-1.5 rounded">VISIBLE</div>
        </div>

        {/* Gemini */}
        <div className="flex flex-col items-center gap-2 pt-8">
          <div className="w-10 h-10 bg-[#C8D6FF] border-2 border-black rounded-full flex items-center justify-center shadow-sm z-20 opacity-80">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div className="text-[10px] font-bold bg-gray-100 text-gray-500 border border-black px-1.5 rounded animate-pulse">SCANNING</div>
        </div>

        {/* Claude */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 bg-[#FFD8A8] border-2 border-black rounded-full flex items-center justify-center shadow-sm z-20 transition-transform hover:scale-110">
            <BrainCircuit className="w-5 h-5 text-black" />
          </div>
          <div className="text-[10px] font-bold bg-red-100 text-red-700 border border-black px-1.5 rounded">GAP FOUND</div>
        </div>
      </div>
    </div>

    {/* Footer Log */}
    <div className="relative z-10 border-t-2 border-black bg-black p-2 flex justify-between items-center">
      <span className="text-[#00ff00] font-mono text-[10px] animate-pulse">● LIVE ANALYSIS</span>
      <span className="text-gray-400 font-mono text-[10px]">3/3 MODELS</span>
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

const GapAnalysisGraphic = () => (
  <div className="w-full max-w-[300px] h-48 flex items-end justify-center gap-6 px-4 border-b-2 border-black pb-2 relative">
    {/* Competitor */}
    <div className="w-16 flex flex-col items-center gap-2 group">
      <div className="text-xs font-bold text-gray-400 mb-1">THEM</div>
      <div className="w-full h-24 bg-gray-200 border-2 border-black border-dashed relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400">
          <AlertCircle className="w-6 h-6" />
        </div>
      </div>
    </div>

    {/* Gap Indicator */}
    <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center animate-pulse">
      <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200 mb-1">GAP</span>
      <div className="h-12 w-0.5 bg-red-300"></div>
    </div>

    {/* You */}
    <div className="w-16 flex flex-col items-center gap-2">
      <div className="text-xs font-bold text-black mb-1">YOU</div>
      <div className="w-full h-36 bg-[#FFC8C8] border-2 border-black shadow-[4px_-4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20"></div>
        <div className="absolute bottom-2 left-0 w-full h-1 bg-white/20"></div>
      </div>
    </div>
  </div>
);

const GSCGraphic = () => (
  <div className="w-full max-w-sm bg-white border-2 border-black p-4 shadow-neo relative">
    <div className="flex justify-between items-center mb-6">
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-gray-400 uppercase">Total Clicks</span>
        <span className="font-display font-black text-2xl">1,248</span>
      </div>
      <div className="flex flex-col text-right">
        <span className="text-[10px] font-bold text-gray-400 uppercase">Impressions</span>
        <span className="font-display font-black text-2xl text-[#C8D6FF]">45.2k</span>
      </div>
    </div>
    {/* Chart */}
    <div className="h-24 w-full flex items-end gap-2 relative">
      <div className="absolute bottom-4 left-0 right-0 h-0.5 bg-gray-100"></div>
      <div className="absolute bottom-12 left-0 right-0 h-0.5 bg-gray-100"></div>

      {/* Bars */}
      <div className="flex-1 bg-[#C8D6FF] border-t-2 border-x-2 border-black h-[30%]"></div>
      <div className="flex-1 bg-[#C8D6FF] border-t-2 border-x-2 border-black h-[45%]"></div>
      <div className="flex-1 bg-[#C8D6FF] border-t-2 border-x-2 border-black h-[40%]"></div>
      <div className="flex-1 bg-[#C8D6FF] border-t-2 border-x-2 border-black h-[60%]"></div>
      <div className="flex-1 bg-[#C8D6FF] border-t-2 border-x-2 border-black h-[85%] relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-black rounded-full"></div>
      </div>
      <div className="flex-1 bg-[#C8D6FF] border-t-2 border-x-2 border-black h-[75%]"></div>
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

const TopicMemoryGraphic = () => (
  <div className="relative w-full max-w-[280px] h-[200px] flex items-center justify-center">
    {/* Center Node */}
    <div className="absolute z-20 w-16 h-16 bg-[#E8C8FF] border-2 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <BrainCircuit className="w-8 h-8 text-black" />
    </div>

    {/* Orbiting Nodes */}
    <div className="absolute top-4 left-4 w-12 h-12 bg-white border-2 border-black rounded-full flex items-center justify-center">
      <Check className="w-5 h-5 text-green-500" />
    </div>
    <div className="absolute bottom-4 right-10 w-12 h-12 bg-white border-2 border-black rounded-full flex items-center justify-center">
      <Check className="w-5 h-5 text-green-500" />
    </div>

    {/* Duplicate Node (Rejected) */}
    <div className="absolute top-10 right-0 w-14 h-14 bg-red-50 border-2 border-black border-dashed rounded-full flex items-center justify-center opacity-80 animate-bounce">
      <X className="w-6 h-6 text-red-500" />
      <span className="absolute -top-4 text-[10px] font-bold bg-red-500 text-white px-1">DUPE</span>
    </div>

    {/* Connector Lines */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
      <line x1="30%" y1="30%" x2="50%" y2="50%" stroke="black" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="70%" y1="80%" x2="50%" y2="50%" stroke="black" strokeWidth="2" strokeDasharray="4 4" />
    </svg>
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
