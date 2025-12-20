
import React from 'react';
import { ScanSearch, BrickWall, FileCheck } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  return (
    <section className="w-full py-24 px-4 flex flex-col items-center relative overflow-hidden">

      {/* Header */}
      <div className="flex flex-col items-center text-center mb-16 max-w-4xl mx-auto z-10 relative">
        <div className="inline-block bg-[#D6F5F2] border-2 border-black shadow-neo-sm px-4 py-1 mb-6 transform -rotate-1 hover:rotate-0 transition-transform">
          <span className="font-display font-black text-xs uppercase tracking-widest">How it works</span>
        </div>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-tight mb-6 uppercase">
          A focused system built for<br className="hidden md:block" /> modern AI search
        </h2>
        <p className="font-sans text-gray-600 text-lg md:text-xl leading-relaxed max-w-2xl">
          Clear answers, real authority, and content that compounds — designed for modern AI search and human readers.
        </p>
      </div>

      {/* Steps Grid */}
      <div className="max-w-[1200px] w-full grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 mb-20">

        {/* Step 1 */}
        <StepCard
          number="01"
          title="We Map Your Category & Gaps"
          content={
            <>
              <p className="mb-4">You start with your site. We analyze the actual answers being surfaced in your category and identify exactly where your brand is absent or invisible.</p>
              <p className="mb-4">This intelligence becomes the foundation for everything that follows—targeting the conversations you're currently missing.</p>
            </>
          }
          accentColor="bg-[#FAFA9D]" // Yellow
          icon={<ScanSearch className="w-6 h-6 text-black" />}
        />

        {/* Step 2 */}
        <StepCard
          number="02"
          title="We build a strategy that compounds"
          content={
            <>
              <p className="mb-4">Using your brand context, category signals, and competitor data, we create a focused 30-day content strategy.</p>
              <p className="mb-4">Each topic is chosen to strengthen authority and build on the previous article — not to chase random keywords or publish filler content.</p>
            </>
          }
          accentColor="bg-[#FFD8A8]" // Orange
          icon={<BrickWall className="w-6 h-6 text-black" />}
        />

        {/* Step 3 */}
        <StepCard
          number="03"
          title="We deliver answer-first content"
          content={
            <>
              <p className="mb-4">Articles are written to explain clearly, completely, and credibly — the way humans read and AI systems trust.</p>
              <p className="mb-4">Content is delivered clean and ready to publish, with your unique brand voice baked in, so you build authority without the friction.</p>
            </>
          }
          accentColor="bg-[#D6F5F2]" // Teal
          icon={<FileCheck className="w-6 h-6 text-black" />}
        />

      </div>

      {/* Closing Statement */}
      <div className="w-full max-w-4xl px-4">
        <div className="bg-black text-white border-2 border-black p-8 md:p-12 shadow-[8px_8px_0px_0px_#FFD8A8] transform rotate-1 hover:rotate-0 transition-transform duration-300">
          <p className="font-display font-bold text-2xl md:text-3xl uppercase leading-snug text-center">
            "This is not only content automation for speed.<br className="hidden md:block" />
            It’s a system designed to earn visibility, trust, and long-term growth."
          </p>
        </div>
      </div>

    </section>
  );
};

interface StepCardProps {
  number: string;
  title: string;
  content: React.ReactNode;
  accentColor: string;
  icon: React.ReactNode;
}

const StepCard: React.FC<StepCardProps> = ({ number, title, content, accentColor, icon }) => {
  return (
    <div className={`h-full bg-white border-2 border-black p-8 shadow-neo flex flex-col relative group hover:-translate-y-1 hover:shadow-neo-hover transition-all duration-200`}>

      {/* Card Header with Number and Icon */}
      <div className="flex items-center justify-between mb-6 border-b-2 border-black/5 pb-4">
        <div className={`px-4 py-2 ${accentColor} border-2 border-black font-display font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
          {number}
        </div>
        <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center rounded-full shadow-sm">
          {icon}
        </div>
      </div>

      {/* Text Content */}
      <h3 className="font-display font-black text-2xl mb-6 uppercase leading-tight min-h-[64px]">
        {title}
      </h3>

      <div className="font-sans text-gray-700 text-base leading-relaxed flex-grow">
        {content}
      </div>

    </div>
  );
};
