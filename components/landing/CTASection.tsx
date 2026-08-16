import React from 'react';
import Button from './Button';
import Link from 'next/link';

import { CornerSquare } from './CornerSquare';

const CTASection: React.FC = () => {
  return (
    <section id="cta" className="w-full py-24 relative z-10 mb-12">
      <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

        {/* Horizontal Pattern Bar Above */}
        <div className="relative w-full h-3 sm:h-4 border-y border-stone-200 mb-24" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>

          <CornerSquare className="-left-[5px] -bottom-[5px]" />
          <CornerSquare className="-right-[5px] -bottom-[5px]" />
        </div>

        <div className="flex flex-col items-center justify-center">
          <h2 className="font-serif text-xl md:text-5xl text-stone-900 mb-16 tracking-tight font-normal text-center">
            Get the agency's answer, without the agency's invoice
          </h2>

          <div className="relative group">

            {/* The Main Button */}
            <div className="relative z-10">
              <Link href="/login?next=/onboarding">
                <Button
                  variant="primary"
                  className="text-xl md:text-3xl px-10 py-5 md:px-20 md:py-7 rounded-xl"
                >
                  <span className="text-brand-800 font-medium tracking-tight">Show Me What I'm Missing</span>
                </Button>
              </Link>
            </div>

            {/* 
                  Handwritten Annotations 
                  - Using Absolute Positioning relative to the button container
                  - Hidden on mobile to preserve layout integrity
               */}
            <div className="absolute inset-0 pointer-events-none">

              {/* 1. Top Left: Land more clients */}
              <div className="absolute -top-14 sm:-top-8 -left-[120px] sm:-left-[200px] w-48 flex flex-col items-end">
                <span className="font-hand text-[14px] sm:text-2xl text-stone-500 mb-1 -rotate-6 leading-none">See source-linked <br />gaps</span>
                <span className="text-stone-500 rotate-180">
                  <svg className="w-[20px] h-[22px] sm:w-[39px] sm:h-[43px]" viewBox="0 0 39 43" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M35.3098 41.3831C38.805 33.6161 39.7653 17.8871 22.106 16.5287C12.0089 15.752 15.1157 28.9559 24.4361 27.4025C32.203 26.108 39.5817 5.6549 1.52344 4.1015M1.52344 4.1015L4.63023 7.59665M1.52344 4.1015L5.40693 1.38305" stroke="#767676ff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              </div>

              {/* 2. Top Right: Outsource your work */}
              <div className="absolute -top-14 sm:-top-8 -right-[120px] sm:-right-[200px] w-48 flex flex-col items-start">
                <span className="font-hand text-[14px] sm:text-2xl text-stone-500 mb-1 rotate-6 leading-none">Know what to <br />write next</span>
                <span className="text-stone-500 rotate-x-180">
                  <svg className="w-[20px] h-[22px] sm:w-[39px] sm:h-[43px]" viewBox="0 0 39 43" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M35.3098 41.3831C38.805 33.6161 39.7653 17.8871 22.106 16.5287C12.0089 15.752 15.1157 28.9559 24.4361 27.4025C32.203 26.108 39.5817 5.6549 1.52344 4.1015M1.52344 4.1015L4.63023 7.59665M1.52344 4.1015L5.40693 1.38305" stroke="#767676ff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              </div>

              {/* 3. Bottom Left: Affordable design... */}
              <div className="absolute top-[110%] -left-[70px] sm:-left-[110px] w-56 flex flex-col items-center">
                <span className="text-stone-500 rotate-90">
                  <svg className="w-[20px] h-[22px] sm:w-[39px] sm:h-[43px]" viewBox="0 0 39 43" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M35.3098 41.3831C38.805 33.6161 39.7653 17.8871 22.106 16.5287C12.0089 15.752 15.1157 28.9559 24.4361 27.4025C32.203 26.108 39.5817 5.6549 1.52344 4.1015M1.52344 4.1015L4.63023 7.59665M1.52344 4.1015L5.40693 1.38305" stroke="#767676ff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="font-hand text-[14px] sm:text-2xl text-stone-500 leading-none text-center">
                  No rankings <br /> promised
                </span>
              </div>

              {/* 4. Bottom Center: Make money on autopilot */}
              <div className="absolute top-[110%] left-1/2 -translate-x-1/2 w-56 flex flex-col items-center">
                <span className="text-stone-500 ">
                  <svg className="w-[8px] h-[26px] sm:w-[16px] sm:h-[52px]" viewBox="0 0 16 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 51C7 51.5523 7.44772 52 8 52C8.55229 52 9 51.5523 9 51L7 51ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 51L9 1L7 1L7 51L9 51Z" fill="#767676ff" />
                  </svg>

                </span>
                <span className="font-hand text-[14px] sm:text-2xl text-center text-stone-500 leading-none">Complete cycle <br /> batch</span>
              </div>

              {/* 5. Bottom Right: Increase conversion */}
              <div className="absolute top-[110%] -right-[70px] sm:-right-[110px] w-56 flex flex-col items-center">
                <span className="text-stone-500 -scale-x-100 -rotate-90">
                  <svg className="w-[20px] h-[22px] sm:w-[39px] sm:h-[43px]" viewBox="0 0 39 43" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M35.3098 41.3831C38.805 33.6161 39.7653 17.8871 22.106 16.5287C12.0089 15.752 15.1157 28.9559 24.4361 27.4025C32.203 26.108 39.5817 5.6549 1.52344 4.1015M1.52344 4.1015L4.63023 7.59665M1.52344 4.1015L5.40693 1.38305" stroke="#767676ff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="font-hand text-[14px] sm:text-2xl text-stone-500 leading-none text-center">
                  Cancel future <br />cycles anytime
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* Horizontal Pattern Bar Below */}
        <div className="relative w-full h-3 sm:h-4 border-y border-stone-200 mt-32" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
          <CornerSquare className="-left-[5px] -top-[5px]" />
          <CornerSquare className="-right-[5px] -top-[5px]" />

        </div>

      </div>
    </section>
  );
};

export default CTASection;
