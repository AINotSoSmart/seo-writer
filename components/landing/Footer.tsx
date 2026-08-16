import React from 'react';
import { X, Mail } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full px-4 md:px-6 pb-8 flex justify-center z-10 relative mb-2">
      {/* 
        Outer Shell - Exactly Matching Navbar Aesthetic 
        Navbar: border border-stone-300/50 rounded-[15px] p-1
      */}
      <div className="
        relative w-full max-w-[1126px]
        bg-white
        border border-stone-300/50
        rounded-[15px] p-1
        shadow-xs
      ">
        {/* 
           Inner Core - Exactly Matching Navbar Aesthetic
           Navbar: bg-stone-100/50 backdrop-blur-sm rounded-[12px] border border-stone-100
        */}
        <div className="
            w-full bg-stone-100/50 backdrop-blur-sm
            rounded-[12px] px-6 py-12 md:p-12 lg:p-16
            border border-stone-100
            relative overflow-hidden
        ">

          <div className="relative z-10 flex flex-col lg:flex-row gap-12 lg:gap-24 mb-16">

            {/* Brand Column */}
            <div className="lg:w-1/3 flex flex-col items-start gap-6">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-2xl tracking-tight text-stone-900 leading-none">
                  FlipAEO
                </span>
              </div>

              <p className="font-sans text-stone-500 text-sm leading-relaxed max-w-sm">
                AI visibility measurement and evidence-bound content delivery for founder-led B2B SaaS. Track 40 buyer questions, see where your brand loses, and receive the highest-priority create or refresh work as one complete batch.
              </p>


            </div>

            {/* Navigation Columns */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">


              {/* Product */}
              <div className="flex flex-col gap-4">
                <h4 className="font-serif text-lg text-stone-900 font-medium">Product</h4>
                <nav className="flex flex-col gap-3">
                  <Link href="/#features" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">Features</Link>
                  <Link href="/case-studies/bringback" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">Live Case Study</Link>
                  <Link href="/#pricing" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">Pricing</Link>
                </nav>
              </div>

              {/* Company */}
              <div className="flex flex-col gap-4">
                <h4 className="font-serif text-lg text-stone-900 font-medium">Company</h4>
                <nav className="flex flex-col gap-3">
                  <Link href="/about" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">About Us</Link>
                  <Link href="/blog" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">Blog</Link>
                  <Link href="mailto:support@flipaeo.com" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">Contact</Link>
                </nav>
              </div>

              {/* Legal */}
              <div className="flex flex-col gap-4">
                <h4 className="font-serif text-lg text-stone-900 font-medium">Legal</h4>
                <nav className="flex flex-col gap-3">
                  <Link href="/privacy-policy" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">Privacy Policy</Link>
                  <Link href="/terms" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">Terms of Service</Link>
                  <Link href="/refund-policy" className="font-sans text-sm text-stone-500 hover:text-brand-600 transition-colors duration-200 w-fit">Refund Policy</Link>

                </nav>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="relative z-10 pt-8 border-t border-stone-200/60 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="font-sans text-sm text-stone-400">
              © {currentYear} FlipAEO. All rights reserved.
            </p>

            {/* Socials */}
            <div className="flex items-center gap-4">
              <Link
                href="https://x.com/flipaeo"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-stone-400 hover:bg-brand-50 hover:text-brand-600 border border-stone-200 hover:border-brand-200 transition-all duration-300"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Link>
              <Link
                href="mailto:support@flipaeo.com"
                aria-label="Email"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-stone-400 hover:bg-brand-50 hover:text-brand-600 border border-stone-200 hover:border-brand-200 transition-all duration-300"
              >
                <Mail className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
