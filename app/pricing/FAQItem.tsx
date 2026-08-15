"use client";

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface FAQItemProps {
    question: string;
    answer: string;
}

export const FAQItem = ({ question, answer }: FAQItemProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            className={`
        group w-full rounded-[20px] p-1 transition-all duration-300 cursor-pointer
        ${isOpen
                    ? 'bg-brand-100 shadow-[inset_0_0_0_1px_#c4b5fd]'
                    : 'bg-white border border-stone-200 hover:border-brand-200 hover:shadow-sm'
                }
      `}
            onClick={() => setIsOpen(!isOpen)}
        >
            <div className={`
        w-full bg-stone-100/50 rounded-[17px] border transition-all duration-300 overflow-hidden relative
        ${isOpen ? 'border-brand-100 bg-white' : 'border-stone-100'}
      `}>
                <div className="flex items-center justify-between px-6 py-5">
                    <h3 className={`font-sans font-medium text-base md:text-xl pr-8 leading-snug transition-colors duration-300 ${isOpen ? 'text-stone-900' : 'text-stone-600 group-hover:text-stone-900'}`}>
                        {question}
                    </h3>
                    <div className={`
            flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-300
            ${isOpen
                            ? 'bg-brand-50 border-brand-200 text-brand-600 rotate-90'
                            : 'bg-stone-50 border-stone-200 text-stone-400 rotate-0 group-hover:bg-brand-50 group-hover:border-brand-200 group-hover:text-brand-500'}
          `}>
                        {isOpen ? <X size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
                    </div>
                </div>

                <div
                    className={`
            grid transition-all duration-500 ease-in-out
            ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
          `}
                >
                    <div className="overflow-hidden px-6 pb-6 pt-0">
                        <p className="text-stone-500 leading-relaxed text-base border-t border-brand-100/50 pt-4">
                            {answer}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
