
import React from 'react';
import { Logo } from './Logo';
import { Facebook, Instagram, Ghost } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#D6F5F2] border-t-2 border-black py-12 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Left: Logo */}
        <div className="flex-shrink-0">
          <Logo />
        </div>

        {/* Center: Navigation */}
        <nav className="flex flex-wrap justify-center gap-8">
          <FooterLink href="#" label="Benefits" />
          <FooterLink href="#" label="How it work" />
          <FooterLink href="#" label="Testimonials" />
          <FooterLink href="#" label="Pricing" />
        </nav>

        {/* Right: Social Icons */}
        <div className="flex items-center gap-4">
          <SocialIcon icon={<Facebook className="w-5 h-5" />} />
          <SocialIcon icon={<Instagram className="w-5 h-5" />} />
          <SocialIcon icon={<Ghost className="w-5 h-5" />} />
        </div>

      </div>
    </footer>
  );
};

const FooterLink: React.FC<{ href: string; label: string }> = ({ href, label }) => (
  <a href={href} className="font-display font-bold text-sm uppercase tracking-wide text-black hover:underline decoration-2 underline-offset-4">
    {label}
  </a>
);

const SocialIcon: React.FC<{ icon: React.ReactNode }> = ({ icon }) => (
  <a href="#" className="w-10 h-10 bg-brand-yellow border-2 border-black rounded-full flex items-center justify-center hover:-translate-y-1 hover:shadow-neo-sm transition-all duration-200 text-black">
    {icon}
  </a>
);
