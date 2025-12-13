"use client";

import React from 'react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { MessageCircleQuestion } from 'lucide-react';

const FAQSection = () => {
    return (
        <section className="py-24 bg-cream border-b border-ink">
            <div className="max-w-4xl mx-auto px-4">

                <div className="flex items-end gap-6 mb-16">
                    <div className="hidden md:flex h-16 w-16 items-center justify-center border border-ink bg-white shadow-brutalist-sm">
                        <MessageCircleQuestion size={32} />
                    </div>
                    <div>
                        <h2 className="font-serif text-4xl md:text-5xl text-ink leading-none mb-4">
                            Answering the <span className="italic text-ink/50">skeptical.</span>
                        </h2>
                        <p className="font-mono text-xs text-ink/60 uppercase tracking-widest">
                            // MODULE: OBJECTION_HANDLING
                        </p>
                    </div>
                </div>

                <div className="border-t border-ink">
                    <Accordion type="single" collapsible className="w-full">

                        <AccordionItem value="item-1" className="border-b border-ink">
                            <AccordionTrigger className="font-serif text-xl py-6 hover:no-underline hover:text-signal transition-colors text-left">
                                Will Google penalize me for AI content?
                            </AccordionTrigger>
                            <AccordionContent className="font-mono text-sm text-ink/70 leading-relaxed pb-6 pl-4 border-l-2 border-signal ml-2">
                                Google penalizes bad content. It doesn't care who wrote it; it cares who reads it. Our content metrics (Time on Page, Scroll Depth) mimic expert human writing because it is expert writing—accelerated by code and validated by real-time citations.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-2" className="border-b border-ink">
                            <AccordionTrigger className="font-serif text-xl py-6 hover:no-underline hover:text-signal transition-colors text-left">
                                Why not just use ChatGPT Plus?
                            </AccordionTrigger>
                            <AccordionContent className="font-mono text-sm text-ink/70 leading-relaxed pb-6 pl-4 border-l-2 border-signal ml-2">
                                ChatGPT is a chat interface, not a publisher. It doesn't know your brand voice, it hallucinates facts, and it resets context every session. FlipAEO is a persistent brain that learns your entity graph and defends it across thousands of articles.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-3" className="border-b border-ink">
                            <AccordionTrigger className="font-serif text-xl py-6 hover:no-underline hover:text-signal transition-colors text-left">
                                How does the "Visibility Check" work?
                            </AccordionTrigger>
                            <AccordionContent className="font-mono text-sm text-ink/70 leading-relaxed pb-6 pl-4 border-l-2 border-signal ml-2">
                                We ping the API endpoints of major LLMs (GPT-4, Claude 3.5, Gemini 1.5) with specific prompts about your brand niche. If they don't return your brand as an entity, we mark you as "Invisible" and generate a content plan specifically designed to inject your entity into their weights.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-4" className="border-b border-ink">
                            <AccordionTrigger className="font-serif text-xl py-6 hover:no-underline hover:text-signal transition-colors text-left">
                                Do I need to be a developer to use this?
                            </AccordionTrigger>
                            <AccordionContent className="font-mono text-sm text-ink/70 leading-relaxed pb-6 pl-4 border-l-2 border-signal ml-2">
                                No. While our backend is complex, the interface is designed for marketers. You simply input your URL, and we handle the scraping, analysis, and generation. It's a "Zero-Config" setup.
                            </AccordionContent>
                        </AccordionItem>

                    </Accordion>
                </div>

            </div>
        </section>
    );
};

export default FAQSection;
