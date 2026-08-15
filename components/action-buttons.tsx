"use client"

import { Plus, RotateCcw, Download } from "lucide-react"

interface ActionButtonsProps {
  onUploadClick: () => void
  onResetClick: () => void
  onExportClick: () => void
}

export default function ActionButtons({ onUploadClick, onResetClick, onExportClick }: ActionButtonsProps) {
  return (
    <div className="flex justify-center mt-3">
      <div className="flex items-center gap-2 px-3 py-1 border-2 border-black rounded-xl dark-shadow bg-white">
        <button
          onClick={onUploadClick}
          className="cursor-pointer w-8 h-8 rounded-full border border-black bg-white hover:bg-gray-50 flex items-center justify-center transition-colors dark-shadow"
          aria-label="Upload new image"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onResetClick}
          className="cursor-pointer w-8 h-8 rounded-full border dark-shadow border-black bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
          aria-label="Reset all settings"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onExportClick}
          className="cursor-pointer w-8 h-8 rounded-full border dark-shadow border-black bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
          aria-label="Export image"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}