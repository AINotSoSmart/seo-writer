"use client";

import React, { useEffect, useState } from 'react';

export const FeaturePreview: React.FC = () => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      // Animation completes after scrolling 400px
      const maxScroll = 400;
      const progress = Math.min(scrolled / maxScroll, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    // Trigger once on mount to set initial state correctly
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate styles based on scroll
  // Tilt starts at 20deg and goes to 0deg
  const rotation = 20 * (1 - scrollProgress);
  // Scale starts at 0.9 and goes to 1.0
  const scale = 0.9 + (0.1 * scrollProgress);

  return (
    <div className="w-full px-2 md:px-0 flex justify-center pb-12" style={{ perspective: '1200px' }}>
      <div
        className="w-full max-w-[1200px] transition-transform duration-100 ease-out will-change-transform"
        style={{
          transform: `rotateX(${rotation}deg) scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <div className="rounded-3xl border-4 border-black overflow-hidden shadow-2xl bg-white relative">
          {/* 
              Replace the src below with your actual dashboard screenshot.
              Recommended size: 1200x800px or similar aspect ratio.
            */}
          <img
            src="https://placehold.co/1200x800/F3F4F6/1F2937?text=SnapClass+Dashboard+Preview"
            alt="SnapClass Dashboard Preview"
            className="w-full h-auto block"
          />
        </div>
      </div>
    </div>
  );
};