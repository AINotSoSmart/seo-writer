"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { getUserBrandStatus } from "@/actions/brand"
import { getUserDefaults } from "@/actions/preferences"
import { STYLE_PRESETS } from "@/lib/presets"
import BrandOnboarding from "./BrandOnboarding"
import { BlogWriterIsland } from "@/components/blog-writer-island"
import { ArticleType } from "@/lib/prompts/article-types"

type BrandVoice = { id: string; name: string }
type BrandInfo = { id: string; website_url: string; created_at: string }
type ArticleRow = {
  id: string
  status: string
  raw_content: string | null
  final_html: string | null
  current_step_index: number | null
}

export default function BlogWriterPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [voices, setVoices] = useState<BrandVoice[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("")
  const [keyword, setKeyword] = useState<string>("")
  const [article, setArticle] = useState<ArticleRow | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")

  // Brand Onboarding State
  const [brandId, setBrandId] = useState<string | null>(null)
  const [brands, setBrands] = useState<BrandInfo[]>([])
  const [brandLimit, setBrandLimit] = useState(0)
  const [brandCount, setBrandCount] = useState(0)
  const [isCreatingBrand, setIsCreatingBrand] = useState(false)
  const [loadingBrands, setLoadingBrands] = useState(true)

  // New state for presets & mimic
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing")
  const [creationMethod, setCreationMethod] = useState<"preset" | "mimic">("preset")

  // Title Generation State
  const [titles, setTitles] = useState<string[]>([])
  const [selectedTitle, setSelectedTitle] = useState<string>("")
  const [step, setStep] = useState<"input" | "selection">("input")
  const [generatingTitles, setGeneratingTitles] = useState<boolean>(false)

  // Article Type State
  const [articleType, setArticleType] = useState<ArticleType>("informational")

  const [presetKey, setPresetKey] = useState<string>("linkedin-influencer")
  const [mimicUrl, setMimicUrl] = useState<string>("")
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)

  const [customStyleName, setCustomStyleName] = useState<string>("")
  const [customStyleJson, setCustomStyleJson] = useState<string>(
    JSON.stringify(STYLE_PRESETS["linkedin-influencer"], null, 2)
  )
  const [savingStyle, setSavingStyle] = useState<boolean>(false)

  const loadBrands = async () => {
    setLoadingBrands(true)
    try {
      const status = await getUserBrandStatus()
      const defaults = await getUserDefaults()
      // @ts-ignore
      setBrands(status.brands)
      setBrandLimit(status.limit)
      setBrandCount(status.count)
      const defBrand = (defaults as any).default_brand_id
      const defVoice = (defaults as any).default_voice_id
      if (defBrand) setBrandId(defBrand)
      if (defVoice) setSelectedVoiceId(defVoice)
      if (!defBrand && status.brands.length > 0 && !brandId) {
        setBrandId(status.brands[0].id)
      }
    } catch (e) {
      console.error("Failed to load brands", e)
    } finally {
      setLoadingBrands(false)
    }
  }

  useEffect(() => {
    loadBrands()
  }, [])

  useEffect(() => {
    if (!loadingBrands && brandCount === 0) {
      router.replace('/onboarding')
    }
  }, [loadingBrands, brandCount, router])

  useEffect(() => {
    let mounted = true
    const loadVoices = async () => {
      const { data } = await supabase
        .from("brand_voices")
        .select("id,name")
        .order("created_at", { ascending: false })
      if (mounted && data) setVoices(data as BrandVoice[])
      if (mounted && data && data.length > 0) setSelectedVoiceId((data[0] as BrandVoice).id)
    }
    loadVoices()
    return () => {
      mounted = false
    }
  }, [supabase])

  useEffect(() => {
    if (!article?.id) return
    const channel = supabase
      .channel(`articles:${article.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "articles", filter: `id=eq.${article.id}` },
        payload => {
          const row = payload.new as ArticleRow
          setArticle(prev => ({ ...(prev || row), ...row }))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [article?.id, supabase])

  // Update JSON editor when preset changes (only if in preset mode)
  useEffect(() => {
    if (creationMethod === "preset" && presetKey && STYLE_PRESETS[presetKey]) {
      setCustomStyleJson(JSON.stringify(STYLE_PRESETS[presetKey], null, 2))
    }
  }, [presetKey, creationMethod])

  const analyzeUrl = async () => {
    if (!mimicUrl) {
      setError("Please enter a valid URL")
      return
    }
    setIsAnalyzing(true)
    setError("")
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(msg)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveNewStyle = async () => {
    if (!customStyleName || !customStyleJson) {
      setError("Please provide a name and style JSON")
      return
    }
    setSavingStyle(true)
    setError("")
    try {
      let parsed
      try {
        parsed = JSON.parse(customStyleJson)
      } catch {
        throw new Error("Invalid JSON format")
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error("User not authenticated")

      const { data, error } = await supabase
        .from("brand_voices")
        .insert({
          name: customStyleName,
          style_dna: parsed,
          user_id: user.id,
          is_default: false,
        })
        .select()
        .single()

      if (error) throw error

      setVoices(prev => [data as BrandVoice, ...prev])
      setSelectedVoiceId(data.id)
      setActiveTab("existing")
      setCustomStyleName("")
      setMimicUrl("")
      setCreationMethod("preset")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(msg)
    } finally {
      setSavingStyle(false)
    }
  }

  const generateTitles = async () => {
    setError("")
    if (!brandId) {
      setError("Brand details missing. Please complete the brand analysis step.")
      return
    }
    if (!selectedVoiceId || !keyword) {
      setError("Please select a voice and enter a keyword")
      return
    }
    setGeneratingTitles(true)
    try {
      const res = await fetch("/api/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          voiceId: selectedVoiceId,
          brandId,
          articleType
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to generate titles")

      setTitles(json.titles)
      setStep("selection")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(msg)
    } finally {
      setGeneratingTitles(false)
    }
  }

  const startGeneration = async () => {
    setError("")
    // Require brandId now
    if (!brandId) {
      setError("Brand details missing. Please complete the brand analysis step.")
      return
    }
    if (!selectedVoiceId || !keyword) {
      setError("Please select a voice and enter a keyword")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          voiceId: selectedVoiceId,
          brandId, // Pass brandId to generation
          title: selectedTitle, // Pass selected title
          articleType // Pass article type
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to start generation")

      // Redirect to articles list to show progress
      router.push("/articles")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Minimal writer UI

  if (loadingBrands || brandCount === 0) {
    return null
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <BlogWriterIsland
        keyword={keyword}
        onKeywordChange={setKeyword}
        articleType={articleType}
        onArticleTypeChange={setArticleType}
        onSubmit={generateTitles}
        isGenerating={generatingTitles}
        titles={titles}
        selectedTitle={selectedTitle}
        onSelectTitle={setSelectedTitle}
        onGenerateArticle={startGeneration}
        isLoading={loading}
        onBack={() => {
          setStep("input")
          setTitles([])
          setSelectedTitle("")
        }}
        disabled={!brandId || !selectedVoiceId}
      />

      {/* Error display */}
      {error && (
        <div className="mt-6 max-w-md w-full">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-100 dark:border-red-800">
            {error}
          </div>
        </div>
      )}
    </div>
  )
}

