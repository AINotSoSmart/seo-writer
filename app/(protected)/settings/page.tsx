"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getUserBrands, getUserBrandStatus, deleteBrandAction } from "@/actions/brand"
import { getUserDefaults, setDefaultBrand, setDefaultVoice } from "@/actions/preferences"
import { createClient } from "@/utils/supabase/client"
import { Check, Globe, PenTool, Trash2, Plus, Edit, Settings2, Sparkles, Loader2, Search } from "lucide-react"
import BrandOnboarding from "@/app/(protected)/blog-writer/BrandOnboarding"
import { STYLE_PRESETS } from "@/lib/presets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { BrandDetails } from "@/lib/schemas/brand"
import { GlobalCard } from "@/components/ui/global-card"
import { motion, AnimatePresence } from "motion/react"

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

  // Dark mode detection for conditional styling if needed, though we use CSS classes mostly
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }, [])

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

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Loading settings...</span>
        </div>
      </div>
    )
  }

  const BrandTab = (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between gap-3 flex-wrap px-1">
        <div className="text-xs font-medium text-stone-500 uppercase tracking-wider">
          Your Brands ({brandCount} / {brandLimit})
        </div>
        {!editingBrand && !isCreatingBrand && (
          <button
            onClick={() => setIsCreatingBrand(true)}
            disabled={brandCount >= brandLimit}
            className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-all
                    active:scale-[0.98] cursor-pointer
                    bg-stone-900 hover:bg-stone-800
                    dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100
                    shadow-sm border border-stone-800 dark:border-stone-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Brand</span>
          </button>
        )}
      </div>

      {isCreatingBrand || editingBrand ? (
        <div className="p-4 border border-stone-200 dark:border-stone-800 rounded-xl bg-stone-50/50 dark:bg-stone-900/50">
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
        </div>
      ) : (
        <div className="grid sm:grid-cols-1 gap-3">
          {brands.map((b) => {
            const isSelected = defaultBrandId === b.id;
            return (
              <div
                key={b.id}
                className={`
                        w-full text-left p-4 rounded-xl border transition-all duration-200
                        group flex items-center justify-between relative
                        ${isSelected
                    ? 'bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-600 ring-1 ring-stone-300 dark:ring-stone-600'
                    : 'bg-white dark:bg-stone-950/50 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700'
                  }
                    `}
              >
                <div className="flex items-center gap-4 overflow-hidden">
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
                    className={`
                                w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer
                                ${isSelected
                        ? 'bg-stone-900 dark:bg-stone-100 border-stone-900 dark:border-stone-100 text-white dark:text-stone-900'
                        : 'border-stone-300 dark:border-stone-700 text-transparent hover:border-stone-400'
                      }
                            `}
                  >
                    <Check className="w-3 h-3" />
                  </button>

                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>
                      {b.website_url}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500 truncate">
                      ID: {b.id.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200" onClick={() => setEditingBrand(b)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-red-600 dark:hover:text-red-400" onClick={async () => {
                    if (!confirm("Are you sure you want to delete this brand?")) return;
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
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}

          {brands.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl">
              <p className="text-sm text-stone-500 mb-2">No brands configured</p>
              <Button onClick={() => setIsCreatingBrand(true)} variant="outline" size="sm">
                Create your first brand
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const VoiceTab = (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Tabs
        value={activeVoiceTab}
        onValueChange={(v) => {
          setActiveVoiceTab(v as any)
          if (v === "existing") {
            setEditingVoice(null)
            setCustomStyleName("")
            setCustomStyleJson(JSON.stringify(STYLE_PRESETS["linkedin-influencer"], null, 2))
            setCreationMethod("preset")
          }
        }}
        className="w-full"
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="text-xs font-medium text-stone-500 uppercase tracking-wider pl-1">
            Content Voices
          </div>
          <TabsList className="bg-stone-100 dark:bg-stone-900 p-1 h-9 rounded-lg">
            <TabsTrigger
              value="existing"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:text-stone-900 dark:data-[state=active]:text-white text-stone-500 text-xs px-3"
            >
              Select Voice
            </TabsTrigger>
            <TabsTrigger
              value="new"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:text-stone-900 dark:data-[state=active]:text-white text-stone-500 text-xs px-3"
            >
              {editingVoice ? "Edit Voice" : "Create New"}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="existing" className="mt-0">
          <div className="grid sm:grid-cols-1 gap-3">
            {voices.map((v) => {
              const isSelected = defaultVoiceId === v.id;
              return (
                <div
                  key={v.id}
                  className={`
                        w-full text-left p-4 rounded-xl border transition-all duration-200
                        group flex items-center justify-between relative
                        ${isSelected
                      ? 'bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-600 ring-1 ring-stone-300 dark:ring-stone-600'
                      : 'bg-white dark:bg-stone-950/50 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700'
                    }
                    `}
                >
                  <div className="flex items-center gap-4">
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
                      className={`
                                w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer
                                ${isSelected
                          ? 'bg-stone-900 dark:bg-stone-100 border-stone-900 dark:border-stone-100 text-white dark:text-stone-900'
                          : 'border-stone-300 dark:border-stone-700 text-transparent hover:border-stone-400'
                        }
                            `}
                    >
                      <Check className="w-3 h-3" />
                    </button>

                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>
                        {v.name}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        JSON Style DNA
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200" onClick={() => {
                      setEditingVoice(v)
                      setCustomStyleName(v.name)
                      setCustomStyleJson(JSON.stringify(v.style_dna, null, 2))
                      setActiveVoiceTab("new")
                    }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-red-600 dark:hover:text-red-400" onClick={async () => {
                      if (!confirm("Delete this voice?")) return;
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
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {voices.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl">
                <p className="text-sm text-stone-500">No voices configured.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="new" className="space-y-6 mt-0">
          <div className="p-4 sm:p-6 border border-stone-200 dark:border-stone-800 rounded-xl bg-white dark:bg-stone-900/50 space-y-6">
            {!editingVoice && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-stone-900 dark:text-white block">Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setCreationMethod("preset")}
                    className={`p-3 rounded-lg border text-sm text-left transition-all ${creationMethod === 'preset' ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800' : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                  >
                    <span className="font-semibold block mb-0.5">Use Preset</span>
                    <span className="text-xs text-stone-500">Start from a template</span>
                  </button>
                  <button
                    onClick={() => setCreationMethod("mimic")}
                    className={`p-3 rounded-lg border text-sm text-left transition-all ${creationMethod === 'mimic' ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800' : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                  >
                    <span className="font-semibold block mb-0.5">Mimic URL</span>
                    <span className="text-xs text-stone-500">Analyze an existing blog</span>
                  </button>
                </div>
              </div>
            )}

            {!editingVoice && creationMethod === 'preset' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-900 dark:text-white">Choose a Preset</label>
                <div className="relative">
                  <select
                    value={presetKey}
                    onChange={e => setPresetKey(e.target.value)}
                    className="w-full appearance-none bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-stone-400"
                  >
                    {Object.keys(STYLE_PRESETS).map(key => (
                      <option key={key} value={key}>{key.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-stone-400 pointer-events-none" />
                </div>
              </div>
            )}

            {!editingVoice && creationMethod === 'mimic' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-900 dark:text-white">Enter URL to Mimic</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      value={mimicUrl}
                      onChange={e => setMimicUrl(e.target.value)}
                      placeholder="https://example.com/blog/article"
                      className="w-full bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-stone-400 transition-all placeholder:text-stone-400"
                    />
                  </div>
                  <button
                    onClick={analyzeUrl}
                    disabled={isAnalyzing || !mimicUrl}
                    className="bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium disabled:opacity-50 w-full sm:w-auto"
                  >
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mx-auto sm:mx-0" /> : "Analyze"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-900 dark:text-white">{editingVoice ? "Voice Name" : "New Voice Name"}</label>
              <input
                value={customStyleName}
                onChange={e => setCustomStyleName(e.target.value)}
                placeholder="e.g. Technical SEO Expert"
                className="w-full bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-stone-400 transition-all placeholder:text-stone-400 shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-stone-900 dark:text-white">Style DNA (JSON)</label>
                <span className="text-xs text-stone-400">Advanced Configuration</span>
              </div>
              <Textarea
                value={customStyleJson}
                onChange={e => setCustomStyleJson(e.target.value)}
                className="h-64 font-mono text-xs bg-stone-50 dark:bg-stone-950/50 border-stone-200 dark:border-stone-800 focus:ring-stone-400"
              />
            </div>

            <div className="flex gap-3 pt-2">
              {editingVoice && (
                <button
                  onClick={() => {
                    setEditingVoice(null)
                    setActiveVoiceTab("existing")
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={saveNewStyle}
                disabled={savingStyle}
                className={`
                        flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold text-white transition-all
                        bg-gradient-to-b from-stone-800 to-stone-950 hover:from-stone-700 hover:to-stone-900
                        dark:from-stone-200 dark:to-stone-400 dark:text-stone-900 dark:hover:from-white dark:hover:to-stone-200
                        shadow-sm disabled:opacity-70 disabled:cursor-not-allowed
                    `}
              >
                {savingStyle ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{editingVoice ? "Update Voice" : "Save Voice"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )

  return (
    <div className="w-full min-h-screen font-sans bg-stone-50/30 dark:bg-black/20 rounded-t-xl">
      <GlobalCard className="w-full shadow-sm rounded-xl overflow-hidden bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-stone-100 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
              <Settings2 className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                Settings
              </h1>
              <p className="text-xs text-stone-500 font-medium hidden sm:block">
                Manage your brands and writing voices
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          <Tabs defaultValue="brand" className="w-full">
            <TabsList className="bg-stone-100/50 dark:bg-stone-900/50 p-1 mb-6 h-auto w-full md:w-auto rounded-xl border border-stone-200/50 dark:border-stone-800 flex flex-nowrap overflow-x-auto">
              <TabsTrigger
                value="brand"
                className="flex-1 md:flex-none px-4 md:px-6 h-9 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:shadow-sm data-[state=active]:text-stone-900 dark:data-[state=active]:text-white text-stone-500 font-medium text-sm transition-all whitespace-nowrap"
              >
                <Globe className="w-4 h-4 mr-2" />
                Brand Settings
              </TabsTrigger>
              <TabsTrigger
                value="voice"
                className="flex-1 md:flex-none px-4 md:px-6 h-9 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:shadow-sm data-[state=active]:text-stone-900 dark:data-[state=active]:text-white text-stone-500 font-medium text-sm transition-all whitespace-nowrap"
              >
                <PenTool className="w-4 h-4 mr-2" />
                Voice & Tone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brand" className="mt-0 focus-visible:outline-none">
              {BrandTab}
            </TabsContent>
            <TabsContent value="voice" className="mt-0 focus-visible:outline-none">
              {VoiceTab}
            </TabsContent>
          </Tabs>
        </div>
      </GlobalCard>
    </div>
  )
}
