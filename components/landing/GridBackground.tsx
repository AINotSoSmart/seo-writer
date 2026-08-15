
export function GridBackground() {
    return (
        <div className="w-full h-full flex justify-center">
            {/* 
            The Grid Container
            Matches the max-w-6xl of the content + the side gutters
        */}
            <div className="w-full max-w-[1250px] flex h-full border-l border-r border-stone-200">

                {/* Left Patterned Bar using SVG */}
                <div
                    className="w-3 sm:w-5 h-full border-r border-stone-200 flex-shrink-0"
                    style={{
                        backgroundImage: `url('https://cdn.prod.website-files.com/66aa53e3f8ad708a60cdd037/66aa9fb5c2a1f988427f6b54_Sidebar%20Lines.svg')`,
                        backgroundSize: '100% auto',
                        backgroundRepeat: 'repeat-y',
                        backgroundPosition: 'top center'
                    }}
                ></div>

                <div className="flex-1 h-full relative grid grid-cols-4">
                </div>

                {/* Right Patterned Bar using SVG */}
                <div
                    className="w-3 sm:w-5 h-full border-l border-stone-200 flex-shrink-0"
                    style={{
                        backgroundImage: `url('https://cdn.prod.website-files.com/66aa53e3f8ad708a60cdd037/66aa9fb5c2a1f988427f6b54_Sidebar%20Lines.svg')`,
                        backgroundSize: '100% auto',
                        backgroundRepeat: 'repeat-y',
                        backgroundPosition: 'top center'
                    }}
                ></div>
            </div>
        </div>
    );
};

