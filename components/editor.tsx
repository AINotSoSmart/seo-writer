"use client"

import React, { useEffect, useRef } from "react"
import EditorJS, { OutputData } from "@editorjs/editorjs"
// @ts-ignore
import Header from "@editorjs/header"
// @ts-ignore
import List from "@editorjs/list"
// @ts-ignore
import NestedList from "@editorjs/nested-list"
// @ts-ignore
import Paragraph from "@editorjs/paragraph"
// @ts-ignore
import Quote from "@editorjs/quote"
// @ts-ignore
import Delimiter from "@editorjs/delimiter"
// @ts-ignore
import CodeTool from "@editorjs/code"
// @ts-ignore
import Checklist from "@editorjs/checklist"
// @ts-ignore
import Embed from "@editorjs/embed"
// @ts-ignore
import SimpleImage from "@editorjs/simple-image"
// @ts-ignore
import ImageTool from "@editorjs/image"
import { marked } from "marked"

interface EditorProps {
  data?: OutputData
  markdown?: string
  onChange?: (data: OutputData) => void
  readOnly?: boolean
  holderId?: string
}

export default function Editor({ data, markdown, onChange, readOnly, holderId = "editorjs" }: EditorProps) {
  const ejInstance = useRef<EditorJS | null>(null)
  const isReady = useRef(false)

  // Helper to convert marked table token to HTML string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildTableHtml = (tableToken: any): string => {
    let html = '<table class="editor-table" style="width:100%; border-collapse: collapse; margin: 1rem 0;">'

    // Header row
    if (tableToken.header && tableToken.header.length > 0) {
      html += '<thead><tr>'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tableToken.header.forEach((cell: any) => {
        const align = cell.align ? `style="text-align: ${cell.align}; padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;"` : 'style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;"'
        html += `<th ${align}>${marked.parseInline(cell.text || cell.raw || '')}</th>`
      })
      html += '</tr></thead>'
    }

    // Body rows
    if (tableToken.rows && tableToken.rows.length > 0) {
      html += '<tbody>'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tableToken.rows.forEach((row: any) => {
        html += '<tr>'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        row.forEach((cell: any) => {
          const align = cell.align ? `style="text-align: ${cell.align}; padding: 8px; border: 1px solid #ddd;"` : 'style="padding: 8px; border: 1px solid #ddd;"'
          html += `<td ${align}>${marked.parseInline(cell.text || cell.raw || '')}</td>`
        })
        html += '</tr>'
      })
      html += '</tbody>'
    }

    html += '</table>'
    return html
  }

  // Advanced Markdown to EditorJS blocks converter using marked
  const parseMarkdown = (md: string) => {
    // Check if it's already JSON
    try {
      const trimmed = md.trim()
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const parsed = JSON.parse(md)
        if (parsed.blocks) return parsed
      }
    } catch (e) {
      // Not JSON, proceed to markdown parsing
    }

    const tokens = marked.lexer(md)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = []

    tokens.forEach((token) => {
      switch (token.type) {
        case 'heading':
          blocks.push({
            type: 'header',
            data: {
              text: parseInline(token.text),
              level: token.depth
            }
          })
          break
        case 'paragraph':
          blocks.push({
            type: 'paragraph',
            data: {
              text: parseInline(token.text)
            }
          })
          break
        case 'list':
          blocks.push({
            type: 'list', // Using nested-list plugin which handles 'list' type usually or 'nestedList'
            data: {
              style: token.ordered ? 'ordered' : 'unordered',
              items: parseListItems(token.items)
            }
          })
          break
        case 'blockquote':
          // Extract text from tokens inside the quote
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const quoteText = token.tokens?.map((t: any) => t.text).join('<br>') || token.text
          blocks.push({
            type: 'quote',
            data: {
              text: parseInline(quoteText),
              alignment: 'left'
            }
          })
          break
        case 'hr':
          blocks.push({
            type: 'delimiter',
            data: {}
          })
          break
        case 'table':
          // Convert markdown table to raw HTML since EditorJS doesn't have native table support
          // We render the table as HTML inside a paragraph block
          const tableHtml = buildTableHtml(token)
          blocks.push({
            type: 'paragraph',
            data: {
              text: tableHtml
            }
          })
          break
        case 'code':
          blocks.push({
            type: 'code',
            data: {
              code: token.text
            }
          })
          break
        case 'space':
          break
        default:
          if (token.type === 'text' || (token as any).text) {
            // Fallback
          }
          break
      }
    })

    return {
      time: Date.now(),
      blocks,
      version: "2.30.6",
    }
  }

  // Helper to parse inline markdown (bold, italic) to HTML tags
  const parseInline = (text: string): string => {
    // marked.parseInline returns a string with HTML tags
    return marked.parseInline(text) as string
  }

  // Helper for list items (recursive for nested lists if we were building that structure manually)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseListItems = (items: any[]): any[] => {
    return items.map(item => {
      // Use tokens to extract content, excluding the nested list to avoid duplication
      let itemText = item.text

      if (item.tokens) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nonListTokens = item.tokens.filter((t: any) => t.type !== 'list')
        // Reconstruct text from non-list tokens
        // We use .raw to preserve formatting/spacing of the content parts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        itemText = nonListTokens.map((t: any) => t.raw).join('')
      }

      const content = parseInline(itemText.trim())

      // Check for nested list in the item's tokens
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nestedList = item.tokens?.find((t: any) => t.type === 'list')
      if (nestedList) {
        return {
          content: content,
          items: parseListItems(nestedList.items)
        }
      }
      // Always return object for NestedList
      return {
        content: content,
        items: []
      }
    })
  }

  useEffect(() => {
    // If already initialized, don't re-init
    if (ejInstance.current) return

    // Avoid double init in strict mode by checking if we are already setting up
    if (isReady.current) return
    isReady.current = true

    const initialData = data || (markdown ? parseMarkdown(markdown) : undefined)

    const editor = new EditorJS({
      holder: holderId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logLevel: "ERROR" as any,
      data: initialData,
      onReady: () => {
        ejInstance.current = editor
      },
      onChange: async () => {
        const content = await editor.save()
        if (onChange) {
          onChange(content)
        }
      },
      readOnly,
      tools: {
        header: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          class: Header as any,
          config: {
            placeholder: 'Enter a header',
            levels: [1, 2, 3, 4],
            defaultLevel: 2
          }
        },
        list: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          class: NestedList as any,
          inlineToolbar: true,
          config: {
            defaultStyle: 'unordered'
          },
        },
        paragraph: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          class: Paragraph as any,
          inlineToolbar: true,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quote: Quote as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delimiter: Delimiter as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code: CodeTool as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        checklist: Checklist as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embed: Embed as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        simpleImage: SimpleImage as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        image: {
          class: ImageTool as any,
          config: {
            endpoints: {
              // If you have a backend endpoint for file uploads, configure it here.
              // For now, we can use byFile/byUrl if we had an endpoint.
              // Since user requested simple-image with backend requirement, maybe they want ImageTool.
              // We will leave it unconfigured or configure a mock/Supabase upload later if requested.
            },
            // Implementing a simple uploader if needed, but usually requires a server endpoint.
          }
        },
      },
    })

    // Cleanup
    return () => {
      // In React 18 Strict Mode, effects run twice. We want to destroy ONLY on unmount.
      // However, checking if component is unmounting is tricky. 
      // Best practice with Editor.js is to destroy if instance exists.
      if (ejInstance.current && typeof ejInstance.current.destroy === 'function') {
        ejInstance.current.destroy()
        ejInstance.current = null
        isReady.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, holderId])
  // Removed 'data' and 'markdown' from dependency array to prevent re-init on every keystroke/prop change. 
  // We only want to init ONCE. Updates should be handled differently if needed (e.g. editor.render(newData))

  return <div id={holderId} className="editor-prose max-w-none" />
}
