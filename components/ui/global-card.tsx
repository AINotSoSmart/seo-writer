"use client"

import React, { useEffect, useState } from "react"
import { ChevronUp } from "lucide-react"

interface StoneCardProps {
    children: React.ReactNode
    className?: string
    contentClassName?: string
    variant?: "default" | "notch" // notch adds the decorative top element
}

export function GlobalCard({
    children,
    className = "",
    contentClassName = "",
    variant = "notch"
}: StoneCardProps) {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
        }
    }, [])

    // Common styling for the inner card borders/bg
    const outerBg = isDark ? 'bg-stone-800' : 'bg-stone-100'
    const innerBg = isDark ? 'bg-stone-900 border-stone-700' : 'bg-white border-stone-200'
    const notchBg = isDark ? 'bg-stone-800 border-stone-700' : 'bg-stone-100 border-stone-200/50'
    const notchIconColor = isDark ? 'text-stone-500' : 'text-stone-400'

    return (
        <div className={`relative flex w-full flex-col ${className}`}>
            {/* Outer Muted Wrapper */}
            <div className={`
        relative p-1 overflow-hidden w-full transition-all duration-300 rounded-[16px]
        shadow-[0_0_0_1px_rgba(0,0,0,0.08),0px_1px_2px_rgba(0,0,0,0.04)]
        ${outerBg}
      `}>



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
