"use client"

import { Globe, Sparkles } from "lucide-react"

import { AnalyzePhaseList } from "@/components/onboarding/analyze-phase-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    BRAND_ANALYZE_PHASES,
    type AnalyzeBrandPhase,
} from "@/lib/analyze-brand/stream"

/**
 * Step 1 of onboarding. One question.
 *
 * `/api/analyze-brand` destructures exactly `{ url, targetSeeds }` and never
 * reads competitors at all, while the scope extractor has an explicit "the
 * founder supplied no target searches, discover from the pages alone" branch.
 * Both of those inputs used to sit on this screen, in front of any value, and
 * both have moved to the point in the flow where they are actually useful:
 * target searches once the founder can see what we already found, competitors
 * on the skippable screen before the audit runs.
 *
 * If a field is ever added back here, find the line that consumes it first.
 *
 * While the crawl runs this screen is ONLY the phase list — stacking it under
 * the URL form made the wait look like the form was still the job.
 */
export function SiteStep({
    url,
    onUrlChange,
    analyzing,
    analysisInterrupted,
    phasesSeen,
    pageCount,
    onAnalyze,
}: {
    url: string
    onUrlChange: (url: string) => void
    analyzing: boolean
    analyzePhase: string
    analysisInterrupted: boolean
    phasesSeen: Set<AnalyzeBrandPhase>
    pageCount: number
    onAnalyze: () => void
}) {
    if (analyzing) {
        return (
            <div className="space-y-4 pb-1">
                <h2 className="font-serif text-xl tracking-tight text-stone-900">
                    Reading your site
                </h2>
                <p className="text-xs text-stone-500">
                    Working out your brand from the pages.
                </p>
                <div className="space-y-2 rounded-lg bg-stone-50 px-3 py-2.5">
                    <AnalyzePhaseList
                        phases={BRAND_ANALYZE_PHASES}
                        seen={phasesSeen}
                        pageCount={pageCount}
                    />
                    <p className="text-[9px] text-stone-400">
                        Usually 1–3 minutes. Keep this tab open —
                        refreshing cannot resume the in-flight read.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3 text-center">
                <div className="flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-100 to-stone-200">
                        <Sparkles className="h-6 w-6 text-stone-600" />
                    </div>
                </div>
                <h2 className="text-xl font-bold text-stone-900">
                    Let&apos;s understand your brand
                </h2>
                <p className="text-sm text-stone-500">
                    Just your website. We&apos;ll work out the rest and show you what we found.
                </p>
            </div>

            <div className="flex">
                <div className="flex flex-1">
                    <span className="inline-flex select-none items-center rounded-l-md border border-r-0 border-stone-200 bg-stone-100 px-3 text-sm font-medium text-stone-500">
                        https://
                    </span>
                    <Input
                        type="text"
                        placeholder="yourwebsite.com"
                        className="flex-1 rounded-l-none border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:outline-none focus:ring-0 focus-visible:ring-0"
                        value={url}
                        onChange={(event) =>
                            onUrlChange(event.target.value.replace(/^https?:\/\//i, ""))
                        }
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && url) onAnalyze()
                        }}
                    />
                </div>
            </div>

            <Button
                onClick={onAnalyze}
                disabled={!url}
                className="w-full gap-2 bg-gradient-to-b from-stone-800 to-stone-950 font-semibold shadow-sm hover:from-stone-700 hover:to-stone-900"
            >
                <Globe className="h-4 w-4 text-white" />
                {analysisInterrupted ? "Run Analyze again" : "Find my business areas"}
            </Button>
        </div>
    )
}
