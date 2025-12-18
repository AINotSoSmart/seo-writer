import React from 'react';
import { Puzzle } from 'lucide-react';

export const Logo: React.FC = () => {
  return (
    <a href="#" className="flex items-center gap-2 group">
      <div className="relative">
        <Puzzle className="w-8 h-8 text-brand-yellow fill-brand-yellow stroke-black stroke-[2.5px] transition-transform group-hover:rotate-12" />
      </div>
      <span className="font-display font-black text-2xl tracking-tight text-white text-stroke-black">
        <span style={{ WebkitTextStroke: '1.5px black', color: '#FCD34D' }}>FlipAEO</span>
      </span>
    </a>
  );
};