"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface StyleCard {
  id: string
  title: string
  imageUrl: string
  prompt: string
  category: string
}

const sampleStyleCards: StyleCard[] = [
  {
    id: "1",
    title: "Romantic Beach Sunset",
    imageUrl: "/content/glamour1.webp",
    prompt: "A couple walking hand in hand along a sandy beach at sunset, silhouetted against the orange sky",
    category: "Couples",
  },
  {
    id: "2",
    title: "Coffee Shop Friends",
    imageUrl: "/content/glamour2.webp",
    prompt: "Two friends sitting at a small table in a cozy cafe, laughing and enjoying coffee together",
    category: "Friends",
  },
  {
    id: "3",
    title: "Romantic Dinner Date",
    imageUrl: "/content/glamour3.webp",
    prompt: "A couple sitting at a restaurant table, enjoying a romantic candlelit dinner with wine glasses",
    category: "Dating",
  },
  {
    id: "4",
    title: "Business Presentation",
    imageUrl: "/content/glamour4.webp",
    prompt: "Two professionally dressed colleagues standing in front of a whiteboard, giving a business presentation",
    category: "Business",
  },
  {
    id: "5",
    title: "Romantic Beach Sunset",
    imageUrl: "/content/glamour5.webp",
    prompt: "A couple walking hand in hand along a sandy beach at sunset, silhouetted against the orange sky",
    category: "Couples",
  },
  {
    id: "6",
    title: "Coffee Shop Friends",

    imageUrl: "/content/glamour6.webp",
    prompt: "Two friends sitting at a small table in a cozy cafe, laughing and enjoying coffee together",
    category: "Friends",
  },
  {
    id: "7",
    title: "Romantic Dinner Date",
    imageUrl: "/content/glamour7.webp",
    prompt: "A couple sitting at a restaurant table, enjoying a romantic candlelit dinner with wine glasses",
    category: "Dating",
  },
  {
    id: "8",
    title: "Business Presentation",
    imageUrl: "/content/glamour8.webp",
    prompt: "Two professionally dressed colleagues standing in front of a whiteboard, giving a business presentation",
    category: "Business",
  },
  // Add more sample cards as needed
]

interface StyleCardsProps {
  onUsePrompt: (prompt: string) => void
  formRef: React.RefObject<HTMLDivElement>
}

export function StyleCards({ onUsePrompt, formRef }: StyleCardsProps) {
  const [activeTab, setActiveTab] = useState("Dating")
  const categories = ["Dating", "Friends", "Couples", "Business"]

  const handleUseClick = (prompt: string) => {
    onUsePrompt(prompt)
    // Smooth scroll to form
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="w-full space-y-6">
      {/* Custom dark tabs */}
      <div className="flex flex-wrap justify-center gap-2 px-4">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveTab(category)}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
              activeTab === category
                ? "bg-gray-800 text-white shadow-lg shadow-gray-800/20"
                : "bg-gray-900/10 text-gray-600 hover:bg-gray-900/20",
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Style cards grid - adjusted for smaller cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {sampleStyleCards
          .filter((card) => card.category === activeTab)
          .map((card) => (
            <Card key={card.id} className="group relative aspect-[3/4] overflow-hidden border-0 bg-transparent">
              <CardContent className="p-0 h-full">
                <div className="relative h-full">
                  <img
                    src={card.imageUrl || "/placeholder.svg"}
                    alt={card.title}
                    className="absolute inset-0 w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-lg" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                    <h3 className="text-xs font-medium mb-1 line-clamp-1">{card.title}</h3>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors text-xs py-1"
                      onClick={() => handleUseClick(card.prompt)}
                    >
                      Use
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  )
}

