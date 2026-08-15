"use client"

import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import type { BrandDetails } from "@/lib/schemas/brand"
import { languageName, marketLabel, TARGET_MARKETS } from "@/lib/target-market"

/**
 * The last screen before the probe: confirm who you compete with.
 *
 * Competitors stopped being optional here, and the reason is structural rather
 * than a growth tactic. `parseAnswer` counts mentions of the *tracked* list and
 * nothing else — there is no open-ended entity extraction anywhere in the
 * pipeline, deliberately, because "ChatGPT named Notion and not you" can be
 * checked against the stored answer and "a model thinks it saw a brand" cannot.
 * So an empty list does not degrade the report, it removes half of it: the run
 * can report that you are absent and can never report who took your place.
 *
 * The list arrives pre-filled from discovery, so confirming is a glance rather
 * than a memory test.
 */

export function ExtrasStep({
    brand,
    competitors,
    discovering,
    onCompetitorsChange,
    onFieldChange,
    saving,
    onStart,
}: {
    brand: BrandDetails
    competitors: string[]
    /** Discovery is still running, so an empty list is not yet an answer. */
    discovering: boolean
    onCompetitorsChange: (competitors: string[]) => void
    onFieldChange: (field: string, value: string) => void
    saving: boolean
    onStart: () => void
}) {
    const hasCompetitors = competitors.length > 0

    return (
        <div className="space-y-5">
            <div className="space-y-1.5">
                <h2 className="font-serif text-xl tracking-tight text-stone-900">
                    Who are you up against?
                </h2>
                <p className="text-sm text-stone-500">
                    We count how often each of these gets named in an AI answer where
                    you don&apos;t. That comparison is the whole finding — so we can
                    only report on companies you list here.
                </p>
            </div>

            <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                    <label className="text-xs font-medium text-stone-500">
                        Your competitors
                    </label>
                    {discovering ? (
                        <span className="text-[10px] text-stone-400">Finding them…</span>
                    ) : (
                        <span className="text-[10px] text-stone-400">
                            {competitors.length} added
                        </span>
                    )}
                </div>
                <PillInput
                    value={competitors}
                    onChange={onCompetitorsChange}
                    placeholder="e.g. competitor.com (press Enter to add)"
                    variant="url"
                />
                {/* An empty list is never left to look like a choice: it silently
                    disables the rival half of the report, so the screen says so
                    and the button waits. */}
                {!hasCompetitors && !discovering ? (
                    <p className="text-[11px] leading-relaxed text-amber-700">
                        Add at least one. Without a name to compare against, the report
                        can tell you that ChatGPT didn&apos;t mention you — but never
                        who it recommended instead.
                    </p>
                ) : (
                    <p className="text-[10px] text-stone-400">
                        We found these for you. Remove any that aren&apos;t real rivals
                        and add the ones we missed — we track up to four.
                    </p>
                )}
            </div>

            {/* Two locales, two jobs, deliberately not merged.
                `target_region` (brand screen) decides which country's ChatGPT and
                Google AI Mode answers we MEASURE. The two below decide which
                sources we RESEARCH — for competitor discovery now and for the
                articles the writer cites later. They usually agree; they are
                still separate calls, and only this one has a valid "Global". */}
            <div className="rounded-lg border border-stone-200 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                    Where we research
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                    Sources we look at when finding rivals and, later, when writing
                    your articles. Separate from the{" "}
                    {marketLabel(brand.target_region || "US")} market in{" "}
                    {languageName(brand.target_language || "en")} we measure — leave
                    this on Global unless your sources have to be local.
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div>
                        <label className="mb-1 block text-[10px] font-medium text-stone-400">
                            Research country
                        </label>
                        <select
                            className="h-8 w-full rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-900"
                            value={brand.search_country || ""}
                            onChange={(event) =>
                                onFieldChange("search_country", event.target.value)
                            }
                        >
                            <option value="">Global</option>
                            {TARGET_MARKETS.map((market) => (
                                <option key={market.code} value={market.tavily}>
                                    {market.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-[10px] font-medium text-stone-400">
                            Research topic
                        </label>
                        <select
                            className="h-8 w-full rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-900"
                            value={brand.search_topic || "general"}
                            onChange={(event) => onFieldChange("search_topic", event.target.value)}
                        >
                            <option value="general">General</option>
                            <option value="news">News</option>
                            <option value="finance">Finance</option>
                            <option value="journal">Journal</option>
                        </select>
                    </div>
                </div>
            </div>

            <Button
                onClick={onStart}
                disabled={saving || discovering || !hasCompetitors}
                className="w-full h-10 font-semibold bg-gradient-to-b from-stone-800 to-stone-950 hover:from-stone-700 hover:to-stone-900 disabled:opacity-50"
            >
                {saving ? (
                    <>Saving…</>
                ) : discovering ? (
                    <>Finding your competitors…</>
                ) : !hasCompetitors ? (
                    <>Add a competitor to continue</>
                ) : (
                    <>
                        Ask the AI engines
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                )}
            </Button>
        </div>
    )
}
