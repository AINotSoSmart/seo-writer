import { GoogleGenAI } from "@google/genai"

// Initialize the Gemini API client
let geminiClient: GoogleGenAI | null = null

export function getGeminiClient() {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }

  if (!geminiClient) {
    throw new Error("Gemini API key is not configured")
  }

  return geminiClient
}

// Function to convert image to base64 - client-side version
export async function imageToBase64Client(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      if (typeof reader.result === "string") {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(",")[1]
        resolve(base64)
      } else {
        reject(new Error("Failed to convert image to base64"))
      }
    }
    reader.onerror = (error) => reject(error)
  })
}

// Server-side function to convert Buffer to base64
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64")
}

// Function to convert base64 to blob - client-side version
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64)
  const byteArrays = []

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024)

    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  return new Blob(byteArrays, { type: mimeType })
}
