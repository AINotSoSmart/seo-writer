"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { AspectRatio } from "@/types"
import { AspectRatioToggle } from "@/components/dashboard-layout/aspect-ratio-toggle"

interface CoverGeneratorProps {
  onCoverGenerated: (coverUrl: string, coverId: string) => void
  userCredits: number
}

const MAX_TITLE_LENGTH = 30 // About 6-7 words
const MAX_SUBTITLE_LENGTH = 40 // About 6-7 words
const MAX_ELEMENTS_LENGTH = 100


// Update the component to save state to sessionStorage
export function CoverGenerator({ onCoverGenerated, userCredits }: CoverGeneratorProps) {
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [coverElements, setCoverElements] = useState("")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("portrait")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string | null>(null)
  const [coverId, setCoverId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load saved state on component mount
  useEffect(() => {
    try {
      const savedState = sessionStorage.getItem("coverGeneratorState")
      if (savedState) {
        const parsedState = JSON.parse(savedState)
        setTitle(parsedState.title || "")
        setSubtitle(parsedState.subtitle || "")
        setCoverElements(parsedState.coverElements || "")
        setAspectRatio(parsedState.aspectRatio || "portrait")
        setGeneratedCoverUrl(parsedState.generatedCoverUrl || null)
        setCoverId(parsedState.coverId || null)

        // If we have a previously generated cover, notify the parent
        if (parsedState.generatedCoverUrl && parsedState.coverId) {
          onCoverGenerated(parsedState.generatedCoverUrl, parsedState.coverId)
        }
      }
    } catch (error) {
      console.error("Error loading saved cover generator state:", error)
    }
  }, [onCoverGenerated])

  // Save state whenever it changes
  useEffect(() => {
    try {
      const stateToSave = {
        title,
        subtitle,
        coverElements,
        aspectRatio,
        generatedCoverUrl,
        coverId,
      }
      sessionStorage.setItem("coverGeneratorState", JSON.stringify(stateToSave))
    } catch (error) {
      console.error("Error saving cover generator state:", error)
    }
  }, [title, subtitle, coverElements, aspectRatio, generatedCoverUrl, coverId])

  const generatePrompt = () => {
    let prompt = `A professional coloring book cover titled "${title}"`

    // Add cover elements
    if (coverElements) {
      prompt += `, featuring ${coverElements}`
    }


    // Add subtitle if provided
    if (subtitle) {
      prompt += `. The cover should have "${subtitle}" in fun, bold font at the top center`
    }


    // Add final instructions
    prompt += `. Use print-ready colors and layout similar to real book covers in bookstores. The design should be clear and appealing for a coloring book.`

    return prompt
  }

  // Update the handleGenerateCover function to save coverId
  const handleGenerateCover = async () => {
    if (userCredits < 5) {
      toast.error("Not enough credits", {
        description: "You need at least 5 credits to generate a cover.",
      })
      return
    }

    if (!title) {
      toast.error("Title required", {
        description: "Please enter a title for your coloring book.",
      })
      return
    }

    if (!coverElements) {
      toast.error("Cover elements required", {
        description: "Please describe what should appear on your cover.",
      })
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const prompt = generatePrompt()
      console.log("Sending cover generation request with prompt:", prompt)

      const response = await fetch("/api/generate-cover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          title,
          subtitle,
          aspectRatio,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server returned ${response.status}`)
      }

      // Only call response.json() once
      const data = await response.json()
      console.log("Cover generation response:", data)

      if (!data.coverUrl) {
        throw new Error("No cover URL returned from server")
      }

      // Success! We have a cover
      setIsGenerating(false)
      setGeneratedCoverUrl(data.coverUrl)
      setCoverId(data.coverId)

      // Pass both the URL and ID to the parent component
      onCoverGenerated(data.coverUrl, data.coverId)

      toast.success("Cover generated successfully", {
        description: "5 credits have been deducted from your account.",
      })
    } catch (error: any) {
      console.error("Error generating cover:", error)
      setIsGenerating(false)
      setError(error.message || "Failed to generate cover")
      toast.error("Failed to generate cover", {
        description: error.message || "Please try again later.",
      })
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Form Section */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">
            Book Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
            placeholder="My Coloring Book"
            maxLength={MAX_TITLE_LENGTH}
          />
          <p className="text-xs text-muted-foreground">
            {title.length}/{MAX_TITLE_LENGTH} characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subtitle">Subtitle (Optional)</Label>
          <Input
            id="subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value.slice(0, MAX_SUBTITLE_LENGTH))}
            placeholder="Let's Color Together!"
            maxLength={MAX_SUBTITLE_LENGTH}
          />
          <p className="text-xs text-muted-foreground">
            {subtitle.length}/{MAX_SUBTITLE_LENGTH} characters
          </p>
        </div>

        

        <div className="space-y-2">
          <Label htmlFor="elements">
            Cover Elements <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="elements"
            value={coverElements}
            onChange={(e) => setCoverElements(e.target.value.slice(0, MAX_ELEMENTS_LENGTH))}
            placeholder="e.g., a happy cartoon lion and monkey, jungle with trees and flowers"
            maxLength={MAX_ELEMENTS_LENGTH}
          />
          <p className="text-xs text-muted-foreground">
            Describe what should appear on the cover (animals, objects, scenery)
          </p>
        </div>

        

        <AspectRatioToggle value={aspectRatio} onChange={setAspectRatio} />

        <div className="pt-4">
          <Button
            onClick={handleGenerateCover}
            disabled={isGenerating || !title || !coverElements || userCredits < 5}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>Generate Cover (5 Credits)</>
            )}
          </Button>
          <p className="text-xs text-center mt-2 text-muted-foreground">You have {userCredits} credits available</p>

          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Section */}
      <div className="flex flex-col space-y-4">
        <h3 className="text-lg font-medium">Cover Preview</h3>

        {(() => {
          const aspectClass =
            aspectRatio === "letter"
              ? "aspect-[85/110]"
              : aspectRatio === "portrait"
              ? "aspect-[3/4]"
              : aspectRatio === "landscape"
              ? "aspect-[4/3]"
              : "aspect-square"
          return (
            generatedCoverUrl ? (
              <div className="relative">
                <Card className={`overflow-hidden ${aspectClass} shadow-md`}>
                  <img
                    src={generatedCoverUrl || "/placeholder.svg"}
                    alt="Generated book cover"
                    className="w-full h-full object-cover"
                  />
                </Card>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleGenerateCover}
                  disabled={isGenerating || userCredits < 5}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            ) : (
              <div className={`flex items-center justify-center ${aspectClass} bg-muted rounded-lg border-2 border-dashed p-8`}>
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">
                    {isGenerating ? "Generating your cover... Please wait" : "Your cover will appear here"}
                  </p>
                  {isGenerating && <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />}
                </div>
              </div>
            )
          )
        })()}

        <p className="text-xs text-muted-foreground">
          Generated covers are high-quality images suitable for print and digital use.
        </p>
      </div>
    </div>
  )
}