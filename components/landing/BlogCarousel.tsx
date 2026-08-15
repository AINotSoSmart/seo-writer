import React from 'react';
import BlogExampleCard from './BlogExampleCard';

const BLOG_EXAMPLES = [
    {
        title: "How to Promote Your Chrome Extension Online",
        category: "LaunchDirectories",
        href: "https://launchdirectories.com/blog/how-to-promote-your-chrome-extension-online",
        imageSrc: "/brands/launch-directories.png"
    },
    {
        title: "Can You Animate Photos of Deceased Relatives?",
        category: "BringBack",
        href: "https://bringback.pro/blog/can-you-animate-photos-of-deceased-relatives-safely",
        imageSrc: "/brands/bringback-screen.png"
    },
    {
        title: "The Complete Guide to AI SEO & AEO in 2026",
        category: "FlipAEO",
        href: "https://flipaeo.com/blog/the-complete-guide-to-ai-seo-aeo-in-2026",
        imageSrc: "/brands/flipaeo.png"
    },
    {
        title: "How to Use AI Headshots to Level Up Your Resume",
        category: "Unrealshot",
        href: "https://www.unrealshot.com/blog/how-to-use-ai-headshots-to-level-up-your-resume",
        imageSrc: "/brands/unrealshot-screen.png"
    }
];

const BlogCarousel: React.FC = () => {
    return (
        <div className="w-full mb-20 flex justify-center overflow-hidden">
            {/* 
                Container constrained to match the GridBackground max-width (1250px).
                We match the layout of GridBackground exactly.
            */}
            <div className="w-full max-w-[1250px] relative">

                {/* 
                    Inner container that sits between the side strips.
                    GridBackground strips are: w-3 (12px) on mobile, w-5 (20px) on sm.
                    We use px-3 sm:px-5 to align ONLY the content area between these strips.
                */}

                <div className="px-3 sm:px-5">
                    {/* 
                        Mask Image: created the "envelope coming out" effect by fading
                        the edges where the strips are. 
                    */}
                    <div
                        className="w-full relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_5%,white_95%,transparent)]"
                    >

                        {/* Carousel Track */}
                        <div className="flex gap-8 w-max animate-infinite-scroll py-10">
                            {/* Original Set */}
                            {BLOG_EXAMPLES.map((post, i) => (
                                <BlogExampleCard
                                    key={`original-${i}`}
                                    {...post}
                                />
                            ))}
                            {/* Duplicated Set for infinite scroll */}
                            {BLOG_EXAMPLES.map((post, i) => (
                                <BlogExampleCard
                                    key={`dupe-${i}`}
                                    {...post}
                                />
                            ))}
                            {/* Duplicated Set 2 for large screens */}
                            {BLOG_EXAMPLES.map((post, i) => (
                                <BlogExampleCard
                                    key={`dupe2-${i}`}
                                    {...post}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

};

export default BlogCarousel;