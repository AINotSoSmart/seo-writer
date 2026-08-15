"use client"

import { Editor } from "@tiptap/react"
import {
    Sparkles,
    RefreshCw,
    FileEdit,
    BookOpen,
    Target,
    Flame,
    Expand,
    Loader2,
    ChevronDown,
    Type,
    Heading1,
    Heading2,
    Heading3
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { updateTokenCache } from "../AITokenIndicator"

interface AIBubbleMenuProps {
    editor: Editor
}

type AIAction = "rewrite" | "rephrase" | "improve" | "simplify" | "concise" | "engaging" | "expand"

const AI_ACTIONS: { action: AIAction; label: string; icon: React.ReactNode; description: string }[] = [
    { action: "rewrite", label: "Rewrite", icon: <Sparkles className="h-4 w-4" />, description: "Completely rewrite" },
    { action: "rephrase", label: "Rephrase", icon: <RefreshCw className="h-4 w-4" />, description: "Same meaning, different words" },
    { action: "improve", label: "Improve", icon: <FileEdit className="h-4 w-4" />, description: "Fix grammar & clarity" },
    { action: "simplify", label: "Simplify", icon: <BookOpen className="h-4 w-4" />, description: "Make easier to understand" },
    { action: "concise", label: "Make Concise", icon: <Target className="h-4 w-4" />, description: "Shorten without losing meaning" },
    { action: "engaging", label: "Make Engaging", icon: <Flame className="h-4 w-4" />, description: "Add energy and interest" },
    { action: "expand", label: "Expand", icon: <Expand className="h-4 w-4" />, description: "Add more detail" }
]

const HEADING_OPTIONS = [
    { level: 0, label: "Paragraph", icon: <Type className="h-4 w-4" /> },
    { level: 1, label: "Heading 1", icon: <Heading1 className="h-4 w-4" /> },
    { level: 2, label: "Heading 2", icon: <Heading2 className="h-4 w-4" /> },
    { level: 3, label: "Heading 3", icon: <Heading3 className="h-4 w-4" /> },
    { level: 4, label: "Heading 4", icon: <span className="font-bold text-xs">H4</span> },
    { level: 5, label: "Heading 5", icon: <span className="font-bold text-xs">H5</span> },
]

export function AIBubbleMenu({ editor }: AIBubbleMenuProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [loadingAction, setLoadingAction] = useState<AIAction | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [showAIMenu, setShowAIMenu] = useState(false)
    const [showHeadingMenu, setShowHeadingMenu] = useState(false)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const menuRef = useRef<HTMLDivElement>(null)
    const aiMenuRef = useRef<HTMLDivElement>(null)
    const headingMenuRef = useRef<HTMLDivElement>(null)

    // Get current heading level
    const getCurrentHeadingLevel = useCallback(() => {
        for (let i = 1; i <= 5; i++) {
            if (editor.isActive('heading', { level: i })) return i
        }
        return 0 // paragraph
    }, [editor])

    const getHeadingLabel = () => {
        const level = getCurrentHeadingLevel()
        if (level === 0) return "P"
        return `H${level}`
    }

    // Update menu visibility and position based on selection
    useEffect(() => {
        const updateMenu = () => {
            const { from, to } = editor.state.selection
            const hasSelection = from !== to && !editor.state.selection.empty

            if (hasSelection) {
                const { view } = editor
                const start = view.coordsAtPos(from)
                const end = view.coordsAtPos(to)

                const editorRect = view.dom.getBoundingClientRect()

                // Check if mobile (using 768px as breakpoint)
                const isMobile = window.innerWidth < 768

                if (isMobile) {
                    // On mobile, center horizontally and position above selection
                    // Use fixed positioning relative to viewport for better mobile experience
                    const selectionTop = Math.min(start.top, end.top)
                    setPosition({
                        top: selectionTop - editorRect.top - 45,
                        left: editorRect.width / 2 // Center relative to editor width
                    })
                } else {
                    // Desktop behavior - center on selection
                    const menuTop = start.top - editorRect.top - 45
                    const menuLeft = (start.left + end.left) / 2 - editorRect.left
                    setPosition({ top: Math.max(0, menuTop), left: Math.max(0, menuLeft) })
                }

                setIsVisible(true)
            } else {
                setIsVisible(false)
                setShowAIMenu(false)
                setShowHeadingMenu(false)
            }
        }

        editor.on('selectionUpdate', updateMenu)

        return () => {
            editor.off('selectionUpdate', updateMenu)
        }
    }, [editor])

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node) &&
                !(e.target as HTMLElement).closest('[data-ai-trigger]')) {
                setShowAIMenu(false)
            }
            if (headingMenuRef.current && !headingMenuRef.current.contains(e.target as Node) &&
                !(e.target as HTMLElement).closest('[data-heading-trigger]')) {
                setShowHeadingMenu(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleAIAction = useCallback(async (action: AIAction) => {
        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, " ")

        if (!selectedText.trim()) {
            toast.error("Please select some text first")
            return
        }

        setIsLoading(true)
        setLoadingAction(action)
        setShowAIMenu(false)

        try {
            const response = await fetch("/api/editor/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: selectedText, action })
            })

            const data = await response.json()

            if (!response.ok) {
                // Handle quota exceeded (402)
                if (response.status === 402) {
                    const resetDate = data.cycle_resets_at
                        ? new Date(data.cycle_resets_at).toLocaleDateString()
                        : 'your next billing date'
                    toast.error(`Monthly AI quota exceeded. Resets on ${resetDate}.`)
                    return
                }

                // Handle subscription required (403)
                if (response.status === 403) {
                    toast.error("AI features require an active subscription.")
                    return
                }

                throw new Error(data.error || "AI request failed")
            }

            if (data.result) {
                editor.chain()
                    .focus()
                    .deleteRange({ from, to })
                    .insertContent(data.result)
                    .run()

                const actionLabel = action === "rewrite" ? "rewritten" : action + "d"
                toast.success(`Text ${actionLabel} successfully`)

                // Update token cache from response
                if (data.tokens_remaining !== undefined) {
                    updateTokenCache(data.tokens_remaining, data.tokens_limit, data.cycle_resets_at)
                }
            }
        } catch (error: any) {
            console.error("AI action error:", error)
            toast.error(error.message || "Failed to process AI request")
        } finally {
            setIsLoading(false)
            setLoadingAction(null)
        }
    }, [editor])

    const handleHeadingChange = (level: number) => {
        if (level === 0) {
            editor.chain().focus().setParagraph().run()
        } else {
            editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 }).run()
        }
        setShowHeadingMenu(false)
    }

    const handleButtonClick = (e: React.MouseEvent, callback: () => void) => {
        e.preventDefault()
        e.stopPropagation()
        callback()
    }

    if (!isVisible) return null

    return (
        <>
            {/* Main bubble menu */}
            <div
                ref={menuRef}
                className="absolute z-50 flex items-center gap-0.5 p-1 bg-popover border rounded-md shadow-md max-w-[90vw] overflow-x-auto no-scrollbar"
                style={{
                    top: position.top,
                    left: position.left,
                    transform: 'translateX(-50%)'
                }}
            >
                {/* Heading indicator/selector */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 min-w-[32px] px-1 font-bold text-[10px] md:text-xs"
                    data-heading-trigger
                    onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowHeadingMenu(!showHeadingMenu)
                        setShowAIMenu(false)
                    }}
                >
                    {getHeadingLabel()}
                    <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                </Button>

                <div className="w-px h-4 bg-border mx-0.5" />

                {/* Bold button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => handleButtonClick(e, () => editor.chain().focus().toggleBold().run())}
                    className={`h-6 w-6 p-0 ${editor.isActive("bold") ? "bg-muted" : ""}`}
                >
                    <span className="font-bold text-[10px] md:text-xs">B</span>
                </Button>

                {/* Italic button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => handleButtonClick(e, () => editor.chain().focus().toggleItalic().run())}
                    className={`h-6 w-6 p-0 ${editor.isActive("italic") ? "bg-muted" : ""}`}
                >
                    <span className="italic text-[10px] md:text-xs">I</span>
                </Button>

                {/* Underline button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => handleButtonClick(e, () => editor.chain().focus().toggleUnderline().run())}
                    className={`h-6 w-6 p-0 ${editor.isActive("underline") ? "bg-muted" : ""}`}
                >
                    <span className="underline text-[10px] md:text-xs">U</span>
                </Button>

                <div className="w-px h-4 bg-border mx-0.5" />

                {/* AI button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5"
                    disabled={isLoading}
                    data-ai-trigger
                    onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowAIMenu(!showAIMenu)
                        setShowHeadingMenu(false)
                    }}
                >
                    {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <Sparkles className="h-3 w-3 text-purple-500" />
                    )}
                    <span className="text-[10px] md:text-xs font-medium">AI</span>
                    <ChevronDown className="h-2.5 w-2.5" />
                </Button>
            </div>

            {/* Heading selector dropdown */}
            {showHeadingMenu && (
                <div
                    ref={headingMenuRef}
                    className="absolute z-[100] w-36 bg-popover border rounded-md shadow-lg p-1"
                    style={{
                        top: position.top + 36,
                        left: position.left,
                        transform: 'translateX(-50%)'
                    }}
                >
                    {HEADING_OPTIONS.map(({ level, label, icon }) => (
                        <button
                            key={level}
                            onClick={() => handleHeadingChange(level)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted rounded-sm transition-colors text-xs ${getCurrentHeadingLevel() === level ? 'bg-muted font-medium' : ''
                                }`}
                        >
                            <span className="w-4 flex justify-center">{icon}</span>
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* AI actions dropdown */}
            {showAIMenu && (
                <div
                    ref={aiMenuRef}
                    className="absolute z-[100] w-48 bg-popover border rounded-md shadow-lg p-1"
                    style={{
                        top: position.top + 36,
                        left: position.left,
                        transform: 'translateX(-50%)'
                    }}
                >
                    {AI_ACTIONS.map(({ action, label, icon, description }) => (
                        <button
                            key={action}
                            onClick={() => handleAIAction(action)}
                            disabled={isLoading}
                            className="w-full flex items-start gap-2 px-2 py-1.5 text-left hover:bg-muted rounded-sm transition-colors disabled:opacity-50"
                        >
                            <span className="mt-0.5 text-muted-foreground scale-90">{icon}</span>
                            <div className="flex flex-col">
                                <span className="font-medium text-xs">{label}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">{description}</span>
                            </div>
                            {loadingAction === action && (
                                <Loader2 className="h-3 w-3 animate-spin ml-auto mt-0.5" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </>
    )
}
