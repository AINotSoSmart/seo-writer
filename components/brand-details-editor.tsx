"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PillInput } from "@/components/ui/pill-input"
import type { BrandDetails } from "@/lib/schemas/brand"

export type BrandArrayTextField = "enemy" | "uvp" | "how_it_works"
export type BrandPillField = "core_features" | "pricing"

/**
 * Full brand-DNA form shared by onboarding (pre-audit) and Settings.
 *
 * `skipAuditCoreFields` hides product name / literally / category when those
 * already sit above this editor on the compact profile confirm card.
 */
export function BrandDetailsEditor({
    brand,
    onFieldChange,
    onArrayTextChange,
    onPillChange,
    skipAuditCoreFields = false,
}: {
    brand: BrandDetails
    onFieldChange: (path: string, value: string) => void
    onArrayTextChange: (field: BrandArrayTextField, value: string) => void
    onPillChange: (field: BrandPillField, value: string[]) => void
    skipAuditCoreFields?: boolean
}) {
    const asLines = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value.join("\n") : value || ""

    return (
        <div className="grid gap-6">
            {!skipAuditCoreFields ? (
                <>
                    <div className="space-y-4">
                        <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                            1. Product Identity
                        </h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-stone-600">
                                    Product Name
                                </label>
                                <Input
                                    value={brand.product_name}
                                    onChange={(e) => onFieldChange("product_name", e.target.value)}
                                    className="border-stone-200 bg-stone-50"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-stone-600">
                                    What is it literally?
                                </label>
                                <Input
                                    value={brand.product_identity.literally}
                                    onChange={(e) =>
                                        onFieldChange("product_identity.literally", e.target.value)
                                    }
                                    className="border-stone-200 bg-stone-50"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-stone-600">
                                    What is it emotionally?
                                </label>
                                <Input
                                    value={brand.product_identity.emotionally}
                                    onChange={(e) =>
                                        onFieldChange("product_identity.emotionally", e.target.value)
                                    }
                                    className="border-stone-200 bg-stone-50"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-stone-600">
                                    What is it NOT?
                                </label>
                                <Input
                                    value={brand.product_identity.not}
                                    onChange={(e) =>
                                        onFieldChange("product_identity.not", e.target.value)
                                    }
                                    className="border-stone-200 bg-stone-50"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                            2. Strategic Positioning
                        </h3>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                                Category
                            </label>
                            <Input
                                value={brand.category || ""}
                                onChange={(e) => onFieldChange("category", e.target.value)}
                                placeholder="e.g., Privacy-First Web Analytics, AI Photo Restoration"
                                className="border-stone-200 bg-stone-50"
                            />
                            <p className="mt-1 text-[10px] text-stone-400">
                                How would you describe your product category?
                            </p>
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-4">
                    <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                        Product Identity (more)
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                                What is it emotionally?
                            </label>
                            <Input
                                value={brand.product_identity.emotionally}
                                onChange={(e) =>
                                    onFieldChange("product_identity.emotionally", e.target.value)
                                }
                                className="border-stone-200 bg-stone-50"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                                What is it NOT?
                            </label>
                            <Input
                                value={brand.product_identity.not}
                                onChange={(e) =>
                                    onFieldChange("product_identity.not", e.target.value)
                                }
                                className="border-stone-200 bg-stone-50"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    Mission
                </h3>
                <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">The &quot;Why&quot;</label>
                    <Textarea
                        value={brand.mission}
                        onChange={(e) => onFieldChange("mission", e.target.value)}
                        className="min-h-[80px] border-stone-200 bg-stone-50"
                    />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    Audience
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">
                            Primary Audience
                        </label>
                        <Input
                            value={brand.audience.primary}
                            onChange={(e) => onFieldChange("audience.primary", e.target.value)}
                            className="border-stone-200 bg-stone-50"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">
                            Psychology (Desires/Fears)
                        </label>
                        <Textarea
                            value={brand.audience.psychology}
                            onChange={(e) => onFieldChange("audience.psychology", e.target.value)}
                            className="min-h-[80px] border-stone-200 bg-stone-50"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    Enemy (What you fight against)
                </h3>
                <Textarea
                    value={asLines(brand.enemy)}
                    onChange={(e) => onArrayTextChange("enemy", e.target.value)}
                    className="min-h-[80px] border-stone-200 bg-stone-50"
                    placeholder="Describe the problem or enemy you are fighting against..."
                />
            </div>

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    Writing Style
                </h3>
                <Textarea
                    value={brand.style_dna || ""}
                    onChange={(e) => onFieldChange("style_dna", e.target.value)}
                    placeholder="Describe your brand's writing style. E.g.: Write in a conversational yet authoritative tone. Use 'we' when referring to the brand. Keep sentences varied. Avoid corporate jargon."
                    className="min-h-[100px] border-stone-200 bg-stone-50"
                />
                <p className="text-right text-[10px] text-stone-400">
                    Comprehensive writing style guide
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    Unique Value Proposition
                </h3>
                <Textarea
                    value={asLines(brand.uvp)}
                    onChange={(e) => onArrayTextChange("uvp", e.target.value)}
                    className="min-h-[80px] border-stone-200 bg-stone-50"
                    placeholder="What makes your product unique?"
                />
            </div>

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    Core Features
                </h3>
                <PillInput
                    value={brand.core_features}
                    onChange={(arr) => onPillChange("core_features", arr)}
                    className="min-h-[80px] border-stone-200 bg-stone-50"
                    placeholder="Type feature and press Enter"
                    variant="keyword"
                />
                <p className="text-right text-[10px] text-stone-400">Press Enter to add feature</p>
            </div>

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    Pricing
                </h3>
                <PillInput
                    value={brand.pricing || []}
                    onChange={(arr) => onPillChange("pricing", arr)}
                    className="min-h-[80px] border-stone-200 bg-stone-50"
                    placeholder="Type plan and press Enter"
                    variant="keyword"
                />
                <p className="text-right text-[10px] text-stone-400">
                    One line e.g. &quot;Pro Plan: $29/mo&quot;
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    How it Works
                </h3>
                <Textarea
                    value={asLines(brand.how_it_works)}
                    onChange={(e) => onArrayTextChange("how_it_works", e.target.value)}
                    className="min-h-[80px] border-stone-200 bg-stone-50"
                    placeholder="Step 1: ..."
                />
            </div>

            <div className="space-y-4">
                <h3 className="border-b border-stone-100 pb-2 text-base font-semibold text-stone-900">
                    Featured Image Style
                </h3>
                <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">
                        Style Preference
                    </label>
                    <select
                        className="flex h-10 w-full items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
                        value={brand.image_style || "stock"}
                        onChange={(e) => onFieldChange("image_style", e.target.value)}
                    >
                        <option value="stock">Stock Photography (Professional, Realistic)</option>
                        <option value="illustration">Modern Illustration (Flat, Vector)</option>
                        <option value="indo">Indo (Vibrant, Cultural Elements)</option>
                        <option value="minimalist">Minimalist (Clean, Abstract)</option>
                        <option value="cyberpunk">Cyberpunk (Neon, Tech)</option>
                        <option value="watercolor">Watercolor (Artistic, Soft)</option>
                    </select>
                    <p className="mt-1 text-[10px] text-stone-400">
                        Select the style for AI-generated featured images.
                    </p>
                </div>
            </div>
        </div>
    )
}
