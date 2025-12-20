"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { getUserBrandStatus } from "@/actions/brand"
import { getUserDefaults } from "@/actions/preferences"
import { BlogWriterIsland } from "@/components/blog-writer-island"
import { ArticleType } from "@/lib/prompts/article-types"

type BrandInfo = { id: string; website_url: string; created_at: string }

export default function BlogWriterPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [keyword, setKeyword] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")

  // Brand State
  const [brandId, setBrandId] = useState<string | null>(null)
  const [brands, setBrands] = useState<BrandInfo[]>([])
  const [brandCount, setBrandCount] = useState(0)
  const [loadingBrands, setLoadingBrands] = useState(true)

  // Title Generation State
  const [titles, setTitles] = useState<string[]>([])
  const [selectedTitle, setSelectedTitle] = useState<string>("")
  const [step, setStep] = useState<"input" | "selection">("input")
  const [generatingTitles, setGeneratingTitles] = useState<boolean>(false)

  // Article Type State
  const [articleType, setArticleType] = useState<ArticleType>("informational")

  const loadBrands = async () => {
    setLoadingBrands(true)
    try {
      const status = await getUserBrandStatus()
      const defaults = await getUserDefaults()
      // @ts-ignore
      setBrands(status.brands)
      setBrandCount(status.count)
      const defBrand = (defaults as any).default_brand_id
      if (defBrand) setBrandId(defBrand)
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

  const generateTitles = async () => {
    setError("")
    if (!brandId) {
      setError("Brand details missing. Please complete the brand analysis step.")
      return
    }
    if (!keyword) {
      setError("Please enter a keyword")
      return
    }
    setGeneratingTitles(true)
    try {
      const res = await fetch("/api/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
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
    if (!brandId) {
      setError("Brand details missing. Please complete the brand analysis step.")
      return
    }
    if (!keyword) {
      setError("Please enter a keyword")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          brandId,
          title: selectedTitle,
          articleType
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
        disabled={!brandId}
      />

      {/* Error display */}
      {error && (
        <div className="mt-6 max-w-md w-full">
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        </div>
      )}
    </div>
  )
}
