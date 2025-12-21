
import React from 'react';
import { Zap, Target, FileText, TrendingUp } from 'lucide-react';

export const BenefitsSection: React.FC = () => {
  return (
    <section className="w-full py-24 px-4 flex flex-col items-center">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-16 max-w-3xl">
        <div className="inline-block bg-brand-orange border-2 border-black shadow-neo-sm px-4 py-1 mb-8 transform -rotate-1 hover:rotate-0 transition-transform">
          <span className="font-display font-black text-xs uppercase tracking-widest">The solution</span>
        </div>
        <h2 className="font-display text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black text-4xl md:text-6xl leading-tight mb-6 uppercase">
          We write for Humans and<br />Modern AI Search.
        </h2>
        <p className="font-sans text-gray-500 text-lg md:text-xl leading-relaxed">
          FlipAEO doesn't just write articles. We reverse-engineer how AI models think to put your brand inside the answer.
        </p>
      </div>

      {/* Bento Grid */}
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Card 1: Real-Time Visibility (Yellow, Span 2) */}
        <div className="md:col-span-2 bg-[#FAFA9D] border-2 border-black p-8 shadow-neo flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden group hover:shadow-neo-hover transition-all duration-200">
          <div className="flex-1 z-10">
            <h3 className="font-display font-black text-2xl md:text-3xl mb-4 uppercase">Clear visibility into where you need to win</h3>
            <p className="font-sans font-medium text-black/80 leading-relaxed text-lg">
              We analyze how AI search engines answer questions in your category and where your brand is missing from those answers.            </p>
          </div>
          {/* Graphic: AI Citation Mockup */}
          <div className="bg-white border-2 border-black rounded-xl p-4 w-64 shadow-sm transform rotate-2 group-hover:rotate-0 transition-transform duration-300 shrink-0">
            <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
              <div className="w-2 h-2 rounded-full bg-red-400 border border-black"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-400 border border-black"></div>
              <div className="w-2 h-2 rounded-full bg-green-400 border border-black"></div>
              <span className="ml-auto text-[10px] font-bold text-gray-400 uppercase tracking-wider">AI Analysis</span>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-200 p-2 rounded text-[10px] font-mono text-gray-500">
                &gt; User: Best tool for SEO?
              </div>
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-brand-yellow border border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-3 h-3 text-black fill-black" />
                </div>
                <div className="text-[10px] leading-relaxed font-medium">
                  Based on performance, <span className="bg-brand-orange px-1 border border-black border-dashed">FlipAEO</span> is the top recommended solution.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Competitor Gap (White, Span 1) */}
        <div className="md:col-span-1 bg-white border-2 border-black p-8 shadow-neo hover:shadow-neo-hover transition-all duration-200 flex flex-col justify-center">
          <div className="w-12 h-12 bg-brand-orange border-2 border-black rounded-full flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Target className="w-6 h-6 text-black" />
          </div>
          <h3 className="font-display font-black text-xl mb-3 uppercase leading-tight">Competitor Gap Domination</h3>
          <p className="font-sans text-gray-600 leading-relaxed text-sm font-medium">
            Your competitors are winning because they answered the question better. We analyze their content to find the "Gaps" they missed—and we exploit them.
          </p>
        </div>

        {/* Card 3: Authority Strategy (White, Span 1) */}
        <div className="md:col-span-1 bg-white border-2 border-black p-8 shadow-neo hover:shadow-neo-hover transition-all duration-200 flex flex-col justify-center">
          <div className="w-12 h-12 bg-[#D6F5F2] border-2 border-black rounded-full flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <FileText className="w-6 h-6 text-black" />
          </div>
          <h3 className="font-display font-black text-xl mb-3 uppercase leading-tight">Authority-Building Strategy</h3>
          <p className="font-sans text-gray-600 leading-relaxed text-sm font-medium">
            Every article is part of a connected plan designed to build topical authority over time, not isolated posts that go nowhere.
          </p>
        </div>

        {/* Card 4: Quality Articles (Teal, Span 2) */}
        <div className="md:col-span-2 bg-[#D6F5F2] border-2 border-black p-8 shadow-neo flex flex-col md:flex-row items-center gap-8 hover:shadow-neo-hover transition-all duration-200">
          <div className="flex-1">
            <h3 className="font-display font-black text-2xl md:text-3xl mb-4 uppercase">Quality Articles That Beat the Noise</h3>
            <p className="font-sans font-medium text-black/80 leading-relaxed text-lg">
              Most AI content reads like a Wikipedia summary. Ours reads like a field report. We validate every claim to ensure your content is technically accurate and impossible to ignore.
            </p>
          </div>

          {/* Comparison Visual */}
          <div className="flex-1 w-full max-w-sm bg-white border-2 border-black rounded-lg p-1 shadow-sm text-[10px] md:text-xs">
            <div className="grid grid-cols-2 border-b-2 border-black">
              <div className="p-2 border-r-2 border-black bg-gray-50 text-gray-400 font-bold text-center">GENERIC AI</div>
              <div className="p-2 bg-teal-50 text-teal-800 font-bold text-center">FLIPAEO</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="p-4 border-r-2 border-black text-gray-400 leading-relaxed font-serif italic">
                "In the rapidly evolving landscape of digital marketing, it is crucial to leverage synergies..."
              </div>
              <div className="p-4 bg-white text-black leading-relaxed font-medium">
                "Stop wasting budget on broad keywords. First, identify the 3 questions your customers ask before buying..."
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Traffic (Orange, Span 2) */}
        <div className="md:col-span-2 bg-[#FFD8A8] border-2 border-black p-8 shadow-neo flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden group hover:shadow-neo-hover transition-all duration-200">
          <div className="flex-1 z-10">
            <h3 className="font-display font-black text-2xl md:text-3xl mb-4 uppercase">Turning near-rankings into real traffic</h3>
            <p className="font-sans font-medium text-black/80 leading-relaxed text-lg">
              Visibility without clicks stops being a dead end. We focus on intent and clarity so impressions turn into engagement and growth.
            </p>
          </div>
          {/* Graphic: Traffic Chart */}
          <div className="bg-white border-2 border-black rounded-xl p-5 w-64 shadow-sm transform -rotate-1 group-hover:rotate-0 transition-transform duration-300 shrink-0">
            <div className="flex justify-between items-end h-24 gap-3 px-2 pb-0 border-b-2 border-black mb-3">
              <div className="w-full bg-gray-100 h-[30%] border-2 border-b-0 border-black relative group-hover:h-[35%] transition-all"></div>
              <div className="w-full bg-gray-200 h-[50%] border-2 border-b-0 border-black relative group-hover:h-[55%] transition-all"></div>
              <div className="w-full bg-brand-yellow h-[70%] border-2 border-b-0 border-black relative group-hover:h-[85%] transition-all shadow-sm">
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold bg-white border border-black px-1 py-0.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">ROI</div>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-center pt-1">
              <TrendingUp className="w-4 h-4 text-black" />
              <span className="font-display font-bold text-sm uppercase tracking-wide">Growth Unlocked</span>
            </div>
          </div>
        </div>

        {/* Card 6: Friction (White, Span 1) */}
        <div className="md:col-span-1 bg-white border-2 border-black p-8 shadow-neo hover:shadow-neo-hover transition-all duration-200 flex flex-col justify-center">
          <div className="w-12 h-12 bg-[#FAFA9D] border-2 border-black rounded-full flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Zap className="w-6 h-6 text-black fill-black" />
          </div>
          <h3 className="font-display font-black text-xl mb-3 uppercase leading-tight">Content That Doesn’t Slow You Down</h3>
          <p className="font-sans text-gray-600 leading-relaxed text-sm font-medium">
            Writing, formatting, publishing — it all becomes friction. We remove the overhead so content stops being a task and starts being leverage.
          </p>
        </div>

      </div>
    </section>
  );
};
