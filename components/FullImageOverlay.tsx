import React from 'react'
import { X } from 'lucide-react'

interface FullImageOverlayProps {
  imageUrl: string
  onClose: () => void
}

const FullImageOverlay: React.FC<FullImageOverlayProps> = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
      <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
        <img
          src={imageUrl || "/placeholder.svg"}
          alt="Full size image"
          className="max-w-full max-h-full object-contain"
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  )
}

export default FullImageOverlay
