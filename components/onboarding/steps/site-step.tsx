"use client"

import { motion } from "motion/react"
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
 */
export function SiteStep({
    url,
    onUrlChange,
    analyzing,
    analyzePhase,
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
    return (
        <div className="space-y-6">
            <div className="text-center space-y-3">
                <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center border border-stone-200">
                        <Sparkles className="w-6 h-6 text-stone-600" />
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
                <div className="flex-1 flex">
                    <span className="inline-flex items-center px-3 text-sm text-stone-500 bg-stone-100 border border-r-0 border-stone-200 rounded-l-md font-medium select-none">
                        https://
                    </span>
                    <Input
                        type="text"
                        placeholder="yourwebsite.com"
                        className="flex-1 bg-stone-50 border-stone-200 py-2 px-3 text-sm rounded-l-none focus:ring-0 focus:outline-none focus-visible:ring-0"
                        value={url}
                        disabled={analyzing}
                        onChange={(event) =>
                            onUrlChange(event.target.value.replace(/^https?:\/\//i, ""))
                        }
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && url && !analyzing) onAnalyze()
                        }}
                    />
                </div>
            </div>

            <Button
                onClick={onAnalyze}
                disabled={analyzing || !url}
                className="w-full font-semibold gap-2 bg-gradient-to-b from-stone-800 to-stone-950 hover:from-stone-700 hover:to-stone-900 shadow-sm"
            >
                <motion.div
                    animate={analyzing ? { scale: [1, 1.2, 1], rotate: [0, 180, 360] } : {}}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Globe className="w-4 h-4 text-white" />
                </motion.div>
                {analyzing
                    ? analyzePhase
                    : analysisInterrupted
                      ? "Run Analyze again"
                      : "Find my business areas"}
            </Button>

            {analyzing && (
                <div className="space-y-2 rounded-lg bg-stone-50 px-3 py-2.5">
                    <AnalyzePhaseList
                        phases={BRAND_ANALYZE_PHASES}
                        seen={phasesSeen}
                        pageCount={pageCount}
                    />
                    <p className="text-[11px] text-stone-400">
                        Usually 1–3 minutes. Keep this tab open —
                        refreshing cannot resume the in-flight read.
                    </p>
                </div>
            )}
        </div>
    )
}
