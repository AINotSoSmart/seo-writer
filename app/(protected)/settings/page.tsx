"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getUserBrands, getUserBrandStatus, deleteBrandAction } from "@/actions/brand"
import { getUserDefaults, setDefaultBrand, setDefaultVoice } from "@/actions/preferences"
import { createClient } from "@/utils/supabase/client"
import { Check, Globe, PenTool, Trash2, Plus, Edit } from "lucide-react"
import BrandOnboarding from "@/app/(protected)/blog-writer/BrandOnboarding"
import { STYLE_PRESETS } from "@/lib/presets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { BrandDetails } from "@/lib/schemas/brand"

type BrandInfo = { id: string; website_url: string; created_at: string; brand_data: BrandDetails }
type VoiceInfo = { id: string; name: string; style_dna: any }

export default function SettingsPage() {
  const supabase = createClient()

  const [brands, setBrands] = useState<BrandInfo[]>([])
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [defaultBrandId, setDefaultBrandId] = useState<string | null>(null)
  const [defaultVoiceId, setDefaultVoiceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [brandLimit, setBrandLimit] = useState(0)
  const [brandCount, setBrandCount] = useState(0)
  const [isCreatingBrand, setIsCreatingBrand] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandInfo | null>(null)
  const [editingVoice, setEditingVoice] = useState<VoiceInfo | null>(null)

  const [activeVoiceTab, setActiveVoiceTab] = useState<"existing" | "new">("existing")
  const [creationMethod, setCreationMethod] = useState<"preset" | "mimic">("preset")
  const [presetKey, setPresetKey] = useState<string>("linkedin-influencer")
  const [mimicUrl, setMimicUrl] = useState<string>("")
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [customStyleName, setCustomStyleName] = useState<string>("")
  const [customStyleJson, setCustomStyleJson] = useState<string>(JSON.stringify(STYLE_PRESETS["linkedin-influencer"], null, 2))
  const [savingStyle, setSavingStyle] = useState<boolean>(false)

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [status, defaults, voiceList] = await Promise.all([
          getUserBrandStatus(),
          getUserDefaults(),
          supabase.from("brand_voices").select("*").order("created_at", { ascending: false }),
        ])
        // @ts-ignore
        setBrands(status.brands)
        // @ts-ignore
        setBrandLimit(status.limit)
        // @ts-ignore
        setBrandCount(status.count)
        setDefaultBrandId((defaults as any).default_brand_id)
        setDefaultVoiceId((defaults as any).default_voice_id)
        setVoices((voiceList.data || []) as any)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [supabase])

  useEffect(() => {
    if (creationMethod === "preset" && presetKey && STYLE_PRESETS[presetKey]) {
      setCustomStyleJson(JSON.stringify(STYLE_PRESETS[presetKey], null, 2))
    }
  }, [presetKey, creationMethod])

  const refreshBrands = async () => {
    const status = await getUserBrandStatus()
    // @ts-ignore
    setBrands(status.brands)
    // @ts-ignore
    setBrandLimit(status.limit)
    // @ts-ignore
    setBrandCount(status.count)
  }

  const analyzeUrl = async () => {
    if (!mimicUrl) return
    setIsAnalyzing(true)
    try {
      const res = await fetch("/api/extract-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mimicUrl }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to analyze style")
      setCustomStyleJson(JSON.stringify(json, null, 2))
      try {
        const domain = new URL(mimicUrl).hostname.replace("www.", "")
        setCustomStyleName(`Style from ${domain}`)
      } catch {
        setCustomStyleName("My Mimic Style")
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveNewStyle = async () => {
    if (!customStyleName || !customStyleJson) return
    setSavingStyle(true)
    try {
      let parsed
      try {
        parsed = JSON.parse(customStyleJson)
      } catch {
        throw new Error("Invalid JSON format")
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      if (editingVoice) {
        // Update existing
        const { data, error } = await supabase
          .from("brand_voices")
          .update({ name: customStyleName, style_dna: parsed })
          .eq("id", editingVoice.id)
          .select()
          .single()
        
        if (error) throw error
        
        setVoices(prev => prev.map(v => v.id === editingVoice.id ? (data as any) : v))
        setEditingVoice(null)
      } else {
        // Create new
        const { data, error } = await supabase
          .from("brand_voices")
          .insert({ name: customStyleName, style_dna: parsed, user_id: user.id, is_default: false })
          .select()
          .single()
        
        if (error) throw error
        setVoices(prev => [data as any, ...prev])
        setDefaultVoiceId((data as any).id)
      }

      setActiveVoiceTab("existing")
      setCustomStyleName("")
      setMimicUrl("")
      setCustomStyleJson(JSON.stringify(STYLE_PRESETS["linkedin-influencer"], null, 2))
      setCreationMethod("preset")
    } catch (e: any) {
        console.error(e)
        alert(e.message || "Failed to save voice")
    } finally {
      setSavingStyle(false)
    }
  }

  const BrandTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-gray-500">{brandCount} / {brandLimit} brands used</div>
        {!editingBrand && !isCreatingBrand && (
            <Button onClick={() => setIsCreatingBrand(true)} disabled={brandCount >= brandLimit} size="sm" className="shrink-0">
            <Plus className="w-4 h-4" /> Add Brand
            </Button>
        )}
      </div>

      {isCreatingBrand || editingBrand ? (
        <BrandOnboarding
          initialData={editingBrand?.brand_data}
          initialUrl={editingBrand?.website_url}
          brandId={editingBrand?.id}
          onComplete={async (id) => {
            setIsCreatingBrand(false)
            setEditingBrand(null)
            await refreshBrands()
            if (!editingBrand) {
                setDefaultBrandId(id)
            }
          }}
          onCancel={() => {
              setIsCreatingBrand(false)
              setEditingBrand(null)
          }}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {brands.map((b) => (
            <div key={b.id} className={`p-3 border rounded-lg flex items-center justify-between ${defaultBrandId === b.id ? "border-blue-500 bg-blue-50" : "hover:bg-accent"}`}>
              <button
                onClick={async () => {
                  setSaving(true)
                  try {
                    const res = await setDefaultBrand(b.id)
                    if (res.success) setDefaultBrandId(b.id)
                  } finally {
                    setSaving(false)
                  }
                }}
                className="flex-1 text-left"
              >
                <span className="truncate pr-4">{b.website_url}</span>
              </button>
              <div className="flex items-center gap-1">
                {defaultBrandId === b.id && <Check className="w-4 h-4 mr-2" />}
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditingBrand(b)}>
                    <Edit className="w-4 h-4 text-gray-600" />
                </Button>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={async () => {
                    setSaving(true)
                    try {
                    const res = await deleteBrandAction(b.id)
                    if (res.success) {
                        await refreshBrands()
                    }
                    } finally {
                    setSaving(false)
                    }
                }}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
          {brands.length === 0 && (
            <p className="text-sm text-gray-500">No brands yet. Add one above.</p>
          )}
        </div>
      )}
    </div>
  )

  const VoiceTab = (
    <div className="space-y-6">
      <Tabs value={activeVoiceTab} onValueChange={(v) => {
          setActiveVoiceTab(v as any)
          if (v === "existing") {
              setEditingVoice(null)
              setCustomStyleName("")
              setCustomStyleJson(JSON.stringify(STYLE_PRESETS["linkedin-influencer"], null, 2))
              setCreationMethod("preset")
          }
      }} className="w-full">
        <TabsList>
          <TabsTrigger value="existing">Select Voice</TabsTrigger>
          <TabsTrigger value="new">{editingVoice ? "Edit Voice" : "Create New Voice"}</TabsTrigger>
        </TabsList>

        <TabsContent value="existing">
          <div className="grid sm:grid-cols-2 gap-3">
            {voices.map((v) => (
              <div key={v.id} className={`p-3 border rounded-lg flex items-center justify-between ${defaultVoiceId === v.id ? "border-purple-500 bg-purple-50" : "hover:bg-accent"}`}>
                <button
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const res = await setDefaultVoice(v.id)
                      if (res.success) setDefaultVoiceId(v.id)
                    } finally {
                      setSaving(false)
                    }
                  }}
                  className="flex-1 text-left"
                >
                  <span className="truncate pr-4">{v.name}</span>
                </button>
                <div className="flex items-center gap-1">
                    {defaultVoiceId === v.id && <Check className="w-4 h-4 mr-2" />}
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => {
                        setEditingVoice(v)
                        setCustomStyleName(v.name)
                        setCustomStyleJson(JSON.stringify(v.style_dna, null, 2))
                        setActiveVoiceTab("new")
                    }}>
                        <Edit className="w-4 h-4 text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={async () => {
                    setSaving(true)
                    try {
                        await supabase.from("brand_voices").delete().eq("id", v.id)
                        const { data } = await supabase.from("brand_voices").select("*").order("created_at", { ascending: false })
                        setVoices((data || []) as any)
                        if (defaultVoiceId === v.id) setDefaultVoiceId(null)
                    } finally {
                        setSaving(false)
                    }
                    }}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                </div>
              </div>
            ))}
            {voices.length === 0 && (
              <p className="text-sm text-gray-500">No voices yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="new" className="space-y-6">
          {!editingVoice && (
             <div className="space-y-2">
                <label className="block text-sm font-medium">Choose a Preset</label>
                <select value={presetKey} onChange={e => setPresetKey(e.target.value)} className="w-full border rounded-md p-2">
                {Object.keys(STYLE_PRESETS).map(key => (
                    <option key={key} value={key}>{key.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
                </select>
            </div>
          )}

          {!editingVoice && (
             <div className="space-y-2">
                <label className="block text-sm font-medium">Enter URL to Mimic</label>
                <div className="flex gap-2 flex-wrap">
                <Input value={mimicUrl} onChange={e => setMimicUrl(e.target.value)} placeholder="https://example.com/blog/post-to-mimic" className="flex-1 min-w-[240px]" />
                <Button onClick={analyzeUrl} disabled={isAnalyzing || !mimicUrl}>{isAnalyzing ? "Analyzing..." : "Analyze"}</Button>
                </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium">{editingVoice ? "Voice Name" : "New Voice Name"}</label>
            <Input value={customStyleName} onChange={e => setCustomStyleName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Style DNA (JSON)</label>
            <Textarea value={customStyleJson} onChange={e => setCustomStyleJson(e.target.value)} className="h-64 font-mono text-sm" />
          </div>
          <div className="flex gap-2">
            {editingVoice && (
                <Button variant="outline" onClick={() => {
                    setEditingVoice(null)
                    setActiveVoiceTab("existing")
                }}>Cancel</Button>
            )}
            <Button onClick={saveNewStyle} disabled={savingStyle} className="w-full sm:w-auto">
                {savingStyle ? "Saving..." : editingVoice ? "Update Voice" : "Save Voice"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500">Configure brand and voice. These defaults are used by the writer.</p>
      </div>
      <Tabs defaultValue="brand" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="brand"><Globe className="w-4 h-4" /> Brand</TabsTrigger>
          <TabsTrigger value="voice"><PenTool className="w-4 h-4" /> Voice & Tone</TabsTrigger>
        </TabsList>
        <TabsContent value="brand">{BrandTab}</TabsContent>
        <TabsContent value="voice">{VoiceTab}</TabsContent>
      </Tabs>
    </div>
  )
}
