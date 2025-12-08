/**
 * Article Type Definitions
 * 
 * Three core article types that determine how research, outlines, and content are generated.
 */

export type ArticleType = 'informational' | 'commercial' | 'howto'

export const ARTICLE_TYPES: {
    value: ArticleType
    label: string
    description: string
    examples: string[]
}[] = [
        {
            value: 'informational',
            label: 'Informational / Deep Dive',
            description: 'Educational content explaining concepts, history, or "what/why" questions',
            examples: ['What is Next.js?', 'History of AI', 'Understanding React Hooks']
        },
        {
            value: 'commercial',
            label: 'Commercial / Comparison',
            description: 'Product comparisons, reviews, and "best of" listicles with pricing and features',
            examples: ['Top 5 Boilerplates', 'ClickUp vs Monday', 'Best AI Writing Tools 2025']
        },
        {
            value: 'howto',
            label: 'How-To / Tutorial',
            description: 'Step-by-step guides, tutorials, and actionable instructions',
            examples: ['How to deploy to Vercel', 'How to restore old photos', 'Setting up Next.js Auth']
        }
    ]

export const getArticleTypeLabel = (type: ArticleType): string => {
    const found = ARTICLE_TYPES.find(t => t.value === type)
    return found?.label || 'Informational'
}

export const getArticleTypeDescription = (type: ArticleType): string => {
    const found = ARTICLE_TYPES.find(t => t.value === type)
    return found?.description || ''
}
