import React from 'react';

interface CornerSquareProps {
    className?: string;
}

/**
 * A reusable design token for the 'crosshair' grid aesthetic.
 * Small white square with inner depth, positioned absolutely.
 */
export const CornerSquare: React.FC<CornerSquareProps> = ({ className = "" }) => (
    <div className={`absolute w-2 h-2 bg-white border border-stone-300 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] z-20 ${className}`} />
);
