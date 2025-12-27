
import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/landing/Button';

export const CTASection: React.FC = () => {
  return (
    <section className="w-full py-12 px-4 flex justify-center mb-12">
      <div className="w-full max-w-6xl bg-[#FAFA9D] border-2 border-black p-8 md:p-16 shadow-neo flex flex-col items-center text-center relative overflow-hidden">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-brand-orange border-2 border-black shadow-neo-sm px-4 py-1 mb-8 transform -rotate-1">
          <Sparkles className="w-3.5 h-3.5 text-white fill-white" />
          <span className="font-display font-black text-xs uppercase tracking-widest text-black">Conversion Ready</span>
        </div>

        {/* Headline */}
        <h2 className="font-display text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black text-4xl md:text-6xl leading-[0.9] mb-8 uppercase tracking-tight">
          Stop guessing<br />
          What to Publish.
        </h2>

        {/* Description */}
        <p className="font-sans text-black/80 text-lg md:text-xl mb-10 max-w-2xl leading-relaxed font-medium">
          Join 2,000+ writers who use autonomous AI to build authority,
          not just generic content.
        </p>

        {/* Action Button (Direct Conversion) */}
        <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
          <Link href="/subscribe" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto h-16 px-10 text-xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[4px] hover:translate-y-[4px] transition-all bg-white text-black">
              Get your Brand cited
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

        </div>

      </div>
    </section>
  );
};
