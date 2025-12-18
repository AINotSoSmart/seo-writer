
import React from 'react';
import { ArrowRight } from 'lucide-react';

export const CTASection: React.FC = () => {
  return (
    <section className="w-full py-12 px-4 flex justify-center mb-12">
      <div className="w-full max-w-[1100px] bg-[#FAFA9D] border-2 border-black p-8 md:p-16 shadow-neo flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Badge */}
        <div className="inline-block bg-brand-orange border-2 border-black shadow-neo-sm px-4 py-1 mb-8 transform -rotate-1">
          <span className="font-display font-black text-xs uppercase tracking-widest">Newsletter</span>
        </div>

        {/* Headline */}
        <h2 className="font-display font-black text-4xl md:text-6xl leading-tight mb-6 uppercase">
          Join Our Exclusive E-<br />Learning Newsletter
        </h2>

        {/* Description */}
        <p className="font-sans text-black/70 text-lg md:text-xl mb-10 max-w-2xl leading-relaxed">
          Receive insider tips, updates and resources to enhance your teaching, course creation, and platform mastery.
        </p>

        {/* Input Field */}
        <div className="w-full max-w-md relative">
          <input 
            type="email" 
            placeholder="example@mail.com" 
            className="w-full bg-white border-2 border-black h-14 px-6 rounded-full font-sans text-lg focus:outline-none focus:ring-0 placeholder:text-gray-400 shadow-sm"
          />
          <button className="absolute right-2 top-2 bottom-2 w-10 h-10 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </section>
  );
};
