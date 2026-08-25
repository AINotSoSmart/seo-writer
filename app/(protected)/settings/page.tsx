"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getUserBrandStatus } from "@/actions/brand"
import { getUserDefaults } from "@/actions/preferences"
import { createClient } from "@/utils/supabase/client"
import { Edit, Search, Settings2 } from "lucide-react"
import BrandOnboarding from "@/components/brand-onboarding"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BrandDetails } from "@/lib/schemas/brand"
import { CustomSpinner } from "@/components/CustomSpinner"
import {
  ProductHeader,
  ProductPage,
  ProductPanel,
} from "@/components/product/product-page"

type BrandInfo = { id: string; website_url: string; created_at: string; brand_data: BrandDetails }


export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [brands, setBrands] = useState<BrandInfo[]>([])
  const [defaultBrandId, setDefaultBrandId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [brandLimit, setBrandLimit] = useState(0)
  const [brandCount, setBrandCount] = useState(0)
  const [isCreatingBrand, setIsCreatingBrand] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandInfo | null>(null)



  // Dark mode detection

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [status, defaults] = await Promise.all([
          getUserBrandStatus(),
          getUserDefaults(),
        ])
        setBrands(status.brands as unknown as BrandInfo[])
        setBrandLimit(status.limit)
        setBrandCount(status.count)
        setDefaultBrandId(defaults.default_brand_id)

        // Redirect to onboarding if no brands
        if (!status.brands || (status.brands as BrandInfo[]).length === 0) {
          router.push("/onboarding")
          return
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [supabase, router])

  const refreshBrands = async () => {
    const status = await getUserBrandStatus()
    setBrands(status.brands as unknown as BrandInfo[])
    setBrandLimit(status.limit)
    setBrandCount(status.count)
  }

  const handleUpdateSearchPrefs = async (brandId: string, field: 'search_country' | 'search_topic' | 'article_length', value: string) => {
    const brand = brands.find(b => b.id === brandId)
    if (!brand) return
    const updatedBrandData = { ...brand.brand_data, [field]: value }
    try {
      const { error } = await supabase
        .from('brand_details')
        .update({ brand_data: updatedBrandData })
        .eq('id', brandId)
      if (error) throw error
      // Update local state
      setBrands(prev => prev.map(b => b.id === brandId ? { ...b, brand_data: updatedBrandData } : b))
      toast.success('Search preference updated')
    } catch (err: unknown) {
      toast.error('Failed to update: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }



  if (loading) {
    return (
      <ProductPage width="reading" className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <CustomSpinner className="w-10 h-10" />
          <span className="text-sm font-medium">Loading settings...</span>
        </div>
      </ProductPage>
    )
  }

  return (
    <ProductPage width="reading">
      <ProductHeader
        eyebrow="Measurement workspace"
        icon={Settings2}
        title="Brand settings"
        description="Keep the identity and research context used across visibility measurement, content planning, and article production in one place."
        actions={
          <span className="rounded-full border border-[var(--viz-hairline)] bg-white px-3 py-1.5 text-xs tabular-nums text-[var(--viz-ink-secondary)]">
            {brandCount} of {brandLimit} brands
          </span>
        }
      />

      <ProductPanel className="mt-6">
        <div className="p-4 sm:p-5 md:p-6">
          {/* Brand Settings */}
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">


            {isCreatingBrand || editingBrand ? (
                <div className="rounded-xl border border-[var(--viz-hairline)] bg-[var(--viz-plane)] p-4">
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
                        w-full rounded-[14px] border transition-all duration-200 overflow-hidden
                        ${isSelected
                          ? 'bg-blue-50/30 border-blue-200 ring-1 ring-blue-100'
                          : 'bg-white border-[var(--viz-hairline)] hover:border-[var(--viz-baseline)]'
                        }
                      `}
                    >
                      {/* Brand Configuration Panels */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Panel: Brand Identity */}
                        <div className="flex flex-col gap-4 rounded-xl border border-[var(--viz-hairline)] bg-[var(--viz-plane)] p-4 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="inline-flex size-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-violet-100 text-sm font-bold uppercase text-violet-700">
                              {b.website_url.replace(/^https?:\/\//, "").charAt(0) || "B"}
                            </div>
                            <div>
                              <div className="mb-0.5 break-words text-sm font-semibold text-[var(--viz-ink)] [overflow-wrap:anywhere]">{b.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>
                              <div className="text-xs leading-5 text-[var(--viz-ink-secondary)]">
                                Update your brand&apos;s audience, mission, core features, and tone of voice.
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="default"
                            size="sm"
                            className="h-9 text-xs gap-2 px-4 font-bold w-full sm:w-auto bg-stone-900 text-white hover:bg-stone-800"
                            onClick={() => setEditingBrand(b)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            EDIT BRAND DATA
                          </Button>
                        </div>

                        {/* Panel: Research Context */}
                        <div className="flex flex-col rounded-xl border border-[var(--viz-hairline)] bg-white p-4 transition-colors hover:border-[var(--viz-baseline)]">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-md">
                              <Search className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs font-semibold text-[var(--viz-ink)]">Research context</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3 flex-1 select-none">
                            <div>
                              <label className="block text-xs font-medium text-stone-500 mb-1.5">Target Country</label>
                              <select
                                className="w-full h-9 rounded-md border px-2 text-xs bg-white border-stone-200 text-stone-900 outline-none focus:ring-1 focus:ring-stone-500 focus:border-stone-500 transition-all"
                                value={b.brand_data?.search_country || ''}
                                onChange={e => handleUpdateSearchPrefs(b.id, 'search_country', e.target.value)}
                              >
                                <option value="">Global</option>
                                <option value="australia">Australia</option>
                                <option value="united states">United States</option>
                                <option value="united kingdom">United Kingdom</option>
                                <option value="canada">Canada</option>
                                <option value="india">India</option>
                                <option value="germany">Germany</option>
                                <option value="france">France</option>
                                <option value="japan">Japan</option>
                                <option value="brazil">Brazil</option>
                                <option value="netherlands">Netherlands</option>
                                <option value="singapore">Singapore</option>
                                <option value="new zealand">New Zealand</option>
                                <option value="ireland">Ireland</option>
                                <option value="south africa">South Africa</option>
                                <option value="united arab emirates">UAE</option>
                                <option value="sweden">Sweden</option>
                                <option value="switzerland">Switzerland</option>
                                <option value="italy">Italy</option>
                                <option value="spain">Spain</option>
                                <option value="mexico">Mexico</option>
                                <option value="south korea">South Korea</option>
                                <option value="indonesia">Indonesia</option>
                                <option value="philippines">Philippines</option>
                                <option value="malaysia">Malaysia</option>
                                <option value="thailand">Thailand</option>
                                <option value="poland">Poland</option>
                                <option value="nigeria">Nigeria</option>
                                <option value="pakistan">Pakistan</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-stone-500 mb-1.5">News Source</label>
                              <select
                                className="w-full h-9 rounded-md border px-2 text-xs bg-white border-stone-200 text-stone-900 outline-none focus:ring-1 focus:ring-stone-500 focus:border-stone-500 transition-all"
                                value={b.brand_data?.search_topic || 'general'}
                                onChange={e => handleUpdateSearchPrefs(b.id, 'search_topic', e.target.value)}
                              >
                                <option value="general">General</option>
                                <option value="news">News</option>
                                <option value="finance">Finance</option>
                                <option value="journal">Journal</option>
                              </select>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )
                })}

                {brands.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-stone-200  rounded-xl">
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
      </ProductPanel>
    </ProductPage>
  )
}
