"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { GlobalCard } from "@/components/ui/global-card"
import { Button } from "@/components/ui/button"
import { FileText, FilePenLine, Plus, Loader2, ExternalLink, Send } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ArticleRow = {
  id: string
  keyword: string
  status: string
  created_at: string
  current_step_index: number | null
  final_html: string | null
  wordpress_post_url: string | null
  webflow_item_id: string | null
  shopify_article_id: string | null
  published_at: string | null
}

type Connection = {
  id: string
  site_name: string | null
  is_default: boolean
  platform: 'wordpress' | 'webflow' | 'shopify'
}

export default function ArticlesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [connections, setConnections] = useState<Connection[]>([])
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
  const [pendingPublishId, setPendingPublishId] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<'wordpress' | 'webflow' | 'shopify'>('wordpress')

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      // Load articles
      const { data: articlesData } = await supabase
        .from("articles")
        .select("id,keyword,status,created_at,current_step_index,final_html,wordpress_post_url,webflow_item_id,shopify_article_id,published_at")
        .order("created_at", { ascending: false })

      if (mounted && articlesData) {
        setArticles(articlesData as ArticleRow[])
      }

      // Load WordPress connections
      const { data: wpData } = await supabase
        .from("wordpress_connections")
        .select("id,site_name,is_default")
        .order("is_default", { ascending: false })

      // Load Webflow connections
      const { data: wfData } = await supabase
        .from("webflow_connections")
        .select("id,site_name,is_default")
        .order("is_default", { ascending: false })

      // Load Shopify connections
      const { data: spData } = await supabase
        .from("shopify_connections")
        .select("id,store_name,is_default")
        .order("is_default", { ascending: false })

      if (mounted) {
        const allConnections: Connection[] = [
          ...(wpData || []).map(c => ({ ...c, platform: 'wordpress' as const })),
          ...(wfData || []).map(c => ({ ...c, platform: 'webflow' as const })),
          ...(spData || []).map(c => ({ id: c.id, site_name: c.store_name, is_default: c.is_default, platform: 'shopify' as const })),
        ]
        setConnections(allConnections)

        // Set default platform based on available connections
        if (allConnections.length > 0) {
          const defaultConn = allConnections.find(c => c.is_default) || allConnections[0]
          setSelectedPlatform(defaultConn.platform)
        }
      }

      setLoading(false)
    }

    loadData()

    // Subscribe to all changes in articles table
    const channel = supabase
      .channel("articles_list_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "articles" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setArticles((prev) => [payload.new as ArticleRow, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setArticles((prev) =>
              prev.map((a) => (a.id === payload.new.id ? { ...a, ...payload.new } : a))
            )
          } else if (payload.eventType === "DELETE") {
            setArticles((prev) => prev.filter((a) => a.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handlePublish = async (articleId: string, platform: 'wordpress' | 'webflow' | 'shopify') => {
    const platformConnections = connections.filter(c => c.platform === platform)
    const defaultConnection = platformConnections.find(c => c.is_default) || platformConnections[0]

    const platformNames = { wordpress: 'WordPress', webflow: 'Webflow', shopify: 'Shopify' }

    if (!defaultConnection) {
      toast.error(`No ${platformNames[platform]} site connected`, {
        action: {
          label: "Connect",
          onClick: () => window.location.href = "/integrations"
        }
      })
      return
    }

    setPublishingIds(prev => new Set(prev).add(articleId))

    try {
      const response = await fetch(`/api/${platform}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          connectionId: defaultConnection.id,
          publishStatus: "draft"
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to publish")
      }

      toast.success(`Published to ${platformNames[platform]} as draft!`, {
        action: result.postUrl || result.articleUrl ? {
          label: "View",
          onClick: () => window.open(result.postUrl || result.articleUrl, "_blank")
        } : undefined
      })

      // Reload articles to get updated publish status
      const { data: updatedArticle } = await supabase
        .from("articles")
        .select("wordpress_post_url,webflow_item_id,shopify_article_id,published_at")
        .eq("id", articleId)
        .single()

      if (updatedArticle) {
        setArticles(prev => prev.map(a =>
          a.id === articleId
            ? { ...a, ...updatedArticle }
            : a
        ))
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to publish")
    } finally {
      setPublishingIds(prev => {
        const next = new Set(prev)
        next.delete(articleId)
        return next
      })
    }
  }

  const getPublishedPlatforms = (article: ArticleRow) => {
    const platforms: string[] = []
    if (article.wordpress_post_url) platforms.push('WP')
    if (article.webflow_item_id) platforms.push('WF')
    if (article.shopify_article_id) platforms.push('SP')
    return platforms
  }

  const wpConnections = connections.filter(c => c.platform === 'wordpress')
  const wfConnections = connections.filter(c => c.platform === 'webflow')
  const spConnections = connections.filter(c => c.platform === 'shopify')
  const hasAnyConnection = connections.length > 0

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">My Articles</h1>
        <div className="text-center py-12">Loading articles...</div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen font-sans">
      <GlobalCard className="w-full shadow-sm rounded-xl">
        {/* Integrated Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/50 bg-stone-50/40 backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-stone-900 tracking-tight">
              My Articles
            </h1>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-200/50 text-[10px] font-medium text-stone-600 px-1.5">
              {articles.length}
            </span>
          </div>

          <Link
            href="/blog-writer"
            className="
              flex h-8 items-center gap-1.5 overflow-hidden rounded-lg px-3 text-xs font-semibold text-white transition-all
              active:scale-[0.98] cursor-pointer
              bg-stone-900 hover:bg-stone-800
              shadow-sm border border-stone-800
            "
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Create New Article</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>

        <div className="overflow-x-auto relative">
          {articles.length === 0 ? (
            <div className="text-center py-24 px-4">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-stone-900 mb-2">No articles yet</h3>
              <p className="text-stone-500 mb-6">Start generating premium content for your blog today.</p>
              <Link
                href="/blog-writer"
                className="text-stone-900 font-medium hover:underline decoration-stone-300 underline-offset-4"
              >
                Create your first article &rarr;
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-stone-100 text-black border-b border-stone-100">
                <tr>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Keyword</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Progress</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Date</th>
                  <th className="
                    px-6 py-4 text-right font-medium sticky right-0 z-10
                    bg-stone-100 backdrop-blur-sm
                    border-l border-stone-100
                  ">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {articles.map((article) => {
                  const publishedPlatforms = getPublishedPlatforms(article)

                  return (
                    <tr key={article.id} className="group hover:bg-stone-50/50 transition-colors">
                      <td className="px-6 py-4 text-stone-900 whitespace-nowrap">
                        {article.keyword}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={article.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {article.status === 'completed' ? (
                          <span className="text-green-600 font-medium flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Done
                          </span>
                        ) : article.status === 'failed' ? (
                          <span className="text-red-600 font-medium">Failed</span>
                        ) : (
                          <span className="text-blue-600">
                            Step {article.current_step_index ?? 0}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-stone-500 tabular-nums whitespace-nowrap">
                        {format(new Date(article.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="
                         px-6 py-4 text-right sticky right-0 z-10
                         bg-white
                         group-hover:bg-stone-50 transition-colors
                         border-l border-stone-100
                      ">
                        <div className="flex items-center justify-end gap-2">
                          {article.status === 'completed' && article.final_html && (
                            <>
                              {/* Published badges */}
                              {publishedPlatforms.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  {publishedPlatforms.map(p => {
                                    const platformInfo = {
                                      WP: { src: '/brands/wordpress.svg', alt: 'WordPress', title: 'Published to WordPress' },
                                      WF: { src: '/brands/webflow.svg', alt: 'Webflow', title: 'Published to Webflow' },
                                      SP: { src: '/brands/shopify.svg', alt: 'Shopify', title: 'Published to Shopify' },
                                    }[p] || { src: '', alt: p, title: p }

                                    return (
                                      <div
                                        key={p}
                                        className="w-5 h-5 rounded bg-green-100 p-0.5 flex items-center justify-center"
                                        title={platformInfo.title}
                                      >
                                        <Image
                                          src={platformInfo.src}
                                          alt={platformInfo.alt}
                                          width={14}
                                          height={14}
                                          className="opacity-80"
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Publish button - always show if any connection exists */}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={publishingIds.has(article.id) || !hasAnyConnection}
                                onClick={() => setPendingPublishId(article.id)}
                                className="h-7 px-2 text-xs gap-1"
                              >
                                {publishingIds.has(article.id) ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                Publish
                              </Button>

                              <Link
                                href={`/articles/${article.id}`}
                                className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-900 font-medium transition-colors"
                              >
                                Edit
                                <FilePenLine className="w-3 h-3" />
                              </Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </GlobalCard>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={!!pendingPublishId} onOpenChange={(open) => !open && setPendingPublishId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Article</AlertDialogTitle>
            <AlertDialogDescription>
              Choose where to publish this article. It will be created as a <strong>draft</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Platform selector */}
          <div className="flex gap-2 my-4">
            {wpConnections.length > 0 && (
              <button
                onClick={() => setSelectedPlatform('wordpress')}
                className={`cursor-pointer flex-1 p-3 rounded-lg border-2 transition-colors ${selectedPlatform === 'wordpress'
                  ? 'border-[#21759b] bg-[#21759b]/10'
                  : 'border-stone-200'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center">
                    <Image src="/brands/wordpress.svg" alt="WordPress" width={24} height={24} />
                  </div>
                  <span className="font-medium text-sm">WordPress</span>
                </div>
              </button>
            )}
            {wfConnections.length > 0 && (
              <button
                onClick={() => setSelectedPlatform('webflow')}
                className={`cursor-pointer flex-1 p-3 rounded-lg border-2 transition-colors ${selectedPlatform === 'webflow'
                  ? 'border-[#4353ff] bg-[#4353ff]/10'
                  : 'border-stone-200'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center">
                    <Image src="/brands/webflow.svg" alt="Webflow" width={24} height={24} />
                  </div>
                  <span className="font-medium text-sm">Webflow</span>
                </div>
              </button>
            )}
            {spConnections.length > 0 && (
              <button
                onClick={() => setSelectedPlatform('shopify')}
                className={`cursor-pointer flex-1 p-3 rounded-lg border-2 transition-colors ${selectedPlatform === 'shopify'
                  ? 'border-[#96bf48] bg-[#96bf48]/10'
                  : 'border-stone-200'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center">
                    <Image src="/brands/shopify.svg" alt="Shopify" width={24} height={24} />
                  </div>
                  <span className="font-medium text-sm">Shopify</span>
                </div>
              </button>
            )}
          </div>

          {!hasAnyConnection && (
            <p className="text-sm text-amber-600">
              No CMS connected. <Link href="/integrations" className="underline">Connect now</Link>
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!hasAnyConnection}
              onClick={() => {
                if (pendingPublishId) {
                  handlePublish(pendingPublishId, selectedPlatform)
                  setPendingPublishId(null)
                }
              }}
            >
              Publish as Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-green-700 border border-green-200">
        Completed
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-red-700 border border-red-200">
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-amber-700 border border-amber-200 animate-pulse">
      {status === 'queued' ? 'Queued' : 'Processing...'}
    </span>
  )
}
