import { useState, useRef, useCallback, useEffect } from "react"

interface UseImageUploadProps {
  setHasImage: (hasImage: boolean) => void
  onImageLoad?: (imageUrl: string) => void
  imageUrl: string | null
  setImageUrl: (url: string | null) => void
}

export function useImageUpload({ setHasImage, onImageLoad, imageUrl, setImageUrl }: UseImageUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load image from local storage on mount
  useEffect(() => {
    const storedImageUrl = localStorage.getItem("pfp_editor_image_url")
    if (storedImageUrl && !imageUrl) {
      setImageUrl(storedImageUrl)
      setHasImage(true)
      onImageLoad?.(storedImageUrl)
    }
  }, [setHasImage, onImageLoad, imageUrl, setImageUrl])

  // Save image to local storage when imageUrl changes (guard against quota)
  useEffect(() => {
    try {
      if (imageUrl) {
        const MAX_CHARS = 4 * 1024 * 1024 // ~4MB safety cap for base64 strings
        if (imageUrl.length <= MAX_CHARS) {
          localStorage.setItem("pfp_editor_image_url", imageUrl)
        } else {
          // Too large to persist reliably; avoid quota errors
          localStorage.removeItem("pfp_editor_image_url")
          console.warn("Skipped persisting image: exceeds localStorage quota")
        }
      } else {
        localStorage.removeItem("pfp_editor_image_url")
      }
    } catch (err) {
      // QuotaExceededError or storage disabled
      console.warn("Failed to persist image to localStorage:", err)
    }
  }, [imageUrl])

  // Convert file to Data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(reader.result as string)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type.startsWith("image/")) {
        const dataUrl = await fileToDataUrl(file)
        setImageUrl(dataUrl)
        setHasImage(true)
        onImageLoad?.(dataUrl)
      }
    }
  }

  const handleDragOver = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      const files = e.dataTransfer.files
      if (files && files[0] && files[0].type.startsWith("image/")) {
        const file = files[0]
        const dataUrl = await fileToDataUrl(file)
        setImageUrl(dataUrl)
        setHasImage(true)
        onImageLoad?.(dataUrl)
      }
    },
    [setHasImage, onImageLoad],
  )

  return {
    fileInputRef,
    dragOver,
    setDragOver,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
