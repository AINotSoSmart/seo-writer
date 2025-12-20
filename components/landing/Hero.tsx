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
        The first <span className="font-bold text-black border-b-[3px] border-brand-orange/30">Autonomous Strategy Engine</span>. designed for Generative Engine Optimization (GEO). We research, plan, draft, refine, and publish articles that humans love and AI models cite as authority.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-12 w-full sm:w-auto px-4">
        <Button variant="primary" size="lg" className="w-full sm:w-auto h-16 px-8 text-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all border-2 border-black">
          Start ranking for free
        </Button>
        <a href="#how-it-works" className="w-full sm:w-auto flex items-center justify-center gap-2 h-16 px-6 font-mono font-bold text-lg hover:bg-gray-50 rounded-lg transition-colors border-2 border-transparent">
          See the engine
          <ArrowRight className="w-5 h-5" />
        </a>
      </div>

      {/* SOCIAL PROOF / TRUST SIGNALS */}
      <div className="flex flex-col items-center gap-3 animate-fade-in-up">

        {/* Avatars + Stars */}
        <div className="flex items-center gap-3 bg-white border border-black/10 px-4 py-2 rounded-full shadow-sm">
          {/* Avatar Stack */}
          <div className="flex -space-x-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i + 42}`}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          <div className="w-px h-8 bg-gray-200 mx-1"></div>

          {/* Text & Rating */}
          <div className="flex flex-col items-start">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className="w-3 h-3 text-brand-orange fill-brand-orange" />
              ))}
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">
              Trusted by 2,000+ Writers
            </span>
          </div>
        </div>

        {/* Micro-Copy */}
        <p className="text-xs text-gray-400 font-medium font-sans">
          No credit card required · Cancel anytime · 14-day guarantee
        </p>

      </div>

    </div>
  );
};