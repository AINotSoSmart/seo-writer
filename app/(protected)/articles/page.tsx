"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/utils/supabase/client"
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
  published_at: string | null
}

type WordPressConnection = {
  id: string
  site_name: string | null
  site_url: string
  is_default: boolean
}

export default function ArticlesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [connections, setConnections] = useState<WordPressConnection[]>([])
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
  const [pendingPublishId, setPendingPublishId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      // Load articles
      const { data: articlesData } = await supabase
        .from("articles")
        .select("id,keyword,status,created_at,current_step_index,final_html,wordpress_post_url,published_at")
        .order("created_at", { ascending: false })

      if (mounted && articlesData) {
        setArticles(articlesData as ArticleRow[])
      }

      // Load WordPress connections
      const { data: connectionsData } = await supabase
        .from("wordpress_connections")
        .select("id,site_name,site_url,is_default")
        .order("is_default", { ascending: false })

      if (mounted && connectionsData) {
        setConnections(connectionsData as WordPressConnection[])
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

  const handlePublish = async (articleId: string) => {
    const defaultConnection = connections.find(c => c.is_default) || connections[0]

    if (!defaultConnection) {
      toast.error("No WordPress site connected", {
        action: {
          label: "Connect",
          onClick: () => window.location.href = "/integrations"
        }
      })
      return
    }

    setPublishingIds(prev => new Set(prev).add(articleId))

    try {
      const response = await fetch("/api/wordpress/publish", {
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

      toast.success("Published as draft!", {
        action: {
          label: "View",
          onClick: () => window.open(result.postUrl, "_blank")
        }
      })

      // Update local state
      setArticles(prev => prev.map(a =>
        a.id === articleId
          ? { ...a, wordpress_post_url: result.postUrl, published_at: new Date().toISOString() }
          : a
      ))
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/50 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-900/40 backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">
              My Articles
            </h1>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-200/50 dark:bg-stone-800 text-[10px] font-medium text-stone-600 dark:text-stone-400 px-1.5">
              {articles.length}
            </span>
          </div>

          <Link
            href="/blog-writer"
            className="
              flex h-8 items-center gap-1.5 overflow-hidden rounded-lg px-3 text-xs font-semibold text-white transition-all
              active:scale-[0.98] cursor-pointer
              bg-stone-900 hover:bg-stone-800
              dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100
              shadow-sm border border-stone-800 dark:border-stone-200
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
              <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-stone-900 dark:text-white mb-2">No articles yet</h3>
              <p className="text-stone-500 mb-6">Start generating premium content for your blog today.</p>
              <Link
                href="/blog-writer"
                className="text-stone-900 dark:text-white font-medium hover:underline decoration-stone-300 underline-offset-4"
              >
                Create your first article &rarr;
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-stone-100 dark:bg-stone-800/95 text-black dark:text-white border-b border-stone-100 dark:border-stone-800">
                <tr>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Keyword</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Progress</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Date</th>
                  <th className="
                    px-6 py-4 text-right font-medium sticky right-0 z-10
                    bg-stone-100 dark:bg-stone-800/95 backdrop-blur-sm
                    border-l border-stone-100 dark:border-stone-800
                  ">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {articles.map((article) => (
                  <tr key={article.id} className="group hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
                    <td className="px-6 py-4 text-stone-900 dark:text-white whitespace-nowrap">
                      {article.keyword}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {article.status === 'completed' ? (
                        <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Done
                        </span>
                      ) : article.status === 'failed' ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">Failed</span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400">
                          Step {article.current_step_index ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-stone-500 dark:text-stone-400 tabular-nums whitespace-nowrap">
                      {format(new Date(article.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="
                       px-6 py-4 text-right sticky right-0 z-10
                       bg-white dark:bg-stone-900
                       group-hover:bg-stone-50 dark:group-hover:bg-stone-800
                       transition-colors
                       border-l border-stone-100 dark:border-stone-800
                    ">
                      <div className="flex items-center justify-end gap-2">
                        {article.status === 'completed' && article.final_html && (
                          <>
                            {/* Published Badge or Publish Button */}
                            {article.wordpress_post_url ? (
                              <a
                                href={article.wordpress_post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Published
                              </a>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={publishingIds.has(article.id) || connections.length === 0}
                                onClick={() => setPendingPublishId(article.id)}
                                className="h-7 px-2 text-xs gap-1"
                              >
                                {publishingIds.has(article.id) ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                {connections.length === 0 ? "No WP" : "Publish"}
                              </Button>
                            )}

                            <Link
                              href={`/articles/${article.id}`}
                              className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-900 dark:hover:text-white font-medium transition-colors"
                            >
                              Edit
                              <FilePenLine className="w-3 h-3" />
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </GlobalCard>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={!!pendingPublishId} onOpenChange={(open) => !open && setPendingPublishId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish to WordPress?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a <strong>draft</strong> post on your WordPress site.
              You can review and publish it from WordPress dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPublishId) {
                  handlePublish(pendingPublishId)
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
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50">
        Completed
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 animate-pulse">
      {status === 'queued' ? 'Queued' : 'Processing...'}
    </span>
  )
}
