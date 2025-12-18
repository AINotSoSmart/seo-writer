import React from 'react';
import { Button } from './Button';
import { ArrowRight, Hourglass } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
      {/* Badge */}
      <div className="inline-flex items-center justify-center bg-brand-orange border-2 border-black shadow-neo-sm px-4 py-1.5 transform -rotate-2 mb-8 hover:rotate-0 transition-transform duration-300 cursor-default">
        <span className="font-display font-bold uppercase tracking-wider text-sm">
          THE POST-SEO ERA
        </span>
      </div>

      {/* Headline */}
      <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-[0.9] md:leading-[0.9] tracking-tighter mb-8 text-black uppercase">
        Don’t just rank on Google<br className="hidden md:block" /> Be the brand AI cites.
      </h1>

      {/* Subtext */}
      <p className="font-sans text-gray-600 text-lg md:text-xl max-w-3xl mb-10 leading-relaxed">
        The first Agentic Writer designed for Generative Engine Optimization (GEO). We research, plan, draft, refine, and publish articles that humans love and ChatGPT, Gemini and Claude cite as sources.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-12">
        <Button variant="primary" size="lg" className="text-lg px-10">
          Start for free
        </Button>
        
        <a href="#" className="group flex items-center gap-2 font-sans font-bold text-lg hover:underline decoration-2 underline-offset-4">
          Compare plans
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </a>
      </div>

      {/* Guarantee */}
      <div className="flex items-center gap-2 text-gray-500 font-medium text-sm md:text-base">
        <Hourglass className="w-4 h-4 text-yellow-600" />
        <span>14 day money back guarantee!</span>
      </div>
    </div>
  );
};