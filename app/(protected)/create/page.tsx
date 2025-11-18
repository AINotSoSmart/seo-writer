"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import type { AspectRatio, GenerateImageParams } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AspectRatioToggle } from "@/components/dashboard-layout/aspect-ratio-toggle"
import { NumberOfImagesToggle } from "@/components/dashboard-layout/number-of-images-toggle"
import { PromptInput } from "@/components/dashboard-layout/prompt-input"
import { GeneratingIndicator } from "@/components/dashboard-layout/generating-indicator"
import { Icons } from "@/components/icons"
import { toast } from "@/components/ui/use-toast"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { downloadImage } from "@/lib/utils"
import { ImagePreviewModal } from "@/components/ui/image-preview-modal"
import { Eye, Download as DownloadIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCreditManager, makeApiCallWithCreditUpdate } from "@/lib/credit-manager"

export default function CreatePage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("square")
  const [numImages, setNumImages] = useState(1)
  const [prompt, setPrompt] = useState("")
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  
  const [generationPhase, setGenerationPhase] = useState<"idle" | "queued" | "running" | "done" | "failed">("idle")
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const { balance: currentBalance } = useCreditManager(user?.id ?? null)

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase.from("users_metadata").select("*").eq("id", user.id).single()

        if (data) {
          setUser({
            id: user.id,
            email: user.email,
            ...data,
          })
        } else {
          setUser({ id: user.id, email: user.email, credits: 0 })
        }
      } else {
        router.push("/sign-in")
      }
    }

    fetchUser()
  }, [supabase, router])

  const handleGenerate = async (inputPrompt: string) => {
    if (!user) return

    if (currentBalance < numImages) {
      setShowUpgradeDialog(true)
      return
    }

    setIsLoading(true)
    setGenerationPhase("queued")
    setPrompt(inputPrompt)
    // Keep previous images to support additive loading

    try {
      const params: GenerateImageParams = {
        prompt: inputPrompt,
        aspectRatio,
        numImages,
        model: "sana", // Default model, can be changed via env
      }
      const queueResp = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      })
      if (!queueResp.ok) {
        const err = await queueResp.json()
        throw new Error(err.error || "Failed to queue generation")
      }
      const queueData = await queueResp.json()

      let completed = false
      for (let i = 0; i < 60; i++) {
        if (i === 0) {
          setGenerationPhase("running")
        }
        const statusResp = await fetch(`/api/generate/status?requestId=${encodeURIComponent(queueData.requestId)}&model=${encodeURIComponent(queueData.model)}`)
        if (!statusResp.ok) {
          const err = await statusResp.json()
          throw new Error(err.error || "Failed to check status")
        }
        const statusData = await statusResp.json()
        if (statusData.status === "COMPLETED" || statusData.status === "completed" || statusData.done === true) {
          completed = true
          break
        }
        if (statusData.status === "FAILED" || statusData.status === "failed" || statusData.error) {
          throw new Error(statusData.error || "Generation failed")
        }
        await new Promise((r) => setTimeout(r, 2000))
      }

      if (!completed) {
        throw new Error("Generation timed out")
      }

      const resultData = await makeApiCallWithCreditUpdate<any>(
        () =>
          fetch(
            `/api/generate/result?requestId=${encodeURIComponent(queueData.requestId)}&model=${encodeURIComponent(queueData.model)}&prompt=${encodeURIComponent(params.prompt)}&aspectRatio=${encodeURIComponent(params.aspectRatio)}&numImages=${params.numImages}`,
          ),
        user.id,
      )
      setGeneratedImages((prev) => [...prev, ...(resultData.images || [])])
      setGenerationPhase("done")

      if (typeof resultData.newBalance === "number") {
        toast({
          title: "Images generated successfully",
          description: `Used ${numImages} credit${numImages > 1 ? "s" : ""}. You have ${resultData.newBalance} credit${resultData.newBalance !== 1 ? "s" : ""} left.`,
        })
      } else {
        toast({
          title: "Images generated successfully",
          description: `Used ${numImages} credit${numImages > 1 ? "s" : ""}.`,
        })
      }
    } catch (error: any) {
      setGenerationPhase("failed")
      toast({
        title: "Error generating images",
        description: error.message || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (imageUrl: string) => {
    try {
      const filename = `coloring-page-${Date.now()}.png`
      await downloadImage(imageUrl, filename)
      toast({ title: "Image downloaded" })
    } catch (error: any) {
      toast({ title: "Failed to download image", description: error.message || "Please try again", variant: "destructive" })
    }
  }

  const aspectClass =
    aspectRatio === "letter"
      ? "aspect-[85/110]"
      : aspectRatio === "portrait"
      ? "aspect-[3/4]"
      : aspectRatio === "landscape"
      ? "aspect-[4/3]"
      : "aspect-square"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Create Coloring Page</h2>
          <p className="text-muted-foreground">Generate beautiful coloring pages with AI.</p>
        </div>

        

        {generatedImages.length === 0 && !isLoading && (
          <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
            Enter a prompt and generate to see results here.
          </div>
        )}

        <div className={`grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3`}>
          {generatedImages.map((imageUrl, index) => (
            <Card key={`img-${index}`} className="overflow-hidden py-0 p-2">
              <div className={`relative ${aspectClass}`}>
                <img src={imageUrl || "/placeholder.svg"} alt={`Generated coloring page ${index + 1}`} className="object-cover w-full h-full" />
                <div className="absolute top-2 left-2">
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-lg bg-black/80 text-white hover:bg-black shadow-sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setPreviewImageUrl(imageUrl)
                      setIsPreviewOpen(true)
                    }}
                    aria-label="Preview image"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute top-2 right-2">
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-lg bg-black/80 text-white hover:bg-black shadow-sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDownload(imageUrl)
                    }}
                    aria-label="Download image"
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {isLoading && Array.from({ length: numImages }).map((_, index) => (
            <Card key={`loader-${index}`} className="overflow-hidden py-0 p-2">
              <div className={`relative ${aspectClass}`}>
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Icons.spinner className="h-6 w-6 animate-spin text-primary" />
                </div>
                <div className="absolute top-2 left-2">
                  <span className="text-[11px] bg-black/60 text-white rounded px-2 py-0.5">
                    {generationPhase === "queued" ? "Queued" : generationPhase === "running" ? "Running" : generationPhase === "done" ? "Done" : generationPhase === "failed" ? "Failed" : ""}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-20">
        <Card>
          <CardContent className="px-4">
            <div className="space-y-4">
              <Accordion type="single" collapsible defaultValue="settings">
                <AccordionItem value="settings">
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <AspectRatioToggle value={aspectRatio} onChange={setAspectRatio} />
                      <NumberOfImagesToggle value={numImages} onChange={setNumImages} max={Math.max(currentBalance || 0, 1)} />
                      
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="pt-2">
                <PromptInput onSubmit={handleGenerate} isLoading={isLoading} defaultValue={prompt} onChange={setPrompt} />
              </div>

              <Button
                onClick={() => handleGenerate(prompt)}
                disabled={isLoading || !prompt.trim()}
                className="w-full bg-black hover:bg-black/90 text-white"
              >
                {isLoading ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ImagePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        imageUrl={previewImageUrl || ""}
        prompt=""
      />

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not enough credits</DialogTitle>
            <DialogDescription>
              You need {numImages} credit{numImages > 1 ? "s" : ""} to generate {numImages} image
              {numImages > 1 ? "s" : ""}, but you only have {currentBalance || 0} credit{(currentBalance || 0) !== 1 ? "s" : ""} left.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>Cancel</Button>
            <Button onClick={() => router.push("/subscription")}>Upgrade</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
