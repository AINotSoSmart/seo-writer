import { Loader2 } from "lucide-react"

export function ImagePlaceholder() {
  return (
    <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  )
}

