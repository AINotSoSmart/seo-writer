"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Save, Calendar, User, FileText, Image as ImageIcon, Link as LinkIcon, Activity, ArrowLeft, Loader2, Menu, Info, LayoutTemplate, PenTool, Share2, MoreVertical, CheckCircle2, AlertCircle, Clock, Download, Copy, Check } from "lucide-react"
import { CustomSpinner } from "@/components/CustomSpinner"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OutlineEditor from "@/components/outline-editor"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { marked } from "marked"
import { ChevronDown, FileText as FileTextIcon, Type, Code } from "lucide-react"


const TipTapEditor = dynamic(() => import("@/components/tiptap/Editor"), { ssr: false })

type Article = {
    id: string
    keyword: string
    status: string
    raw_content: string | null
    final_html: string | null
    current_step_index: number | null
    error_message: string | null
    created_at: string
    outline: any
    competitor_data: any
    meta_description?: string | null
    slug?: string | null
    featured_image_url?: string | null
    supporting_keywords?: string[] | null
}

/**
 * Converts old R2 direct URLs to proxy URLs for backward compatibility.
 * Old format: https://[bucket].r2.cloudflarestorage.com/featured-images/...
 * New format: /api/images/featured-images/...
 */
const getProxiedImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null

    // Already a proxy URL
    if (url.startsWith('/api/images/')) return url

    // robustly extract key: find 'featured-images/' and take everything after
    // This handles R2, S3, custom domains, or any source as long as path structure is preserved
    const match = url.match(/(featured-images\/.*)/)
    if (match) {
        return `/api/images/${match[1]}`
    }

    // Fallback: Check if it's an old R2 direct URL (legacy support)
    if (url.includes('.r2.cloudflarestorage.com/')) {
        const key = url.split('.r2.cloudflarestorage.com/')[1]
        return `/api/images/${key}`
    }

    // Return original if we can't proxy it
    return url
}

export default function ArticleDetailPage() {
    const params = useParams()
    const id = params?.id as string

    const supabase = useMemo(() => createClient(), [])
    const [article, setArticle] = useState<Article | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isSaving, setIsSaving] = useState<boolean>(false)
    const [editorMarkdown, setEditorMarkdown] = useState<string | null>(null)
    const [outlineData, setOutlineData] = useState<any>(null)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [activeTab, setActiveTab] = useState<string>("editor")
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isCopied, setIsCopied] = useState(false)
    const [editableMetaDescription, setEditableMetaDescription] = useState<string>("")
    const [editableSlug, setEditableSlug] = useState<string>("")
    const [isSavingMetadata, setIsSavingMetadata] = useState(false)

    useEffect(() => {
        if (!id) return

        let mounted = true
        const loadArticle = async () => {
            const { data } = await supabase
                .from("articles")
                .select("*")
                .eq("id", id)
                .single()

            if (mounted && data) {
                setArticle(data as Article)
                setOutlineData(data.outline)
                setEditableMetaDescription(data.meta_description || "")
                setEditableSlug(data.slug || "")
                setLoading(false)
                if (data.created_at) {
                    setLastSaved(new Date(data.created_at))
                }
            }
        }

        loadArticle()

        const channel = supabase
            .channel(`article:${id}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "articles", filter: `id=eq.${id}` },
                (payload) => {
                    const newArticle = payload.new as Article
                    setArticle((prev) => {
                        if (!prev) return newArticle
                        return { ...prev, ...newArticle }
                    })
                }
            )
            .subscribe()

        return () => {
            mounted = false
            supabase.removeChannel(channel)
        }
    }, [id, supabase])

    const handleEditorChange = useCallback((markdown: string) => {
        setEditorMarkdown(markdown)
    }, [])

    const getMarkdownContent = useCallback(() => {
        if (editorMarkdown) {
            return editorMarkdown
        }
        if (article?.raw_content) {
            return article.raw_content
        }
        return ""
    }, [editorMarkdown, article?.raw_content])

    const handleCopyMarkdown = async () => {
        let markdown = getMarkdownContent()
        if (!markdown) {
            toast.error("No content to copy")
            return
        }

        // Convert relative image URLs to absolute URLs for external use
        const baseUrl = window.location.origin
        markdown = markdown.replace(/!\[(.*?)\]\((\/api\/images\/[^)]+)\)/g, `![$1](${baseUrl}$2)`)
        markdown = markdown.replace(/!\[(.*?)\]\((\/[^)]+\.(?:png|jpg|jpeg|gif|webp))\)/gi, `![$1](${baseUrl}$2)`)

        try {
            await navigator.clipboard.writeText(markdown)
            setIsCopied(true)
            toast.success("Copied as Markdown (with absolute image URLs)")
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            toast.error("Failed to copy")
        }
    }

    const generateFinalHtml = useCallback(async (markdown: string) => {
        let finalHtml = await marked.parse(markdown)
        const baseUrl = window.location.origin
        finalHtml = finalHtml.replace(/src="(\/api\/images\/[^"]+)"/g, `src="${baseUrl}$1"`)
        finalHtml = finalHtml.replace(/src="(\/[^"]+\.(?:png|jpg|jpeg|gif|webp))"/gi, `src="${baseUrl}$1"`)
        return finalHtml
    }, [])

    const handleCopyHtml = async () => {
        const markdown = getMarkdownContent()
        if (!markdown) {
            toast.error("No content to copy")
            return
        }

        try {
            const html = await generateFinalHtml(markdown)
            await navigator.clipboard.writeText(html)
            setIsCopied(true)
            toast.success("Copied as HTML")
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            toast.error("Failed to copy")
        }
    }

    const handleCopyRichText = async () => {
        let markdown = getMarkdownContent()
        if (!markdown) {
            toast.error("No content to copy")
            return
        }

        // Convert relative image URLs to absolute URLs for external use
        const baseUrl = window.location.origin
        markdown = markdown.replace(/!\[(.*?)\]\((\/api\/images\/[^)]+)\)/g, `![$1](${baseUrl}$2)`)
        markdown = markdown.replace(/!\[(.*?)\]\((\/[^)]+\.(?:png|jpg|jpeg|gif|webp))\)/gi, `![$1](${baseUrl}$2)`)

        try {
            const html = await marked.parse(markdown)
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([markdown], { type: 'text/plain' })
                })
            ])
            setIsCopied(true)
            toast.success("Copied as Rich Text (with images)")
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            // Fallback for browsers that don't support ClipboardItem
            await navigator.clipboard.writeText(markdown)
            toast.success("Copied as Markdown (Rich text not supported)")
        }
    }

    const handleDownloadMarkdown = () => {
        const markdown = getMarkdownContent()
        if (!markdown) {
            toast.error("No content to export")
            return
        }

        const blob = new Blob([markdown], { type: "text/markdown" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${article?.keyword?.replace(/\s+/g, '-') || "article"}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleDownloadHtml = async () => {
        const markdown = getMarkdownContent()
        if (!markdown) {
            toast.error("No content to export")
            return
        }

        try {
            const html = await generateFinalHtml(markdown)
            const blob = new Blob([html], { type: "text/plain" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${article?.keyword?.replace(/\s+/g, '-') || "article"}-html.txt`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success("Downloaded as HTML (.txt)")
        } catch (err) {
            toast.error("Failed to download HTML")
        }
    }

    const handleSave = async () => {
        if (!article) return

        setIsSaving(true)
        try {
            const updatePayload: any = {}

            if (editorMarkdown) {
                const markdownContent = editorMarkdown
                updatePayload.raw_content = markdownContent

                // Convert to HTML for publishing
                const finalHtml = await generateFinalHtml(markdownContent)
                updatePayload.final_html = finalHtml
            }

            if (outlineData) {
                updatePayload.outline = outlineData
            }

            if (Object.keys(updatePayload).length === 0) {
                setIsSaving(false)
                return
            }

            const { error } = await supabase
                .from("articles")
                .update(updatePayload)
                .eq("id", article.id)

            if (error) throw error

            setLastSaved(new Date())
            toast.success("Article saved successfully")
        } catch (error) {
            console.error("Error saving article:", error)
            toast.error("Failed to save article")
        } finally {
            setIsSaving(false)
        }
    }

    // Helper function to count syllables in a word (approximation)
    const countSyllables = useCallback((word: string): number => {
        word = word.toLowerCase().replace(/[^a-z]/g, '')
        if (word.length <= 3) return 1

        // Count vowel groups
        const vowels = word.match(/[aeiouy]+/g)
        let count = vowels ? vowels.length : 1

        // Adjust for common patterns
        if (word.endsWith('e')) count--
        if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) count++
        if (word.endsWith('es') || word.endsWith('ed')) count--

        return Math.max(1, count)
    }, [])

    // Helper to extract plain text from HTML/markdown
    const extractPlainText = useCallback((content: string): string => {
        return content
            .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
            .replace(/[#*_~`\[\]()]/g, ' ')  // Remove markdown syntax
            .replace(/\s+/g, ' ')
            .trim()
    }, [])

    const stats = useMemo(() => {
        const defaultStats = {
            words: 0,
            images: 0,
            links: 0,
            readingTime: 0,
            readabilityScore: 0,
            readabilityLabel: 'N/A',
            keywordDensity: 0
        }

        if (!editorMarkdown && !article?.raw_content) return defaultStats

        // Use markdown content directly
        const content = editorMarkdown || article?.raw_content || ""

        // Extract plain text from markdown (remove markdown syntax)
        const fullText = extractPlainText(content)
        const words = fullText.split(/\s+/).filter(w => w.length > 0).length
        const images = (content.match(/!\[.*?\]\(.*?\)/g) || []).length
        const links = (content.match(/(?<!!)\[.*?\]\(.*?\)/g) || []).length

        // Reading Time (200 words per minute average)
        const readingTime = Math.ceil(words / 200)

        // Flesch-Kincaid Readability Score
        const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0)
        const wordsArray = fullText.split(/\s+/).filter(w => w.length > 0)
        const totalSyllables = wordsArray.reduce((acc, word) => acc + countSyllables(word), 0)

        const avgSentenceLength = sentences.length > 0 ? wordsArray.length / sentences.length : 0
        const avgSyllablesPerWord = wordsArray.length > 0 ? totalSyllables / wordsArray.length : 0

        // Flesch Reading Ease formula
        const fleschScore = Math.round(206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord))
        const readabilityScore = Math.max(0, Math.min(100, fleschScore))

        // Readability label - user-friendly labels (50-70 is ideal for B2B/professional content)
        let readabilityLabel = 'N/A'
        if (readabilityScore >= 70) readabilityLabel = 'Easy Read'
        else if (readabilityScore >= 50) readabilityLabel = 'Professional'  // Ideal for B2B, SaaS, expert content
        else if (readabilityScore >= 30) readabilityLabel = 'Advanced'
        else readabilityLabel = 'Expert Level'

        // Keyword Density - count individual terms for multi-word keywords
        let keywordDensity = 0
        if (article?.keyword && words > 0) {
            const keyword = article.keyword.toLowerCase().trim()
            const textLower = fullText.toLowerCase()

            // Split keyword into individual terms and count each
            const keywordTerms = keyword.split(/\s+/).filter(t => t.length > 2) // Ignore short words like "a", "to"
            let totalMatches = 0

            // Count exact phrase matches (worth more)
            const exactMatches = (textLower.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
            totalMatches += exactMatches * keywordTerms.length  // Full phrase counts as all terms

            // Also count individual term appearances (excluding those in exact matches)
            const textWithoutExact = textLower.replace(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
            keywordTerms.forEach(term => {
                const termMatches = (textWithoutExact.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length
                totalMatches += termMatches
            })

            keywordDensity = parseFloat(((totalMatches / words) * 100).toFixed(1))
        }

        return {
            words,
            images,
            links,
            readingTime,
            readabilityScore,
            readabilityLabel,
            keywordDensity
        }
    }, [editorMarkdown, article?.raw_content, article?.keyword, countSyllables, extractPlainText])


    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 rounded-lg">
                <div className="flex flex-col items-center gap-4">
                    <CustomSpinner className="w-10 h-10" />
                    <p className="text-gray-500 font-medium">Loading Editor...</p>
                </div>
            </div>
        )
    }

    if (!article) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-gray-900">Article Not Found</h2>
                    <p className="text-gray-500">The article you are looking for does not exist or has been deleted.</p>
                    <Button asChild>
                        <Link href="/articles">Return to Articles</Link>
                    </Button>
                </div>
            </div>
        )
    }

    const SidebarContent = () => (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b shrink-0">
                <h3 className="font-semibold text-sm text-gray-900">Article Details</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-6">


                    {/* Stats Grid */}
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Statistics</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-gray-50 p-2 rounded-lg border text-center">
                                <p className="text-xs text-gray-500 mb-1">Words</p>
                                <p className="font-semibold text-gray-900">{stats.words.toLocaleString()}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded-lg border text-center">
                                <p className="text-xs text-gray-500 mb-1">Reading</p>
                                <p className="font-semibold text-gray-900">{stats.readingTime} min</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded-lg border text-center">
                                <p className="text-xs text-gray-500 mb-1">Links</p>
                                <p className="font-semibold text-gray-900">{stats.links}</p>
                            </div>
                        </div>

                        {/* <div className="bg-gray-50 p-3 rounded-lg border">
        <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Readability Score</p>
            <Badge
                variant="outline"
                className={`text-xs ${stats.readabilityScore >= 50 ? 'bg-green-50 text-green-700 border-green-200' :
                    stats.readabilityScore >= 30 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-red-50 text-red-700 border-red-200'
                    }`}
            >
                {stats.readabilityLabel}
            </Badge>
        </div>
        <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-gray-900">{stats.readabilityScore}</span>
            <span className="text-xs text-gray-400 mb-1">/ 100</span>
        </div>
        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all ${stats.readabilityScore >= 50 ? 'bg-green-500' :
                    stats.readabilityScore >= 30 ? 'bg-yellow-500' :
                        'bg-red-500'
                    }`}
                style={{ width: `${stats.readabilityScore}%` }}
            />
        </div>
    </div>

    <div className="bg-gray-50 p-3 rounded-lg border">
        <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Keyword Density</p>
            <Badge
                variant="outline"
                className={`text-xs ${stats.keywordDensity >= 1 && stats.keywordDensity <= 2.5 ? 'bg-green-50 text-green-700 border-green-200' :
                    stats.keywordDensity > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
            >
                {stats.keywordDensity >= 1 && stats.keywordDensity <= 2.5 ? 'Optimal' :
                    stats.keywordDensity > 2.5 ? 'High' :
                        stats.keywordDensity > 0 ? 'Low' : 'N/A'}
            </Badge>
        </div>
        <div className="flex items-end gap-1 mt-1">
            <span className="text-xl font-bold text-gray-900">{stats.keywordDensity}%</span>
            <span className="text-xs text-gray-400 mb-0.5">of content</span>
        </div>
    </div> 
*/}


                    </div>

                    <Separator />

                    {/* Metadata */}
                    <div className="space-y-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</p>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">Target Keyword</p>
                            <div className="flex flex-wrap gap-1">
                                <Badge variant="secondary" className="font-normal">
                                    {article.keyword}
                                </Badge>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">Meta Title</p>
                            <p className="text-sm font-medium text-gray-900 leading-snug">
                                {article.outline?.title || "Untitled Article"}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">Meta Description</p>
                            <textarea
                                value={editableMetaDescription}
                                onChange={(e) => setEditableMetaDescription(e.target.value)}
                                placeholder="Enter meta description..."
                                className="w-full text-sm font-medium text-gray-900 leading-snug bg-gray-50 border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-all"
                                rows={3}
                                maxLength={160}
                            />
                            <p className="text-xs text-gray-400 text-right">{editableMetaDescription.length}/160</p>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">URL Slug</p>
                            <input
                                type="text"
                                value={editableSlug}
                                onChange={(e) => setEditableSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-'))}
                                placeholder="enter-url-slug"
                                className="w-full text-sm font-medium text-gray-900 leading-snug font-mono bg-gray-50 border border-gray-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-all"
                            />
                        </div>

                        <Button
                            onClick={async () => {
                                if (!article) return
                                setIsSavingMetadata(true)
                                try {
                                    const { error } = await supabase
                                        .from("articles")
                                        .update({
                                            meta_description: editableMetaDescription,
                                            slug: editableSlug
                                        })
                                        .eq("id", article.id)
                                    if (error) throw error
                                    setArticle(prev => prev ? { ...prev, meta_description: editableMetaDescription, slug: editableSlug } : null)
                                    toast.success("Metadata saved!")
                                } catch (err) {
                                    toast.error("Failed to save metadata")
                                } finally {
                                    setIsSavingMetadata(false)
                                }
                            }}
                            disabled={isSavingMetadata}
                            size="sm"
                            variant="outline"
                            className="w-full mt-2"
                        >
                            {isSavingMetadata ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                            Save Metadata
                        </Button>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">Created At</p>
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                {new Date(article.created_at).toLocaleDateString()}
                            </div>
                        </div>


                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="h-screen flex flex-col bg-white overflow-hidden font-sans rounded-lg border border-gray-200">
            {/* Header */}
            <header className="h-14 border-b bg-white px-4 flex items-center justify-between shrink-0 z-20 relative">
                <div className="flex items-center gap-4 overflow-hidden">
                    <Button variant="ghost" size="icon" asChild className="shrink-0 hover:bg-gray-100 rounded-full w-8 h-8">
                        <Link href="/articles">
                            <ArrowLeft className="w-4 h-4 text-gray-600" />
                        </Link>
                    </Button>
                    <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="hidden sm:inline hover:text-gray-900 transition-colors cursor-pointer">Articles</span>
                            <span className="hidden sm:inline text-gray-300">/</span>
                            <span className="truncate font-medium text-gray-900 max-w-[200px] sm:max-w-md">
                                {article.keyword}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-3 mr-2">
                        {lastSaved && (
                            <span className="text-xs text-gray-400 font-medium">
                                Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 mr-2 border-r pr-2 border-gray-200">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 gap-1"
                                >
                                    {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={handleCopyMarkdown} className="cursor-pointer gap-2">
                                    <FileTextIcon className="w-4 h-4" />
                                    Copy as Markdown
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleCopyRichText} className="cursor-pointer gap-2">
                                    <Type className="w-4 h-4" />
                                    Copy as Rich Text
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleCopyHtml} className="cursor-pointer gap-2">
                                    <Code className="w-4 h-4" />
                                    Copy as HTML
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 gap-1"
                                    title="Download"
                                >
                                    <Download className="w-4 h-4" />
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={handleDownloadMarkdown} className="cursor-pointer gap-2">
                                    <FileTextIcon className="w-4 h-4" />
                                    Download as Markdown
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleDownloadHtml} className="cursor-pointer gap-2">
                                    <Code className="w-4 h-4" />
                                    Download as HTML (.txt)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={isSaving || article.status !== 'completed'}
                        size="sm"
                        className="gap-2 bg-black hover:bg-gray-800 text-white rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline font-medium">Save</span>
                    </Button>

                    <div className="h-4 w-px bg-gray-200 hidden lg:block" />

                    {/* Mobile Sidebar Trigger */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="lg:hidden hover:bg-gray-100 rounded-full w-8 h-8">
                                <MoreVertical className="w-4 h-4 text-gray-600" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="p-0 w-80 border-l shadow-xl">
                            <SidebarContent />
                        </SheetContent>
                    </Sheet>

                    {/* Desktop Sidebar Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hidden lg:flex hover:bg-gray-100 rounded-full w-8 h-8"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        <LayoutTemplate className={`w-4 h-4 ${isSidebarOpen ? 'text-black' : 'text-gray-400'}`} />
                    </Button>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden bg-gray-50/30">
                {/* Center Content */}
                <div className="flex-1 flex flex-col min-w-0 relative">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                        {/* Tabs Header - Floating Style */}
                        <div className="px-4 py-3 flex justify-center shrink-0">
                            <TabsList className="bg-gray-100/80 p-1 rounded-full border border-gray-200/50">
                                <TabsTrigger
                                    value="editor"
                                    className="cursor-pointer rounded-full px-6 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm transition-all"
                                >
                                    Editor
                                </TabsTrigger>
                                {/* Outline tab hidden for now - not useful after article is written
                                <TabsTrigger
                                    value="outline"
                                    className="cursor-pointer rounded-full px-6 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm transition-all"
                                >
                                    Outline
                                </TabsTrigger>
                                */}
                            </TabsList>
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide">
                            <TabsContent value="editor" className="m-0 min-h-full p-2 pt-0 max-w-4xl mx-auto focus-visible:ring-0 outline-none">
                                <div className=" min-h-[calc(100vh-10rem)]">
                                    {article.status === 'completed' ? (
                                        <div className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
                                            {/* Featured Image Display */}
                                            {article.featured_image_url && (
                                                <div className="mb-8 relative rounded-lg overflow-hidden group border border-gray-100 shadow-sm">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={article.featured_image_url || ''}
                                                        alt="Featured"
                                                        className="w-full max-h-[720px] object-cover"
                                                    />
                                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            className="h-8 px-3 text-xs backdrop-blur-md bg-white/90 hover:bg-white"
                                                            onClick={async () => {
                                                                const imageUrl = getProxiedImageUrl(article.featured_image_url)
                                                                if (!imageUrl) return
                                                                try {
                                                                    const response = await fetch(imageUrl)
                                                                    const blob = await response.blob()
                                                                    const blobUrl = URL.createObjectURL(blob)
                                                                    const link = document.createElement('a')
                                                                    link.href = blobUrl
                                                                    link.download = `featured-image-${article.id}.webp`
                                                                    document.body.appendChild(link)
                                                                    link.click()
                                                                    document.body.removeChild(link)
                                                                    URL.revokeObjectURL(blobUrl)
                                                                    toast.success("Image downloaded")
                                                                } catch (err) {
                                                                    toast.error("Failed to download image")
                                                                }
                                                            }}
                                                        >
                                                            <Download className="w-3 h-3 mr-1.5" /> Download
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <TipTapEditor
                                                    content={article.raw_content || ""}
                                                    readOnly={false}
                                                    onChange={handleEditorChange}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-8 py-12">
                                            <div className="flex flex-col items-center justify-center text-center space-y-6">
                                                <div className="relative w-20 h-20">
                                                    <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                                                    <div className="absolute inset-0 rounded-full border-4 border-black border-t-transparent animate-spin"></div>
                                                    <PenTool className="absolute inset-0 m-auto w-8 h-8 text-black" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-semibold text-gray-900">
                                                        Crafting your masterpiece...
                                                    </h3>
                                                    <p className="text-gray-500 max-w-sm mx-auto">
                                                        Our AI agents are researching, outlining, and writing your article. This usually takes 2-3 minutes.
                                                    </p>
                                                </div>
                                                <Badge variant="secondary" className="px-3 py-1 bg-gray-100 text-gray-600 border-gray-200 animate-pulse">
                                                    {article.status.toUpperCase()}
                                                </Badge>
                                            </div>

                                            {article.raw_content && (
                                                <div className="max-w-2xl mx-auto border rounded-lg p-8 bg-gray-50/50 backdrop-blur-sm">
                                                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                        <p className="text-xs font-medium uppercase tracking-wider">Live Output</p>
                                                    </div>
                                                    <div className="font-mono text-sm text-gray-600 whitespace-pre-wrap leading-relaxed opacity-80">
                                                        {article.raw_content.slice(-800)}
                                                        <span className="inline-block w-2 h-4 bg-black ml-1 animate-pulse align-middle" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* Outline tab content hidden for now - not useful after article is written
                            <TabsContent value="outline" className="m-0 min-h-full p-4 sm:p-8 max-w-4xl mx-auto focus-visible:ring-0 outline-none">
                                <div className="bg-white rounded-lg shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 min-h-[calc(100vh-10rem)] p-6 sm:p-10">
                                    <OutlineEditor
                                        initialData={outlineData}
                                        onChange={setOutlineData}
                                    />
                                </div>
                                <div className="h-20" />
                            </TabsContent>
                            */}
                        </div>
                    </Tabs>
                </div>

                {/* Desktop Sidebar */}
                <div className={`hidden lg:block border-l bg-white transition-all duration-300 ease-in-out h-full ${isSidebarOpen ? 'w-[320px]' : 'w-0 overflow-hidden'}`}>
                    <SidebarContent />
                </div>
            </div>
        </div>
    )
}
