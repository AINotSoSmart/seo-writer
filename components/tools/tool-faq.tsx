"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FAQItem {
    question: string;
    answer: string;
}

interface ToolFAQProps {
    faqs: FAQItem[];
    title?: string;
}

export function ToolFAQ({ faqs, title = "Frequently Asked Questions" }: ToolFAQProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    // Generate FAQPage schema
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
            },
        })),
    };

    return (
        <section className="py-12">
            {/* Inject FAQPage Schema */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />

            <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-8 text-foreground">{title}</h2>

            <div className="max-w-3xl mx-auto space-y-4">
                {faqs.map((faq, index) => (
                    <div
                        key={index}
                        className="border-2 border-black shadow-neo"
                    >
                        <button
                            onClick={() => toggleFAQ(index)}
                            className="flex items-center justify-between w-full p-4 text-left"
                        >
                            <span className="font-medium font-display text-lg pr-4">{faq.question}</span>
                            <ChevronDown
                                className={cn(
                                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
                                    openIndex === index && "rotate-180"
                                )}
                            />
                        </button>
                        <div
                            className={cn(
                                "overflow-hidden transition-all duration-200",
                                openIndex === index ? "max-h-96" : "max-h-0"
                            )}
                        >
                            <p className="px-4 pb-4 text-muted-foreground leading-relaxed border-t-2 border-transparent">
                                {faq.answer}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
