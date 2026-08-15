"use client";

import { useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Caveat } from 'next/font/google';

// Configure the Caveat font
const caveat = Caveat({
  subsets: ['latin'],
  weight: '500',
});

interface FloatingTextProps {
  text: string;
  position: "left" | "right" | "bottom";
  isVisible: boolean;
  withUnderline?: boolean;
}

export default function FloatingText({ text, position, isVisible, withUnderline = false }: FloatingTextProps) {
  const textRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={textRef}
      className={cn(
        "absolute font-medium text-gray-600 transition-all duration-700",
        caveat.className, // Apply Caveat font to all text within this div
        position === "left" &&
          "left-8 -top-2 -translate-y-full -rotate-2 text-xs md:left-4 md:-translate-x-1/3 md:text-base sm:text-xl  floating-animation-1",
        position === "right" &&
          "right-8 top-2 -translate-y-full rotate-2 text-xs md:right-12 md:translate-x-1/3 floating-animation-2 text-lg md:text-xl flex items-center gap-1",
        position === "bottom" &&
          "bottom-0 sm:bottom-2 left-1/2 sm:left-[74%] md:left-[74%] sm:-rotate-12 -translate-x-1/2 translate-y-full text-lg md:text-xl floating-animation-3",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      {position === "right" && (
        <>
          <button className="border border-red-600 rounded-full">
            <X className="w-3 h-3 text-red-600" />
          </button>
          <span>{text}</span>
          {/* Tooltip always visible for right position */}
          <div className="absolute bottom-full right-20 mb-2 w-24 sm:w-32 bg-white shadow-lg rounded-lg p-1 sm:p-2 border z-10">
            <Image
              src="/content/plastic-feel3.webp"
              alt="Example of plastic AI skin"
              width={120}
              height={80}
              className="w-full h-auto rounded"
              style={{
                maxWidth: "100%",
                height: "auto",
              }}
            />

            {/* Arrow pointing down from tooltip to text */}
            <div className="absolute -bottom-2 right-0 transform rotate-90">
              <svg width="45" height="25" viewBox="0 0 40 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M40 0C25 15 10 20 0 15"
                  stroke="rgba(246, 59, 59, 0.6)"
                  strokeWidth="2.5"
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                />
                <path
                  d="M5 10L0 15L5 20"
                  stroke="rgba(246, 59, 59, 0.6)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </>
      )}

      {position !== "right" && text}

      {/* Original curved arrow animation for left position */}
      {position === "left" && (
        <div className="absolute -bottom-8 right-6 curved-arrow-left">
          <svg width="40" height="30" viewBox="0 0 40 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 0C15 15 30 20 40 15"
              stroke="rgba(79, 70, 229, 0.6)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
            <path
              d="M35 10L40 15L35 20"
              stroke="rgba(79, 70, 229, 0.6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {withUnderline && (
        <div className="absolute -bottom-1 left-0 h-0.5 w-full bg-gradient-to-r from-indigo-400 to-blue-600"></div>
      )}
    </div>
  );
}