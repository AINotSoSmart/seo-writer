import React from 'react';
import { AlertCircle, WifiOff, Construction, FileQuestion } from 'lucide-react';

interface ErrorGraphicProps {
    mode?: 'error' | 'offline' | 'maintenance' | '404';
    className?: string;
}

export const ErrorGraphic: React.FC<ErrorGraphicProps> = ({ mode = 'error', className }) => {
    const config = {
        error: {
            icon: AlertCircle,
            label: 'Something went wrong',
            bgColor: 'bg-red-50',
            iconColor: 'text-red-500',
            borderColor: 'border-red-200'
        },
        offline: {
            icon: WifiOff,
            label: 'You\'re offline',
            bgColor: 'bg-stone-50',
            iconColor: 'text-stone-600',
            borderColor: 'border-stone-200'
        },
        maintenance: {
            icon: Construction,
            label: 'Under maintenance',
            bgColor: 'bg-amber-50',
            iconColor: 'text-amber-600',
            borderColor: 'border-amber-200'
        },
        '404': {
            icon: FileQuestion,
            label: 'Page not found',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-500',
            borderColor: 'border-blue-200'
        }
    };

    const { icon: Icon, label, bgColor, iconColor, borderColor } = config[mode];

    return (
        <div className={`flex flex-col items-center ${className}`}>
            {/* Icon Container */}
            <div className={`w-28 h-28 ${bgColor} border-2 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6`}>
                <Icon className={`w-12 h-12 ${iconColor}`} strokeWidth={1.5} />
            </div>

            {/* Label Badge */}
            <div className={`inline-block px-4 py-1.5 ${bgColor} border-2 border-black text-black font-bold text-sm uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                {label}
            </div>
        </div>
    );
};
