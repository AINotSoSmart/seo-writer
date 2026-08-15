"use client"

import { Facebook, Linkedin, Twitter } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SocialShareProps {
  url: string
  title: string
}

export function SocialShare({ url, title }: SocialShareProps) {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const share = (platform: "facebook" | "twitter" | "linkedin") => {
    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
    }
    window.open(urls[platform], "_blank", "width=600,height=400")
  }

  return (
    <div className="flex items-center gap-2 my-4">
      <span className="text-sm text-gray-600">Share:</span>
      <Button variant="ghost" size="icon" onClick={() => share("facebook")}>
        <Facebook className="h-4 w-4" />
        <span className="sr-only">Share on Facebook</span>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => share("linkedin")}>
        <Linkedin className="h-4 w-4" />
        <span className="sr-only">Share on LinkedIn</span>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => share("twitter")}>
        <Twitter className="h-4 w-4" />
        <span className="sr-only">Share on Twitter</span>
      </Button>
    </div>
  )
}

