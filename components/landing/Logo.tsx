import React from 'react';
import { Puzzle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export const Logo: React.FC = () => {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      <div className="relative ">
        <Image src="/site-logo.png" alt="Logo" width={38} height={38} className="object-contain" />
      </div>
      <span className="font-display font-black text-2xl tracking-tight text-white text-stroke-black">
        <span style={{ WebkitTextStroke: '1px black', color: '#FCD34D' }}>FlipAEO</span>
      </span>
    </Link>
  );
};