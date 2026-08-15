"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Highlight from "@tiptap/extension-highlight"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import { Markdown } from "tiptap-markdown"
import { useEffect, useCallback, useState, useRef } from "react"

import { Toolbar } from "./menus/Toolbar"
import { AIBubbleMenu } from "./menus/AIBubbleMenu"
import "./styles/editor.css"

interface TipTapEditorProps {
    content?: string // Markdown content
    onChange?: (markdown: string) => void
    readOnly?: boolean
    placeholder?: string
}

export default function TipTapEditor({
    content = "",
    onChange,
    readOnly = false,
    placeholder = "Start writing..."
}: TipTapEditorProps) {
    const [isSticky, setIsSticky] = useState(false)
    const sentinelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0)
            },
            { threshold: [1], rootMargin: '-1px 0px 0px 0px' }
        )

        observer.observe(sentinel)

        return () => {
            observer.unobserve(sentinel)
        }
    }, [])

    const editor = useEditor({
        immediatelyRender: false, // Prevent SSR hydration mismatch
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4, 5]
                },
                codeBlock: {
                    HTMLAttributes: {
                        spellcheck: 'false'
                    }
                }
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-primary underline"
                }
            }),
            Image.configure({
                HTMLAttributes: {
                    class: "rounded-lg max-w-full"
                }
            }),
            Table.configure({
                resizable: true
            }),
            TableRow,
            TableCell,
            TableHeader,
            TaskList,
            TaskItem.configure({
                nested: true
            }),
            Placeholder.configure({
                placeholder
            }),
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph"]
            }),
            Highlight.configure({
                multicolor: false
            }),
            Subscript,
            Superscript,
            Markdown.configure({
                html: false, // Parse content as markdown, not HTML
                transformPastedText: true,
                transformCopiedText: true
            })
        ],
        content: "", // Start empty, we'll set content after markdown parsing
        editable: !readOnly,
        editorProps: {
            attributes: {
                class: "editor-prose max-w-none focus:outline-none min-h-[300px] p-4"
            }
        },
        onUpdate: ({ editor }) => {
            if (onChange) {
                // @ts-ignore - tiptap-markdown extends storage
                const markdown = editor.storage.markdown?.getMarkdown() || ""
                onChange(markdown)
            }
        }
    })

    // Update content when prop changes (for loading existing articles)
    // Use markdown parsing for initial content
    useEffect(() => {
        if (editor && content) {
            // @ts-ignore - tiptap-markdown extends setContent with contentType option
            editor.commands.setContent(content, { contentType: 'markdown' })
        }
    }, [editor, content])

    // Expose markdown getter
    const getMarkdown = useCallback(() => {
        if (!editor) return ""
        // @ts-ignore - tiptap-markdown extends storage
        return editor.storage.markdown?.getMarkdown() || ""
    }, [editor])

    if (!editor) {
        return (
            <div className="border rounded-lg p-4 min-h-[400px] animate-pulse bg-muted/50">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
        )
    }

    return (
        <div className="border rounded-lg bg-background flex flex-col relative">
            {/* Sentinel for sticky detection */}
            <div ref={sentinelRef} className="absolute -top-px left-0 right-0 h-px opacity-0 pointer-events-none" />

            {/* Sticky toolbar - stays at top while scrolling */}
            {!readOnly && (
                <div className={`sticky z-20 transition-all duration-300 ease-in-out ${isSticky
                    ? 'top-2 mx-2 rounded-xl border shadow-lg bg-background/80 backdrop-blur-md ring-1 ring-black/5'
                    : 'top-0 border-b bg-background rounded-t-lg'
                    }`}>
                    <Toolbar editor={editor} />
                </div>
            )}

            {/* Content area - auto expands */}
            <div className="relative min-h-[500px]">
                <AIBubbleMenu editor={editor} />
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}

// Export the getMarkdown function type for parent components
export type { TipTapEditorProps }
