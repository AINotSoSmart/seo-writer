"use client"

import { Editor } from "@tiptap/react"
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Code,
    List,
    ListOrdered,
    ListChecks,
    Quote,
    Minus,
    Undo,
    Redo,
    Superscript,
    Subscript,
    ChevronDown,
    Type,
    Heading1,
    Heading2,
    Heading3,
    Table as TableIcon,
    PlusCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useCallback, useState, useEffect } from "react"
import { LinkSelector, ImageSelector } from "./LinkImageSelector"
import { AITokenIndicator } from "../AITokenIndicator"

interface ToolbarProps {
    editor: Editor
}

export function Toolbar({ editor }: ToolbarProps) {
    const [isLinkOpen, setIsLinkOpen] = useState(false)
    const [isImageOpen, setIsImageOpen] = useState(false)
    const [linkUrl, setLinkUrl] = useState("")

    const openLinkSelector = useCallback(() => {
        const previousUrl = editor.getAttributes("link").href
        setLinkUrl(previousUrl || "")
        setIsLinkOpen(true)
    }, [editor])

    const openImageSelector = useCallback(() => {
        setIsImageOpen(true)
    }, [])

    const addTable = useCallback(() => {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    }, [editor])

    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    if (isMobile) {
        return (
            <TooltipProvider delayDuration={0}>
                <div className="flex items-center justify-between gap-0.5 p-1.5 bg-muted/30 overflow-x-auto no-scrollbar">
                    {/* History Group */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editor.chain().focus().undo().run()}
                            disabled={!editor.can().undo()}
                            className="h-7 w-7 p-0"
                        >
                            <Undo className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editor.chain().focus().redo().run()}
                            disabled={!editor.can().redo()}
                            className="h-7 w-7 p-0"
                        >
                            <Redo className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

                    {/* Headings */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1 shrink-0 px-1">
                                <Type className="h-3.5 w-3.5" />
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                                <Type className="h-4 w-4 mr-2" />
                                Paragraph
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                                <Heading1 className="h-4 w-4 mr-2" />
                                Heading 1
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                                <Heading2 className="h-4 w-4 mr-2" />
                                Heading 2
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                                <Heading3 className="h-4 w-4 mr-2" />
                                Heading 3
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Essential Formatting */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`h-7 w-7 p-0 shrink-0 ${editor.isActive("bold") ? "bg-muted" : ""}`}
                    >
                        <Bold className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`h-7 w-7 p-0 shrink-0 ${editor.isActive("italic") ? "bg-muted" : ""}`}
                    >
                        <Italic className="h-3.5 w-3.5" />
                    </Button>

                    {/* Insert Options */}
                    <div className="shrink-0 scale-90 origin-center">
                        <LinkSelector
                            editor={editor}
                            isOpen={isLinkOpen}
                            setIsOpen={setIsLinkOpen}
                            url={linkUrl}
                            setUrl={setLinkUrl}
                        />
                    </div>

                    <div className="shrink-0 scale-90 origin-center">
                        <ImageSelector
                            editor={editor}
                            isOpen={isImageOpen}
                            setIsOpen={setIsImageOpen}
                        />
                    </div>

                    <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

                    {/* More Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                                <PlusCircle className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 h-[300px] overflow-y-auto">
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleUnderline().run()}>
                                <UnderlineIcon className="h-4 w-4 mr-2" />
                                Underline
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleStrike().run()}>
                                <Strikethrough className="h-4 w-4 mr-2" />
                                Strikethrough
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleCode().run()}>
                                <Code className="h-4 w-4 mr-2" />
                                Inline Code
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleBulletList().run()}>
                                <List className="h-4 w-4 mr-2" />
                                Bullet List
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                                <ListOrdered className="h-4 w-4 mr-2" />
                                Numbered List
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleTaskList().run()}>
                                <ListChecks className="h-4 w-4 mr-2" />
                                Task List
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                                <Quote className="h-4 w-4 mr-2" />
                                Quote
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                                <Minus className="h-4 w-4 mr-2" />
                                Divider
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                                <Code className="h-4 w-4 mr-2" />
                                Code Block
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={addTable}>
                                <TableIcon className="h-4 w-4 mr-2" />
                                Insert Table
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* AI Token Indicator */}
                    <div className="ml-auto">
                        <AITokenIndicator />
                    </div>
                </div>
            </TooltipProvider>
        )
    }

    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex flex-wrap items-center gap-0.5 p-2 bg-muted/30">
                {/* History */}
                <div className="flex items-center gap-0.5 mr-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().undo().run()}
                                disabled={!editor.can().undo()}
                                className="h-8 w-8 p-0"
                            >
                                <Undo className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Undo</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().redo().run()}
                                disabled={!editor.can().redo()}
                                className="h-8 w-8 p-0"
                            >
                                <Redo className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Redo</TooltipContent>
                    </Tooltip>
                </div>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Headings Dropdown */}
                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-1">
                                    <Type className="h-4 w-4" />
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Text Style</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                            <Type className="h-4 w-4 mr-2" />
                            Paragraph
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                            <Heading1 className="h-4 w-4 mr-2" />
                            Heading 1
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                            <Heading2 className="h-4 w-4 mr-2" />
                            Heading 2
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                            <Heading3 className="h-4 w-4 mr-2" />
                            Heading 3
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
                            <span className="h-4 w-4 mr-2 font-bold text-sm">H4</span>
                            Heading 4
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}>
                            <span className="h-4 w-4 mr-2 font-bold text-xs">H5</span>
                            Heading 5
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Lists */}
                <div className="flex items-center gap-0.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("bulletList") ? "bg-muted" : ""}`}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Bullet List</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("orderedList") ? "bg-muted" : ""}`}
                            >
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Numbered List</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleTaskList().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("taskList") ? "bg-muted" : ""}`}
                            >
                                <ListChecks className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Task List</TooltipContent>
                    </Tooltip>
                </div>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Formatting */}
                <div className="flex items-center gap-0.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBold().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("bold") ? "bg-muted" : ""}`}
                            >
                                <Bold className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Bold</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("italic") ? "bg-muted" : ""}`}
                            >
                                <Italic className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Italic</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleUnderline().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("underline") ? "bg-muted" : ""}`}
                            >
                                <UnderlineIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Underline</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleStrike().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("strike") ? "bg-muted" : ""}`}
                            >
                                <Strikethrough className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Strikethrough</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleCode().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("code") ? "bg-muted" : ""}`}
                            >
                                <Code className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Inline Code</TooltipContent>
                    </Tooltip>
                </div>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Insert */}
                <div className="flex items-center gap-0.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <LinkSelector
                                    editor={editor}
                                    isOpen={isLinkOpen}
                                    setIsOpen={setIsLinkOpen}
                                    url={linkUrl}
                                    setUrl={setLinkUrl}
                                />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>Link</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("superscript") ? "bg-muted" : ""}`}
                            >
                                <Superscript className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Superscript</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleSubscript().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("subscript") ? "bg-muted" : ""}`}
                            >
                                <Subscript className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Subscript</TooltipContent>
                    </Tooltip>
                </div>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Insert Blocks */}
                <div className="flex items-center gap-0.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <ImageSelector
                                    editor={editor}
                                    isOpen={isImageOpen}
                                    setIsOpen={setIsImageOpen}
                                />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>Image</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={addTable}
                                className="h-8 w-8 p-0"
                            >
                                <TableIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Table</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("codeBlock") ? "bg-muted" : ""}`}
                            >
                                <Code className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Code Block</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                                className="h-8 w-8 p-0"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Divider</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive("blockquote") ? "bg-muted" : ""}`}
                            >
                                <Quote className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Quote</TooltipContent>
                    </Tooltip>
                </div>

                {/* AI Token Indicator - Right aligned */}
                <div className="ml-auto">
                    <AITokenIndicator />
                </div>
            </div>
        </TooltipProvider>
    )
}
