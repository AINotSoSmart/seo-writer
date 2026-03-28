"use client";

import React from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import Button from './Button';
import Link from 'next/link';
import Image from 'next/image';

const NAV_LINKS = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Benefits', href: '/#benefits' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
];

export const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <nav className="max-w-6xl mx-auto sticky top-3 z-50 w-full px-4 md:px-8 flex justify-center">
      {/* 
          Outer Shell 
          - Pure white background to match page
          - Subtle border and shadow for lift
        */}
      <div className="
          relative w-full
          bg-white
          border border-stone-300/50
          
          rounded-[15px] p-1
          transition-all duration-300
        ">

        {/* 
             Inner Core
             - Light gray background for contrast
          */}
        <div className="
              w-full bg-stone-100/50 backdrop-blur-sm
              rounded-[12px] px-2 sm:px-5 py-2 sm:py-2 
              flex items-center justify-between  border border-stone-100
          ">

          <div className="flex items-center gap-2 group">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/site-logo.png" alt="Logo" width={36} height={36} />
              <span className="font-bold text-2xl tracking-tight text-stone-900 leading-none pb-1">
                FlipAEO
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-600">
            {NAV_LINKS.map((link, idx) => (
              <React.Fragment key={link.href}>
                <Link href={link.href} className="hover:text-stone-900 transition-colors">
                  {link.label}
                </Link>
                {idx < NAV_LINKS.length - 1 && <span className="text-stone-300">•</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Social/Tool Icons (Desktop only) */}
            <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-stone-200/50 mr-1">

              <Link href="https://x.com/flipaeo" target="_blank">
                <button className="
                          cursor-pointer group relative w-9 h-10 flex items-center justify-center 
                          bg-white border border-gray-300 rounded-lg text-stone-700
                          shadow-tactile-gray
                          active:translate-y-[2px] active:shadow-tactile-gray-active
                          transition-all duration-150 ease-out
                      ">
                  {/* X / Twitter Icon */}
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
              </Link>
            </div>

            {/* CTA Button */}
            <Link href="/content-plan">
              <button
                id="nav-cta-btn"
                className="
                       cursor-pointer flex items-center gap-2.5
                       bg-white
                       border border-gray-300
                       shadow-tactile-gray
                       active:translate-y-[2px] active:shadow-tactile-gray-active
                       px-2 sm:px-5 pt-1 sm:pt-2 pb-2 sm:pb-3 rounded-lg
                       transition-all duration-150 ease-out
                     ">
                <span className="text-gray-600 font-semibold text-xs sm:text-sm">Start Ranking in AI</span>
              </button>
            </Link>
            {/* Mobile Menu Toggle (only visible on mobile) */}

            <button
              className="
                          cursor-pointer lg:hidden
                          flex items-center justify-center
                          px-2 pt-1.5 pb-2 
                          bg-white
                          border border-gray-300
                          shadow-tactile-gray
                          active:translate-y-[2px] active:shadow-tactile-gray-active
                          rounded-lg
                          text-stone-600
                          transition-all duration-150
                      "
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-24 left-4 right-4 bg-white rounded-2xl shadow-2xl border border-stone-100 p-2 z-40 flex flex-col animate-in fade-in slide-in-from-top-2 origin-top lg:hidden">
          <div className="bg-stone-50 rounded-xl p-2 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="cursor-pointer px-4 py-3 rounded-lg hover:bg-white hover:shadow-sm text-stone-600 font-medium text-base transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="p-2 mt-1">
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full justify-center bg-stone-900 text-brand-50 shadow-none rounded-lg py-3">
                Start Ranking Now
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};