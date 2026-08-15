import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export async function downloadImage(imageUrl: string, filename: string): Promise<boolean> {
  try {
    // Try to use the Fetch API to get the image as a blob
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error("Failed to fetch image")

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up the blob URL
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100)

    return true
  } catch (error) {
    console.error("Download failed, falling back to direct download", error)

    // Fallback method
    const link = document.createElement("a")
    link.href = imageUrl
    link.download = filename
    link.target = "_self" // Ensure it doesn't open in a new tab
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    return true
  }
}

// Utility function to generate a UUID if crypto is not available
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}