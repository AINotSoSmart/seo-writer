"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { generateUUID } from "@/lib/utils"

interface SaveBookParams {
  title: string
  subtitle?: string
  imageIds: string[]
  coverId?: string | null
  options?: {
    addBlankPages: boolean
    addPageNumbers: boolean
    borderWidth: number
    paperSize?: "letter" | "kdp_8_5x11" | "kdp_8x10" | "a4"
    bleedMm?: number
  }
}

export async function saveColoringBook({ title, subtitle, imageIds, coverId, options }: SaveBookParams) {
  console.log("saveColoringBook called with params:", {
    title,
    subtitle,
    imageIds: imageIds.length,
    hasCoverId: !!coverId,
    options,
  })

  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("Authentication error:", userError)
      return { success: false, error: "You must be logged in to save a coloring book" }
    }

    console.log("User authenticated:", user.id)

    // Generate a unique ID for the book
    const bookId = generateUUID()
    console.log("Generated book ID:", bookId)

    // Create page order array
    const pageOrder = Array.from({ length: imageIds.length }, (_, i) => i)
    console.log("Page order:", pageOrder)

    // Prepare data for insertion - match exactly what's in the database schema
    const bookData = {
      id: bookId,
      user_id: user.id,
      title,
      subtitle: subtitle || null,
      image_ids: imageIds,
      page_order: pageOrder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cover_id: coverId || null,
      options: options || null,
      credits_paid: true, // Mark as paid since we deduct credits when saving
    }

    console.log("Book data to insert:", {
      ...bookData,
      image_ids: bookData.image_ids.length,
    })

    // Save the book to the database
    const { error } = await supabase.from("coloring_books").insert(bookData)

    if (error) {
      console.error("Error saving coloring book:", error)
      return { success: false, error: `Failed to save coloring book: ${error.message}` }
    }

    console.log("Book saved successfully with ID:", bookId)

    // If we have a cover ID, update it with the book ID
    if (coverId) {
      console.log("Updating cover image with book ID:", bookId)
      const { error: coverUpdateError } = await supabase
        .from("cover_images")
        .update({ book_id: bookId })
        .eq("id", coverId)
        .eq("user_id", user.id)

      if (coverUpdateError) {
        console.error("Error updating cover image:", coverUpdateError)
        // Non-critical error, continue with book creation
      } else {
        console.log("Cover image updated successfully with book ID")
      }
    }

    // Revalidate the books page
    revalidatePath("/books")

    return { success: true, bookId }
  } catch (error: any) {
    console.error("Error in saveColoringBook:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function getUserBooks() {
  console.log("getUserBooks called")

  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("Authentication error:", userError)
      return { success: false, error: "You must be logged in to view your coloring books" }
    }

    console.log("User authenticated:", user.id)

    const { data: books, error } = await supabase
      .from("coloring_books")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching coloring books:", error)
      return { success: false, error: "Failed to fetch coloring books" }
    }

    const coverIds = (books || [])
      .map((b: any) => b.cover_id)
      .filter((id: string | null) => !!id)

    let coversMap: Record<string, { id: string; image_url: string }> = {}
    if (coverIds.length > 0) {
      const { data: covers, error: coverError } = await supabase
        .from("cover_images")
        .select("id, image_url")
        .in("id", coverIds)
        .eq("user_id", user.id)
      if (!coverError && covers) {
        coversMap = covers.reduce((acc: any, c: any) => {
          acc[c.id] = c
          return acc
        }, {})
      }
    }

    const enrichedBooks = (books || []).map((b: any) => ({
      ...b,
      cover: b.cover_id ? coversMap[b.cover_id] || null : null,
    }))

    console.log(`Fetched ${enrichedBooks.length} books for user`)

    return { success: true, books: enrichedBooks }
  } catch (error: any) {
    console.error("Error in getUserBooks:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function getBookById(bookId: string) {
  console.log("getBookById called with ID:", bookId)

  try {
    const supabase = await createClient()

    // Get the book with its cover image
    console.log("Fetching book details from database")
    const { data: book, error } = await supabase
      .from("coloring_books")
      .select("*")
      .eq("id", bookId)
      .single()

    if (error) {
      console.error("Error fetching coloring book:", error)
      return { success: false, error: "Failed to fetch coloring book" }
    }

    console.log("Book details:", book)

    // Explicitly set the cover_image property for the PDF generator
    let coverImageUrl = null
    if (book.cover_images && book.cover_images.length > 0) {
      coverImageUrl = book.cover_images[0].image_url
      console.log("Found cover image URL:", coverImageUrl)
    } else if (book.cover_id) {
      // Try to fetch the cover image directly if the join didn't work
      const { data: coverImage } = await supabase
        .from("cover_images")
        .select("image_url")
        .eq("id", book.cover_id)
        .single()

      if (coverImage) {
        coverImageUrl = coverImage.image_url
        console.log("Found cover image URL from direct query:", coverImageUrl)
      }
    }

    // Add the cover image URL to the book object
    book.cover_image = coverImageUrl

    // Get the images
    const imageIds = book.image_ids
    console.log("Image IDs from book:", imageIds)

    // Determine which images are from which table
    const regularImageIds = imageIds.filter((id: string) => !id.includes("gemini"))
    const geminiImageIds = imageIds.filter((id: string) => id.includes("gemini"))

    console.log("Regular image IDs:", regularImageIds)
    console.log("Gemini image IDs:", geminiImageIds)

    // Fetch images from both tables
    console.log("Fetching images from databases")
    const [regularImagesResult, geminiImagesResult] = await Promise.all([
      regularImageIds.length > 0
        ? supabase.from("images").select("*").in("id", regularImageIds)
        : { data: [], error: null },
      geminiImageIds.length > 0
        ? supabase.from("gemini_images").select("*").in("id", geminiImageIds)
        : { data: [], error: null },
    ])

    if (regularImagesResult.error) {
      console.error("Error fetching regular images:", regularImagesResult.error)
      return { success: false, error: "Failed to fetch images" }
    }

    if (geminiImagesResult.error) {
      console.error("Error fetching gemini images:", geminiImagesResult.error)
      return { success: false, error: "Failed to fetch images" }
    }

    console.log(`Fetched ${regularImagesResult.data?.length || 0} regular images`)
    console.log(`Fetched ${geminiImagesResult.data?.length || 0} gemini images`)

    // Transform gemini images to match regular images format
    const transformedGeminiImages = (geminiImagesResult.data || []).map((img) => ({
      ...img,
      image_url: img.coloring_page_url,
      source: "gemini",
    }))

    // Add source field to regular images
    const transformedRegularImages = (regularImagesResult.data || []).map((img) => ({
      ...img,
      source: "regular",
    }))

    // Combine all images
    const allImages = [...transformedRegularImages, ...transformedGeminiImages]
    console.log("Combined images count:", allImages.length)

    // Sort images according to the order in image_ids
    const orderedImages = imageIds
      .map((id: string) => {
        const foundImage = allImages.find((img) => img.id === id)
        if (!foundImage) {
          console.warn(`Image with ID ${id} not found in fetched images`)
        }
        return foundImage
      })
      .filter(Boolean)

    console.log("Final ordered images count:", orderedImages.length)

    return {
      success: true,
      book: {
        ...book,
        images: orderedImages,
        cover_image: book.cover_image, // Ensure this is included
      },
    }
  } catch (error: any) {
    console.error("Error in getBookById:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function deleteBook(bookId: string) {
  console.log("deleteBook called with ID:", bookId)

  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("Authentication error:", userError)
      return { success: false, error: "You must be logged in to delete a coloring book" }
    }

    console.log("User authenticated:", user.id)

    // Delete the book
    const { error } = await supabase.from("coloring_books").delete().eq("id", bookId).eq("user_id", user.id)

    if (error) {
      console.error("Error deleting coloring book:", error)
      return { success: false, error: "Failed to delete coloring book" }
    }

    console.log("Book deleted successfully")

    // Revalidate the books page
    revalidatePath("/books")

    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteBook:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
