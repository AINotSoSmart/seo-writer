
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { GridBackground } from '@/components/landing/GridBackground';
import { ArrowRight, Check, Zap, Target, Sparkles, AlertTriangle, ChevronRight } from 'lucide-react';
import { StructuredData } from '@/components/seo/StructuredData';
import { solutions } from '../data';
import { defaultSEO } from '@/config/seo';

interface Props {
    params: Promise<{
        slug: string;
    }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const solution = solutions[slug];

    if (!solution) {
        return { title: 'Solution Not Found | FlipAEO' };
    }

    return {
        title: `${solution.heroTitle} | FlipAEO`,
        description: solution.heroSubtitle,
        alternates: {
            canonical: `${defaultSEO.siteUrl}/solutions/${slug}`
        }
    };
}

export async function generateStaticParams() {
    return Object.keys(solutions).map((slug) => ({ slug }));
}

export default async function SolutionPage({ params }: Props) {
    const { slug } = await params;
    const solution = solutions[slug];

    if (!solution) {
        notFound();
    }

    const {
        editorial,
        methodology,
        measurementModel,
        implementationPlan,
        sources,
        relatedResources,
        engineName, heroTitle, heroBadge, heroSubtitle,
        quickAnswer, problems, howItWorks, rankingFactors, benefits,
        useCases, deepDive, faqTitle, faqSubtitle, faqs, cta, relatedTitle, relatedSubtitle, relatedSlugs, color
    } = solution;

    const relatedCards = relatedSlugs
        .filter(s => solutions[s])
        .map(s => ({
            slug: s,
            title: solutions[s].engineName,
            description: solutions[s].heroSubtitle.length > 100
                ? solutions[s].heroSubtitle.substring(0, 100).trim() + '...'
                : solutions[s].heroSubtitle,
            badge: solutions[s].heroBadge
        }));

    const importanceColors: Record<string, string> = {
        Critical: 'bg-red-50 text-red-700 border-red-100',
        High: 'bg-amber-50 text-amber-700 border-amber-100',
        Medium: 'bg-stone-50 text-stone-600 border-stone-200'
    };

    return (
        <div className="relative min-h-screen w-full flex flex-col font-sans bg-stone-50/20">
            <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <GridBackground />
            </div>

            <Navbar />

            <main className="flex-grow flex flex-col items-center w-full relative pt-24 pb-24 z-10 overflow-hidden">
                <StructuredData
                    data={{
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: `${engineName} Optimization by FlipAEO`,
                        description: heroSubtitle,
                        author: editorial ? {
                            "@type": "Person",
                            name: editorial.author
                        } : undefined,
                        provider: {
                            "@type": "Organization",
                            name: "FlipAEO",
                            url: defaultSEO.siteUrl
                        },
                        serviceType: `${engineName} Optimization`
                    }}
                />
                <StructuredData
                    data={{
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        mainEntity: faqs.map(faq => ({
                            "@type": "Question",
                            name: faq.question,
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: faq.answer
                            }
                        }))
                    }}
                />
                <StructuredData
                    data={{
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        itemListElement: [
                            {
                                "@type": "ListItem",
                                position: 1,
                                name: "Solutions",
                                item: `${defaultSEO.siteUrl}/solutions`
                            },
                            {
                                "@type": "ListItem",
                                position: 2,
                                name: engineName,
                                item: `${defaultSEO.siteUrl}/solutions/${slug}`
                            }
                        ]
                    }}
                />

                {/* [01] HERO */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16 text-center pt-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-brand-200 text-brand-600 text-[11px] font-bold tracking-widest uppercase mb-8 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{heroBadge}</span>
                    </div>
                    <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl text-stone-900 leading-[1.1] mb-6 tracking-tight max-w-4xl mx-auto">
                        {heroTitle.split('—')[0]}
                        {heroTitle.includes('—') && (
                            <>
                                <br />
                                <span className="italic font-light text-brand-600">{heroTitle.split('—')[1]}</span>
                            </>
                        )}
                    </h1>
                    <p className="font-sans text-lg md:text-xl text-stone-500 max-w-2xl mx-auto leading-snug mb-6">
                        {heroSubtitle}
                    </p>
                    <Link
                        href={cta.buttonHref}
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200"
                    >
                        {cta.buttonLabel}
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </section>

                {editorial && (
                    <section className="w-full max-w-5xl mx-auto px-6 mb-12">
                        <div className="bg-white rounded-xl border border-stone-200 px-5 py-4 text-sm text-stone-600 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <span>Written by {editorial.author}</span>
                            <span>Reviewed by {editorial.reviewer}</span>
                            <span>Last updated {editorial.lastUpdated}</span>
                        </div>
                    </section>
                )}

                {methodology && (
                    <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                                <h2 className="text-sm font-display text-stone-900">Methodology</h2>
                            </div>
                            <div className="p-6 space-y-5">
                                <p className="text-sm text-stone-600 leading-relaxed">{methodology.summary}</p>
                                <ul className="grid md:grid-cols-2 gap-3">
                                    {methodology.checks.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-sm text-stone-600">
                                            <Check className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                )}

                {/* [02] ZERO-CLICK ANSWER */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                    <div className="bg-white rounded-xl border border-brand-200 overflow-hidden shadow-xs">
                        <div className="bg-brand-50/50 px-6 py-4 border-b border-brand-100 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-brand-600 fill-brand-600" />
                            <h2 className="font-display text-sm text-brand-900 uppercase tracking-wider">{quickAnswer.question}</h2>
                        </div>
                        <div className="p-6 md:p-8">
                            <p className="text-stone-700 text-sm md:text-base leading-relaxed mb-6 font-medium">
                                {quickAnswer.answer}
                            </p>
                            <div className="border-t border-stone-100 pt-6">
                                <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Key Takeaways</div>
                                <ul className="grid md:grid-cols-2 gap-3">
                                    {quickAnswer.keyTakeaways.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-sm text-stone-600">
                                            <Check className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* [03] PROBLEM */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">

                    <div className="text-center mb-12">
                        <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">
                            {problems.title}
                        </h2>
                        <p className="text-stone-500 text-lg max-w-2xl mx-auto">{problems.subtitle}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 md:gap-0">
                        {problems.items.map((item, i) => (
                            <div key={i} className={`flex flex-col gap-4 ${i === 0 ? 'md:pr-10 md:border-r border-brand-200' : i === 1 ? 'md:px-10 md:border-r border-brand-200' : 'md:pl-10'}`}>
                                <div className="w-7 h-7 rounded-md bg-brand-50 border border-brand-100 flex items-center justify-center">
                                    <AlertTriangle className="w-3.5 h-3.5 text-brand-500" />
                                </div>
                                <h3 className="font-sans text-xl font-medium text-stone-900 tracking-tight">{item.headline}</h3>
                                <p className="font-sans text-stone-500 leading-relaxed text-sm">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* [04] HOW IT WORKS */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">

                    <div className="text-center mb-12">
                        <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{howItWorks.title}</h2>
                        <p className="text-stone-500 text-lg max-w-2xl mx-auto">{howItWorks.subtitle}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {howItWorks.steps.map((step, i) => (
                            <div key={i} className="relative bg-white border border-stone-200 rounded-2xl p-8 hover:border-brand-200 transition-colors group">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm">
                                        {step.stepNumber}
                                    </div>
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{step.label}</span>
                                </div>
                                <h3 className="font-serif text-xl text-stone-900 mb-3 group-hover:text-brand-600 transition-colors">{step.title}</h3>
                                <p className="text-stone-500 text-sm leading-relaxed mb-4">{step.description}</p>
                                <p className="text-stone-400 text-xs leading-relaxed italic">{step.detail}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* [05] RANKING FACTORS */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">


                    <div className="text-center mb-12">
                        <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{rankingFactors.title}</h2>
                        <p className="text-stone-500 text-lg max-w-2xl mx-auto">{rankingFactors.subtitle}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <div className="grid grid-cols-12 bg-stone-50 border-b border-stone-200">
                                <div className="col-span-2 p-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Factor</div>
                                <div className="col-span-3 p-4 text-xs font-bold text-stone-500 uppercase tracking-wider">What It Means</div>
                                <div className="col-span-5 p-4 text-xs font-bold text-brand-700 uppercase tracking-wider">How FlipAEO Addresses It</div>
                                <div className="col-span-2 p-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-center">Priority</div>
                            </div>
                            <div className="divide-y divide-stone-100">
                                {rankingFactors.factors.map((f, i) => (
                                    <div key={i} className="grid grid-cols-12 hover:bg-stone-50/50 transition-colors">
                                        <div className="col-span-2 p-4 text-sm font-semibold text-stone-900">{f.factor}</div>
                                        <div className="col-span-3 p-4 text-sm text-stone-500 leading-tight">{f.description}</div>
                                        <div className="col-span-5 p-4 text-sm text-stone-700 leading-tight font-medium">{f.flipaeoApproach}</div>
                                        <div className="col-span-2 p-4 flex items-center justify-center">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded border ${importanceColors[f.importance]}`}>
                                                {f.importance}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-stone-100">
                            {rankingFactors.factors.map((f, i) => (
                                <div key={i} className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-stone-900">{f.factor}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${importanceColors[f.importance]}`}>
                                            {f.importance}
                                        </span>
                                    </div>
                                    <p className="text-sm text-stone-500">{f.description}</p>
                                    <div className="bg-brand-50/30 border border-brand-100 rounded-lg p-3">
                                        <p className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">FlipAEO Approach</p>
                                        <p className="text-sm text-stone-700">{f.flipaeoApproach}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* [06] BENEFITS BENTO */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">

                    <div className="text-center mb-12">
                        <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{benefits.title}</h2>
                        <p className="text-stone-500 text-lg max-w-2xl mx-auto">{benefits.subtitle}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                        {benefits.items.map((b, i) => (
                            <div
                                key={i}
                                className={`${b.size === 'large' ? 'md:col-span-4' : 'md:col-span-2'} bg-white border border-brand-200 rounded-2xl p-8 flex flex-col`}
                            >
                                <div className="text-[10px] font-bold tracking-widest text-brand-400 uppercase mb-2">{b.label}</div>
                                <h3 className="font-serif text-xl md:text-2xl text-stone-900 mb-3 leading-tight">{b.title}</h3>
                                <p className="text-stone-500 text-sm leading-relaxed">{b.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* [07] USE CASES */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">

                    <div className="text-center mb-12">
                        <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{useCases.title}</h2>
                        <p className="text-stone-500 text-lg max-w-2xl mx-auto">{useCases.subtitle}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {useCases.items.map((uc, i) => (
                            <div key={i} className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col hover:border-brand-200 transition-colors">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                                        <Target className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold text-stone-900">{uc.role}</span>
                                </div>
                                <p className="text-sm text-stone-500 leading-relaxed mb-4 flex-grow italic">&ldquo;{uc.scenario}&rdquo;</p>
                                <div className="bg-brand-50/30 border border-brand-100 rounded-lg p-3">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">
                                        <Check className="w-3 h-3" /> Outcome
                                    </div>
                                    <p className="text-sm text-stone-700">{uc.outcome}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* [08] DEEP DIVE */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                    <div className="text-center mb-12">
                        <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{deepDive.title}</h2>
                        <p className="text-stone-500 text-lg max-w-2xl mx-auto">{deepDive.subtitle}</p>
                    </div>

                    <div className="space-y-6">
                        {deepDive.sections.map((section, i) => (
                            <div key={i} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50">
                                    <h3 className="text-sm font-display text-stone-900 flex items-center gap-2">
                                        <ChevronRight className="w-4 h-4 text-brand-500" />
                                        {section.heading}
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <p className="text-stone-600 text-sm leading-relaxed">{section.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {measurementModel && (
                    <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                        <div className="text-center mb-12">
                            <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{measurementModel.title}</h2>
                            <p className="text-stone-500 text-lg max-w-2xl mx-auto">{measurementModel.subtitle}</p>
                        </div>

                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                            <div className="divide-y divide-stone-100">
                                {measurementModel.metrics.map((item, idx) => (
                                    <div key={idx} className="grid md:grid-cols-3 gap-4 p-6">
                                        <div className="text-sm font-semibold text-stone-900">{item.metric}</div>
                                        <div className="text-sm text-stone-500 leading-relaxed">{item.whyItMatters}</div>
                                        <div className="text-sm text-stone-700 leading-relaxed">{item.targetSignal}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {implementationPlan && (
                    <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                        <div className="text-center mb-12">
                            <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{implementationPlan.title}</h2>
                            <p className="text-stone-500 text-lg max-w-2xl mx-auto">{implementationPlan.subtitle}</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            {implementationPlan.phases.map((item, idx) => (
                                <div key={idx} className="bg-white border border-stone-200 rounded-2xl p-6">
                                    <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">{item.phase}</div>
                                    <h3 className="font-serif text-xl text-stone-900 mb-3">{item.title}</h3>
                                    <p className="text-sm text-stone-500 leading-relaxed">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}


                {/* [10] FAQ */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                    <div className="text-center mb-12">
                        <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{faqTitle}</h2>
                        <p className="text-stone-500 text-lg max-w-2xl mx-auto">{faqSubtitle}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
                        {faqs.map((faq, idx) => (
                            <div key={idx} className="p-6">
                                <h3 className="text-sm font-display text-stone-900 mb-2 flex items-center gap-2">
                                    <span className="text-brand-500">Q.</span>
                                    {faq.question}
                                </h3>
                                <p className="text-stone-500 text-sm leading-relaxed pl-6">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {sources && sources.length > 0 && (
                    <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                        <div className="text-center mb-12">
                            <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">Sources And Methodology</h2>
                            <p className="text-stone-500 text-lg max-w-2xl mx-auto">Use primary references, platform documentation, and Search Central guidance to validate the framework on this page.</p>
                        </div>

                        <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
                            {sources.map((source, idx) => (
                                <div key={idx} className="p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                                    <div className="text-sm text-stone-600">
                                        <div className="font-medium text-stone-900">{source.label}</div>
                                        {source.note && <div className="mt-1">{source.note}</div>}
                                    </div>
                                    <Link
                                        href={source.href}
                                        className="text-sm font-medium text-brand-600 hover:text-brand-700"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Visit source
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {relatedResources && relatedResources.length > 0 && (
                    <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                        <div className="text-center mb-12">
                            <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">Put This Framework Into Practice</h2>
                            <p className="text-stone-500 text-lg max-w-2xl mx-auto">Move from strategy to execution with the comparison pages most closely tied to this recovery workflow.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            {relatedResources.map((resource) => (
                                <Link
                                    key={resource.href}
                                    href={resource.href}
                                    className="group block bg-white rounded-xl border border-stone-200 p-6 hover:border-brand-200 hover:bg-stone-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-sm font-semibold text-stone-900 group-hover:text-brand-700 transition-colors">
                                                {resource.title}
                                            </div>
                                            <div className="text-sm text-stone-500 mt-2 leading-relaxed">{resource.description}</div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-brand-600 transition-colors shrink-0 mt-0.5" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* [11] CTA */}
                <section className="w-full max-w-5xl mx-auto px-6 mb-16">
                    <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-200 rounded-2xl p-8 md:p-12 text-center">
                        <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{cta.headline}</h2>
                        <p className="text-stone-500 text-lg max-w-2xl mx-auto mb-8">{cta.subheadline}</p>
                        <Link
                            href={cta.buttonHref}
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200"
                        >
                            {cta.buttonLabel}
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </section>

                {/* [12] RELATED SOLUTIONS */}
                {relatedCards.length > 0 && (
                    <section className="w-full max-w-5xl mx-auto px-6 mb-24">
                        <div className="text-center mb-12">
                            <h2 className="font-serif text-3xl md:text-4xl text-stone-900 mb-4 tracking-tight">{relatedTitle}</h2>
                            <p className="text-stone-500 text-lg max-w-2xl mx-auto">{relatedSubtitle}</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            {relatedCards.map((card) => (
                                <Link
                                    key={card.slug}
                                    href={`/solutions/${card.slug}`}
                                    className="group block bg-white rounded-xl border border-stone-200 p-6 hover:border-brand-200 hover:bg-stone-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">{card.badge}</div>
                                            <div className="text-sm font-semibold text-stone-900 group-hover:text-brand-700 transition-colors mb-2">
                                                {card.title} Optimization
                                            </div>
                                            <div className="text-sm text-stone-500 leading-relaxed">{card.description}</div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-brand-600 transition-colors shrink-0 mt-1" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

            </main>

            <Footer />
        </div>
    );
}
