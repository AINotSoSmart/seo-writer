"use client";

import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const faqs = [
    {
      question: "CAN I CANCEL ANYTIME?",
      answer: "Yes, absolutely! You can cancel your subscription at any time from your account settings. You will retain access until the end of your current billing period."
    },
    {
      question: "DO I NEED TO DOWNLOAD OR INSTALL ANYTHING?",
      answer: "No, SnapClass is completely web-based. You can access it from any browser on any device without installing any software."
    },
    {
      question: "IS THERE A FREE TRIAL AVAILABLE?",
      answer: "Yes, we offer a 14-day free trial on all paid plans so you can explore the features before committing."
    },
    {
      question: "CAN I UPLOAD VIDEOS AND DOCUMENTS?",
      answer: "Yes! Our course builder supports video hosting, PDF documents, quizzes, and various other media types to enrich your lessons."
    },
    {
      question: "HOW MANY STUDENTS CAN I ADD?",
      answer: "The number of students depends on your plan. The Starter plan allows up to 100 students, while the Pro and Academy plans support significantly more or unlimited students."
    },
    {
      question: "DO STUDENTS NEED THEIR OWN ACCOUNT?",
      answer: "Yes, students will create their own accounts to access your courses, track their progress, and receive certificates upon completion."
    }
  ];

  return (
    <section className="w-full py-24 px-4 flex flex-col items-center">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-16 max-w-3xl">
        <div className="inline-block bg-[#FAFA9D] border-2 border-black shadow-neo-sm px-4 py-1 mb-8 transform rotate-2">
          <span className="font-display font-black text-xs uppercase tracking-widest">FAQ</span>
        </div>
        <h2 className="font-display font-black text-4xl md:text-6xl leading-tight mb-6">
          COMMON QUESTIONS<br />ANSWERED CLEARLY
        </h2>
        <p className="font-sans text-gray-500 text-lg md:text-xl leading-relaxed max-w-2xl">
          Here are clear answers to the most common questions we get from creators coaches and teams using the platform.
        </p>
      </div>

      {/* FAQ List */}
      <div className="w-full max-w-3xl space-y-4">
        {faqs.map((faq, index) => (
          <FAQItem key={index} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </section>
  );
};

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white border-2 border-black p-4 md:p-6 shadow-neo flex items-center justify-between group transition-all duration-200 ${isOpen ? 'translate-x-[2px] translate-y-[2px] shadow-none' : 'hover:-translate-y-1 hover:shadow-neo-hover'}`}
      >
        <span className="font-display font-black text-lg md:text-xl text-left uppercase">{question}</span>
        <div className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center flex-shrink-0 transition-colors ${isOpen ? 'bg-brand-orange' : 'bg-brand-yellow group-hover:bg-brand-orange'}`}>
          {isOpen ? <ChevronDown className="w-6 h-6 text-black stroke-[3px]" /> : <ChevronRight className="w-6 h-6 text-black stroke-[3px]" />}
        </div>
      </button>

      {isOpen && (
        <div className="bg-white border-2 border-t-0 border-black p-6 animate-in slide-in-from-top-2 fade-in duration-200">
          <p className="font-sans text-gray-600 text-lg leading-relaxed">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
};
