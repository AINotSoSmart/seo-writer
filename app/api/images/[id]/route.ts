import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { deleteFileFromStorage } from "@/lib/storage-utils"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const imageId = params.id
    if (!imageId) {
      return NextResponse.json({ error: "Image ID is required" }, { status: 400 })
    }

    console.log(`Starting deletion process for image ID: ${imageId}`)
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(`User authenticated: ${user.id}`)

    // Get the image to find its storage path
    const { data: image, error: fetchError } = await supabase
      .from("images")
      .select("*")
      .eq("id", imageId)
      .eq("user_id", user.id)
      .single()

    if (fetchError) {
      console.error("Error fetching image:", fetchError)
      return NextResponse.json({ error: "Failed to fetch image details" }, { status: 500 })
    }

    if (!image) {
      console.error("Image not found or access denied")
      return NextResponse.json({ error: "Image not found or access denied" }, { status: 404 })
    }

    console.log(`Image found:`, { id: image.id, url: image.image_url })

    // Storage deletion
    let storageResult: { success: boolean; error?: unknown } = { success: false }

    if (image.image_url) {
      storageResult = await deleteFileFromStorage(supabase, image.image_url)
      console.log("Storage deletion result:", storageResult)
    } else {
      console.warn("Image URL is empty or null")
    }

    // Delete from database regardless of storage deletion result
    console.log("Attempting database deletion")
    const { error: dbError } = await supabase.from("images").delete().eq("id", imageId).eq("user_id", user.id)

    if (dbError) {
      console.error("Database deletion error:", dbError)
      return NextResponse.json(
        {
          error: "Failed to delete image record from database",
          details: dbError.message,
        },
        { status: 500 },
      )
    }

    console.log("Database deletion successful")

    // Return appropriate response
    if (storageResult.success) {
      return NextResponse.json({
        success: true,
        storageDeleted: true,
        databaseDeleted: true,
        message: "Image deleted successfully from both storage and database",
      })
    } else {
      return NextResponse.json({
        success: true,
        storageDeleted: false,
        databaseDeleted: true,
        message: "Image record deleted from database, but there was an issue removing the file from storage",
        storageError: storageResult.error ? String(storageResult.error) : undefined,
      })
    }
  } catch (error: any) {
    console.error("Unexpected error during image deletion:", error)
    return NextResponse.json(
      {
        error: "Failed to delete image",
        details: error.message || "Unknown error",
      },
      { status: 500 },
    )
  }
}
