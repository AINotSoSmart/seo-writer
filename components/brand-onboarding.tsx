"use client"
import React, { useState, useEffect, useRef } from "react"
import { saveBrandAction, updateBrandAction } from "@/actions/brand"
import { BrandDetails } from "@/lib/schemas/brand"
import { Loader2, ArrowLeft, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { PillInput } from "@/components/ui/pill-input"
import { ScopeFamilyReview } from "@/components/onboarding/scope-family-review"

interface BrandOnboardingProps {
    onComplete: (brandId: string) => void
    onCancel: () => void
    initialData?: BrandDetails
    initialUrl?: string
    brandId?: string
}

export default function BrandOnboarding({ onComplete, onCancel, initialData, initialUrl, brandId }: BrandOnboardingProps) {
    const [url, setUrl] = useState(initialUrl || "")
    const [analyzing, setAnalyzing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [brandData, setBrandData] = useState<BrandDetails | null>(initialData || null)
    const [targetSeeds, setTargetSeeds] = useState<string[]>(
        initialData?.target_seed_keywords || [],
    )
    const [seedsWithoutDemand, setSeedsWithoutDemand] = useState<string[]>([])
    const [error, setError] = useState("")

    const handleAnalyze = async () => {
        if (!url) return
        if (targetSeeds.length > 12) {
            setError("Add no more than 12 main customer searches.")
            return
        }
        setAnalyzing(true)
        setError("")
        try {
            const res = await fetch("/api/analyze-brand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, targetSeeds }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to analyze brand")
            setBrandData(data)

            // Advisory-only and intentionally NOT awaited before this screen
            // renders — see the incident note on findSeedsWithoutDemand in
            // lib/harvest/query-validation.ts. Badges appear a moment later,
            // or not at all if this is slow or fails.
            const seeds: string[] = (data.scope_families || []).flatMap(
                (family: { seed_keywords?: string[] }) => family.seed_keywords || [],
            )
            if (seeds.length > 0) {
                fetch("/api/analyze-brand/demand-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ seeds }),
                })
                    .then((r) => r.json())
                    .then((demand) =>
                        setSeedsWithoutDemand(
                            Array.isArray(demand.seedsWithoutDemand)
                                ? demand.seedsWithoutDemand
                                : [],
                        ),
                    )
                    .catch(() => {})
            }
        } catch (e: any) {
            setError(e.message || "An error occurred")
        } finally {
            setAnalyzing(false)
        }
    }

    // Validate that required fields are filled
    const isValidBrand = (data: BrandDetails): boolean => {
        if (!data.product_name?.trim()) return false
        if (!data.product_identity?.literally?.trim()) return false
        if (!data.mission?.trim()) return false
        if (!data.audience?.primary?.trim()) return false
        if (!data.category?.trim()) return false
        return true
    }

    // Helper to clean array data before sending to DB
    const cleanArray = (arr: string[] | undefined) => {
        if (!arr) return []
        return arr.map(item => item.trim()).filter(item => item !== "")
    }

    const handleSave = async () => {
        if (!brandData) return

        // 1. Clean the data here
        // For textareas (Enemy, UVP, How it Works), we split by newline if they haven't been already
        // Pill inputs (Pricing, Core Features) are already arrays
        const cleanData: BrandDetails = {
            ...brandData,
            enemy: cleanArray(brandData.enemy),
            uvp: cleanArray(brandData.uvp),
            how_it_works: cleanArray(brandData.how_it_works),
            core_features: cleanArray(brandData.core_features),
            pricing: cleanArray(brandData.pricing),
            target_seed_keywords: cleanArray(
                brandData.target_seed_keywords || targetSeeds,
            ),
            scope_families: (brandData.scope_families || [])
                .filter((family) => family.enabled)
                .map((family, priority) => ({
                    ...family,
                    name: family.name.trim(),
                    description: family.description.trim(),
                    seed_keywords: cleanArray(family.seed_keywords),
                    priority,
                    enabled: true,
                })),
        }

        // Validate required fields
        if (!isValidBrand(cleanData)) {
            setError("Please fill in all required fields: Product Name, Product Identity, Category, Mission, and Primary Audience")
            return
        }

        setSaving(true)
        setError("")
        try {
            if (brandId) {
                // Update existing - pass cleanData instead of brandData
                const res = await updateBrandAction(brandId, cleanData)
                if (!res.success) {
                    throw new Error(res.error || "Failed to update brand")
                }
                onComplete(brandId)
            } else {
                // Create new - pass cleanData instead of brandData
                const res = await saveBrandAction(url, cleanData)
                if (!res.success) {
                    throw new Error('error' in res ? res.error : "Failed to save brand")
                }
                if (!res.brandId) {
                    throw new Error("Failed to save brand - no brandId returned")
                }
                onComplete(res.brandId)
            }
        } catch (e: any) {
            setError(e.message || "Failed to save brand details")
        } finally {
            setSaving(false)
        }
    }

    // Helper to update nested state
    const updateField = (path: string, value: any) => {
        if (!brandData) return
        const newData = { ...brandData }

        if (path.includes('.')) {
            const [parent, child] = path.split('.')
            // @ts-ignore
            newData[parent] = { ...newData[parent], [child]: value }
        } else {
            // @ts-ignore
            newData[path] = value
        }
        setBrandData(newData)
    }

    if (!brandData) {
        return (
            <div className="w-full mx-auto space-y-6 p-4 sm:p-6 bg-white">
                <Button variant="ghost" size="sm" onClick={onCancel} className="mb-2 -ml-2 text-stone-500 hover:text-stone-900">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <div className="space-y-2 text-center">
                    <h2 className="text-xl font-bold text-stone-900">Let&apos;s understand your brand</h2>
                    <p className="text-sm text-stone-500">Enter your website URL to automatically extract your brand identity.</p>
                </div>

                <div className="space-y-4">
                    <Input
                        type="url"
                        placeholder="https://example.com"
                        className="flex-1 w-full"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">
                            What do people type into Google to find a tool like yours?
                        </label>
                        <PillInput
                            value={targetSeeds}
                            onChange={setTargetSeeds}
                            placeholder="e.g. ai photo restoration"
                        />
                        <p className="mt-1 text-[10px] text-stone-400">
                            Not your brand name — the words a stranger would search. Two to
                            five words each. These decide what the whole audit researches,
                            so anything you add here we treat as correct.
                        </p>
                    </div>
                    <Button onClick={handleAnalyze} disabled={analyzing || !url} className="w-full bg-stone-900 text-white">
                        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze Brand"}
                    </Button>
                </div>
                <div className="text-center">
                    <button
                        className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
                        onClick={() => setBrandData({
                            product_name: "",
                            product_identity: { literally: "", emotionally: "", not: "" },
                            mission: "",
                            audience: { primary: "", psychology: "" },
                            enemy: [],
                            category: "",
                            uvp: [],
                            core_features: [],
                            pricing: [],
                            how_it_works: [],
                            image_style: "stock",
                            style_dna: "",
                            brand_keywords: [], // Added to fix type error
                            scope_families: [],
                            target_seed_keywords: targetSeeds,
                            search_country: "",
                            search_topic: "general",
                            article_length: "long",
                        })}
                    >
                        Skip and fill manually
                    </button>
                </div>

                {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-md border border-red-100">{error}</p>}
            </div>
        )
    }

    return (
        <div className="w-full mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-stone-900">Review Brand Details</h2>
                    <p className="text-sm text-stone-500">Verify extracted information before saving</p>
                </div>
                <Button variant="outline" size="sm" onClick={onCancel} className="w-full sm:w-auto border-stone-200">
                    <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                    Back
                </Button>
            </div>

            <div className="grid gap-6 p-4 sm:p-6 bg-white rounded-xl border border-stone-200">
                <ScopeFamilyReview
                    families={brandData.scope_families || []}
                    targetSeeds={brandData.target_seed_keywords || targetSeeds}
                    seedsWithoutDemand={seedsWithoutDemand}
                    onChange={(scope_families) =>
                        setBrandData((current) =>
                            current ? { ...current, scope_families } : current,
                        )
                    }
                />

                {/* 1. Product Identity */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">1. Product Identity</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-stone-600">Product Name</label>
                            <Input
                                value={brandData.product_name}
                                onChange={e => updateField('product_name', e.target.value)}
                                className="bg-stone-50 border-stone-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-stone-600">What is it literally?</label>
                            <Input
                                value={brandData.product_identity.literally}
                                onChange={e => updateField('product_identity.literally', e.target.value)}
                                className="bg-stone-50 border-stone-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-stone-600">What is it emotionally?</label>
                            <Input
                                value={brandData.product_identity.emotionally}
                                onChange={e => updateField('product_identity.emotionally', e.target.value)}
                                className="bg-stone-50 border-stone-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-stone-600">What is it NOT?</label>
                            <Input
                                value={brandData.product_identity.not}
                                onChange={e => updateField('product_identity.not', e.target.value)}
                                className="bg-stone-50 border-stone-200"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Category (Strategic Positioning) */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">2. Strategic Positioning</h3>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-stone-600">Category</label>
                        <Input
                            value={brandData.category || ""}
                            onChange={e => updateField('category', e.target.value)}
                            placeholder="e.g., Privacy-First Web Analytics, AI Photo Restoration"
                            className="bg-stone-50 border-stone-200"
                        />
                        <p className="text-[10px] text-stone-400 mt-1">How would you describe your product category?</p>
                    </div>
                </div>

                {/* 2. Mission */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">2. Mission</h3>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-stone-600">The "Why"</label>
                        <Textarea
                            value={brandData.mission}
                            onChange={e => updateField('mission', e.target.value)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                        />
                    </div>
                </div>

                {/* 3. Audience */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">3. Audience</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-stone-600">Primary Audience</label>
                            <Input
                                value={brandData.audience.primary}
                                onChange={e => updateField('audience.primary', e.target.value)}
                                className="bg-stone-50 border-stone-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-stone-600">Psychology (Desires/Fears)</label>
                            <Textarea
                                value={brandData.audience.psychology}
                                onChange={e => updateField('audience.psychology', e.target.value)}
                                className="bg-stone-50 border-stone-200 min-h-[80px]"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Enemy */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">4. Enemy (What you fight against)</h3>
                    <div className="relative">
                        <Textarea
                            value={Array.isArray(brandData.enemy) ? brandData.enemy.join('\n') : brandData.enemy || ""}
                            onChange={e => setBrandData(prev => prev ? ({ ...prev, enemy: e.target.value.split('\n') }) : null)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                            placeholder="Describe the problem or enemy you are fighting against..."
                        />
                    </div>
                </div>

                {/* 5. Writing Style DNA */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">5. Writing Style</h3>
                    <div className="relative">
                        <Textarea
                            value={brandData.style_dna || ""}
                            onChange={e => setBrandData(prev => prev ? ({ ...prev, style_dna: e.target.value }) : null)}
                            placeholder="Describe your brand's writing style. E.g.: Write in a conversational yet authoritative tone. Use 'we' when referring to the brand. Keep sentences varied. Avoid corporate jargon."
                            className="bg-stone-50 border-stone-200 min-h-[100px]"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 text-right">Comprehensive writing style guide</p>
                    </div>
                </div>

                {/* 6. UVP */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">6. Unique Value Proposition</h3>
                    <div className="relative">
                        <Textarea
                            value={Array.isArray(brandData.uvp) ? brandData.uvp.join('\n') : brandData.uvp || ""}
                            onChange={e => setBrandData(prev => prev ? ({ ...prev, uvp: e.target.value.split('\n') }) : null)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                            placeholder="What makes your product unique?"
                        />
                    </div>
                </div>

                {/* 7. Core Features */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">7. Core Features</h3>
                    <div className="relative">
                        <PillInput
                            value={brandData.core_features}
                            onChange={arr => setBrandData(prev => prev ? ({ ...prev, core_features: arr }) : null)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                            placeholder="Type feature and press Enter"
                            variant="keyword"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 text-right">Press Enter to add feature</p>
                    </div>
                </div>

                {/* 8. Pricing */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">8. Pricing</h3>
                    <div className="relative">
                        <PillInput
                            value={brandData.pricing || []}
                            onChange={arr => setBrandData(prev => prev ? ({ ...prev, pricing: arr }) : null)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                            placeholder="Type plan and press Enter"
                            variant="keyword"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 text-right">One line e.g. "Pro Plan: $29/mo"</p>
                    </div>
                </div>

                {/* 9. How it Works */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">9. How it Works</h3>
                    <div className="relative">
                        <Textarea
                            value={Array.isArray(brandData.how_it_works) ? brandData.how_it_works.join('\n') : brandData.how_it_works || ""}
                            onChange={e => setBrandData(prev => prev ? ({ ...prev, how_it_works: e.target.value.split('\n') }) : null)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                            placeholder="Step 1: ..."
                        />
                    </div>
                </div>

                {/* 10. Image Style */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">10. Featured Image Style</h3>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-stone-600">Style Preference</label>
                        <select
                            className="flex h-10 w-full items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
                            value={brandData.image_style || "stock"}
                            onChange={e => updateField('image_style', e.target.value)}
                        >
                            <option value="stock">Stock Photography (Professional, Realistic)</option>
                            <option value="illustration">Modern Illustration (Flat, Vector)</option>
                            <option value="indo">Indo (Vibrant, Cultural Elements)</option>
                            <option value="minimalist">Minimalist (Clean, Abstract)</option>
                            <option value="cyberpunk">Cyberpunk (Neon, Tech)</option>
                            <option value="watercolor">Watercolor (Artistic, Soft)</option>
                        </select>
                        <p className="text-[10px] text-stone-400 mt-1">Select the style for AI-generated featured images.</p>
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}

                <div className="flex justify-end pt-4 sticky bottom-0 bg-white/80 backdrop-blur-sm py-4 border-t border-stone-100 mt-4">
                    <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-8 bg-stone-900 text-white hover:bg-stone-800">
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                            </>
                        ) : brandId ? "Update Brand" : "Save & Continue"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
