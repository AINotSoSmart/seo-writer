import React from 'react';
import { ArrowRight, Zap, Lock } from 'lucide-react';

const CTASection = () => {
    return (
        <section className="py-32 bg-ink text-cream relative overflow-hidden flex flex-col items-center justify-center text-center">

            {/* Background noise/grain */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150"></div>

            {/* Signal Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-signal/20 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="max-w-4xl mx-auto px-4 relative z-10">

                <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-white/20 rounded-full mb-10 bg-white/5 backdrop-blur-sm">
                    <Zap size={14} className="text-signal fill-signal" />
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/80">
                        Limited Beta Access
                    </span>
                </div>

                <h2 className="font-serif text-6xl md:text-8xl text-white leading-[0.9] tracking-tight mb-8">
                    Become the <br />
                    <span className="italic text-signal">Source of Truth.</span>
                </h2>

                <p className="font-mono text-sm md:text-base text-white/60 leading-relaxed max-w-2xl mx-auto mb-12">
                    The window to own your entity space in the LLM training data is closing. Once the weights are set, they are set. Don't let your competitors define your brand.
                </p>

                <div className="flex flex-col items-center gap-6">
                    <button className="group relative px-10 py-5 bg-signal text-white font-mono font-bold text-base tracking-wide shadow-[8px_8px_0px_0px_#ffffff] hover:translate-y-1 hover:shadow-none hover:bg-signal/90 transition-all flex items-center gap-3">
                        CLAIM YOUR ENTITY SPACE
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <div className="flex items-center gap-2 opacity-50 text-[10px] font-mono text-white/50">
                        <Lock size={10} />
                        <span>Indexing capacity varies by server load.</span>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default CTASection;
