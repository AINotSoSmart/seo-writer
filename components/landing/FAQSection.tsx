"use client";

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

const FAQS = [
  {
    question: "How do I know the gaps you find are real?",
    answer: "Check them. Every gap in your report links to the page or the search where we observed that question. Open a few at random. We built the audit this way because the honest answer to 'trust us' is that you should not have to."
  },
  {
    question: "How is this different from hiring an agency?",
    answer: "The workflow is narrower and productised. FlipAEO measures a fixed set of buyer questions, retains the evidence, and delivers the selected content work as one batch. What an agency may give you that we do not: a human strategist on calls, link building, and someone to coordinate your team."
  },
  {
    question: "Why not just buy a $19 AI blog writer?",
    answer: "Because writing was never the bottleneck. Those tools will happily produce fifty articles about whatever you type in, which is how sites end up with a large archive and nothing to show for it. The expensive part is knowing which articles are worth writing and being able to check that answer. That is the part we do first, and the part we let you audit."
  },
  {
    question: "How many articles will I actually get?",
    answer: "Up to eight create or refresh actions can be selected in one billing cycle, but eight is a ceiling rather than a quota. A cycle may honestly contain fewer. Qualified work that does not fit stays visible in the backlog instead of being discarded or squeezed into filler."
  },
  {
    question: "How do you stop it inventing things about my product?",
    answer: "Anything an article claims about your product has to trace back to your own website or something you confirmed during setup. Facts from anywhere else are attributed to the page they came from, and never rewritten as though they were about you. Articles are checked against that rule before delivery, and a failing one is rewritten rather than shipped."
  },
  {
    question: "What happens to work that does not fit this cycle?",
    answer: "It stays in the visible backlog for later prioritisation. Findings that should not become owned content remain report-only evidence. Neither kind is silently deleted, and neither is used to pad the batch to eight."
  },
  {
    question: "What happens when you run out of topics?",
    answer: "We show a report-only cycle or a smaller action batch; we do not manufacture articles. The subscription does not cancel itself. You can cancel future billing cycles at any time, while completed reports and delivered drafts remain available."
  },
  {
    question: "Do I need to edit the articles?",
    answer: "Read them before publishing, always. Research, structure, internal links and images are done, so you are editing rather than writing. Anyone promising zero human review is selling you something they have not read either."
  },
  {
    question: "What if my site is too small to qualify?",
    answer: "There is no minimum cluster floor in the recurring contract. A narrow site may produce fewer than eight actions or only report evidence in a cycle. We would rather show that honestly than invent content merely because an allowance exists."
  },
  {
    question: "Can I use this for more than one product?",
    answer: "The launch plan covers one website. A second product on another website needs a separate subscription. It is built for the person who owns the product, not for agencies: there are no client workspaces, white-label reports or approval chains."
  },
  {
    question: "Do you promise rankings or traffic?",
    answer: "No. We can show the exact questions measured, the AI answers and citations observed, and the drafts delivered for selected work. Search and AI systems are controlled by third parties, so rankings, traffic, mentions and citations are not guaranteed."
  },
  {
    question: "What languages do you support?",
    answer: "English only for now, in either US or UK spelling. We would rather do one language properly than several badly, so we will announce another when it genuinely reaches the same standard."
  },
];

const FAQItem = ({ item }: { item: typeof FAQS[0] }) => {
  return (
    <details
      className="group w-full rounded-[20px] p-1 transition-all duration-300 open:bg-brand-100 open:shadow-[inset_0_0_0_1px_#c4b5fd] bg-white border border-stone-200 hover:border-brand-200"
    >
      <summary className="list-none outline-none cursor-pointer flex items-center justify-between">
        {/* Inner Container (The "Canvas") */}
        <div className="w-full bg-stone-100 rounded-[17px] border border-stone-100 transition-all duration-300 flex items-center justify-between px-6 py-3.5 relative overflow-hidden group-open:border-brand-100">
          <h3 className="font-sans font-medium text-base md:text-xl pr-8 leading-snug transition-colors duration-300 text-stone-600 group-hover:text-stone-900 group-open:text-stone-900">
            {item.question}
          </h3>

          {/* Interactive Icon */}
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-300 bg-stone-50 border-stone-200 text-stone-400 rotate-0 group-hover:bg-brand-50 group-hover:border-brand-200 group-hover:text-brand-500 group-open:bg-brand-50 group-open:border-brand-200 group-open:text-brand-600 group-open:rotate-90">
            <Plus size={16} strokeWidth={2.5} className="group-open:hidden transition-transform duration-300" />
            <X size={16} strokeWidth={2.5} className="hidden group-open:block transition-transform duration-300" />
          </div>
        </div>
      </summary>

      {/* Expandable Content Area */}
      <div className="px-6 py-5 bg-stone-100/50 rounded-b-[17px] -mt-4 pt-8 transition-all duration-500 opacity-0 group-open:opacity-100">
        <p className="text-stone-500 leading-relaxed text-base font-medium">
          {item.answer}
        </p>
      </div>
    </details>
  );
};

import { CornerSquare } from './CornerSquare';

export const FAQSection: React.FC = () => {
  // Generate FAQ Schema for SEO
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQS.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <>
      <section id="faq" className="w-full py-24 relative z-10">
        <div className="w-full max-w-[1250px] mx-auto px-3 sm:px-5">

          {/* Horizontal Pattern Bar Above Header */}
          <div className="relative w-full h-3 sm:h-4 border-y border-stone-200 mb-16" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
            <CornerSquare className="-left-[5px] -bottom-[5px]" />
            <CornerSquare className="-right-[5px] -bottom-[5px]" />
          </div>

          {/* Header - Left/Right Premium Setup */}
          <div className="flex flex-col md:flex-row gap-8 md:gap-16 justify-between items-start md:items-end mb-16 w-full px-4 md:px-8">
            <div className="flex-1">
              <span className="font-sans text-xs font-bold tracking-widest text-brand-500 uppercase mb-4 block">
                Common Questions
              </span>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-stone-900 tracking-tight font-normal leading-[1]">
                Doubts about FlipAEO?<br /><span className='italic text-stone-500'>Let's clear them.</span>
              </h2>
            </div>
            <div className="flex-1 md:max-w-xl pb-0 md:pb-2">
              <p className="font-sans text-stone-500 text-lg leading-relaxed">
                We know you've been burned by "magic buttons" before. Here is exactly how we protect your brand and authority.
              </p>
            </div>
          </div>

          {/* Horizontal Pattern Bar Top (Grid Boundary) */}
          <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>

            <CornerSquare className="-left-[5px] -bottom-[5px]" />
            <CornerSquare className="-right-[5px] -bottom-[5px]" />
          </div>

          {/* FAQ List wrapped in the wireframe border */}
          <div className="w-full border-x border-stone-200  p-4 md:p-8 relative">
            <CornerSquare className="-left-[5px] -top-[5px]" />
            <CornerSquare className="-right-[5px] -top-[5px]" />
            <CornerSquare className="-left-[5px] -bottom-[5px]" />
            <CornerSquare className="-right-[5px] -bottom-[5px]" />

            <div className="max-w-3xl mx-auto flex flex-col gap-4">
              {FAQS.map((faq, index) => (
                <FAQItem key={index} item={faq} />
              ))}
            </div>
          </div>

          {/* Horizontal Pattern Bar Bottom (Grid Boundary) */}
          <div className="relative w-full h-3 sm:h-4 border-y border-stone-200" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)' }}>
            <CornerSquare className="-left-[5px] -top-[5px]" />
            <CornerSquare className="-right-[5px] -top-[5px]" />
          </div>

        </div>
      </section>

      {/* FAQ Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
};

export default FAQSection;
