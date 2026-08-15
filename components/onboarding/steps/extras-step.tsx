"use client"

import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PillInput } from "@/components/ui/pill-input"
import type { BrandDetails } from "@/lib/schemas/brand"

/**
 * Step 4 of onboarding. Real audit inputs, none of them required.
 *
 * These three are read by the harvest — `search_country` becomes the
 * autocomplete `gl` parameter and gates the demand filter, competitors seed the
 * competitor set, `search_topic` sets the Tavily search topic — but none is
 * needed to analyze a brand or to work out what it sells. They used to sit on
 * the first screen (competitors) and behind the last stream event (country and
 * topic, disabled until it landed). Both placements were wrong in the same way:
 * they demanded input at a moment when the founder had no basis for an answer.
 *
 * Blank is a real answer here. Competitors auto-discover, country defaults to
 * Global, topic defaults to general.
 */
const SEARCH_COUNTRIES: Array<[value: string, label: string]> = [
    ["", "Global"],
    ["australia", "Australia"],
    ["united states", "United States"],
    ["united kingdom", "United Kingdom"],
    ["canada", "Canada"],
    ["india", "India"],
    ["germany", "Germany"],
    ["france", "France"],
    ["japan", "Japan"],
    ["brazil", "Brazil"],
    ["netherlands", "Netherlands"],
    ["singapore", "Singapore"],
    ["new zealand", "New Zealand"],
    ["ireland", "Ireland"],
    ["south africa", "South Africa"],
    ["united arab emirates", "UAE"],
    ["sweden", "Sweden"],
    ["switzerland", "Switzerland"],
    ["italy", "Italy"],
    ["spain", "Spain"],
    ["mexico", "Mexico"],
    ["south korea", "South Korea"],
    ["indonesia", "Indonesia"],
    ["philippines", "Philippines"],
    ["malaysia", "Malaysia"],
    ["thailand", "Thailand"],
    ["poland", "Poland"],
    ["nigeria", "Nigeria"],
    ["pakistan", "Pakistan"],
]

export function ExtrasStep({
    brand,
    competitors,
    onCompetitorsChange,
    onFieldChange,
    saving,
    onStart,
}: {
    brand: BrandDetails
    competitors: string[]
    onCompetitorsChange: (competitors: string[]) => void
    onFieldChange: (field: string, value: string) => void
    saving: boolean
    onStart: () => void
}) {
    return (
        <div className="space-y-5">
            <div className="space-y-1.5">
                <h2 className="font-serif text-xl tracking-tight text-stone-900">
                    Anything we should know?
                </h2>
                <p className="text-sm text-stone-500">
                    All optional. Skip and we will work it out — competitors
                    are discovered automatically and we search globally by default.
                </p>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-stone-500">
                    Know your competitors?{" "}
                    <span className="text-stone-400">(optional — improves audit accuracy)</span>
                </label>
                <PillInput
                    value={competitors}
                    onChange={onCompetitorsChange}
                    placeholder="e.g. competitor.com (press Enter to add)"
                    variant="url"
                />
                <p className="text-[10px] text-stone-400">
                    Optional. We&apos;ll keep yours and find others if you add fewer than four.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="mb-1 block text-[10px] font-medium text-stone-400">
                        Country
                    </label>
                    <select
                        className="h-8 w-full rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-900"
                        value={brand.search_country || ""}
                        onChange={(event) => onFieldChange("search_country", event.target.value)}
                    >
                        {SEARCH_COUNTRIES.map(([value, label]) => (
                            <option key={value || "global"} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-[10px] font-medium text-stone-400">
                        Topic
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

            <Button
                onClick={onStart}
                disabled={saving}
                className="w-full h-10 font-semibold bg-gradient-to-b from-stone-800 to-stone-950 hover:from-stone-700 hover:to-stone-900 disabled:opacity-50"
            >
                {saving ? (
                    <>Saving…</>
                ) : (
                    <>
                        Start my audit
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                )}
            </Button>
        </div>
    )
}
