"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import { Loader2, CheckCircle2 } from "lucide-react"
import JSZip from "jszip"
import { generatePDF } from "@/lib/pdf-generator"

type PaperSize = "letter" | "kdp_8_5x11" | "kdp_8x10" | "a4"

export default function BulkBookGeneratorPage() {
  const [theme, setTheme] = useState("Animals")
  const [title, setTitle] = useState("My 30-Page Coloring Book")
  const [subtitle, setSubtitle] = useState("Auto-generated themed collection")
  const [pages, setPages] = useState<{ id: string; url: string }[]>([])
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverId, setCoverId] = useState<string | null>(null)
  const [paperSize, setPaperSize] = useState<PaperSize>("kdp_8_5x11")
  const [bleedMm, setBleedMm] = useState(0)
  const [isGeneratingPages, setIsGeneratingPages] = useState(false)
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const makePromptForTheme = (t: string) => (
    t === "Animals"
      ? "Cute animals coloring pages, clean black and white line art, printable"
      : t === "Fantasy"
        ? "Fantasy scenes coloring pages, dragons, castles, clean line art, printable"
        : t === "Kawaii"
          ? "Kawaii style coloring pages, adorable characters, clean line art, printable"
          : "Seasonal holiday coloring pages, clean black and white line art, printable"
  )

  const handleGeneratePages = async () => {
    setIsGeneratingPages(true)
    try {
      const prompt = makePromptForTheme(theme)
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspectRatio: "portrait", numImages: 30 }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to queue generation")
      }
      const queued = await res.json()
      const requestId = queued.requestId
      let done = false
      while (!done) {
        const s = await fetch(`/api/generate/status?requestId=${encodeURIComponent(requestId)}`)
        const status = await s.json()
        if (status.status === "completed") {
          done = true
          break
        }
        if (status.status === "error" || status.status === "failed") {
          throw new Error("Generation failed")
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
      const resultRes = await fetch(`/api/generate/result?requestId=${encodeURIComponent(requestId)}&prompt=${encodeURIComponent(prompt)}&aspectRatio=portrait&numImages=30`)
      if (!resultRes.ok) {
        const err = await resultRes.json()
        throw new Error(err.error || "Failed to fetch results")
      }
      const data = await resultRes.json()
      const recs: { id: string | null; url: string }[] = data.images || []
      const items = recs.map((rec, i) => ({ id: rec.id ?? `${Date.now()}-${i}`, url: rec.url }))
      setPages(items)
      if (!coverUrl && items.length > 0) {
        setCoverUrl(items[0].url)
      }
      toast.success("Generated 30 pages from theme")
    } catch (e: any) {
      toast.error(e.message || "Failed to generate pages")
    } finally {
      setIsGeneratingPages(false)
    }
  }

  const handleGenerateCover = async () => {
    if (!title) {
      toast.error("Title required")
      return
    }
    setIsGeneratingCover(true)
    try {
      const prompt = `${title} coloring book cover, ${theme} theme, clean layout, bold typography, high contrast`
      const res = await fetch("/api/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, title, subtitle, aspectRatio: "portrait" }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to generate cover")
      }
      const data = await res.json()
      setCoverUrl(data.coverUrl)
      setCoverId(data.coverId)
      toast.success("Generated professional cover")
    } catch (e: any) {
      toast.error(e.message || "Failed to generate cover")
    } finally {
      setIsGeneratingCover(false)
    }
  }

  const handleExportZip = async () => {
    if (pages.length === 0) {
      toast.error("No pages to export")
      return
    }
    setIsExporting(true)
    try {
      const urls = pages.map((p) => p.url)
      const pdfBlob = await generatePDF(urls, {
        title,
        subtitle,
        coverImage: coverUrl || undefined,
        addBlankPages: false,
        addPageNumbers: true,
        borderWidth: 0,
        paperSize,
        bleedMm,
      })
      const zip = new JSZip()
      zip.file("book.pdf", pdfBlob)
      if (coverUrl) {
        const c = await fetch(coverUrl)
        const cb = await c.blob()
        zip.file("cover.png", cb)
      }
      const sampleCount = Math.min(4, urls.length)
      for (let i = 0; i < sampleCount; i++) {
        const r = await fetch(urls[i])
        const b = await r.blob()
        zip.file(`samples/sample-${i + 1}.png`, b)
      }
      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-kdp.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Exported KDP ZIP")
    } catch (e: any) {
      toast.error(e.message || "Failed to export ZIP")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Bulk 30-Page Book Generator</h1>
      <p className="text-muted-foreground mb-6">Choose a theme, auto-generate 30 curated pages, generate a professional cover, and export a KDP-ready ZIP.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Book Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My 30-Page Coloring Book" />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Auto-generated themed collection" />
            </div>
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Animals">Animals</SelectItem>
                  <SelectItem value="Fantasy">Fantasy</SelectItem>
                  <SelectItem value="Kawaii">Kawaii</SelectItem>
                  <SelectItem value="Seasonal">Seasonal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paper Size</Label>
              <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PaperSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter 8.5×11</SelectItem>
                  <SelectItem value="kdp_8_5x11">KDP 8.5×11</SelectItem>
                  <SelectItem value="kdp_8x10">KDP 8×10</SelectItem>
                  <SelectItem value="a4">A4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bleed (mm)</Label>
              <div className="flex items-center gap-3">
                <Slider value={[bleedMm]} min={0} max={6} step={1} onValueChange={(v) => setBleedMm(v[0])} className="flex-1" />
                <span className="w-12 text-center">{bleedMm}mm</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleGeneratePages} disabled={isGeneratingPages}>
              {isGeneratingPages ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : (<>Generate 30 Pages</>)}
            </Button>
            <Button variant="secondary" onClick={handleGenerateCover} disabled={isGeneratingCover}>
              {isGeneratingCover ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : (<>Generate Professional Cover</>)}
            </Button>
            <Button onClick={handleExportZip} disabled={isExporting || pages.length === 0}>
              {isExporting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting...</>) : (<>Download Upload-ready ZIP</>)}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {pages.map((p, i) => (
              <div key={p.id} className="relative rounded-md overflow-hidden border">
                <img src={p.url} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                {coverUrl === p.url ? (
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-400" /> Cover
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" className="absolute bottom-2 right-2 h-7 opacity-90" onClick={() => setCoverUrl(p.url)}>
                    Make Cover
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-1 space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">Status</h3>
            <p className="text-sm text-muted-foreground">Pages: {pages.length}/30</p>
            <p className="text-sm text-muted-foreground">Cover: {coverUrl ? "Ready" : "Not generated"}</p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">Tips</h3>
            <p className="text-sm text-muted-foreground">Choose a theme that yields clean line art. Animals and Kawaii are safest.</p>
            <p className="text-sm text-muted-foreground">Use bleed if you want full-bleed printing on KDP.</p>
          </div>
        </div>
      </div>
    </div>
  )
}