import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getQueueResult } from "@/utils/fal/generate"
import { creditService } from "@/lib/credits"

export async function GET(request: Request) {
 try {
    // 1. Authentication Check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get request ID and model from query params
    const url = new URL(request.url)
    const requestId = url.searchParams.get("requestId")
    const model = url.searchParams.get("model")
    const prompt = url.searchParams.get("prompt")
    const aspectRatio = url.searchParams.get("aspectRatio")
    const numImagesStr = url.searchParams.get("numImages")
    const numImages = numImagesStr ? Number.parseInt(numImagesStr) : 1

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 })
    }

    // Get queue result (images from FAL.ai)
    const falImages = await getQueueResult(requestId)

    // If prompt and aspectRatio are provided, store images in database
    if (prompt && aspectRatio && falImages.length > 0) {
      const storedRecords = await Promise.all(
        falImages.map(async (imageUrl, index) => {
          try {
            const response = await fetch(imageUrl)
            if (!response.ok) {
              console.error(`Failed to fetch image from FAL: ${response.statusText}`)
              return { id: null, url: imageUrl }
            }

            const blob = await response.blob()

            const filename = `private/${user.id}-${Date.now()}-${index}-${prompt.slice(0, 20).replace(/[^a-z0-9]/gi, "_")}.png`

            const { error: uploadError } = await supabase.storage.from("coloring-pages").upload(filename, blob, {
              contentType: "image/png",
              upsert: true,
            })

            if (uploadError) {
              console.error("Storage upload error:", uploadError)
              return { id: null, url: imageUrl }
            }

            const { data: publicUrlData } = supabase.storage.from("coloring-pages").getPublicUrl(filename)

            const { data: inserted, error: insertError } = await supabase
              .from("images")
              .insert({
                user_id: user.id,
                prompt,
                image_url: publicUrlData.publicUrl,
                aspect_ratio: aspectRatio,
                model: "flux-1/schnell",
              })
              .select("id,image_url")
              .single()

            if (insertError || !inserted) {
              console.error("DB insert error:", insertError)
              return { id: null, url: publicUrlData.publicUrl }
            }

            return { id: inserted.id, url: inserted.image_url }
          } catch (error) {
            console.error("Error processing image:", error)
            return { id: null, url: imageUrl }
          }
        }),
      )

      const deduction = await creditService.deductCredits(user.id, numImages, "Text-to-image generation")
      if (!deduction.success) {
        return NextResponse.json({ error: deduction.error || "Failed to deduct credits" }, { status: 400 })
      }
      return NextResponse.json({ images: storedRecords, newBalance: deduction.newBalance })
    }

    // If we couldn't store in Supabase Storage, return the original FAL.ai URLs
    return NextResponse.json({ images: falImages })
  } catch (error: any) {
    console.error("Error getting queue result:", error)
    return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 })
  }
}
