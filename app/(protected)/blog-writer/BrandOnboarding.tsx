"use client"
import { useState } from "react"
import { saveBrandAction, updateBrandAction } from "@/actions/brand"
import { BrandDetails } from "@/lib/schemas/brand"
import { Loader2, ArrowLeft } from "lucide-react"
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
        if (!res.success || !res.brandId) {
          throw new Error(res.error || "Failed to save brand")
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
      <div className="max-w-2xl mx-auto space-y-6 p-6 bg-white rounded-xl border shadow-sm">
        <Button variant="outline" size="sm" onClick={onCancel} className="mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Brands
        </Button>
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold">Let's understand your brand</h2>
          <p className="text-gray-500">Enter your website URL to automatically extract your brand identity.</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Input
            type="url"
            placeholder="https://example.com"
            className="flex-1 min-w-[240px]"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <Button onClick={handleAnalyze} disabled={analyzing || !url}>
            {analyzing ? "Analyzing..." : "Analyze Brand"}
          </Button>
          <Button variant="outline"
            onClick={() => setBrandData({
              product_name: "",
              product_identity: { literally: "", emotionally: "", not: "" },
              mission: "",
              audience: { primary: "", psychology: "" },
              enemy: [],
              voice_tone: [],
              uvp: [],
              core_features: [],
              pricing: [],
              how_it_works: [],
              image_style: "stock",
            })}
          >
            Start Manual Entry
          </Button>
        </div>
        
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Review Brand Details</h2>
        <Button variant="outline" size="sm" onClick={() => setBrandData(null)}>
          Analyze different URL
        </Button>
      </div>

      <div className="grid gap-6 p-6 bg-white rounded-xl border shadow-sm">
        {/* 1. Product Identity */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">1. Product Identity</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <Input
                value={brandData.product_name}
                onChange={e => updateField('product_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">What is it literally?</label>
              <Input
                value={brandData.product_identity.literally}
                onChange={e => updateField('product_identity.literally', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">What is it emotionally?</label>
              <Input
                value={brandData.product_identity.emotionally}
                onChange={e => updateField('product_identity.emotionally', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">What is it NOT?</label>
              <Input
                value={brandData.product_identity.not}
                onChange={e => updateField('product_identity.not', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 2. Mission */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">2. Mission</h3>
          <div>
            <label className="block text-sm font-medium mb-1">The "Why"</label>
            <Textarea
              value={brandData.mission}
              onChange={e => updateField('mission', e.target.value)}
            />
          </div>
        </div>

        {/* 3. Audience */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">3. Audience</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Primary Audience</label>
              <Input
                value={brandData.audience.primary}
                onChange={e => updateField('audience.primary', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Psychology (Desires/Fears)</label>
              <Textarea
                value={brandData.audience.psychology}
                onChange={e => updateField('audience.psychology', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 4. Enemy */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">4. Enemy (What you fight against)</h3>
          <p className="text-xs text-gray-500">One item per line</p>
          <Textarea
            value={brandData.enemy.join('\n')}
            onChange={e => updateArray('enemy', e.target.value)}
          />
        </div>

        {/* 5. Voice & Tone */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">5. Voice & Tone</h3>
          <p className="text-xs text-gray-500">One item per line</p>
          <Textarea
            value={brandData.voice_tone.join('\n')}
            onChange={e => updateArray('voice_tone', e.target.value)}
          />
        </div>

        {/* 6. UVP */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">6. Unique Value Proposition</h3>
          <p className="text-xs text-gray-500">One item per line</p>
          <Textarea
            value={brandData.uvp.join('\n')}
            onChange={e => updateArray('uvp', e.target.value)}
          />
        </div>

        {/* 7. Core Features */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">7. Core Features</h3>
          <p className="text-xs text-gray-500">One item per line</p>
          <Textarea
            value={brandData.core_features.join('\n')}
            onChange={e => updateArray('core_features', e.target.value)}
          />
        </div>

        {/* 8. Pricing */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">8. Pricing</h3>
          <p className="text-xs text-gray-500">One item per line (e.g., "Pro Plan: $29/mo", "Free Tier available")</p>
          <Textarea
            value={brandData.pricing?.join('\n') || ''}
            onChange={e => updateArray('pricing', e.target.value)}
          />
        </div>

        {/* 9. How it Works */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">9. How it Works</h3>
          <p className="text-xs text-gray-500">One step per line (e.g., "Step 1: Sign up", "Step 2: Upload photo")</p>
          <Textarea
            value={brandData.how_it_works?.join('\n') || ''}
            onChange={e => updateArray('how_it_works', e.target.value)}
          />
        </div>

        {/* 10. Image Style */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">10. Featured Image Style</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Style Preference</label>
            <p className="text-xs text-gray-500 mb-2">Select the style for AI-generated featured images.</p>
            <select 
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving} className="px-8">
            {saving ? "Saving..." : brandId ? "Update Brand" : "Save & Continue"}
          </Button>
        </div>
      </div>
    </div>
  )
}
