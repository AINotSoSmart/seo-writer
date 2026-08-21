import React from "react"
import { Bot, FileStack, Gauge, Globe, ListRestart, Target } from "lucide-react"
import Link from "next/link"

import { PRODUCT_TRUTH } from "@/config/product-truth"
import Button from "./Button"
import { CornerSquare } from "./CornerSquare"

const FeatureItem = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
    <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-50">
            <Icon size={20} strokeWidth={1.5} />
        </div>
        <div>
            <h4 className="font-serif text-lg leading-tight text-stone-900">{title}</h4>
            <p className="mt-1 text-sm leading-relaxed text-stone-500">{description}</p>
        </div>
    </div>
)

const PricingSection: React.FC = () => (
    <section id="pricing" className="relative z-10 w-full py-24">
        <div className="mx-auto w-full max-w-[1250px] px-3 sm:px-5">
            <div className="mb-16 h-3 w-full border-y border-stone-200 sm:h-4" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)" }} />
            <div className="mb-14 flex flex-col items-start justify-between gap-8 px-4 md:flex-row md:items-end md:px-8">
                <div>
                    <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-brand-500">Founding beta</span>
                    <h2 className="font-serif text-4xl font-normal leading-none tracking-tight text-stone-900 md:text-6xl">
                        Measure what buyers ask.<br /><span className="italic text-stone-500">Close what is missing.</span>
                    </h2>
                </div>
                <p className="max-w-xl text-lg leading-relaxed text-stone-500">
                    One recurring plan measures up to 25 distinct buyer questions, shows the evidence, and turns the highest-priority gaps into a complete draft batch.
                </p>
            </div>

            <div className="relative h-3 w-full border-y border-stone-200 sm:h-4" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)" }}>
                <CornerSquare className="-bottom-[5px] -left-[5px]" />
                <CornerSquare className="-bottom-[5px] -right-[5px]" />
            </div>
            <div className="grid border-x border-b border-stone-200 bg-white md:grid-cols-[1.2fr_0.8fr]">
                <div className="border-b border-stone-200 p-8 md:border-b-0 md:border-r md:p-12">
                    <div className="flex items-end gap-3">
                        <span className="font-serif text-6xl tracking-tight text-stone-900">${PRODUCT_TRUTH.introductoryPrice}</span>
                        <span className="pb-2 text-sm text-stone-500">/ month</span>
                    </div>
                    <p className="mt-2 text-sm text-stone-500">
                        First {PRODUCT_TRUTH.introductoryPeriods} billing periods. Planned continuing price ${PRODUCT_TRUTH.continuingPrice}/month thereafter.
                    </p>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        <FeatureItem icon={Target} title="40 buyer questions" description="Confirmed once, then tracked durably for one website." />
                        <FeatureItem icon={Bot} title="Two AI engines" description="ChatGPT and Google AI Mode measured each paid cycle." />
                        <FeatureItem icon={Gauge} title="Up to 8 actions" description="Create or refresh work selected by priority, never filler." />
                        <FeatureItem icon={FileStack} title="One complete batch" description="All selected drafts released together for review or export." />
                        <FeatureItem icon={ListRestart} title="Visible backlog" description="Qualified work that does not fit waits for a later cycle." />
                        <FeatureItem icon={Globe} title="Report-only findings" description="Evidence stays useful even when an article is not the answer." />
                    </div>
                </div>
                <div className="flex flex-col justify-between bg-stone-50/70 p-8 md:p-12">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-brand-500">Launch contract</p>
                        <h3 className="mt-4 font-serif text-3xl text-stone-900">The cap controls cost. It does not invent work.</h3>
                        <p className="mt-4 text-sm leading-relaxed text-stone-500">
                            A cycle can honestly deliver fewer than eight actions. Additional qualified gaps remain visible and carry forward. The subscription continues until you cancel; completed reports and drafts remain yours.
                        </p>
                    </div>
                    <div className="mt-10">
                        <Link href="/login?next=/onboarding" className="block">
                            <Button variant="primary" className="w-full px-6 py-3.5">Confirm my buyer questions</Button>
                        </Link>
                        <p className="mt-3 text-center text-xs text-stone-400">Checkout opens only after sandbox verification.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>
)

export default PricingSection
