"use client"
import { useState } from "react"
import { saveBrandAction, updateBrandAction } from "@/actions/brand"
import { BrandDetails } from "@/lib/schemas/brand"
import { Loader2, ArrowLeft, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
    const [error, setError] = useState("")

    const handleAnalyze = async () => {
        if (!url) return
        setAnalyzing(true)
        setError("")
        try {
            const res = await fetch("/api/analyze-brand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to analyze brand")
            setBrandData(data)
        } catch (e: any) {
            setError(e.message || "An error occurred")
        } finally {
            setAnalyzing(false)
        }
    }

    const handleSave = async () => {
        if (!brandData) return
        setSaving(true)
        setError("")
        try {
            if (brandId) {
                // Update existing
                const res = await updateBrandAction(brandId, brandData)
                if (!res.success) {
                    throw new Error(res.error || "Failed to update brand")
                }
                onComplete(brandId)
            } else {
                // Create new
                const res = await saveBrandAction(url, brandData)
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

    const updateArray = (field: keyof BrandDetails, value: string) => {
        // Split by newline and filter empty
        const arr = value.split('\n').filter(line => line.trim() !== '')
        setBrandData(prev => prev ? ({ ...prev, [field]: arr }) : null)
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

                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        type="url"
                        placeholder="https://example.com"
                        className="flex-1 w-full"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    />
                    <Button onClick={handleAnalyze} disabled={analyzing || !url} className="w-full sm:w-auto bg-stone-900 text-white">
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
                            uvp: [],
                            core_features: [],
                            pricing: [],
                            how_it_works: [],
                            image_style: "stock",
                            style_dna: "",
                        })}
                    >
                        Or enter details manually
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
                <Button variant="outline" size="sm" onClick={() => setBrandData(null)} className="w-full sm:w-auto border-stone-200">
                    <RotateCcw className="w-3.5 h-3.5 mr-2" />
                    Re-Analyze
                </Button>
            </div>

            <div className="grid gap-6 p-4 sm:p-6 bg-white rounded-xl border border-stone-200">
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
                            value={brandData.enemy.join('\n')}
                            onChange={e => updateArray('enemy', e.target.value)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 text-right">One item per line</p>
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
                            value={brandData.uvp.join('\n')}
                            onChange={e => updateArray('uvp', e.target.value)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 text-right">One item per line</p>
                    </div>
                </div>

                {/* 7. Core Features */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">7. Core Features</h3>
                    <div className="relative">
                        <Textarea
                            value={brandData.core_features.join('\n')}
                            onChange={e => updateArray('core_features', e.target.value)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 text-right">One item per line</p>
                    </div>
                </div>

                {/* 8. Pricing */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">8. Pricing</h3>
                    <div className="relative">
                        <Textarea
                            value={brandData.pricing?.join('\n') || ''}
                            onChange={e => updateArray('pricing', e.target.value)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 text-right">One line e.g. "Pro Plan: $29/mo"</p>
                    </div>
                </div>

                {/* 9. How it Works */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b border-stone-100 pb-2 text-stone-900">9. How it Works</h3>
                    <div className="relative">
                        <Textarea
                            value={brandData.how_it_works?.join('\n') || ''}
                            onChange={e => updateArray('how_it_works', e.target.value)}
                            className="bg-stone-50 border-stone-200 min-h-[80px]"
                        />
                        <p className="text-[10px] text-stone-400 mt-1 text-right">One step per line</p>
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
