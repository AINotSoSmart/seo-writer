"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getUserBrandStatus } from "@/actions/brand"
import { getUserDefaults, setDefaultBrand } from "@/actions/preferences"
import { createClient } from "@/utils/supabase/client"
import { Check, Globe, Plus, Edit, Settings2, Loader2, ExternalLink, AlertCircle, FileText, Search } from "lucide-react"
import BrandOnboarding from "@/components/brand-onboarding"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BrandDetails } from "@/lib/schemas/brand"
import { GlobalCard } from "@/components/ui/global-card"
import { CustomSpinner } from "@/components/CustomSpinner"
import { ARTICLE_LENGTHS } from "@/lib/prompts/article-length"

type BrandInfo = { id: string; website_url: string; created_at: string; brand_data: BrandDetails }


export default function SettingsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [brands, setBrands] = useState<BrandInfo[]>([])
  const [defaultBrandId, setDefaultBrandId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
        // @ts-ignore
        setBrands(status.brands)
        // @ts-ignore
        setBrandLimit(status.limit)
        // @ts-ignore
        setBrandCount(status.count)
        setDefaultBrandId((defaults as any).default_brand_id)

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
    // @ts-ignore
    setBrands(status.brands)
    // @ts-ignore
    setBrandLimit(status.limit)
    // @ts-ignore
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
    } catch (err: any) {
      toast.error('Failed to update: ' + (err.message || 'Unknown error'))
    }
  }



  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-stone-500">
          <CustomSpinner className="w-10 h-10" />
          <span className="text-sm font-medium">Loading settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen font-sans bg-stone-50/30 rounded-t-xl">
      <GlobalCard className="w-full rounded-lg overflow-hidden bg-white  border border-stone-100 ">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-stone-100  bg-white/50 /50 backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-100  flex items-center justify-center text-stone-500">
              <Settings2 className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-stone-900  tracking-tight">
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


            {isCreatingBrand || editingBrand ? (
              <div className="p-4 border border-stone-200  rounded-xl bg-stone-50/50 /50">
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
                          ? 'bg-stone-50 /30 border-stone-300 ring-1 ring-stone-300'
                          : 'bg-white border-stone-200  hover:border-stone-300'
                        }
                      `}
                    >
                      {/* Brand Configuration Panels */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Panel: Brand Identity */}
                        <div className="p-4 bg-stone-50 rounded-lg border border-stone-200 md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="w-8 h-8 flex-shrink-0 rounded-md border border-stone-200 overflow-hidden bg-white shadow-sm">
                              <img 
                                src={`https://www.google.com/s2/favicons?domain=${b.website_url}&sz=128`} 
                                alt="Favicon" 
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.src = "https://www.google.com/s2/favicons?domain=example.com&sz=128" }}
                              />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-stone-900 uppercase tracking-wider mb-0.5">{b.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>
                              <div className="text-xs text-stone-500 font-medium">
                                Update your brand's audience, mission, core features, and tone of voice.
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

                        {/* Panel: Content Strategy */}
                        <div className="p-4 bg-white rounded-lg border border-stone-100 flex flex-col hover:border-stone-200 transition-colors">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-md">
                              <FileText className="w-4 h-4" />
                            </div>
                            <h3 className="text-[10px] font-bold text-stone-900 uppercase tracking-wider">Content Strategy</h3>
                          </div>
                          <div className="flex-1 select-none">
                            <label className="block text-xs font-medium text-stone-500 mb-1.5">Default Article Length</label>
                            <select
                              className="w-full h-9 rounded-md border px-3 text-xs bg-white border-stone-200 text-stone-900 focus:ring-1 focus:ring-stone-500 focus:border-stone-500 outline-none transition-all"
                              value={b.brand_data?.article_length || 'long'}
                              onChange={e => handleUpdateSearchPrefs(b.id, 'article_length', e.target.value)}
                            >
                              {ARTICLE_LENGTHS.map(len => (
                                <option key={len.value} value={len.value}>{len.label} ({len.wordRange} words)</option>
                              ))}
                            </select>
                            <p className="text-[10px] text-stone-400 mt-2">Applied to all new articles by default.</p>
                          </div>
                        </div>

                        {/* Panel: Research Context */}
                        <div className="p-4 bg-white rounded-xl border border-stone-100 flex flex-col hover:border-stone-200 transition-colors">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-md">
                              <Search className="w-4 h-4" />
                            </div>
                            <h3 className="text-[10px] font-bold text-stone-900 uppercase tracking-wider">Research Context</h3>
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
      </GlobalCard >
    </div >
  )
}
