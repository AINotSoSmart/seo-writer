import React from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

export function BlogCTABanner() {
    return (
        <div className="relative my-16 w-full max-w-4xl mx-auto">
            {/* The "Paper" Card Container (Restored style) */}
            <div className="
          relative w-full bg-white 
          border border-stone-300/50 
          rounded-[15px] 
          p-1
          overflow-hidden
      ">
                <div className="
            w-full bg-stone-100/50 backdrop-blur-sm
            rounded-[12px] p-4 sm:p-8 md:p-12
            border border-stone-100
            relative
        ">


                    <div className="relative z-10 flex flex-col items-center text-center">
                        {/* Header Label */}
                        <div className="flex items-center gap-3">
                            <div className="h-px w-6 bg-stone-300"></div>
                            <span className="font-sans text-[10px] font-bold tracking-[0.3em] text-stone-400 uppercase">
                                Strategic Insight
                            </span>
                            <div className="h-px w-6 bg-stone-300"></div>
                        </div>

                        {/* The Hook - Instrument Serif */}
                        <div className="max-w-2xl mb-4">
                            <h3 className="font-serif text-3xl md:text-[42px] leading-[1.15] text-stone-800 tracking-tight">
                                Your next six clusters should come from <span className="italic font-light text-stone-400">evidence, not a prompt.</span>
                            </h3>
                        </div>

                        {/* The Solution - Clean Sans */}
                        <p className="max-w-xl text-stone-500 font-sans text-base md:text-lg leading-relaxed mb-12">
                            FlipAEO audits your existing B2B SaaS site, shows source-linked gaps, and offers a finite delivery program only when six qualified clusters exist.
                        </p>

                        {/* CTA Block - Integrated but direct */}
                        <div className="flex flex-col items-center w-full border-t border-stone-200/50 pt-4">
                            <Link href="/login?next=/onboarding">
                                <button className="
                    cursor-pointer group relative inline-flex items-center gap-3 bg-stone-900 text-white 
                    px-8 py-4 rounded-lg text-base font-medium text-sm
                    transition-all hover:bg-stone-700 hover:shadow-xl active:scale-95
                  ">
                                    Find My Content Gaps
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </button>
                            </Link>


                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}
