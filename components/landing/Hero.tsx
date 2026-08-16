import React from 'react';
import Button from './Button';
import Link from 'next/link';



export default function Hero() {

  return (
    <section className="relative w-full max-w-5xl mx-auto px-6 py-12 md:pt-24 md:pb-12 flex flex-col items-center text-center">

      {/* Decorative Star/Crosshair Left */}
      <div className="hidden md:block absolute sm:top-1/4 left-4 md:left-0 text-stone-400 ">
        <svg width="51" height="50" viewBox="0 0 51 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M26 1V20" stroke="black" strokeLinecap="round" />
          <path d="M26 30V49" stroke="black" strokeLinecap="round" />
          <path d="M50 25L31 25" stroke="black" strokeLinecap="round" />
          <path d="M21 25L0.999999 25" stroke="black" strokeLinecap="round" />
          <path d="M37.5 36.5L28.1847 27.1847" stroke="black" strokeLinecap="round" />
          <path d="M23.3164 22.3154L14.0011 13.0001" stroke="black" strokeLinecap="round" />
          <path d="M14 36.5L23.3153 27.1847" stroke="black" strokeLinecap="round" />
          <path d="M28.1836 22.3154L37.4989 13.0001" stroke="black" strokeLinecap="round" />
        </svg>

      </div>

      {/* Decorative Star Right */}
      <div className="hidden md:block absolute sm:top-1/3 right-4 md:right-0 text-stone-800  animate-pulse">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 17V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M21 12H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7 12H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <path d="M18.364 5.63605L16.95 7.05005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5.63604 18.364L7.05004 16.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M18.364 18.364L16.95 16.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5.63604 5.63605L7.05004 7.05005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

      </div>

      {/* Availability Badge */}
      <div className="inline-flex items-center gap-2 px-4 pt-1.5 pb-2 rounded-full border border-brand-400 bg-white text-stone-900 text-[11px] font-normal mb-6 shadow-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-brand-500">
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="none" />
        </svg>
        <span>FOR FOUNDER-LED B2B SAAS</span>
      </div>

      {/* Main Headline */}
      <h1 className="font-serif text-4xl md:text-7xl lg:text-8xl text-stone-900 leading-[1.1] mb-6 tracking-tight">
        Know where AI overlooks you. <br />
        <span className="italic font-light">Fix the gaps that matter.</span>
      </h1>

      {/* Subheadline */}
      <p className="font-sans text-lg md:text-xl text-stone-500 max-w-2xl leading-snug mb-6 px-2">
        Confirm 40 questions real buyers ask, then see how ChatGPT and Google AI Mode answer them.
        <strong className="text-black font-normal">{" "}FlipAEO shows where your brand is absent or outranked, keeps the evidence visible, and turns the highest-priority gaps into create or refresh work.</strong>{" "}
        Selected drafts arrive together as one complete batch.
      </p>

      {/* CTA Button Container */}
      <div className="relative group z-10">
        <Link href="/login?next=/onboarding">
          <Button variant="primary" className="text-brand-600">
            Show Me What I'm Missing
          </Button>
        </Link>

        <p className="mt-4 text-[11px] text-stone-400 tracking-wide">
          Confirm questions first &middot; measurement starts only when you choose
        </p>
      </div>

      {/* Testimonial */}
      <div className="mt-8 flex flex-col items-center gap-4 animate-fade-in-up">
        <p className="text-stone-600 font-normal text-center max-w-xl italic text-[12px] leading-relaxed px-4">
          “The output quality is honestly great. I’ve already started using it for both of my SaaS products. It’s rare to find a tool this production-ready so early.”
        </p>
        <div className="flex items-center gap-3 mt-2">
          <img
            src="/brands/krzysztof.webp"
            alt="Krzysztof profile picture"
            className="w-6 h-6 rounded-full object-cover border border-stone-200"
          />
          <div className="text-sm text-stone-500">
            <span className="font-semibold text-stone-900">Krzysztof </span>, Founder at LaunchDirectories
          </div>
        </div>
      </div>





    </section>
  );
};
