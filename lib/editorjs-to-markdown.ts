import { OutputData } from "@editorjs/editorjs"

/**
 * Converts Editor.js output data to a Markdown string.
 * Supports standard blocks: header, paragraph, list, quote, delimiter, code, checklist, embed, image/simpleImage.
 */
export function editorJsToMarkdown(data: OutputData): string {
    if (!data || !data.blocks || !Array.isArray(data.blocks)) {
        return ""
    }

    return data.blocks.map(block => {
        switch (block.type) {
            case 'header':
                return '#'.repeat(block.data.level) + ' ' + block.data.text + '\n'
            
            case 'paragraph':
                return block.data.text + '\n\n'
            
            case 'list':
                // Supports nested-list plugin structure or standard list
                return convertList(block.data) + '\n'
            
            case 'checklist':
                return block.data.items.map((item: any) => {
                    return `- [${item.checked ? 'x' : ' '}] ${item.text}`
                }).join('\n') + '\n\n'
            
            case 'quote':
                // Handle alignment if needed, though markdown doesn't support it natively
                return `> ${block.data.text}\n\n`
            
            case 'code':
                return '```\n' + block.data.code + '\n```\n\n'
            
            case 'delimiter':
                return '---\n\n'
            
            case 'image':
            case 'simpleImage':
                const url = block.data.url || block.data.file?.url || ''
                const caption = block.data.caption || ''
                const withBorder = block.data.withBorder ? ' (with border)' : ''
                const withBackground = block.data.withBackground ? ' (with background)' : ''
                const stretched = block.data.stretched ? ' (stretched)' : ''
                // Standard markdown image: ![alt](url)
                // We might lose some styling metadata in standard markdown, but that's expected.
                return `![${caption}](${url})\n\n`
            
            case 'embed':
                // Embeds usually need HTML or specific platform syntax. 
                // For standard markdown, we can just output the source URL or an iframe if target supports HTML.
                // Let's try to output a link or the raw embed URL for now.
                const source = block.data.source || block.data.embed || ''
                return `[Embed: ${block.data.service}](${source})\n\n`
            
            default:
                return ''
        }
    }).join('\n')
}

function convertList(data: any): string {
    const style = data.style === 'ordered' ? 'ordered' : 'unordered'
    return processListItems(data.items, style, 0)
}

function processListItems(items: any[], style: 'ordered' | 'unordered', level: number): string {
    if (!items || !Array.isArray(items)) return ''

    return items.map((item, index) => {
        const indent = '  '.repeat(level)
        const bullet = style === 'ordered' ? `${index + 1}.` : '-'
        const content = item.content || item.text || '' // NestedList uses 'content', standard list uses 'text'
        
        let result = `${indent}${bullet} ${content}\n`
        
        // Handle nested items (NestedList plugin)
        if (item.items && item.items.length > 0) {
            result += processListItems(item.items, style, level + 1)
        }
        
        return result
    }).join('')
}
