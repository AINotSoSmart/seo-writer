

import { Zap, ArrowRight, Play, Cpu, Search, Database, Globe, Fingerprint, Box } from 'lucide-react';
import { ProductMockup } from './ProductMockup';

const LOGOS = [
  { name: 'ChatGPT', icon: <Zap size={18} /> },
  { name: 'Claude', icon: <Cpu size={18} /> },
  { name: 'Perplexity', icon: <Search size={18} /> },
  { name: 'Gemini', icon: <Database size={18} /> },
  { name: 'Bing AI', icon: <Globe size={18} /> },
  { name: 'Llama 3', icon: <Fingerprint size={18} /> },
  { name: 'Mistral', icon: <Box size={18} /> },
];

const HeroSection = () => {
  return (
    <section className="relative pt-32 md:pt-48 min-h-screen flex flex-col items-center justify-start overflow-hidden pb-12">

      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-white via-transparent to-transparent z-10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-orange-200/30 to-yellow-200/30 blur-3xl rounded-full pointer-events-none" />

      <div className="max-w-7xl w-full mx-auto px-4 relative z-10 flex flex-col items-center text-center mb-24">

        {/* Top Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-ink shadow-brutalist-sm rounded-none transition-transform hover:-translate-y-0.5 cursor-default">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-signal"></span>
          </span>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink/80">
            Indexing Claude 3.5 & Gemini 1.5
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif leading-[0.95] tracking-tight mb-8 max-w-5xl">
          Are you <span className="italic text-signal font-light">invisible</span> to <br className="hidden md:block" />
          the machines?
        </h1>

        {/* Subtitle */}
        <p className="font-mono text-sm md:text-base text-ink/70 max-w-2xl mb-10 leading-relaxed">
          FlipAEO extracts your brand voice and runs a real-time visibility check across ChatGPT, Perplexity, and Claude. We turn zero answers into a prioritized, answer-first content plan.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-20">
          <button className="group relative px-8 py-4 bg-ink text-white font-mono font-bold text-sm tracking-wide shadow-brutalist hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-3">
            START FREE VISIBILITY CHECK
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="px-8 py-4 bg-white border border-ink text-ink font-mono font-bold text-sm tracking-wide shadow-brutalist hover:bg-paper hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-2">
            <Play className="w-4 h-4 fill-ink" />
            WATCH DEMO
          </button>
        </div>

        {/* --- PRODUCT MOCKUP CONTAINER --- */}
        <div className="w-full relative max-w-6xl mx-auto px-2 md:px-0">
          <ProductMockup />
        </div>

      </div>

      {/* Marquee Stripe - Full Edge-to-Edge Width */}
      <div className="w-full border-y border-ink bg-white py-6 relative z-20 overflow-hidden">
        {/* Wrapper for animation */}
        <div className="flex w-max animate-marquee">
          {/* 
              We render the list of logos twice.
              The animation moves the container -50% to the left.
              When it hits -50%, it snaps back to 0 (which looks identical to -50%), creating a seamless loop.
            */}
          {[0, 1].map((setIndex) => (
            <div key={setIndex} className="flex items-center gap-16 md:gap-32 px-8 md:px-16">
              {LOGOS.map((logo, i) => (
                <div key={i} className="flex items-center gap-3 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                  <div className="text-signal">{logo.icon}</div>
                  <span className="font-mono text-sm md:text-base font-bold uppercase tracking-widest text-ink whitespace-nowrap">
                    {logo.name}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

    </section>
  );
};

export default HeroSection;