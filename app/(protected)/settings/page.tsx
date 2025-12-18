"use client"

import { useEffect, useState } from "react"
import { getUserBrandStatus, deleteBrandAction } from "@/actions/brand"
import { getUserDefaults, setDefaultBrand } from "@/actions/preferences"
import { createClient } from "@/utils/supabase/client"
import { Check, Globe, Trash2, Plus, Edit, Settings2, Loader2, Link2, RefreshCcw, ExternalLink } from "lucide-react"
import BrandOnboarding from "@/app/(protected)/blog-writer/BrandOnboarding"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BrandDetails } from "@/lib/schemas/brand"
import { GlobalCard } from "@/components/ui/global-card"

type BrandInfo = { id: string; website_url: string; created_at: string; brand_data: BrandDetails }

export default function SettingsPage() {
  const supabase = createClient()

  const [brands, setBrands] = useState<BrandInfo[]>([])
  const [defaultBrandId, setDefaultBrandId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [brandLimit, setBrandLimit] = useState(0)
  const [brandCount, setBrandCount] = useState(0)
  const [isCreatingBrand, setIsCreatingBrand] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandInfo | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  // Dark mode detection
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
        const [status, defaults] = await Promise.all([
          getUserBrandStatus(),
          getUserDefaults(),
        ])
        // @ts-ignore
        setBrands(status.brands)
        // @ts-ignore
        setBrandLimit(status.limit)
        // @ts-ignore
        setBrandCount(status.count)
        setDefaultBrandId((defaults as any).default_brand_id)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [supabase])

  const refreshBrands = async () => {
    const status = await getUserBrandStatus()
    // @ts-ignore
    setBrands(status.brands)
    // @ts-ignore
    setBrandLimit(status.limit)
    // @ts-ignore
    setBrandCount(status.count)
  }

  const handleSyncLinks = async (brandId: string, websiteUrl: string) => {
    setSyncingId(brandId)
    try {
      // Clean URL and assume /sitemap.xml
      let sitemapUrl = websiteUrl.endsWith('/') ? `${websiteUrl}sitemap.xml` : `${websiteUrl}/sitemap.xml`

      const res = await fetch('/api/content-plan/sync-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitemapUrl })
      })

      if (!res.ok) throw new Error("Failed to start sync")

      toast.success("Sync started! This may take a few minutes for deep indexing.")
    } catch (error: any) {
      toast.error(error.message || "Failed to sync links")
    } finally {
      setSyncingId(null)
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
                Manage your brands
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {/* Brand Settings */}
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
              <div className="grid sm:grid-cols-1 gap-4">
                {brands.map((b) => {
                  const isSelected = defaultBrandId === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`
                        w-full rounded-xl border transition-all duration-200 overflow-hidden
                        ${isSelected
                          ? 'bg-stone-50 dark:bg-stone-800/30 border-stone-300 dark:border-stone-600 ring-1 ring-stone-300 dark:ring-stone-600 shadow-sm'
                          : 'bg-white dark:bg-stone-950/50 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between p-4 group">
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
                            <span className={`text-sm font-bold truncate ${isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>
                              {b.brand_data?.product_name || b.website_url}
                            </span>
                            <span className="text-[10px] text-stone-400 dark:text-stone-500 truncate flex items-center gap-1">
                              <Globe className="w-2.5 h-2.5" />
                              {b.website_url}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
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

                      {/* Internal Linking Sync Section */}
                      <div className="px-4 pb-4">
                        <div className="p-3 bg-white dark:bg-stone-900 rounded-lg border border-stone-100 dark:border-stone-800 flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-stone-50 dark:bg-stone-800 rounded-md border border-stone-100 dark:border-stone-700">
                              <Link2 className="w-3.5 h-3.5 text-stone-500" />
                            </div>
                            <div>
                              <div className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Internal Linking</div>
                              <div className="text-[11px] text-stone-600 dark:text-stone-400 font-medium leading-tight">
                                Index your site for semantic link suggestions
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-[10px] gap-1.5 px-3 font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 border-none"
                            onClick={() => handleSyncLinks(b.id, b.website_url)}
                            disabled={syncingId === b.id}
                          >
                            {syncingId === b.id ? (
                              <RefreshCcw className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCcw className="w-3 h-3" />
                            )}
                            {syncingId === b.id ? 'SYNCING...' : 'SYNC SITE'}
                          </Button>
                        </div>
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
        </div>
      </GlobalCard>
    </div>
  )
}
