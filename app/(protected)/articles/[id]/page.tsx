"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Save, Calendar, User, FileText, Image as ImageIcon, Link as LinkIcon, Activity, ArrowLeft, Loader2, Menu, Info, LayoutTemplate, PenTool, Share2, MoreVertical, CheckCircle2, AlertCircle, Clock, Download, Copy, Check } from "lucide-react"
import { OutputData } from "@editorjs/editorjs"
import { toast } from "sonner"
import { editorJsToMarkdown } from "@/lib/editorjs-to-markdown"
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


const Editor = dynamic(() => import("@/components/editor"), { ssr: false })

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
}

export default function ArticleDetailPage() {
    const params = useParams()
    const id = params?.id as string

    const supabase = useMemo(() => createClient(), [])
    const [article, setArticle] = useState<Article | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isSaving, setIsSaving] = useState<boolean>(false)
    const [editorData, setEditorData] = useState<OutputData | null>(null)
    const [outlineData, setOutlineData] = useState<any>(null)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [activeTab, setActiveTab] = useState<string>("editor")
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isCopied, setIsCopied] = useState(false)

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

    const handleEditorChange = useCallback((data: OutputData) => {
        setEditorData(data)
    }, [])

    const getMarkdownContent = useCallback(() => {
        if (editorData) {
            return editorJsToMarkdown(editorData)
        }
        if (article?.raw_content) {
            const content = article.raw_content.trim()
            if (content.startsWith("{") && content.endsWith("}")) {
                try {
                    const data = JSON.parse(content)
                    if (data.blocks) {
                        return editorJsToMarkdown(data)
                    }
                } catch (e) {
                    // ignore
                }
            }
            return article.raw_content
        }
        return ""
    }, [editorData, article?.raw_content])

    const handleCopy = async () => {
        const markdown = getMarkdownContent()
        if (!markdown) {
            toast.error("No content to copy")
            return
        }

        try {
            await navigator.clipboard.writeText(markdown)
            setIsCopied(true)
            toast.success("Copied to clipboard")
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            toast.error("Failed to copy")
        }
    }

    const handleExport = () => {
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

    const handleSave = async () => {
        if (!article) return

        setIsSaving(true)
        try {
            const updatePayload: any = {}

            if (editorData) {
                const markdownContent = editorJsToMarkdown(editorData)
                updatePayload.raw_content = markdownContent
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

    const stats = useMemo(() => {
        if (!editorData && !article?.raw_content) return { words: 0, images: 0, links: 0 }

        if (editorData) {
            let words = 0
            let images = 0
            let links = 0

            editorData.blocks.forEach(block => {
                if (block.type === 'paragraph' || block.type === 'header' || block.type === 'quote' || block.type === 'list') {
                    const text = block.data.text || ""
                    words += text.replace(/<[^>]*>?/gm, '').split(/\s+/).filter((w: string) => w.length > 0).length
                    const linkMatches = text.match(/<a\s/g)
                    if (linkMatches) links += linkMatches.length
                }
                if (block.type === 'image' || block.type === 'simpleImage') {
                    images++
                }
            })
            return { words, images, links }
        }

        if (article?.raw_content) {
            const content = article.raw_content.trim()
            if (content.startsWith("{") && content.endsWith("}")) {
                try {
                    const data = JSON.parse(content)
                    if (data.blocks) {
                        let words = 0
                        let images = 0
                        let links = 0

                        data.blocks.forEach((block: any) => {
                            if (block.type === 'paragraph' || block.type === 'header' || block.type === 'quote' || block.type === 'list') {
                                const text = block.data.text || ""
                                words += text.replace(/<[^>]*>?/gm, '').split(/\s+/).filter((w: any) => w.length > 0).length
                                const linkMatches = text.match(/<a\s/g)
                                if (linkMatches) links += linkMatches.length
                            }
                            if (block.type === 'image' || block.type === 'simpleImage') {
                                images++
                            }
                        })
                        return { words, images, links }
                    }
                } catch (e) { }
            }

            const words = content.split(/\s+/).filter(w => w.length > 0).length
            const images = (content.match(/!\[.*?\]\(.*?\)/g) || []).length
            const links = (content.match(/\[.*?\]\(.*?\)/g) || []).length
            return { words, images, links }
        }

        return { words: 0, images: 0, links: 0 }
    }, [editorData, article?.raw_content])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-gray-500 font-medium">Loading Editor...</p>
                </div>
            </div>
        )
    }

    if (!article) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
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
            <div className="p-4 border-b">
                <h3 className="font-semibold text-sm text-gray-900">Article Details</h3>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Status Card */}
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</p>
                        <div className="flex items-center gap-2">
                            {article.status === 'completed' ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Completed
                                </Badge>
                            ) : article.status === 'failed' ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                                    <AlertCircle className="w-3 h-3" /> Failed
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> {article.status}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Stats Grid */}
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Statistics</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-gray-50 p-2 rounded-lg border text-center">
                                <p className="text-xs text-gray-500 mb-1">Words</p>
                                <p className="font-semibold text-gray-900">{stats.words}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded-lg border text-center">
                                <p className="text-xs text-gray-500 mb-1">Images</p>
                                <p className="font-semibold text-gray-900">{stats.images}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded-lg border text-center">
                                <p className="text-xs text-gray-500 mb-1">Links</p>
                                <p className="font-semibold text-gray-900">{stats.links}</p>
                            </div>
                        </div>
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
                            <p className="text-xs text-gray-500">Title</p>
                            <p className="text-sm font-medium text-gray-900 leading-snug">
                                {article.outline?.title || "Untitled Article"}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">Meta Description</p>
                            <p className="text-sm font-medium text-gray-900 leading-snug">
                                {article.meta_description || "Not generated yet"}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">URL Slug</p>
                            <p className="text-sm font-medium text-gray-900 leading-snug font-mono break-all">
                                {article.slug || "Not generated yet"}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">Created At</p>
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                {new Date(article.created_at).toLocaleDateString()}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">Last Saved</p>
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                {lastSaved ? lastSaved.toLocaleTimeString() : "Never"}
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
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
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopy}
                            className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                            title="Copy as Markdown"
                        >
                            {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleExport}
                            className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                            title="Export as Markdown"
                        >
                            <Download className="w-4 h-4" />
                        </Button>
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
                                    className="rounded-full px-6 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm transition-all"
                                >
                                    Editor
                                </TabsTrigger>
                                <TabsTrigger
                                    value="outline"
                                    className="rounded-full px-6 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm transition-all"
                                >
                                    Outline
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide">
                            <TabsContent value="editor" className="m-0 min-h-full p-4 pt-0 max-w-4xl mx-auto focus-visible:ring-0 outline-none">
                                <div className=" min-h-[calc(100vh-10rem)]">
                                    {article.status === 'completed' ? (
                                        <div className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl">
                                            {/* Featured Image Display */}
                                            {article.featured_image_url && (
                                                <div className="mb-8 relative rounded-xl overflow-hidden group border border-gray-100 shadow-sm">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img 
                                                      src={article.featured_image_url} 
                                                      alt="Featured" 
                                                      className="w-full max-h-[400px] object-cover"
                                                    />
                                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button 
                                                            size="sm" 
                                                            variant="secondary"
                                                            className="h-8 px-3 text-xs backdrop-blur-md bg-white/90 hover:bg-white"
                                                            onClick={() => window.open(article.featured_image_url || '', '_blank')}
                                                        >
                                                            <LinkIcon className="w-3 h-3 mr-1.5" /> Open
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="secondary"
                                                            className="h-8 px-3 text-xs backdrop-blur-md bg-white/90 hover:bg-white"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(article.featured_image_url || "")
                                                                toast.success("Image URL copied")
                                                            }}
                                                        >
                                                            <Copy className="w-3 h-3 mr-1.5" /> Copy URL
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            <Editor
                                                markdown={article.raw_content || ""}
                                                readOnly={false}
                                                onChange={handleEditorChange}
                                            />
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
                                                <div className="max-w-2xl mx-auto border rounded-xl p-8 bg-gray-50/50 backdrop-blur-sm">
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
                                <div className="h-20" /> {/* Bottom spacer */}
                            </TabsContent>

                            <TabsContent value="outline" className="m-0 min-h-full p-4 sm:p-8 max-w-4xl mx-auto focus-visible:ring-0 outline-none">
                                <div className="bg-white rounded-xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 min-h-[calc(100vh-10rem)] p-6 sm:p-10">
                                    <OutlineEditor
                                        initialData={outlineData}
                                        onChange={setOutlineData}
                                    />
                                </div>
                                <div className="h-20" /> {/* Bottom spacer */}
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* Desktop Sidebar */}
                <div className={`hidden lg:block border-l bg-white transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[320px]' : 'w-0 overflow-hidden'}`}>
                    <SidebarContent />
                </div>
            </div>
        </div>
    )
}
