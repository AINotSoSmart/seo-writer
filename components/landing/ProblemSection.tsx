import React from 'react';

export const ProblemSection: React.FC = () => {
  return (
    <section className="w-full py-24 px-4 flex flex-col items-center">
      {/* Section Badge */}
      <div className="inline-block bg-brand-orange border-2 border-black shadow-neo-sm px-4 py-1 mb-8">
        <span className="font-display font-black text-xs uppercase tracking-widest">Market Audit</span>
      </div>

      {/* Headline */}
      <h2 className="font-display font-black text-4xl md:text-6xl text-center leading-tight mb-6 uppercase">
        One-click AI content is<br />quietly killing your growth.
      </h2>

      {/* Subtext */}
      <p className="font-sans text-gray-500 text-center max-w-3xl text-lg mb-16 leading-relaxed">
        You’re publishing more than ever, yet traffic stays flat. Modern search engines can tell the difference between real answers and mass-produced content.
      </p>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
        <ProblemCard 
          title="AI SEARCH IGNORES YOU" 
          description="You write 100 blogs, but ChatGPT and Claude don’t know who you are. When founders search for your category, the AI recommends your competitors."
          graphic={<AiSearchGraphic />}
        />
        <ProblemCard 
          title="YOU SOUND LIKE A BOT" 
          description="Google smells 'Default GPT-4' content in 3 seconds. It has no brand voice, no unique data, and no soul. It doesn't build authority; it just adds to the noise."
          graphic={<BotVoiceGraphic />}
        />
        <ProblemCard 
          title="IMPRESSIONS BUT ZERO CLICKS" 
          description="You are ranking for keywords that don't convert. Without GSC data dictating your roadmap, you are just guessing while competitors win the real answers."
          graphic={<ZeroClicksGraphic />}
        />
      </div>
    </section>
  );
};

const ProblemCard: React.FC<{ title: string; description: string; graphic: React.ReactNode }> = ({ title, description, graphic }) => {
  return (
    <div className="bg-white border-2 border-black p-8 shadow-neo hover:shadow-neo-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 flex flex-col items-center text-center h-full">
      <div className="h-32 w-full flex items-center justify-center mb-2">
        {graphic}
      </div>
      <h3 className="font-display font-black text-2xl mb-4 uppercase leading-tight">{title}</h3>
      <p className="font-sans text-gray-600 leading-relaxed font-medium">
        {description}
      </p>
    </div>
  );
};

// Graphic 1: AI ignoring (Chat bubble with ?)
const AiSearchGraphic = () => (
  <div className="relative">
     {/* Background decorative blob */}
     <div className="absolute -right-6 -top-4 w-12 h-12 bg-brand-yellow rounded-full border-2 border-black opacity-100"></div>
     
     {/* Main Chat Bubble */}
     <div className="relative w-24 h-16 bg-white border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <span className="font-display font-black text-3xl text-gray-400">?</span>
        {/* Tail */}
        <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white border-b-2 border-r-2 border-black transform rotate-45"></div>
     </div>
     
     {/* Small search icon badge */}
     <div className="absolute -left-4 -bottom-2 w-10 h-10 bg-brand-orange border-2 border-black rounded-full flex items-center justify-center shadow-sm">
        <div className="w-4 h-4 border-2 border-black rounded-full"></div>
        <div className="w-2 h-[2px] bg-black transform rotate-45 absolute bottom-3 right-3 origin-center"></div>
     </div>
  </div>
);

// Graphic 2: Robot Head
const BotVoiceGraphic = () => (
  <div className="relative">
      {/* Robot Head */}
      <div className="w-20 h-20 bg-gray-100 border-2 border-black relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center">
        {/* Antenna */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-3 h-3 bg-brand-yellow border-2 border-black rounded-full"></div>
            <div className="w-[2px] h-2 bg-black"></div>
        </div>
        
        {/* Eyes */}
        <div className="flex gap-3 mb-2">
            <div className="w-3 h-3 bg-black"></div>
            <div className="w-3 h-3 bg-black"></div>
        </div>
        
        {/* Mouth */}
        <div className="w-10 h-1 bg-black"></div>
        
        {/* Ears */}
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-4 bg-gray-300 border-2 border-black border-r-0"></div>
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-4 bg-gray-300 border-2 border-black border-l-0"></div>
      </div>
  </div>
);

// Graphic 3: Chart with specific data
const ZeroClicksGraphic = () => (
  <div className="relative w-28 h-24 flex items-end justify-center gap-3 p-2 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {/* Bar 1 (High Impressions) */}
      <div className="w-8 h-[80%] bg-[#D6F5F2] border-2 border-black relative group">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-sans font-bold text-xs">10k</div>
      </div>
      
      {/* Bar 2 (Low Clicks) */}
      <div className="w-8 h-[20%] bg-brand-orange border-2 border-black relative">
         <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-sans font-bold text-xs text-red-500">0</div>
      </div>

      {/* Axis lines */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black"></div>
      <div className="absolute bottom-0 left-0 w-[2px] h-full bg-black"></div>
      
      {/* Cursor Icon overlay */}
      <div className="absolute top-1/2 right-0 transform translate-x-1/2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19177L14.8698 12.3673H5.65376Z" fill="black" stroke="black" strokeWidth="2"/>
        </svg>
      </div>
  </div>
);