"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Link as LinkIcon, Image as ImageIcon, Trash2, Check } from "lucide-react"

interface LinkSelectorProps {
    editor: any
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    url: string
    setUrl: (url: string) => void
}

export function LinkSelector({ editor, isOpen, setIsOpen, url, setUrl }: LinkSelectorProps) {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
        } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
        }
        setIsOpen(false)
    }

    const removeLink = () => {
        editor.chain().focus().extendMarkRange("link").unsetLink().run()
        setIsOpen(false)
        setUrl("")
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 ${editor.isActive("link") ? "bg-muted" : ""}`}
                >
                    <LinkIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                    <h4 className="font-medium leading-none mb-2">Edit Link</h4>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Paste link URL..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="h-8"
                        />
                        <Button type="submit" size="sm" className="h-8 w-8 p-0">
                            <Check className="h-4 w-4" />
                        </Button>
                    </div>
                    {editor.isActive("link") && (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={removeLink}
                            className="h-8 mt-2 w-full"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Link
                        </Button>
                    )}
                </form>
            </PopoverContent>
        </Popover>
    )
}

interface ImageSelectorProps {
    editor: any
    isOpen: boolean
    setIsOpen: (open: boolean) => void
}

export function ImageSelector({ editor, isOpen, setIsOpen }: ImageSelectorProps) {
    const [url, setUrl] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (url) {
            editor.chain().focus().setImage({ src: url }).run()
            setIsOpen(false)
            setUrl("")
        }
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                >
                    <ImageIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                    <h4 className="font-medium leading-none mb-2">Embed Image</h4>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Paste image URL..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="h-8"
                        />
                        <Button type="submit" size="sm" className="h-8 w-8 p-0">
                            <Check className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Paste a direct link to an image (jpg, png, webp)
                    </p>
                </form>
            </PopoverContent>
        </Popover>
    )
}
