"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { GlobalCard } from "@/components/ui/global-card"
import { FileText, Eye, FilePenLine, Plus } from "lucide-react"

// Mock data to simulate the structure of ArticleRow
const mockArticles = [
    {
        id: "1",
        keyword: "Christmas gift ideas",
        status: "completed",
        created_at: new Date().toISOString(),
        current_step_index: 5,
        final_html: "<div>Content</div>",
    },
    {
        id: "2",
        keyword: "Cost of professional photo restoration in 2025",
        status: "completed",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        current_step_index: 5,
        final_html: "<div>Content</div>",
    },
    {
        id: "3",
        keyword: "Best AI tools for SEO",
        status: "processing",
        created_at: new Date(Date.now() - 172800000).toISOString(),
        current_step_index: 2,
        final_html: null,
    },
]

export default function TestArticlesPage() {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 min-h-screen font-sans bg-stone-50 md:bg-white dark:bg-black">
            <GlobalCard className="w-full shadow-sm">
                {/* Integrated Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200/50 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-900/40 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                            My Articles
                        </h1>
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-200/50 dark:bg-stone-800 text-[10px] font-medium text-stone-600 dark:text-stone-400 px-1.5">
                            {mockArticles.length}
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

                <div className="overflow-x-auto relative min-h-[300px]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-stone-50/50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 font-medium border-b border-stone-100 dark:border-stone-800">
                            <tr>
                                <th className="px-6 py-4 font-medium text-xs uppercase tracking-wider text-stone-400 pl-8">Article</th>
                                <th className="px-6 py-4 font-medium text-xs uppercase tracking-wider text-stone-400">Status</th>
                                <th className="px-6 py-4 font-medium text-xs uppercase tracking-wider text-stone-400">Progress</th>
                                <th className="px-6 py-4 font-medium text-xs uppercase tracking-wider text-stone-400">Created</th>
                                <th className="
                    px-6 py-4 text-right font-medium text-xs uppercase tracking-wider text-stone-400 sticky right-0 z-10
                    bg-stone-50/95 dark:bg-stone-900/95 backdrop-blur-sm
                    border-l border-stone-100 dark:border-stone-800
                  ">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                            {mockArticles.map((article) => (
                                <tr key={article.id} className="group hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-white border border-stone-100 shadow-sm flex items-center justify-center text-stone-400 group-hover:text-stone-600 group-hover:border-stone-200 transition-colors">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <span className="font-semibold text-stone-900 dark:text-white text-base">
                                                {article.keyword}
                                            </span>
                                        </div>
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
                                        {article.status === 'completed' && article.final_html && (
                                            <Link
                                                href={`/articles/${article.id}`}
                                                className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-900 dark:hover:text-white font-medium transition-colors"
                                            >
                                                Edit
                                                <FilePenLine className="w-3 h-3" />
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlobalCard>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'completed') {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-100 dark:border-green-900/50">
                Completed
            </span>
        )
    }
    if (status === 'failed') {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                Failed
            </span>
        )
    }
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 animate-pulse">
            {status === 'queued' ? 'Queued' : 'Processing...'}
        </span>
    )
}
