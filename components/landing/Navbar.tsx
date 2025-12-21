"use client";

import React, { useState } from 'react';
import { Logo } from './Logo';
import { Button } from './Button';
import { Menu, X } from 'lucide-react';

interface NavLink {
  label: string;
  href: string;
}

const links: NavLink[] = [
  { label: 'Benefits', href: '#' },
  { label: 'How it work', href: '#' },
  { label: 'Testimonials', href: '#' },
  { label: 'Pricing', href: '#' },
];

export const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="w-full max-w-7xl mx-auto px-4 py-6 flex items-center justify-between relative !z-50">
      {/* Logo */}
      <div className="flex-shrink-0">
        <Logo />
      </div>

      {/* Desktop Nav */}
      <div className="hidden md:flex items-center gap-8">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="font-sans font-semibold text-black hover:text-gray-600 transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>

      {/* CTA Button Desktop */}
      <div className="hidden md:block">
        <Button variant="primary" size="sm" className="text-sm font-bold px-5 py-2.5">
          Start for free
        </Button>
      </div>

      {/* Mobile Menu Toggle */}
      <button
        className="md:hidden p-2"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
      </button>

      {/* Mobile Nav Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 min-h-screen z-50 bg-white flex flex-col animate-in fade-in duration-200">
          {/* Header with Logo and Close Button */}
          <div className="w-full max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
            <Logo />
            <button
              className="p-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-8 h-8" />
            </button>
          </div>

          {/* Links Container */}
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="font-display font-black text-4xl uppercase text-black hover:text-brand-yellow hover:scale-105 transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Footer Button */}
          <div className="p-8 pb-12 w-full max-w-md mx-auto">
            <Button variant="primary" size="lg" fullWidth onClick={() => setIsMobileMenuOpen(false)} className="py-6 text-xl uppercase tracking-widest">
              Start for free
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};