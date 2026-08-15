"use client"

import React, { useEffect, useState } from "react"
import { ChevronUp } from "lucide-react"

interface StoneCardProps {
    children: React.ReactNode
    className?: string
    contentClassName?: string
    variant?: "default" | "notch" // notch adds the decorative top element
}

export function StoneCard({
    children,
    className = "",
    contentClassName = "",
    variant = "notch"
}: StoneCardProps) {

    // Common styling for the inner card borders/bg
    const outerBg = 'bg-stone-100'
    const innerBg = 'bg-white border-stone-200'
    const notchBg = 'bg-stone-100 border-stone-200/50'
    const notchIconColor = 'text-stone-400'

    return (
        <div className={`relative flex w-full flex-col ${className}`}>
            {/* Outer Muted Wrapper */}
            <div className={`
        relative p-1 overflow-hidden w-full transition-all duration-300 rounded-[16px]
        shadow-[0_0_0_1px_rgba(0,0,0,0.08),0px_1px_2px_rgba(0,0,0,0.04)]
        ${outerBg}
      `}>

                {/* Top Notch Decoration - Optional Variant */}
                {variant === "notch" && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-6 z-20 flex justify-center pointer-events-none">
                        <div className={`w-8 h-4 rounded-b-lg border-b border-x ${notchBg} flex items-center justify-center`}>
                            <ChevronUp className={`w-3 h-3 ${notchIconColor}`} />
                        </div>
                    </div>
                )}

                {/* Inner Content Card */}
                <div className={`
           relative border overflow-hidden transition-all h-full rounded-[12px]
           ${innerBg}
           ${contentClassName}
        `}>
                    {children}
                </div>
            </div>
        </div>
    )
}
