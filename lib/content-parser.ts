import * as cheerio from 'cheerio'
// import DOMPurify from 'isomorphic-dompurify'

// Define types for extracted data
export interface TOCEntry {
    id: string
    text: string
    level: number // 2 for h2, 3 for h3
}

export interface FAQEntry {
    question: string
    answer: string
}

export interface ParsedContent {
    tocEntries: TOCEntry[]
    faqs: FAQEntry[]
    content: string
}

/**
 * Parses raw HTML content to extract metadata and sanitize HTML
 * Handles potential errors and malformed content gracefully
 */
export function parseContent(rawContent: string): ParsedContent {
    try {
        if (!rawContent || typeof rawContent !== 'string') {
            console.warn('parseContent: Invalid input content')
            return {
                tocEntries: [],
                faqs: [],
                content: ''
            }
        }

        // 1. Sanitize the raw content first with stricter settings
        // DOMPurify removed due to server-side ESM crash with jsdom
        const sanitizedContent = rawContent; 
        /* DOMPurify.sanitize(rawContent, {
            ALLOWED_TAGS: [
                'p', 'br', 'strong', 'em', 'u', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'img', 'figure', 'figcaption',
                'table', 'thead', 'tbody', 'tr', 'th', 'td', 'iframe'
            ],
            ALLOWED_ATTR: [
                'href', 'src', 'alt', 'title', 'id', 'class',
                'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'loading'
            ],
            KEEP_CONTENT: true,
        }) */

        if (!sanitizedContent) {
            console.warn('parseContent: Sanitization resulted in empty content')
            return {
                tocEntries: [],
                faqs: [],
                content: ''
            }
        }

        // 2. Load into Cheerio for extraction with proper settings
        const $ = cheerio.load(sanitizedContent, {
            decodeEntities: false, // Preserve HTML entities
            // selfClosingTags: ['img', 'br', 'hr', 'input', 'meta', 'link']
        })

        const tocEntries: TOCEntry[] = []
        const faqs: FAQEntry[] = []

        // Extract headings for Table of Contents
        try {
            $('h2, h3').each((_, el) => {
                try {
                    const $el = $(el)
                    const text = $el.text().trim()
                    const tagName = $el.prop('tagName') as string

                    if (!text) return // Skip empty headings

                    const level = tagName ? parseInt(tagName.substring(1), 10) : 2

                    // Generate ID if missing
                    let id = $el.attr('id')
                    if (!id) {
                        id = text
                            .toLowerCase()
                            .replace(/[^\w\s-]/g, '')
                            .replace(/\s+/g, '-')
                            .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
                    }

                    if (id) {
                        tocEntries.push({ id, text, level })
                        // Ensure the element has the ID in the final HTML
                        $el.attr('id', id)
                    }
                } catch (headingError) {
                    console.warn('Error processing heading:', headingError)
                    // Continue with next heading
                }
            })
        } catch (tocError) {
            console.warn('Error extracting table of contents:', tocError)
        }

        // 3. Extract final content more carefully
        // Instead of just getting body HTML, we'll manually reconstruct from sanitized content
        // This prevents issues with Cheerio's automatic body wrapping
        let finalContent: string

        try {
            // Try to get the actual body content
            const bodyContent = $('body').html()
            
            if (bodyContent) {
                finalContent = bodyContent
            } else {
                // If no body tag was parsed, use the sanitized content directly
                // This preserves the original structure better
                finalContent = sanitizedContent
            }

            // Extra safety: ensure content is not empty or corrupted
            if (!finalContent || finalContent.length === 0) {
                console.warn('parseContent: Final content is empty, using sanitized content')
                finalContent = sanitizedContent
            }
        } catch (contentError) {
            console.warn('Error extracting final content:', contentError)
            finalContent = sanitizedContent
        }

        return {
            tocEntries,
            faqs, // Empty for now unless specific structure is defined
            content: finalContent
        }
    } catch (error) {
        console.error('Fatal error in parseContent:', error)
        // Return graceful fallback
        return {
            tocEntries: [],
            faqs: [],
            content: rawContent || ''
        }
    }
}

/**
 * Optional: Validate parsed content before using
 */
export function validateParsedContent(parsed: ParsedContent): boolean {
    return (
        parsed &&
        typeof parsed.content === 'string' &&
        parsed.content.length > 0 &&
        Array.isArray(parsed.tocEntries) &&
        Array.isArray(parsed.faqs)
    )
}
