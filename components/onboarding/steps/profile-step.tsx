"use client"

import { useState } from "react"
import { ArrowRight, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    BrandDetailsEditor,
    type BrandArrayTextField,
    type BrandPillField,
} from "@/components/brand-details-editor"
import type { BrandDetails } from "@/lib/schemas/brand"
import {
    resolveLanguage,
    resolveRegion,
    TARGET_LANGUAGES,
    TARGET_MARKETS,
} from "@/lib/target-market"

/**
 * Step 2 of onboarding. Confirm the three audit-critical fields, then optionally
 * expand the rest of the brand DNA before scope/audit. Corrections after the
 * audit do not rewrite that run — this is the last honest place to edit.
 */
export function ProfileStep({
    brand,
    onFieldChange,
    onArrayTextChange,
    onPillChange,
    onConfirm,
}: {
    brand: BrandDetails
    onFieldChange: (field: string, value: string) => void
    onArrayTextChange: (field: BrandArrayTextField, value: string) => void
    onPillChange: (field: BrandPillField, value: string[]) => void
    onConfirm: () => void
}) {
    const [detailsOpen, setDetailsOpen] = useState(false)

    return (
        <div className="space-y-5">
            <div className="space-y-1.5">
                <h2 className="font-serif text-xl tracking-tight text-stone-900">
                    Here&apos;s what we understood
                </h2>
                <p className="text-sm text-stone-500">
                    Correct anything that looks wrong. Open full brand details if
                    you need to fix voice, audience, features, or anything else
                    before we continue — the audit uses what you confirm here.
                </p>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        Product name
                    </label>
                    <Input
                        value={brand.product_name}
                        onChange={(event) => onFieldChange("product_name", event.target.value)}
                        placeholder="What is it called?"
                        className="h-9 text-sm"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        What it is
                    </label>
                    <Input
                        value={brand.product_identity.literally}
                        onChange={(event) =>
                            onFieldChange("product_identity.literally", event.target.value)
                        }
                        placeholder="e.g. browser-based photo restoration software"
                        className="h-9 text-sm"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        Category
                    </label>
                    <Input
                        value={brand.category || ""}
                        onChange={(event) => onFieldChange("category", event.target.value)}
                        placeholder="e.g. AI photo tools"
                        className="h-9 text-sm"
                    />
                </div>
            </div>

            {/* Market. Asked here rather than on the last screen for two
                reasons: the questions are written in this language, and they are
                generated on the very next screen — and an answer engine always
                answers from somewhere, so declining to choose does not mean
                "global", it means the United States by default. */}
            <div className="rounded-lg border border-stone-200 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                    Who you sell to
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                    ChatGPT and Google answer differently in different countries and
                    languages. We ask yours so the result is the one your buyers see.
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div>
                        <label
                            htmlFor="target-region"
                            className="mb-1 block text-[10px] font-medium text-stone-400"
                        >
                            Market
                        </label>
                        <select
                            id="target-region"
                            className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-900"
                            value={resolveRegion(brand.target_region)}
                            onChange={(event) => onFieldChange("target_region", event.target.value)}
                        >
                            {TARGET_MARKETS.map((market) => (
                                <option key={market.code} value={market.code}>
                                    {market.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label
                            htmlFor="target-language"
                            className="mb-1 block text-[10px] font-medium text-stone-400"
                        >
                            Language
                        </label>
                        <select
                            id="target-language"
                            className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-900"
                            value={resolveLanguage(brand.target_language)}
                            onChange={(event) =>
                                onFieldChange("target_language", event.target.value)
                            }
                        >
                            {TARGET_LANGUAGES.map((language) => (
                                <option key={language.code} value={language.code}>
                                    {language.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {!detailsOpen && brand.style_dna ? (
                <div className="rounded-lg bg-stone-50 px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        Voice we picked up
                    </p>
                    <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-stone-500">
                        {brand.style_dna}
                    </p>
                </div>
            ) : null}

            <div className="rounded-lg border border-stone-200">
                <button
                    type="button"
                    onClick={() => setDetailsOpen((open) => !open)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-stone-800 hover:bg-stone-50"
                    aria-expanded={detailsOpen}
                >
                    Edit full brand details
                    <ChevronDown
                        className={`h-4 w-4 text-stone-400 transition-transform ${
                            detailsOpen ? "rotate-180" : ""
                        }`}
                    />
                </button>
                {detailsOpen ? (
                    <div className="border-t border-stone-100 px-3 py-4">
                        <BrandDetailsEditor
                            brand={brand}
                            onFieldChange={onFieldChange}
                            onArrayTextChange={onArrayTextChange}
                            onPillChange={onPillChange}
                            skipAuditCoreFields
                        />
                    </div>
                ) : null}
            </div>

            <Button
                onClick={onConfirm}
                disabled={!brand.product_name.trim()}
                className="h-10 w-full bg-gradient-to-b from-stone-800 to-stone-950 font-semibold hover:from-stone-700 hover:to-stone-900 disabled:opacity-50"
            >
                Looks right — find what I sell
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    )
}
