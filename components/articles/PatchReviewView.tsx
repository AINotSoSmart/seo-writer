"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Copy, ExternalLink, Globe, Layers, Sparkles, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

interface SectionChange {
    operation: "replace_section" | "insert_after" | "insert_before" | "delete_section"
    sectionId: string
    reason: string
    newHeading?: string
    newContent: string
}

interface PatchReviewProps {
    article: {
        id: string
        keyword: string
        raw_content: string | null
        final_html: string | null
        outline: {
            isPatch?: boolean
            targetUrl?: string
            sourceHash?: string
            changes?: SectionChange[]
        }
    }
}

export function PatchReviewView({ article }: PatchReviewProps) {
    const [copiedAll, setCopiedAll] = useState(false)
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
    const [isApplyingWp, setIsApplyingWp] = useState(false)

    const targetUrl = article.outline?.targetUrl || ""
    const changes: SectionChange[] = article.outline?.changes || []

    const copyToClipboard = async (text: string, onDone: () => void) => {
        try {
            await navigator.clipboard.writeText(text)
            onDone()
            toast.success("Copied to clipboard")
        } catch {
            toast.error("Failed to copy")
        }
    }

    const handleApplyWp = async () => {
        setIsApplyingWp(true)
        try {
            const res = await fetch(`/api/articles/${article.id}/apply-patch`, {
                method: "POST",
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "WordPress update failed")
            } else {
                toast.success(data.message || "Successfully updated WordPress post!")
            }
        } catch {
            toast.error("Failed to communicate with WordPress")
        } finally {
            setIsApplyingWp(false)
        }
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            {/* Navigation back */}
            <div className="mb-6 flex items-center justify-between">
                <Link
                    href="/content-plan"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Content Plan
                </Link>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                    <Sparkles className="mr-1 h-3.5 w-3.5 text-amber-600" />
                    Page Improvement Patch
                </Badge>
            </div>

            {/* Target Page Header */}
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                            Target Live Page
                        </span>
                        <h1 className="mt-1 text-2xl font-bold text-stone-900">{article.keyword}</h1>
                        {targetUrl && (
                            <a
                                href={targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                            >
                                <Globe className="h-3.5 w-3.5" />
                                {targetUrl}
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                copyToClipboard(article.final_html || "", () => {
                                    setCopiedAll(true)
                                    setTimeout(() => setCopiedAll(false), 2000)
                                })
                            }
                        >
                            {copiedAll ? <Check className="mr-1.5 h-4 w-4 text-emerald-600" /> : <Copy className="mr-1.5 h-4 w-4" />}
                            Copy Full HTML
                        </Button>
                        <Button
                            size="sm"
                            className="bg-stone-900 text-white hover:bg-stone-800"
                            onClick={handleApplyWp}
                            disabled={isApplyingWp}
                        >
                            <Send className="mr-1.5 h-4 w-4" />
                            {isApplyingWp ? "Updating..." : "Apply to WordPress"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tabs for Granular Patches vs Full Preview */}
            <Tabs defaultValue="patches" className="mt-8">
                <TabsList className="bg-stone-100 p-1">
                    <TabsTrigger value="patches" className="text-xs sm:text-sm">
                        <Layers className="mr-1.5 h-4 w-4" /> Section Changes ({changes.length})
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs sm:text-sm">
                        Full Page Preview
                    </TabsTrigger>
                    <TabsTrigger value="code" className="text-xs sm:text-sm">
                        Raw Patched HTML
                    </TabsTrigger>
                </TabsList>

                {/* Granular Section Patches */}
                <TabsContent value="patches" className="mt-6 space-y-6">
                    {changes.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-stone-200 p-8 text-center text-sm text-stone-500">
                            No granular section changes recorded.
                        </div>
                    ) : (
                        changes.map((change, idx) => (
                            <div
                                key={idx}
                                className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
                            >
                                <div className="flex flex-wrap items-center justify-between border-b border-stone-100 bg-stone-50/75 px-5 py-3.5">
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="secondary"
                                            className="font-mono text-xs uppercase"
                                        >
                                            {change.operation.replace("_", " ")}
                                        </Badge>
                                        <span className="text-xs text-stone-500">
                                            Anchor ID: <code className="text-stone-700">{change.sectionId}</code>
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                            copyToClipboard(
                                                `<h2>${change.newHeading || ""}</h2>\n${change.newContent}`,
                                                () => {
                                                    setCopiedIndex(idx)
                                                    setTimeout(() => setCopiedIndex(null), 2000)
                                                }
                                            )
                                        }
                                    >
                                        {copiedIndex === idx ? (
                                            <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                                        ) : (
                                            <Copy className="mr-1 h-3.5 w-3.5" />
                                        )}
                                        Copy Section
                                    </Button>
                                </div>
                                <div className="p-5">
                                    <div className="mb-3 rounded-md bg-violet-50/75 p-3 text-xs text-violet-900">
                                        <span className="font-semibold">Why this change:</span> {change.reason}
                                    </div>
                                    {change.newHeading && (
                                        <h3 className="text-base font-semibold text-stone-900">
                                            {change.newHeading}
                                        </h3>
                                    )}
                                    <div
                                        className="prose prose-stone prose-sm mt-3 max-w-none text-stone-700"
                                        dangerouslySetInnerHTML={{ __html: change.newContent }}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </TabsContent>

                {/* Full HTML Preview */}
                <TabsContent value="preview" className="mt-6">
                    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                        <div
                            className="prose prose-stone max-w-none"
                            dangerouslySetInnerHTML={{ __html: article.final_html || "<p>No content</p>" }}
                        />
                    </div>
                </TabsContent>

                {/* Raw HTML Code */}
                <TabsContent value="code" className="mt-6">
                    <div className="rounded-xl border border-stone-200 bg-stone-950 p-4">
                        <pre className="overflow-x-auto text-xs font-mono text-stone-200">
                            <code>{article.final_html || ""}</code>
                        </pre>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
