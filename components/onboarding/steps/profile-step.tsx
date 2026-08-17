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
import { resolveRegion, TARGET_MARKETS } from "@/lib/target-market"

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
                    before we continue, the audit uses what you confirm here.
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

            {/* Market, asked here rather than on the last screen because the
                buyer questions are generated on the very next one — and because
                an answer engine always answers from somewhere, so declining to
                choose does not mean "global", it means the United States.

                There is no language control, and that absence is deliberate.
                Language is not a probe setting: it selects the language of the
                whole chain, and the writer's only locale awareness is British vs
                American spelling. Offering it would produce Spanish questions,
                Spanish answers, Spanish research and an English article — with
                every stage reporting success. See WRITER_SUPPORTED_LANGUAGES. */}
            <div className="rounded-lg border border-stone-200 p-3">
                <label
                    htmlFor="target-region"
                    className="block text-[10px] font-medium uppercase tracking-wide text-stone-400"
                >
                    Where your buyers are
                </label>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                    ChatGPT and Google answer the same question differently by country.
                    We ask yours so the result is the one your buyers actually see.
                </p>
                <select
                    id="target-region"
                    className="mt-2.5 h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-900"
                    value={resolveRegion(brand.target_region)}
                    onChange={(event) => onFieldChange("target_region", event.target.value)}
                >
                    {TARGET_MARKETS.map((market) => (
                        <option key={market.code} value={market.code}>
                            {market.label}
                        </option>
                    ))}
                </select>
                <p className="mt-1.5 text-[10px] leading-relaxed text-stone-400">
                    Questions and articles are written in English for now, whichever
                    market you pick.
                </p>
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
                Looks right
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    )
}
