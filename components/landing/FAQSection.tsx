"use client";

import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const faqs = [
    {
      question: "WILL GOOGLE PENALIZE THIS CONTENT?",
      answer: "No. Google rewards helpful, authoritative content regardless of how it's produced. Unlike generic AI that hallucinates, our engine performs deep research, cites real sources, and focuses on 'Information Gain'—the exact signals Google's algorithms prioritize."
    },
    {
      question: "HOW IS THIS DIFFERENT FROM CHATGPT?",
      answer: "ChatGPT is a chatbot; we are a Strategy Engine. We don't just 'write text'. We analyze top-ranking competitors, map your internal links, ensure accurate citations, and apply your specific Brand Voice DNA. It's the difference between a rough draft and a publish-ready article."
    },
    {
      question: "DO I NEED TO EDIT THE ARTICLES?",
      answer: "Our users typically spend 2-5 minutes polishing. Because we handle the research, formatting, and internal linking automatically, you're acting more like an Editor-in-Chief than a writer. The heavy lifting is 100% done for you."
    },
    {
      question: "DOES IT INTEGRATE WITH MY SITE?",
      answer: "Yes. We have direct 1-click publishing integrations for WordPress and Webflow. We also support custom webhooks if you have a unique tech stack. Images, formatting, and meta tags are all synced automatically."
    },
    {
      question: "WHAT IF I DON'T LIKE THE OUTPUT?",
      answer: "You have full control. You can regenerate specific sections or the entire article. Plus, our 'Brand Voice' learning improves with every article you publish, ensuring the AI gets smarter about your specific style over time."
    },
    {
      question: "CAN I CANCEL IF IT'S NOT FOR ME?",
      answer: "Absolutely. We offer a 14-day money-back guarantee. If you don't see the quality in your initial articles, we'll refund you. No questions asked."
    },
    {
      question: "IS THE CONTENT PLAGIARISM-FREE?",
      answer: "Yes. Every article is generated from scratch based on real-time research. We also run a built-in uniqueness check to ensure your content is original and safe to publish."
    },
    {
      question: "WHAT LANGUAGES DO YOU SUPPORT?",
      answer: "Currently, we specialize in high-quality English (US/UK) content to ensure maximum nuance and authority. Multi-language support is on our roadmap for Q4."
    },
    {
      question: "WHAT HAPPENS IF I RUN OUT OF CREDITS?",
      answer: "You can easily top up credits from your dashboard at any time, or upgrade to a higher tier plan for better volume pricing. Unused credits roll over for 30 days."
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
          DOUBTS ABOUT AI?<br />LET'S CLEAR THEM.
        </h2>
        <p className="font-sans text-gray-500 text-lg md:text-xl leading-relaxed max-w-2xl">
          We know you've been burned by "magic buttons" before. Here is exactly how we protect your brand and authority.
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
    <div
      className={`
        w-full bg-white border-2 border-black shadow-neo transition-all duration-200 overflow-hidden
        ${isOpen ? 'translate-x-[2px] translate-y-[2px] shadow-none' : 'hover:-translate-y-1 hover:shadow-neo-hover'}
      `}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between group text-left"
      >
        <span className="font-display font-black text-lg md:text-xl uppercase pr-4">{question}</span>
        <div
          className={`
            w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-black flex items-center justify-center flex-shrink-0 transition-colors duration-200
            ${isOpen ? 'bg-brand-orange rotate-180' : 'bg-brand-yellow group-hover:bg-brand-orange'}
          `}
        >
          <ChevronDown className="w-5 h-5 md:w-6 md:h-6 text-black stroke-[3px]" />
        </div>
      </button>

      <div
        className={`
          transition-[max-height,opacity] duration-300 ease-in-out
          ${isOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="px-6 pb-6 pt-0">
          <p className="font-sans text-gray-600 text-lg leading-relaxed border-t-2 border-black/5 pt-4">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
};
