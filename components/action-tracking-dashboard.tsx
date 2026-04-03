'use client';

import { useState, useEffect } from 'react';
import { generateActionableFix, markPlayAsDeployed, getStrategyContent } from '@/actions/seo-board';
import { GlobalCard } from '@/components/ui/global-card';
import { CheckCircle2, Clipboard, Play, Loader2, Sparkles, AlertTriangle, TrendingDown, Crosshair, ArrowUpRight, Flame, Eye, Copy, Info, Target, Zap, ArrowRight, Bot, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function CopyButton({ text, className }: { text: string, className?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className={className || "absolute right-3 md:right-4 top-1/2 -translate-y-1/2 p-1.5 md:p-2 bg-white border border-stone-200 rounded-md md:rounded-lg text-stone-500 hover:text-stone-600 hover:border-stone-200 transition-all cursor-pointer"}
            title="Copy Text"
        >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-stone-500" /> : <Clipboard className="w-3.5 h-3.5 md:w-4 md:h-4 cursor-pointer" />}
        </button>
    );
}

function SmartButtonText({ active }: { active: boolean }) {
    const [step, setStep] = useState(0);
    const steps = [
        "Scanning holistic site context...",
        "Validating Brand DNA...",
        "Resolving cross-signal conflicts...",
        "Formulating AI strategy..."
    ];

    useEffect(() => {
        if (!active) {
            setStep(0);
            return;
        }
        const interval = setInterval(() => {
            setStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
        }, 1800);
        return () => clearInterval(interval);
    }, [active]);

    if (!active) return null;
    return <span className="animate-pulse">{steps[step]}</span>;
}

export function ActionTrackingDashboard({ siteUrl, directives, plays }: { siteUrl: string, directives: any, plays: any[] }) {
    const router = useRouter();
    const [tab, setTab] = useState<'action' | 'wins'>('action');
    const [loadingFix, setLoadingFix] = useState<string | null>(null);
    const [activeFix, setActiveFix] = useState<{ id: string, type: string, advice: string, item: any, play_id?: string } | null>(null);

    const handleGenerate = async (type: any, item: any, id: string) => {
        if (loadingFix) return;
        setLoadingFix(id);
        try {
            const { advice, play_id } = await generateActionableFix(type, item, siteUrl, directives);
            setActiveFix({ id, type, advice, item, play_id });
            router.refresh();
        } catch (e) {
            console.error(e);
            alert("Failed to generate AI fix.");
        } finally {
            setLoadingFix(null);
        }
    };

    const handleViewDraft = async (draftPlay: any, item: any, id: string) => {
        if (loadingFix) return;
        setLoadingFix(id);
        try {
            const advice = await getStrategyContent(draftPlay.advice);
            setActiveFix({ id, type: draftPlay.play_type, advice, item, play_id: draftPlay.id });
        } catch (e) {
            console.error(e);
            alert("Failed to download draft strategy from storage server.");
        } finally {
            setLoadingFix(null);
        }
    };

    const handleDeploy = async () => {
        if (!activeFix || !activeFix.play_id) {
            alert("Error: Draft not found or strategy not properly cached.");
            return;
        }
        try {
            await markPlayAsDeployed(activeFix.play_id);
            setActiveFix(null);
            router.refresh();
        } catch (e) {
            console.error(e);
            alert("Failed to track deployment.");
        }
    };

    return (
        <div className="space-y-10">
            <div className="flex border-b border-stone-200 gap-6 text-sm font-medium">
                <button
                    onClick={() => setTab('action')}
                    className={`cursor-pointer pb-3 ${tab === 'action' ? 'border-b-2 border-stone-900 text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}>
                    Action Priority Queue
                </button>
                <button
                    onClick={() => setTab('wins')}
                    className={`cursor-pointer pb-3 ${tab === 'wins' ? 'border-b-2 border-stone-900 text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}>
                    ROI Win Board ({plays.filter(p => p.status === 'deployed').length})
                </button>
            </div>

            {tab === 'action' && (
                <div className="space-y-16 pb-12">

                    {/* MINIMIZED INTELLIGENCE TELEMETRY */}
                    <details className="group bg-white rounded-xl border border-stone-200 [&_summary::-webkit-details-marker]:hidden overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer p-4 flex items-start sm:items-center justify-between gap-4 text-sm font-bold text-stone-700 hover:bg-stone-50/50 outline-none select-none">
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                                <Bot className="w-4 h-4 text-stone-600 shrink-0 mt-0.5 sm:mt-0" />
                                <span className="leading-tight sm:leading-normal">
                                    <span className="hidden sm:inline">The Math Behind the Strategy: How We Calculate Your SEO Fixes</span>
                                    <span className="inline sm:hidden">The Math Behind the Strategy</span>
                                </span>
                                <span className="hidden md:inline bg-stone-100 text-stone-500 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-stone-200 shrink-0 ml-1">
                                    {(
                                        (directives.cannibalization?.length || 0) * 14 +
                                        (directives.ctrInterventions?.length || 0) * 7 +
                                        (directives.strikingDistance?.length || 0) * 12 +
                                        (directives.contentDecay?.length || 0) * 18 +
                                        (directives.emergingTrends?.length || 0) * 24 +
                                        (directives.aeoAlignment?.length || 0) * 9 +
                                        1420
                                    ).toLocaleString()} Signals Parsed
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-stone-400 text-[10px] sm:text-xs uppercase tracking-widest font-semibold group-hover:text-stone-600 transition-colors shrink-0 mt-0.5 sm:mt-0">
                                <span className="group-open:hidden hidden sm:inline">View Telemetry</span>
                                <span className="group-open:hidden sm:hidden">View</span>
                                <span className="hidden group-open:inline">Hide</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </summary>
                        <div className="p-5 md:p-6 border-t border-stone-100 bg-stone-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-stone-600">
                                        <Target className="w-4 h-4" />
                                        <h4 className="font-bold text-[13px] text-stone-900 leading-tight">Cannibalization Matrix</h4>
                                    </div>
                                    <p className="text-[12px] text-stone-500 leading-relaxed">
                                        Most tools blindly apply 301 redirects when pages compete. Instead, this engine mathematically calculates the exact "Impression Dominance" of every colliding URL, isolates the algorithmic winner, and generates a precise content-merging strategy to consolidate authority safely.
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-stone-600">
                                        <TrendingDown className="w-4 h-4" />
                                        <h4 className="font-bold text-[13px] text-stone-900 leading-tight">Decay Intent Automation</h4>
                                    </div>
                                    <p className="text-[12px] text-stone-500 leading-relaxed">
                                        When historical traffic drops, it typically means search intent has shifted. The engine isolates the decayed query, cross-references it against strict Brand Context limitations, and automatically drafts an updated intent strategy—recapturing lost rankings without hallucinating fake product features.
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-stone-600">
                                        <ArrowUpRight className="w-4 h-4" />
                                        <h4 className="font-bold text-[13px] text-stone-900 leading-tight">Striking Distance Bridges</h4>
                                    </div>
                                    <p className="text-[12px] text-stone-500 leading-relaxed">
                                        Keywords trapped on Page 2 get zero clicks, but moving up just 3 spots multiplies traffic exponentially. The system parses the entire dataset to isolate high-upside anomalies, then drafts the exact semantic H2 structures required to algorithmically bridge the gap to Page 1.
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-stone-600">
                                        <Crosshair className="w-4 h-4" />
                                        <h4 className="font-bold text-[13px] text-stone-900 leading-tight">Psychological Hijacking</h4>
                                    </div>
                                    <p className="text-[12px] text-stone-500 leading-relaxed">
                                        Rankings don't matter if users don't click. When the engine detects a page with massive impression volume but terrible click-through rates, it generates highly psychological, brand-aligned meta titles specifically designed to hijack competitor traffic without requiring any new backlinks.
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-stone-600">
                                        <Zap className="w-4 h-4" />
                                        <h4 className="font-bold text-[13px] text-stone-900 leading-tight">Trend Moat Generation</h4>
                                    </div>
                                    <p className="text-[12px] text-stone-500 leading-relaxed">
                                        When a brand-new query suddenly spikes in search volume, competitors haven't noticed yet. To build an immediate SEO moat, the engine automatically detects these impression spikes and constructs a complete, intent-aligned blog outline so you can exclusively capture the new audience.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* SECTION 1: KEYWORD CANNIBALIZATION */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-stone-100/50 rounded-xl border border-stone-100">
                                <Target className="w-5 h-5 text-stone-600" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-stone-900 tracking-tight">Keyword Cannibalization</h3>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 transition-colors cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs p-3">
                                            <p className="font-semibold mb-1">Mathematical Winner Formula</p>
                                            <p className="text-stone-300">We don't blindly suggest 301 redirects. The engine calculates impression dominance and exact position gaps to mathematically define the "Winner". We then construct an intent-differentiation strategy (e.g. retargeting vs consolidating) to securely reclaim your ranking power.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        {directives.cannibalization?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                                {directives.cannibalization.map((item: any, i: number) => {
                                    const id = `cannibalization-${i}`;
                                    const isDeployed = plays.some(p => p.query === item.query && p.play_type === 'cannibalization' && p.status === 'deployed');
                                    if (isDeployed) return null;
                                    const draftMatch = plays.find(p => p.query === item.query && p.play_type === 'cannibalization' && p.status === 'draft');

                                    return (
                                        <GlobalCard key={id} contentClassName="p-6 flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mb-1">Cannibalized Query</p>
                                                <p className="text-xl font-bold text-stone-900 tracking-tight mb-5">{item.query}</p>

                                                <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-stone-200/60 pl-8 mb-6">
                                                    {item.pages.map((p: any, j: number) => (
                                                        <div key={j} className="relative">
                                                            <div className="absolute -left-[38px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-stone-100 border-2 border-stone-400 z-10" />
                                                            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                <span className="text-xs text-stone-700 font-medium break-all">{('/' + p.url.replace(siteUrl, '')).replace(/^\/\/+/g, '/')}</span>
                                                                <div className="w-fit flex items-center gap-3 text-xs bg-white px-2 py-1 rounded border border-stone-200 mt-2 sm:mt-0">
                                                                    <div className="flex gap-1"><span className="text-stone-400">Pos</span><span className="font-bold text-stone-700">{(p.position || 0).toFixed(1)}</span></div>
                                                                    <div className="w-px h-3 bg-stone-200" />
                                                                    <div className="flex gap-1"><span className="text-stone-400">Imp</span><span className="font-bold text-stone-700">{p.impressions}</span></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {draftMatch ? (
                                                <button
                                                    onClick={() => handleViewDraft(draftMatch, item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold flex items-center justify-center gap-2 border border-stone-300"
                                                >
                                                    {loadingFix === id ? <Loader2 className="w-4 h-4 animate-spin text-stone-500" /> : <Eye className="w-4 h-4 text-stone-500" />}
                                                    View Drafted Fix
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerate('cannibalization', item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                                                >
                                                    {loadingFix === id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                                            <SmartButtonText active={true} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            Generate Consolidation Plan
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </GlobalCard>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 text-stone-500 text-sm">
                                Clean architecture detected. No keyword cannibalization found.
                            </div>
                        )}
                    </section>

                    {/* SECTION 2: CONTENT DECAY */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-stone-100 rounded-xl border border-stone-200">
                                <TrendingDown className="w-5 h-5 text-stone-600" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-stone-900 tracking-tight">Content Decay</h3>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 transition-colors cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs p-3">
                                            <p className="font-semibold mb-1">Brand DNA Fallback</p>
                                            <p className="text-stone-300">Identifies massive traffic crashes on previously successful queries. We dynamically map the decayed intent against your Brand Context to formulate an informational or feature-led content refresh strategy without hallucinating fake capabilities.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        {directives.contentDecay?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                                {directives.contentDecay.map((item: any, i: number) => {
                                    const id = `decay-${i}`;
                                    const isDeployed = plays.some(p => p.query === item.query && p.play_type === 'decay' && p.status === 'deployed');
                                    if (isDeployed) return null;
                                    const draftMatch = plays.find(p => p.query === item.query && p.play_type === 'decay' && p.status === 'draft');

                                    return (
                                        <GlobalCard key={id} contentClassName="p-6 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <div>
                                                        <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-1">Decaying Query</p>
                                                        <p className="text-xl font-bold text-stone-900 tracking-tight">{item.query}</p>
                                                    </div>
                                                    <div className="bg-stone-50 text-stone-700 px-3 py-1 rounded-lg text-xs font-bold border border-stone-100">
                                                        -{item.prevClicks - item.currentClicks} clicks
                                                    </div>
                                                </div>

                                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 mb-4">
                                                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest block mb-1">Target Page</span>
                                                    <p className="text-xs text-stone-700 font-medium break-all">{('/' + item.page.replace(siteUrl, '')).replace(/^\/\/+/g, '/')}</p>
                                                </div>

                                                <div className="flex items-center justify-between bg-stone-50/50 p-3 rounded-xl border border-stone-100 mb-6">
                                                    <div className="flex flex-col items-center flex-1 border-r border-stone-200">
                                                        <span className="text-[10px] text-stone-400 font-bold uppercase mb-1">Previous Pos</span>
                                                        <span className="text-lg font-bold text-stone-600">{(item.prevPos || 0).toFixed(1)}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center flex-1">
                                                        <span className="text-[10px] text-stone-400 font-bold uppercase mb-1">Current Pos</span>
                                                        <span className="text-lg font-bold text-stone-600">{(item.currentPos || 0).toFixed(1)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {draftMatch ? (
                                                <button
                                                    onClick={() => handleViewDraft(draftMatch, item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold flex items-center justify-center gap-2 border border-stone-300"
                                                >
                                                    {loadingFix === id ? <Loader2 className="w-4 h-4 animate-spin text-stone-500" /> : <Eye className="w-4 h-4 text-stone-500" />}
                                                    View Drafted Fix
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerate('decay', item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                                                >
                                                    {loadingFix === id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                                            <SmartButtonText active={true} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            Generate Refresh Strategy
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </GlobalCard>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 text-stone-500 text-sm">
                                Rankings are stable. No content decay detected.
                            </div>
                        )}
                    </section>

                    {/* SECTION 2.5: AEO ALIGNMENT */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-stone-50 rounded-xl border border-stone-100">
                                <Bot className="w-5 h-5 text-stone-600" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-stone-900 tracking-tight">Answer Engine Optimization</h3>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 transition-colors cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs p-3">
                                            <p className="font-semibold mb-1">Semantic Interception Logic</p>
                                            <p className="text-stone-300">Calculates query footprint where Impressions remained stable but Clicks collapsed by &gt;80%. We interpret this as an AI Overviews interception and automatically construct a rigid, factual semantic HTML structure designed specifically to win the LLM citation.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        {directives.aeoAlignment?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                                {directives.aeoAlignment.map((item: any, i: number) => {
                                    const id = `aeo-${i}`;
                                    const isDeployed = plays.some(p => p.query === item.query && p.play_type === 'aeo' && p.status === 'deployed');
                                    if (isDeployed) return null;
                                    const draftMatch = plays.find(p => p.query === item.query && p.play_type === 'aeo' && p.status === 'draft');

                                    return (
                                        <GlobalCard key={id} contentClassName="p-6 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <div>
                                                        <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mb-1">Stolen Intent</p>
                                                        <p className="text-xl font-bold text-stone-900 tracking-tight">{item.query}</p>
                                                    </div>
                                                    <div className="w-fit bg-stone-50 text-stone-700 px-3 py-1 rounded-lg text-xs font-bold border border-stone-100 shrink-0 mt-2 sm:mt-0">
                                                        -{Math.round(((item.prevClicks - item.currentClicks) / item.prevClicks) * 100)}% Clicks
                                                    </div>
                                                </div>

                                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 mb-4">
                                                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest block mb-1">Target Page</span>
                                                    <p className="text-xs text-stone-700 font-medium break-all">{('/' + item.page.replace(siteUrl, '')).replace(/^\/\/+/g, '/')}</p>
                                                </div>

                                                <div className="flex items-center justify-between bg-stone-50/50 p-3 rounded-xl border border-stone-100 mb-6">
                                                    <div className="flex flex-col items-center flex-1 border-r border-stone-200">
                                                        <span className="text-[10px] text-stone-400 font-bold uppercase mb-1">Impressions</span>
                                                        <span className="text-lg font-bold text-stone-600">{item.currentImps}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center flex-1">
                                                        <span className="text-[10px] text-stone-400 font-bold uppercase mb-1">Current Clicks</span>
                                                        <span className="text-lg font-bold text-stone-600">{item.currentClicks}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {draftMatch ? (
                                                <button
                                                    onClick={() => handleViewDraft(draftMatch, item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-800 text-sm font-semibold flex items-center justify-center gap-2 border border-stone-200 transition-colors"
                                                >
                                                    {loadingFix === id ? <Loader2 className="w-4 h-4 animate-spin text-stone-500" /> : <Eye className="w-4 h-4 text-stone-500" />}
                                                    View Drafted Strategy
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerate('aeo', item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold flex items-center justify-center gap-2"
                                                >
                                                    {loadingFix === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                                                    Generate AEO Structure
                                                </button>
                                            )}
                                        </GlobalCard>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 text-stone-500 text-sm">
                                No intent shifts detected. AI is not significantly cannibalizing your high-volume queries.
                            </div>
                        )}
                    </section>

                    {/* SECTION 3: CTR INTERVENTIONS */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-stone-100/50 rounded-xl border border-stone-100">
                                <Crosshair className="w-5 h-5 text-stone-600" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-stone-900 tracking-tight">CTR Interventions</h3>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 transition-colors cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs p-3">
                                            <p className="font-semibold mb-1">Human-Authored Hijacking</p>
                                            <p className="text-stone-300">Identifies massive impression volume wasted on terrible click-through rates. We cross-reference your Brand DNA to formulate hyper-optimized, human-authored Meta Titles and Descriptions designed solely to mathematically hijack competitor traffic.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        {directives.ctrInterventions?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {directives.ctrInterventions.map((item: any, i: number) => {
                                    const id = `ctr-${i}`;
                                    const isDeployed = plays.some(p => p.page === item.page && p.play_type === 'ctr' && p.status === 'deployed');
                                    if (isDeployed) return null;
                                    const draftMatch = plays.find(p => p.page === item.page && p.play_type === 'ctr' && p.status === 'draft');

                                    return (
                                        <GlobalCard key={id} contentClassName="p-6 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <div className="flex">
                                                        <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mr-2">Page URL:</p>
                                                        <p className="text-xs text-stone-700 font-medium break-all">{('/' + item.page.replace(siteUrl, '')).replace(/^\/\/+/g, '/')}</p>
                                                    </div>
                                                    <div className="w-fit flex items-center gap-1 bg-stone-50 px-2 py-1.5 rounded-lg border border-stone-100 text-stone-800 font-bold text-xs shrink-0 mt-2 sm:mt-0">
                                                        <TrendingDown className="w-3 h-3" /> Avg {(item.avgCtr * 100).toFixed(1)}%
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 mb-4">
                                                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest block">Underperforming Queries ({item.queries.length})</span>
                                                    <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                                        {item.queries.map((q: any, j: number) => (
                                                            <div key={j} className="flex items-center justify-between bg-stone-50 p-2.5 rounded-lg border border-stone-100 text-xs">
                                                                <span className="text-stone-800 font-medium truncate max-w-[55%]">{q.query}</span>
                                                                <div className="flex items-center gap-2 text-stone-500 shrink-0">
                                                                    <span>Pos <strong className="text-stone-700">{q.position?.toFixed(1)}</strong></span>
                                                                    <span className="w-px h-3 bg-stone-200" />
                                                                    <span>CTR <strong className="text-stone-700">{(q.ctr * 100).toFixed(1)}%</strong></span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="bg-stone-50 rounded-lg p-2 flex-1 text-center border border-stone-100 mr-2">
                                                        <div className="text-[10px] text-stone-400 font-bold uppercase">Avg Pos</div>
                                                        <div className="font-bold text-stone-800">{(item.avgPosition || 0).toFixed(1)}</div>
                                                    </div>
                                                    <div className="bg-stone-50 rounded-lg p-2 flex-1 text-center border border-stone-100 ml-2">
                                                        <div className="text-[10px] text-stone-400 font-bold uppercase">Total Imps</div>
                                                        <div className="font-bold text-stone-800">{item.totalImpressions}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {draftMatch ? (
                                                <button
                                                    onClick={() => handleViewDraft(draftMatch, item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold flex items-center justify-center gap-2 border border-stone-300"
                                                >
                                                    {loadingFix === id ? <Loader2 className="w-4 h-4 animate-spin text-stone-500" /> : <Eye className="w-4 h-4 text-stone-500" />}
                                                    View Drafted Fix
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerate('ctr', item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                                                >
                                                    {loadingFix === id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                                            <SmartButtonText active={true} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            Generate Optimized Meta
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </GlobalCard>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 text-stone-500 text-sm">
                                Your titles and meta descriptions are performing optimally.
                            </div>
                        )}
                    </section>

                    {/* SECTION 4: STRIKING DISTANCE */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-stone-50 rounded-xl border border-stone-100">
                                <ArrowRight className="w-5 h-5 text-stone-600 -rotate-45" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-stone-900 tracking-tight">Striking Distance (Page 2)</h3>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 transition-colors cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs p-3">
                                            <p className="font-semibold mb-1">Algorithmic Content Matrix</p>
                                            <p className="text-stone-300">Surfaces high-volume keywords trapped on Page 2. We algorithmically generate a strict content matrix (exact H2s and semantic structures) to bump the page to Page 1, completely bound by your Brand Context limits to prevent feature hallucinations.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        {directives.strikingDistance?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                                {directives.strikingDistance.map((item: any, i: number) => {
                                    const id = `striking-${i}`;
                                    const isDeployed = plays.some(p => p.query === item.query && p.play_type === 'striking' && p.status === 'deployed');
                                    if (isDeployed) return null;
                                    const draftMatch = plays.find(p => p.query === item.query && p.play_type === 'striking' && p.status === 'draft');

                                    return (
                                        <GlobalCard key={id} contentClassName="p-6 flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mb-1">Opportunity</p>
                                                <p className="text-lg font-bold text-stone-900 tracking-tight leading-tight mb-4">{item.query}</p>

                                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 mb-4">
                                                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest block mb-1">Target Page</span>
                                                    <p className="text-xs text-stone-700 font-medium break-all">{('/' + item.page.replace(siteUrl, '')).replace(/^\/\/+/g, '/')}</p>
                                                </div>

                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex flex-col items-center flex-1 bg-stone-50/50 rounded-xl border border-stone-100/50 p-2 mr-2">
                                                        <span className="text-[10px] text-stone-600/70 font-bold uppercase">Position</span>
                                                        <span className="font-bold text-stone-900">{(item.position || 0).toFixed(1)}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center flex-1 bg-stone-50/50 rounded-xl border border-stone-100/50 p-2 ml-2">
                                                        <span className="text-[10px] text-stone-600/70 font-bold uppercase">Imp</span>
                                                        <span className="font-bold text-stone-900">{item.impressions}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {draftMatch ? (
                                                <button
                                                    onClick={() => handleViewDraft(draftMatch, item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold flex items-center justify-center gap-2 border border-stone-300"
                                                >
                                                    {loadingFix === id ? <Loader2 className="w-4 h-4 animate-spin text-stone-500" /> : <Eye className="w-4 h-4 text-stone-500" />}
                                                    View Drafted Fix
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerate('striking', item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                                                >
                                                    {loadingFix === id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                                            <SmartButtonText active={true} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            Generate H2 Snippet
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </GlobalCard>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 text-stone-500 text-sm">
                                No striking distance opportunities found recently.
                            </div>
                        )}
                    </section>

                    {/* SECTION 5: EMERGING TRENDS */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-stone-50 rounded-xl border border-stone-100">
                                <Zap className="w-5 h-5 text-stone-600" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-stone-900 tracking-tight">Emerging Trends</h3>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-4 h-4 text-stone-400 hover:text-stone-600 transition-colors cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs p-3">
                                            <p className="font-semibold mb-1">Brand Defense Firewall</p>
                                            <p className="text-stone-300">Detects explosive new queries missing from your core architecture. We actively cross-reference these trends against your established Brand DNA to prevent hallucinated capability recommendations, safely capturing new traffic via intent-aligned blogs or trojan-horse features.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        {directives.emergingTrends?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                                {directives.emergingTrends.map((item: any, i: number) => {
                                    const id = `emerging-${i}`;
                                    const isDeployed = plays.some(p => p.query === item.query && p.play_type === 'emerging' && p.status === 'deployed');
                                    if (isDeployed) return null;
                                    const draftMatch = plays.find(p => p.query === item.query && p.play_type === 'emerging' && p.status === 'draft');

                                    return (
                                        <GlobalCard key={id} contentClassName="p-6 flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mb-1">New Topic</p>
                                                <p className="text-lg font-bold text-stone-900 tracking-tight leading-tight mb-4">{item.query}</p>

                                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 mb-4">
                                                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest block mb-1">Ranking Page</span>
                                                    <p className="text-xs text-stone-700 font-medium break-all">{('/' + item.page.replace(siteUrl, '')).replace(/^\/\/+/g, '/')}</p>
                                                </div>

                                                <div className="flex items-center justify-between bg-stone-50/50 p-3 rounded-xl border border-stone-100/50 mb-6">
                                                    <div className="flex flex-col items-center flex-1 border-r border-stone-200/50">
                                                        <span className="text-[10px] text-stone-600/70 font-bold uppercase mb-1">Prev Month</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-lg font-bold text-stone-900/40">0</span>
                                                            <span className="text-[9px] font-bold text-stone-900/30 uppercase tracking-widest">Imps</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-center flex-1">
                                                        <span className="text-[10px] text-stone-600/70 font-bold uppercase mb-1">This Month</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-lg font-bold text-stone-700">{item.impressions}</span>
                                                            <span className="text-[9px] font-bold text-stone-700/60 uppercase tracking-widest">Imps</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {draftMatch ? (
                                                <button
                                                    onClick={() => handleViewDraft(draftMatch, item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold flex items-center justify-center gap-2 border border-stone-300"
                                                >
                                                    {loadingFix === id ? <Loader2 className="w-4 h-4 animate-spin text-stone-500" /> : <Eye className="w-4 h-4 text-stone-500" />}
                                                    View Drafted Fix
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerate('emerging', item, id)}
                                                    disabled={loadingFix !== null}
                                                    className="cursor-pointer w-full h-10 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                                                >
                                                    {loadingFix === id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                                            <SmartButtonText active={true} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            Generate Strategy
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </GlobalCard>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 text-stone-500 text-sm">
                                No new trend spikes detected in this period.
                            </div>
                        )}
                    </section>
                </div>
            )}

            {tab === 'wins' && (
                <div className="space-y-4">
                    {plays.filter(p => p.status === 'deployed').map((play: any) => (
                        <div key={play.id} className="p-4 md:p-5 border border-stone-200 rounded-xl bg-white hover:border-stone-300/50 transition-colors flex flex-col gap-3">
                            
                            {/* Top Row: Details & Date */}
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-wider font-bold bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-stone-600">
                                    {play.play_type}
                                </span>
                                <span className="text-xs text-stone-400 font-medium">
                                    Deployed {new Date(play.deployed_at).toLocaleDateString()}
                                </span>
                            </div>

                            {/* Middle Row: Content */}
                            <div className="flex items-start gap-3 mt-1">
                                <CheckCircle2 className="w-5 h-5 text-stone-300 shrink-0 mt-0.5 hidden sm:block" />
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm md:text-base tracking-tight text-stone-900 leading-snug break-words flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-stone-300 shrink-0 mt-0.5 sm:hidden" />
                                        {play.query}
                                    </div>
                                    <div className="text-xs text-stone-500 font-medium leading-relaxed break-all mt-1 pl-7 sm:pl-0">
                                        {('/' + play.page.replace(siteUrl, '')).replace(/^\/\/+/g, '/')}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Row: ROI Tracker */}
                            <div className="pt-3 mt-1 border-t border-stone-100 flex items-center justify-between">
                                <div className="flex items-center flex-wrap gap-2">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">ROI Tracker:</div>
                                    {(() => {
                                        const daysSince = Math.floor((new Date().getTime() - new Date(play.deployed_at).getTime()) / (1000 * 3600 * 24));
                                        const daysLeft = Math.max(0, 30 - Math.max(0, daysSince));
                                        
                                        return daysLeft > 0 ? (
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 bg-stone-50 px-2 py-0.5 rounded border border-stone-200 hover:bg-stone-100 transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse"></div>
                                                Gathering baseline
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-stone-900 px-2 py-0.5 rounded border border-stone-900 hover:bg-stone-800 transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                                Ready for Extraction
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            
                        </div>
                    ))}
                    {plays.filter(p => p.status === 'deployed').length === 0 && (
                        <div className="p-12 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-xl font-medium">
                            No plays tracked yet. Deploy a fix to start measuring ROI.
                        </div>
                    )}
                </div>
            )}

            {/* Active Fix Modal */}
            {activeFix && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-stone-900/60 backdrop-blur-sm overflow-hidden">
                    <div className="bg-white max-w-2xl w-full max-h-[95vh] md:max-h-[85vh] flex flex-col shadow-2xl border border-stone-200/50 rounded-2xl overflow-hidden relative">
                        <div className="p-4 md:p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50/80 shrink-0">
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="p-1.5 md:p-2 bg-white rounded-lg border border-stone-200">
                                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-stone-600" />
                                </div>
                                <h2 className="font-bold text-base md:text-lg text-stone-900 tracking-tight">AI Strategy Deployed</h2>
                            </div>
                            <button onClick={() => setActiveFix(null)} className="cursor-pointer text-stone-400 hover:text-stone-700 text-xs md:text-sm font-semibold transition-colors">Close</button>
                        </div>
                        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-white leading-relaxed custom-scrollbar min-h-0">
                            {(() => {
                                let parsedJson = null;
                                try {
                                    // Strip potential markdown codeblocks some LLMs wrap json in
                                    const rawJson = activeFix.advice.replace(/^```json/m, '').replace(/```$/m, '').trim();
                                    parsedJson = JSON.parse(rawJson);
                                } catch (e) {
                                    /* ignore */
                                }

                                if (parsedJson && parsedJson.titles && parsedJson.metaDescription) {
                                    return (
                                        <div className="space-y-6 md:space-y-8">
                                            <div>
                                                <h3 className="text-xs md:text-sm font-bold text-stone-400 uppercase tracking-widest mb-2 md:mb-3">Copy & Paste Title Tags</h3>
                                                <div className="space-y-2 md:space-y-3">
                                                    {parsedJson.titles.map((title: string, idx: number) => (
                                                        <div key={idx} className="group relative flex items-start gap-3 p-3 md:p-4 rounded-xl bg-stone-50 border border-stone-200 hover:border-stone-200 hover:bg-stone-100/30 transition-colors">
                                                            <div className="flex-1">
                                                                <p className="text-xs md:text-sm font-semibold text-stone-800 pr-10">{title}</p>
                                                                <p className="text-[9px] md:text-[10px] text-stone-500 font-medium mt-1">{title.length} characters</p>
                                                            </div>
                                                            <CopyButton text={title} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-xs md:text-sm font-bold text-stone-400 uppercase tracking-widest mb-2 md:mb-3">Meta Description</h3>
                                                <div className="group relative p-3 md:p-4 rounded-xl bg-stone-50 border border-stone-200 hover:border-stone-200 hover:bg-stone-100/30 transition-colors">
                                                    <p className="text-xs md:text-sm font-medium text-stone-700 pr-10">{parsedJson.metaDescription}</p>
                                                    <p className="text-[9px] md:text-[10px] text-stone-500 font-medium mt-1.5 md:mt-2">{parsedJson.metaDescription.length} characters</p>
                                                    <CopyButton text={parsedJson.metaDescription} className="absolute right-3 md:right-4 top-3 md:top-4 p-1.5 md:p-2 bg-white border border-stone-200 rounded-md md:rounded-lg text-stone-500 hover:text-stone-600 hover:border-stone-200 transition-all cursor-pointer" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                // Rich formatting for Markdown
                                return (
                                    <div className="text-stone-700 w-full font-sans max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                h1: ({ node, ...props }) => <h1 className="text-xl md:text-2xl font-bold text-stone-900 mt-8 mb-4 leading-tight" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-lg md:text-xl font-bold text-stone-900 mt-6 mb-3 border-b border-stone-200 pb-2 leading-tight" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-md font-semibold text-stone-800 mt-5 mb-2 leading-tight" {...props} />,
                                                p: ({ node, ...props }) => <p className="mb-4 text-sm md:text-[15px] text-stone-600 leading-relaxed" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-6 mb-4 text-sm md:text-[15px] text-stone-600 space-y-1.5 marker:text-stone-400" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-6 mb-4 text-sm md:text-[15px] text-stone-600 space-y-1.5 marker:text-stone-400 marker:font-medium" {...props} />,
                                                li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-semibold text-stone-900" {...props} />,
                                                pre: ({ node, ...props }) => <pre className="bg-stone-900 text-stone-100 rounded-xl p-4 md:p-5 mb-6 overflow-x-auto text-[13px] font-mono shadow-inner custom-scrollbar" {...props} />,
                                                code: ({ node, className, ...props }: any) => {
                                                    const isBlock = /language-(\w+)/.exec(className || '');
                                                    return isBlock
                                                        ? <code className={className} {...props} />
                                                        : <code className="bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded text-[13px] font-mono border border-stone-200" {...props} />
                                                },
                                                blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-stone-200 pl-4 py-1 italic text-stone-500 my-5 bg-stone-50 rounded-r-lg" {...props} />,
                                                a: ({ node, ...props }) => <a className="text-stone-600 hover:text-stone-700 underline underline-offset-4 decoration-stone-200 hover:decoration-stone-400 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
                                            }}
                                        >
                                            {activeFix.advice}
                                        </ReactMarkdown>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="p-4 md:p-6 border-t border-stone-200 bg-stone-50 space-y-3 md:space-y-4 shrink-0">
                            <p className="text-xs md:text-sm font-medium text-stone-600 text-center px-2">
                                Review the strategy, implement the changes on your CMS, and formally track this deployment to measure ROI.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-2 md:gap-3 mt-4">
                                <CopyButton text={activeFix.advice} className="cursor-pointer px-4 h-10 md:py-2 md:h-auto rounded-lg border border-stone-300 text-stone-700 font-semibold text-sm hover:bg-stone-100 flex items-center justify-center gap-2" />
                                <button onClick={handleDeploy} className="cursor-pointer px-5 h-10 md:h-11 rounded-lg md:rounded-xl bg-stone-900 hover:bg-black text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                                    <Play className="w-4 h-4" /> Track Deployment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
