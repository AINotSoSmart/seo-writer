"use client"

import { Button } from "@/components/ui/button"
import { Check, Play, Sparkles } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import Image from "next/image"
import { Caveat } from 'next/font/google';

// Configure the Caveat font
const caveat = Caveat({
  subsets: ['latin'],
  weight: '500',
});

// Using your actual image paths from the original component
const images = [
  { src: "/landing/landingphotowoman1.webp", alt: "AI-generated glamorous photoshoot - Unrealshot AI" },
  { src: "/landing/landingphotoman2.webp", alt: "AI-generated vintage photoshoot of a man - Unrealshot AI" },
  { src: "/landing/landingphotowoman3.webp", alt: "AI-generated influencer photoshoot of a lady - Unrealshot AI" },
  { src: "/landing/landingphotoman4.webp", alt: "AI-generated 90s photoshoot of a man - Unrealshot AI" },
  { src: "/landing/landingphotowoman5.webp", alt: "AI-generated Natural Looks photoshoot of a lady - Unrealshot AI" },
  { src: "/landing/landingphotoman16.webp", alt: "- MD doctor AI headshot of a man - Unrealshot AI" },
  { src: "/landing/landingphotowoman7.webp", alt: "Stylish AI Portraits of a woman - Unrealshot AI" },

  { src: "/landing/landingphotoman8.webp", alt: "AI-generated professional headshot of a man - Unrealshot AI" },
  { src: "/landing/landingphotowoman9.webp", alt: "AI-generated Neutral Muse photoshoot of woman - Unrealshot AI" },
  { src: "/landing/landingphotoman10.webp", alt: "AI real estate headshot of a man - Unrealshot AI" },
  { src: "/landing/landingphotowoman11.webp", alt: "AI-generated romantic indoor photoshoot of a lady - Unrealshot AI" },
  { src: "/landing/landingphotoman12.webp", alt: "AI Dating photoshoot of a man  - Unrealshot AI" },
  { src: "/landing/landingphotowoman13.webp", alt: "urban street style photo of a woman - Unrealshot AI" },
  { src: "/landing/landingphotoman14.webp", alt: "AI-generated Fantasy photoshoot of a man - Unrealshot AI" },
  { src: "/landing/landingphotowoman15.webp", alt: "AI Yearbook photo of a woman - Unrealshot AI" },
  { src: "/landing/landingphotoman6.webp", alt: "AI-generated natural outdoor photography of a man - Unrealshot AI" },
  { src: "/landing/landingphotoman17.webp", alt: "black swan inspired photoshoot of a man - Unrealshot AI" },
]

export function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const [isCopied, setIsCopied] = useState(false)
  const couponCode = "WELCOME15"

  const handleCopy = () => {
    navigator.clipboard.writeText(couponCode)
    setIsCopied(true)
    setTimeout(() => {
      setIsCopied(false)
    }, 2000) // Revert back to the original text after 2 seconds
  }
  return (
    <section className="relative mx-auto pb-12 overflow-hidden min-h-screen bg-black">
      {/* Paper Texture */}
      <div
        className="absolute inset-0 z-2 -pt-8"
        style={{
          backgroundImage: `url('/bg-pattern.svg')`,
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'auto'
        }}
      />
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('/bg-image.webp')`,
        }}
      />

      <div className="px-4 pt-[150px] max-w-6xl mx-auto text-center flex flex-col justify-center">
        <div className="relative z-10 space-y-6">
          <div className="space-y-6">
            <div className="inline-flex p-[3px] rounded-full bg-gradient-to-r from-[#ff6f00] via-orange-400 to-[#ff6f00] shadow-[0_0_15px_rgba(255,111,0,0.3)] animate-pulse-subtle">
              <div className="flex items-center bg-black rounded-full p-[2px]">

                {/* Left Side: The Hook (High Contrast Orange) */}
                <div className="bg-[#ff6f00] text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Sparkles size={12} className="text-white" />
                  <span className="tracking-wide uppercase ">Halloween Sale</span>
                </div>

                {/* --- The NEW Interactive Right Side --- */}
                <div
                  className="flex items-center px-3 cursor-pointer"
                  onClick={handleCopy}
                  title="Click to copy coupon code"
                >
                  <span className="text-gray-300 text-xs font-medium mr-1 transition-all duration-300">
                    {isCopied ? (
                      <span className="text-green-400 font-bold">Code Copied!</span>
                    ) : (
                      <>
                        Get <span className="text-white font-bold">15% Off</span>
                      </>
                    )}
                  </span>

                  {/* The icon now changes based on the state */}
                  {isCopied ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#ff6f00] opacity-80"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  )}
                </div>


              </div>
            </div>
            <h1 className="text-4xl sm:text-6xl max-w-4xl mx-auto font-bold leading-[1.1] mb-4 font-[var(--font-inter-tight)]">
              <span className="text-white">
                AI Photoshoots That Actually
              </span>
              <span className="text-[#ff6f00] ml-2">
                Look Like You
              </span>
            </h1>

            <p className="text-lg text-gray-300 max-w-3xl mx-auto mb-8">
              Transform your casual photos into a professional-grade photoshoot that captures you at your absolute best. Get an entire portfolio of authentic photos for every profile.            </p>
          </div>
          <div className="flex  sm:flex-row gap-2 justify-center items-center w-full relative">

            <Link href="/blog-writer">
              <Button
                className="text-sm sm:text-md font-semibold py-5 sm:py-6 group relative bg-[#ff6f00] hover:bg-[#ff6f00]/90 text-white rounded-md overflow-hidden cursor-pointer pr-12"
              >
                Start Your Shoot
                <div className="bg-white rounded-sm p-2 sm:p-3 absolute right-1 top-1/2 -translate-y-1/2">
                  <img
                    src="/arrow.svg"
                    alt="arrow-right"
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </div>
              </Button>
            </Link>
            <Link href="#">
              <Button
                className="text-sm sm:text-md py-5 sm:py-6 group relative bg-white hover:bg-white/90 text-black rounded-md overflow-hidden cursor-pointer pr-12"
                onClick={(e) => {
                  e.preventDefault();
                  setIsVideoModalOpen(true);
                }}
              >
                Watch Demo
                <div className="bg-[#ff6f00] text-white rounded-sm p-2 sm:p-3 absolute right-1 top-1/2 -translate-y-1/2">
                  <Play className="w-6 h-6 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </Button>
            </Link>

            {/* Whirl Arrow pointing to floating text */}
            <div className="hidden md:block absolute right-82 top-16 mt-4 -translate-y-1/2 w-16 h-20 pointer-events-none">
              <svg
                viewBox="0 0 59 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full text-orange-500 opacity-70 transform rotate-50"
              >
                <path
                  d="M7.66614 22.083C8.61245 23.967 9.50382 25.809 10.5502 27.8855C9.46822 27.9516 8.62906 27.273 8.11869 26.4189C6.58755 23.8566 5.08123 21.2357 3.75924 18.5229C2.99812 16.9739 3.65927 15.9282 5.04612 16.172C7.36079 16.5421 9.68076 17.0712 12.0256 17.5417C12.1602 17.5669 12.3348 17.5838 12.4048 17.6759C12.7097 17.9858 12.9498 18.3626 13.2298 18.7311C12.9958 18.9402 12.8221 19.3502 12.5678 19.35C11.6851 19.3744 10.8123 19.29 9.95444 19.2559C9.48565 19.2471 9.04169 19.1798 8.47894 19.5644C9.09834 20.0754 9.7328 20.6367 10.3522 21.1477C23.4279 31.1179 38.4176 30.6525 47.7967 20.0973C48.9958 18.7256 50.015 17.178 51.1441 15.7141C51.5421 15.2039 51.955 14.7439 52.353 14.2337C52.5027 14.3091 52.6277 14.4431 52.7774 14.5186C52.7934 14.9956 52.9342 15.6067 52.7454 15.9665C52.1844 17.2048 51.6234 18.443 50.8975 19.5556C43.7187 30.665 30.0661 33.8934 16.8279 27.4803C14.2971 26.248 11.87 24.5135 9.42336 22.9967C8.90409 22.6783 8.44951 22.2929 7.95505 21.9159C7.86023 21.8823 7.75566 21.9576 7.66614 22.083Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </svg>
            </div>

            {/* Floating text */}
            <p className={`hidden md:block text-gray-300 text-lg font-semibold leading-none md:absolute md:transform md:rotate-6 md:right-40 md:top-full md:mt-8 md:w-48 sm:static sm:mt-2 sm:transform-none sm:rotate-0 sm:text-center sm:w-auto pointer-events-none ${caveat.className}`}>
              Watch it Live before you give your money to us
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 pt-2">
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-2">
                <img
                  src="/content/sachin.webp"
                  alt="User profile photo"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="/content/sumesh.webp"
                  alt="User profile photo"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="/content/manoj.jpg"
                  alt="User profile photo"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="/content/emma-thopmson.jpg"
                  alt="User profile photo"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <div className="w-8 h-8 rounded-full bg-gray-900 border-2 border-white flex items-center justify-center">
                  <span className="text-white text-xs font-bold">1.2k</span>
                </div>
              </div>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-lg">
                    ★
                  </span>
                ))}
              </div>
            </div>
            <p className="text-gray-400 text-md">Starting at $9.99 ONLY</p>
          </div>
        </div>
      </div>

      {/* Slider Section with Right-to-Left Animation */}
      <div className="w-full pt-4 sm:pt-12 overflow-hidden">
        <div className="hidden md:flex w-full">
          <div className="flex animate-slide-rtl">
            {/* Duplicate images for seamless loop */}
            {[...images, ...images].map((image, index) => (
              <div
                key={index}
                className="min-w-[200px] p-2 relative flex-shrink-0"
                style={{ padding: "0 10px" }}
              >
                <div className="relative w-[200px] h-[280px]">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="rounded-lg object-cover"
                    style={{ objectPosition: 'center' }}
                  />
                  <div className="absolute bottom-2 left-2 flex items-center gap-[1.5px]">
                    <Image
                      src="/site-logo.png"
                      alt="Unrealshot AI Logo"
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Image Slider - Infinite loop with no gaps */}
        <div className="block md:hidden w-full overflow-hidden">
          <div
            className="flex animate-slide-rtl-mobile"
            style={{
              width: `${images.length * 2 * 220}px` // Double width for seamless loop
            }}
          >
            {/* First set of images */}
            {images.map((image, index) => (
              <div
                key={`first-${index}`}
                className="w-[200px] p-2 relative flex-shrink-0"
              >
                <div className="relative w-full h-full max-w-[200px] mx-auto aspect-[3/4]">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="rounded-lg object-cover"
                    style={{ objectPosition: 'center top' }}
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-[1px] bg-white/80 rounded text-[10px]">
                    <Image
                      src="/site-logo.png"
                      alt="Unrealshot AI Logo"
                      width={16}
                      height={16}
                      className="w-4 h-4 rounded"
                    /><span className="px-1 py-0.5">
                      AI
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {/* Second set of images for seamless loop */}
            {images.map((image, index) => (
              <div
                key={`second-${index}`}
                className="w-[200px] p-2 relative flex-shrink-0"
              >
                <div className="relative w-full h-full max-w-[200px] mx-auto aspect-[3/4]">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="rounded-lg object-cover"
                    style={{ objectPosition: 'center top' }}
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-[1px] bg-white/80 rounded text-[10px]">
                    <Image
                      src="/site-logo.png"
                      alt="Unrealshot AI Logo"
                      width={16}
                      height={16}
                      className="w-4 h-4 rounded"
                    /><span className="px-1 py-0.5">
                      AI
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-rtl {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .animate-slide-rtl {
          animation: slide-rtl 60s linear infinite;
        }
        
        .animate-slide-rtl-mobile {
          animation: slide-rtl-mobile 38s linear infinite;
        }
        
        @keyframes slide-rtl-mobile {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>

      
    </section>
  )
}
