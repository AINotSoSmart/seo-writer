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
    <nav className="w-full max-w-7xl mx-auto px-4 py-6 flex items-center justify-between relative z-50">
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

      {/* Mobile Nav Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b-2 border-black shadow-neo p-6 flex flex-col gap-4 md:hidden animate-in slide-in-from-top-5">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-sans font-bold text-xl text-black hover:text-brand-yellow transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Button variant="primary" fullWidth onClick={() => setIsMobileMenuOpen(false)}>
            Start for free
          </Button>
        </div>
      )}
    </nav>
  );
};