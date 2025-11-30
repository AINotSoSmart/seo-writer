"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"
import { format } from "date-fns"

type ArticleRow = {
  id: string
  keyword: string
  status: string
  created_at: string
  current_step_index: number | null
  final_html: string | null
}

export default function ArticlesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true
    const loadArticles = async () => {
      const { data } = await supabase
        .from("articles")
        .select("id,keyword,status,created_at,current_step_index,final_html")
        .order("created_at", { ascending: false })
      
      if (mounted && data) {
        setArticles(data as ArticleRow[])
        setLoading(false)
      }
    }

    loadArticles()

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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">My Articles</h1>
        <div className="text-center py-12">Loading articles...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Articles</h1>
        <Link 
          href="/blog-writer" 
          className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
        >
          Create New Article
        </Link>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 font-medium border-b">
              <tr>
                <th className="px-6 py-4">Keyword</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Progress</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {articles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No articles found. Start by generating one!
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {article.keyword}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="px-6 py-4">
                      {article.status === 'completed' ? (
                        <span className="text-green-600 font-medium">Completed</span>
                      ) : article.status === 'failed' ? (
                        <span className="text-red-600 font-medium">Failed</span>
                      ) : (
                        <span className="text-blue-600">
                          Step {article.current_step_index ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {format(new Date(article.created_at), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {article.status === 'completed' && article.final_html && (
                        <Link 
                          href={`/articles/${article.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Completed
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <div className="flex flex-col items-start">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Failed
        </span>
      </div>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
      {status === 'queued' ? 'Queued' : 'Processing...'}
    </span>
  )
}
