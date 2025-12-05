"use client"

import { useState } from "react"
import { BlogWriterIsland } from "@/components/blog-writer-island"

export default function TestIslandPage() {
    const [keyword, setKeyword] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [titles, setTitles] = useState<string[]>([])
    const [selectedTitle, setSelectedTitle] = useState("")

    const handleGenerateTitles = () => {
        setIsGenerating(true)
        setTimeout(() => {
            setIsGenerating(false)
            setTitles([
                "10 AI Marketing Trends for 2025",
                "How to Use AI for SEO Optimization",
                "The Future of Content Creation with AI",
                "Why Agentic Workflows are the Next Big Thing",
                "Mastering Blog Writing with AI Tools"
            ])
        }, 2000)
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-black">
            <BlogWriterIsland
                keyword={keyword}
                onKeywordChange={setKeyword}
                onSubmit={handleGenerateTitles}
                isGenerating={isGenerating}
                titles={titles}
                selectedTitle={selectedTitle}
                onSelectTitle={setSelectedTitle}
                onGenerateArticle={() => alert("Generate Article Clicked")}
                isLoading={false}
                onBack={() => {
                    setTitles([])
                    setSelectedTitle("")
                }}
            />
        </div>
    )
}
