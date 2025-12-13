"use client"

import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NavItem = ({ label, active = false }: { label: string; active?: boolean }) => (
  <button
    className={`
      h-full px-6 flex items-center text-sm font-mono tracking-tight border-l border-ink hover:bg-paper transition-colors relative group
      ${active ? 'bg-signal text-white hover:bg-orange-600' : ''}
    `}
  >
    {label}
    {!active && (
      <span className="absolute bottom-0 left-0 w-full h-0 bg-signal transition-all group-hover:h-1" />
    )}
  </button>
);

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-50">
      <div className="bg-cream border border-ink shadow-brutalist flex justify-between h-14 md:h-16 relative">
        {/* Logo Section */}
        <div className="flex items-center pl-6 pr-8 border-r border-ink bg-white">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-signal border border-ink" />
            <span className="font-serif font-bold text-xl tracking-tighter italic">
              FlipAEO
            </span>
          </div>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex flex-1 items-stretch">
          <NavItem label="PRODUCT" />
          <NavItem label="CASE STUDIES" />
          <NavItem label="PRICING" />
          <div className="flex-1 border-l border-ink bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] opacity-20" />
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-stretch">
          <button className="px-8 font-mono text-sm border-l border-ink hover:text-signal transition-colors">
            LOGIN
          </button>
          <button className="px-8 font-mono text-sm font-bold bg-ink text-white hover:bg-signal transition-colors flex items-center gap-2">
            START SCAN
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden px-6 border-l border-ink flex items-center justify-center hover:bg-paper"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-cream border border-t-0 border-ink shadow-brutalist mt-0 flex flex-col md:hidden">
          <div className="p-4 border-b border-ink">PRODUCT</div>
          <div className="p-4 border-b border-ink">PRICING</div>
          <div className="p-4 bg-ink text-white text-center font-bold font-mono">
            START FREE SCAN
          </div>
        </div>
      )}
    </nav>
  );
};

export default Header;