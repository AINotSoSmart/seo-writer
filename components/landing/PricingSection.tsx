import Link from "next/link"
import { CalendarClock, Check, Layers3, SearchCheck } from "lucide-react"
import Button from "./Button"
import { CornerSquare } from "./CornerSquare"

const tiers = [
    {
        name: "Close",
        price: 249,
        velocity: "1 cluster / month",
        description: "Close the highest-priority part of your map at a steady pace.",
    },
    {
        name: "Accelerate",
        price: 449,
        velocity: "2 clusters / month",
        description: "Move through the same verified scope twice as fast.",
        featured: true,
    },
    {
        name: "Dominate",
        price: 799,
        velocity: "4 clusters / month",
        description: "Ship four complete, interlinked clusters every month.",
    },
]

const sharedFeatures = [
    "A finite, evidence-backed content scope",
    "Every gap linked to the page where it was observed",
    "Complete clusters shipped together",
    "Research, citations, internal links, and on-brand images",
    "WordPress-ready drafts and manual export",
]

export default function PricingSection() {
    return (
        <section id="pricing" className="relative z-10 w-full py-24">
            <div className="mx-auto w-full max-w-[1250px] px-3 sm:px-5">
                <div
                    className="mb-16 h-3 w-full border-y border-stone-200 sm:h-4"
                    style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)" }}
                />

                <div className="mb-14 flex w-full flex-col items-start justify-between gap-8 px-4 md:flex-row md:items-end md:gap-16 md:px-8">
                    <div className="flex-1">
                        <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-brand-500">
                            Price the finish line, choose the speed
                        </span>
                        <h2 className="font-serif text-4xl font-normal leading-[1] tracking-tight text-stone-900 md:text-5xl lg:text-6xl">
                            One verified scope. <br />
                            <span className="italic text-stone-500">Three delivery velocities.</span>
                        </h2>
                    </div>
                    <p className="max-w-xl flex-1 text-lg leading-relaxed text-stone-500">
                        We do not invent 30 topics to fill a monthly quota. Your audit reveals the
                        finite opportunity first; your plan only changes how quickly complete
                        clusters are researched, written, and delivered.
                    </p>
                </div>

                <div
                    className="relative h-3 w-full border-y border-stone-200 sm:h-4"
                    style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 6px, #e7e5e4 6px, #e7e5e4 7px)" }}
                >
                    <CornerSquare className="-left-[5px] -bottom-[5px]" />
                    <CornerSquare className="-right-[5px] -bottom-[5px]" />
                </div>

                <div className="grid border-x border-stone-200 md:grid-cols-3">
                    {tiers.map((tier) => (
                        <article
                            key={tier.name}
                            className={`relative flex flex-col border-b border-stone-200 p-7 md:border-r md:last:border-r-0 ${
                                tier.featured ? "bg-brand-50/40" : "bg-white/60"
                            }`}
                        >
                            {tier.featured && (
                                <span className="absolute right-5 top-5 rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                                    Recommended
                                </span>
                            )}
                            <div className="mb-8">
                                <h3 className="font-serif text-3xl text-stone-900">{tier.name}</h3>
                                <p className="mt-2 min-h-10 text-sm leading-relaxed text-stone-500">{tier.description}</p>
                            </div>
                            <div className="mb-2 flex items-end gap-1">
                                <span className="font-serif text-5xl tracking-tight text-stone-900">${tier.price}</span>
                                <span className="pb-1.5 text-sm text-stone-500">/ month</span>
                            </div>
                            <div className="mb-7 flex items-center gap-2 text-sm font-semibold text-stone-700">
                                <CalendarClock size={16} />
                                {tier.velocity}
                            </div>
                            <ul className="mb-8 flex-1 space-y-3">
                                {sharedFeatures.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed text-stone-600">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/login">
                                <Button variant="primary" className="w-full py-4">
                                    Audit My Site First
                                </Button>
                            </Link>
                        </article>
                    ))}
                </div>

                <div className="grid border-x border-b border-stone-200 bg-stone-50/60 md:grid-cols-3">
                    <div className="flex gap-3 p-6 md:border-r md:border-stone-200">
                        <SearchCheck className="mt-0.5 h-5 w-5 shrink-0 text-stone-700" />
                        <p className="text-sm text-stone-600">No gap enters the plan without a source URL.</p>
                    </div>
                    <div className="flex gap-3 p-6 md:border-r md:border-stone-200">
                        <Layers3 className="mt-0.5 h-5 w-5 shrink-0 text-stone-700" />
                        <p className="text-sm text-stone-600">No duplicate is added just to hit a quota.</p>
                    </div>
                    <div className="flex gap-3 p-6">
                        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-stone-700" />
                        <p className="text-sm text-stone-600">When the disclosed scope is closed, the program ends.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
