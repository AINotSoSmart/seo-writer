import React from 'react';
import Link from 'next/link';

export const CaseStudyTeaser: React.FC = () => {
    return (
        <section className="w-full relative z-10 -mt-8 sm:-mt-12 mb-20 px-3 sm:px-5">
            <div className="w-full max-w-[1000px] mx-auto group">
                <Link href="/case-studies/bringback">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-6 bg-white/60 backdrop-blur-md border border-stone-200 rounded-2xl shadow-sm hover:shadow-md hover:border-stone-300 hover:bg-white transition-all duration-300">
                        <div className="flex items-center gap-4 text-center sm:text-left">
                            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-lg shrink-0 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)]">
                                📈
                            </span>
                            <div>
                                <h3 className="font-sans text-stone-900 font-medium text-sm sm:text-base">
                                    We drink our own champagne: <span className="text-stone-500 font-normal">See how we grew BringBack.pro by 1,300% in 90 days using FlipAEO.</span>
                                </h3>
                            </div>
                        </div>
                        <div className="shrink-0 flex items-center text-stone-900 font-medium text-sm border border-stone-200 rounded-full px-4 py-2 group-hover:border-stone-300 group-hover:bg-stone-50 transition-colors">
                            Read Case Study <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                    </div>
                </Link>
            </div>
        </section>
    );
};
