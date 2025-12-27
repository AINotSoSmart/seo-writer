import React from 'react';
import { Button } from './Button';
import { ArrowRight, Sparkles, Star } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="flex flex-col items-center text-center max-w-5xl mx-auto pt-6 md:pt-10 relative z-10">

      {/* Background Glow (Subtle) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-orange/5 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* Badge */}
      <div className="inline-flex items-center justify-center bg-brand-orange border-2 border-black shadow-neo-sm px-4 py-1.5 transform -rotate-2 mb-8 hover:rotate-0 transition-transform duration-300 cursor-default">
        <span className="font-display font-bold uppercase tracking-wider text-sm">
          THE POST-SEO ERA IS HERE
        </span>
      </div>

      {/* Headline */}
      <h1 className="font-display font-black text-5xl md:text-6xl lg:text-[6rem] leading-[0.9] tracking-tighter mb-8 text-black uppercase">
        Don’t just rank<br />
        <span className="text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black">
          Be the Source AI cites.
        </span>
      </h1>

      {/* Subtext */}
      <p className="font-sans text-gray-600 text-lg md:text-2xl max-w-3xl mb-12 leading-relaxed font-medium px-4">
        FlipAEO is an <span className="font-bold text-black border-b-[3px] border-brand-orange/30">Strategic Content Engine</span> designed for Generative Engine Optimization (GEO). We analyze your brand, competitors, and visibility gaps to decide what content should exist, what should come next, and what actually moves authority forward before it ever writes a word.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-12 w-full sm:w-auto px-4">
        <Button variant="primary" size="lg" className="w-full sm:w-auto h-16 px-8 text-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all border-2 border-black">
          Build My Growth Strategy
        </Button>
        <a href="#how-it-works" className="w-full sm:w-auto flex items-center justify-center gap-2 h-16 px-6 font-mono font-bold text-lg hover:bg-gray-50 rounded-lg transition-colors border-2 border-transparent">
          See the engine
          <ArrowRight className="w-5 h-5" />
        </a>
      </div>

      {/* SOCIAL PROOF / TRUST SIGNALS */}
      <div className="flex flex-col items-center gap-4 animate-fade-in-up">

        {/* Trust Badge - Neo-Brutalist Style */}
        <div className="flex items-center gap-4 bg-white border-2 border-black px-5 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 hover:rotate-0 transition-all duration-300">

          {/* Avatar Stack */}
          <div className="flex -space-x-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-9 h-9 rounded-full border-2 border-black bg-[#D6F5F2] flex items-center justify-center overflow-hidden shadow-sm">
                <img
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i + 42}`}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-[2px] h-10 bg-black"></div>

          {/* Rating & Text */}
          <div className="flex flex-col gap-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className="w-4 h-4 text-brand-orange fill-brand-orange" />
              ))}
            </div>
            <span className="font-display font-bold text-xs uppercase tracking-wider text-black">
              2,000+ Writers Trust Us
            </span>
          </div>
        </div>

        {/* Micro-Copy as Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {['No credit card', 'Cancel anytime', '14-day guarantee'].map((text, idx) => (
            <span
              key={idx}
              className="bg-[#FAFA9D] border-2 border-black px-3 py-1 font-mono font-bold text-xs uppercase tracking-wide shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {text}
            </span>
          ))}
        </div>

      </div>

    </div>
  );
};