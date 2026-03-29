  {/* Process Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Card 1: Drop Your Footage */}
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 md:p-12 shadow-xs relative overflow-hidden group">
            <DottedGlowBackground
        className="pointer-events-none mask-radial-to-90% mask-radial-at-center opacity-20 dark:opacity-100"
        opacity={0.7}
        gap={15}
        radius={1.6}
        colorLightVar="--color-neutral-400"
        glowColorLightVar="--color-neutral-500"
        colorDarkVar="--color-neutral-400"
        glowColorDarkVar="--color-sky-700"
        backgroundOpacity={0}
        speedMin={0.3}
        speedMax={1.6}
        speedScale={1}
      />
                <span className="inline-block px-3 py-1 rounded-lg bg-slate-50 text-slate-500 font-semibold text-sm mb-8">01</span>
                
                {/* Graphic Area */}
                <div className="h-48 md:h-56 w-full relative mb-8">
                    {/* Connecting Lines (SVG) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Line from 't' (WeTransfer) at 40,25 to Hub at 70,50 */}
                        <path d="M 40 25 C 55 25, 55 50, 70 50" stroke="#ffedd5" strokeWidth="1" strokeDasharray="4 4" fill="none" vectorEffect="non-scaling-stroke" />
                        
                        {/* Line from Dropbox at 20,50 to Hub at 70,50 */}
                        <path d="M 20 50 L 70 50" stroke="#ffedd5" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                        
                        {/* Line from Drive at 40,75 to Hub at 70,50 */}
                        <path d="M 40 75 C 55 75, 55 50, 70 50" stroke="#ffedd5" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
                    </svg>

                    {/* Central Node (Receiver - Right Side) */}
                    <div className="absolute top-1/2 left-[70%] -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-orange-300 shadow-xl shadow-orange-500/30 flex items-center justify-center animate-pulse-slow z-20">
                        <Sparkles className="text-white w-10 h-10" />
                        {/* Small decorative plus signs */}
                        <div className="absolute top-3 right-4 text-orange-200 opacity-80">+</div>
                        <div className="absolute bottom-4 left-4 text-orange-200 text-xs opacity-80">✦</div>
                    </div>

                    {/* Source 1: Dropbox (Far Left) */}
                    <div className="absolute top-1/2 left-[20%] -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#0061FF] rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center text-white z-10 hover:scale-110 transition-transform cursor-pointer">
                        <Box size={32} strokeWidth={1.5} />
                    </div>

                    {/* Source 2: WeTransfer 't' (Top Middle) */}
                    <div className="absolute top-[25%] left-[40%] -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-[#171544] rounded-full shadow-lg flex items-center justify-center text-white z-10 hover:scale-110 transition-transform cursor-pointer">
                        <span className="font-serif font-bold text-xl italic mb-1">t</span>
                    </div>

                    {/* Source 3: Drive (Bottom Middle) */}
                    <div className="absolute bottom-[25%] left-[40%] -translate-x-1/2 translate-y-1/2 w-12 h-12 bg-white border border-slate-100 rounded-xl shadow-md flex items-center justify-center z-10 hover:scale-110 transition-transform cursor-pointer">
                         <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-7 h-7" />
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-3">Drop Your Footage</h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                    Upload your raw clips — WeTransfer, Google Drive, Dropbox — whatever works for you.
                </p>
            </div>

            {/* Card 2: We Do Our Magic */}
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 md:p-12 shadow-xs relative overflow-hidden group">
                 <DottedGlowBackground
        className="pointer-events-none mask-radial-to-90% mask-radial-at-center opacity-20 dark:opacity-100"
        opacity={0.7}
        gap={15}
        radius={1.6}
        colorLightVar="--color-neutral-400"
        glowColorLightVar="--color-neutral-500"
        colorDarkVar="--color-neutral-400"
        glowColorDarkVar="--color-sky-700"
        backgroundOpacity={0}
        speedMin={0.3}
        speedMax={1.6}
        speedScale={1}
      />
       <span className="inline-block px-3 py-1 rounded-lg bg-slate-50 text-slate-500 font-semibold text-sm mb-8">02</span>
                
                {/* Graphic Area */}
                <div className="h-48 md:h-56 w-full relative mb-8">
                     
                     {/* Abstract Timeline Wave Background */}
                     <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" viewBox="0 0 400 200" preserveAspectRatio="none">
                         <path d="M-50 100 Q 100 20, 200 100 T 450 100" stroke="#cbd5e1" strokeWidth="3" fill="none" strokeDasharray="6 6" />
                     </svg>

                     {/* CapCut - Left Top */}
                     <div className="absolute left-[5%] top-[15%] w-14 h-14 bg-white border border-slate-100 rounded-2xl shadow-card flex items-center justify-center z-10 transition-all duration-700 animate-float" style={{ animationDelay: '0s' }}>
                        <Scissors size={26} className="text-slate-900" />
                     </div>

                     {/* DaVinci - Left Bottom/Mid */}
                     <div className="absolute left-[28%] top-[55%] w-12 h-12 rounded-full shadow-lg z-10 transition-all duration-700 animate-float"
                          style={{ background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)', animationDelay: '1.5s' }}>
                         <div className="absolute inset-1 bg-slate-900 rounded-full flex items-center justify-center">
                             <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                         </div>
                     </div>

                     {/* Final Cut - Right Top/Mid */}
                     <div className="absolute right-[28%] top-[20%] w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg flex items-center justify-center text-white z-10 rotate-3 transition-all duration-700 animate-float" style={{ animationDelay: '0.8s' }}>
                        <Clapperboard size={30} fill="currentColor" className="text-white/90" />
                     </div>

                     {/* Premiere Pro - Right Bottom */}
                     <div className="absolute right-[5%] top-[50%] w-12 h-12 bg-[#00005B] rounded-lg shadow-xl border border-white/10 flex items-center justify-center text-[#DB96FF] font-bold text-lg z-20 transition-all duration-700 animate-float" style={{ animationDelay: '2.2s' }}>
                        Pr
                     </div>

                     {/* Render Button - Center Bottom */}
                     <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 z-30 transition-transform hover:scale-105 cursor-pointer border border-slate-800">
                         <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                         Start Rendering
                         {/* Interacting Cursor */}
                         <div className="absolute -bottom-5 -right-5 text-slate-900 animate-bounce" style={{ animationDuration: '2s' }}>
                             <MousePointer2 size={28} fill="#FF4D00" className="stroke-white stroke-[2px]" />
                         </div>
                     </div>

                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-3">We Do Our Magic</h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                    We do cut, trim, color-grade, sfs and add engaging transitions and what not!
                </p>
            </div>

            {/* Card 3: Feedback? Easy */}
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 md:p-12 shadow-xs relative overflow-hidden group">
                  <DottedGlowBackground
        className="pointer-events-none mask-radial-to-90% mask-radial-at-center opacity-20 dark:opacity-100"
        opacity={0.7}
        gap={15}
        radius={1.6}
        colorLightVar="--color-neutral-400"
        glowColorLightVar="--color-neutral-500"
        colorDarkVar="--color-neutral-400"
        glowColorDarkVar="--color-sky-700"
        backgroundOpacity={0}
        speedMin={0.3}
        speedMax={1.6}
        speedScale={1}
      />
      <span className="inline-block px-3 py-1 rounded-lg bg-slate-50 text-slate-500 font-semibold text-sm mb-8">03</span>
                
                {/* Graphic Area */}
                <div className="h-48 md:h-56 w-full flex items-center justify-center relative mb-8">
                    
                    {/* User Avatar */}
                    <div className="absolute top-[20%] left-[10%] z-20">
                         <img src="https://picsum.photos/seed/user5/64/64" alt="User" className="w-10 h-10 rounded-full border-2 border-white shadow-md" />
                    </div>

                    {/* Chat Bubble */}
                    <div className="absolute top-[22%] left-[22%] bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl rounded-tl-none shadow-sm text-sm font-semibold text-slate-700 z-10">
                        Requested a Revision
                    </div>

                    {/* Orange Sticker */}
                    <div className="absolute top-[50%] left-[15%] w-full max-w-[280px] bg-brand-orange text-white px-5 py-3 rounded-2xl shadow-xl shadow-orange-500/30 transform -rotate-6 transition-transform group-hover:rotate-0 flex items-center gap-3">
                        <span className="font-bold text-lg">Revision is in progress!</span>
                        {/* Cursor */}
                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-brand-orange">
                             <MousePointer2 size={32} fill="#FF4D00" className="stroke-white stroke-[2px]" />
                        </div>
                    </div>

                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-3">Feedback? Easy</h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                    Want something changed? We offer smooth revision rounds to make sure everything.
                </p>
            </div>

            {/* Card 4: Upload & Grow */}
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 md:p-12 shadow-xs relative overflow-hidden group">
                 <DottedGlowBackground
        className="pointer-events-none mask-radial-to-90% mask-radial-at-center opacity-20 dark:opacity-100"
        opacity={0.7}
        gap={15}
        radius={1.6}
        colorLightVar="--color-neutral-400"
        glowColorLightVar="--color-neutral-500"
        colorDarkVar="--color-neutral-400"
        glowColorDarkVar="--color-sky-700"
        backgroundOpacity={0}
        speedMin={0.3}
        speedMax={1.6}
        speedScale={1}
      />
       <span className="inline-block px-3 py-1 rounded-lg bg-slate-50 text-slate-500 font-semibold text-sm mb-8">04</span>
                
                {/* Graphic Area */}
                <div className="h-48 md:h-56 w-full flex items-center justify-center relative mb-8 perspective-1000">
                    
                    {/* File 1: Thumbnail */}
                    <div className="absolute top-[40%] left-[10%] bg-white border border-slate-100 px-4 py-2 rounded-xl shadow-md flex items-center gap-2 transform rotate-12 group-hover:rotate-6 transition-transform duration-500 z-10">
                        <ImageIcon size={16} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">Thumbnail.png</span>
                    </div>

                    {/* File 2: Video */}
                    <div className="absolute top-[10%] right-[10%] bg-[#1A1A1A] px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500 z-20">
                        <Film size={16} className="text-white" />
                        <span className="text-xs font-bold text-white">Final_Cut_v2.mp4</span>
                    </div>

                    {/* Publish Button */}
                    <div className="absolute bottom-[20%] right-[15%] bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-xl shadow-lg shadow-orange-500/30 transform -rotate-12 group-hover:-rotate-6 transition-transform duration-300 z-30 flex items-center gap-2 cursor-pointer hover:scale-105">
                        <span className="font-bold text-xl tracking-tight">Publish</span>
                    </div>

                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-3">Upload & Grow</h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                    We deliver your final video in ready-to-upload YouTube format.
                </p>
            </div>

        </div>
    </section>





    2.   <div className="relative w-full max-w-[220px] flex flex-col gap-1.5">
        {/* Vertical fade masks */}
        <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#F9FAFB] to-transparent z-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#F9FAFB] to-transparent z-20 pointer-events-none" />

        {modules.map((mod, idx) => {
          const isActive = idx === activeIndex;
          
          return (
            <div key={mod} className="relative flex items-center h-12 px-2">
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="active-module-container"
                    className="absolute inset-0 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-gray-50 flex items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  >
                    <div className="w-1 h-4 bg-red-500 rounded-full ml-3" />
                  </motion.div>
                )}
              </AnimatePresence>
              
              <AnimatePresence>
                {isActive && (
                  <motion.div 
                    initial={{ scale: 0, x: -20 }}
                    animate={{ scale: 1, x: -45 }}
                    exit={{ scale: 0, x: -20 }}
                    className="absolute left-0 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20 z-30"
                  >
                    <span className="text-white text-[8px] font-bold">You</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative z-10 flex items-center justify-between w-full pl-6 pr-2">
                <span className={`text-[11px] font-semibold transition-colors duration-500 ${isActive ? 'text-gray-900' : 'text-gray-300'}`}>
                  {mod}
                </span>
                
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-green-500' : 'bg-gray-100 opacity-40'}`}>
                  <Check className={`w-3 h-3 ${isActive ? 'text-white' : 'text-gray-400'}`} strokeWidth={4} />
                </div>
              </div>
            </div>
          );
        })}
      </div>


      3.   <div className="relative w-[260px] h-[200px] bg-white border-2 border-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 bg-red-500 rounded flex items-center justify-center">
            <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[4px] border-l-white border-b-[3px] border-b-transparent ml-0.5" />
          </div>
          <div className="h-2 w-16 bg-gray-100 rounded-full" />
          <div className="flex-1" />
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-100" />
            <div className="w-2 h-2 rounded-full bg-gray-100" />
          </div>
        </div>

        {/* Video Box */}
        <motion.div 
          className="w-full h-24 rounded-xl border-2 transition-all duration-500"
          animate={{ 
            borderColor: activeElement === 'video' ? '#EF4444' : '#F3F4F6',
            backgroundColor: activeElement === 'video' ? '#FEF2F2' : '#F9FAFB',
            boxShadow: activeElement === 'video' ? '0 0 20px rgba(239, 68, 68, 0.1)' : 'none'
          }}
        />

        {/* Title & Profile */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-2.5 pt-1">
            <motion.div 
              className="h-2.5 rounded-full w-3/4 transition-colors duration-500"
              animate={{ backgroundColor: activeElement === 'title' ? '#FCA5A5' : '#F3F4F6' }}
            />
            <motion.div 
              className="h-2 rounded-full w-full transition-colors duration-500"
              animate={{ backgroundColor: activeElement === 'desc' ? '#FCA5A5' : '#F3F4F6' }}
            />
          </div>
        </div>

        {/* Cursors */}
        <Cursor name="Oscar Gracie" pos={oscarPos} color="bg-red-500" />
        <Cursor name="Lauren Brenner" pos={laurenPos} color="bg-red-600" />
      </div>