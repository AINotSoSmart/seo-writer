import { type Node, type Edge } from '@xyflow/react'
import { ContentPlanItem } from '@/lib/schemas/content-plan'

interface PillarRecommendation {
    id: string
    title: string
    description: string
    suggested_slug: string
    created_url?: string
}

interface CategoryConfig {
    label: string
    tagline: string
    color: string
}

const CATEGORIES: Record<string, CategoryConfig> = {
    "Core Answers": {
        label: "Core Answers",
        tagline: "Direct answers to your customers' most burning questions.",
        color: "#78716c" // Premium Stone
    },
    "Supporting Articles": {
        label: "Supporting Articles",
        tagline: "Comprehensive guides that build depth and trust.",
        color: "#78716c" // Premium Stone
    },
    "Conversion Pages": {
        label: "Conversion Pages",
        tagline: "High-intent content designed to drive signups.",
        color: "#78716c" // Premium Stone
    },
    "Authority Plays": {
        label: "Authority Plays",
        tagline: "Thought leadership to establish industry expertise.",
        color: "#78716c" // Premium Stone
    }
}

export function buildCanvasGraph(args: {
    planData: ContentPlanItem[]
    pillars: PillarRecommendation[] | null
    brandName: string
}): { nodes: Node[], edges: Edge[] } {
    const { planData, pillars, brandName } = args
    const nodes: Node[] = []
    const edges: Edge[] = []

    const hasPillars = pillars && pillars.length > 0

    // ── 1. Brand Node (root) ──────────────────────────────
    nodes.push({
        id: 'brand',
        type: 'brandNode',
        position: { x: 0, y: 0 },
        data: {
            label: brandName,
            totalArticles: planData.length,
            publishedCount: planData.filter(i => i.status === 'published').length
        },
    })

    // ── Group Articles by Category ────────────────────────
    const categorized: Record<string, ContentPlanItem[]> = {}
    const uncategorized: ContentPlanItem[] = []

    planData.forEach(item => {
        const cat = item.article_category
        if (cat && CATEGORIES[cat]) {
            if (!categorized[cat]) categorized[cat] = []
            categorized[cat].push(item)
        } else {
            uncategorized.push(item)
        }
    })

    const activeCategories = Object.keys(CATEGORIES).filter(k => categorized[k]?.length > 0)
    if (uncategorized.length > 0) {
        activeCategories.push('_uncategorized')
    }

    // ── Layout Metrics (Premium Airy Space) ────────────────
    const articlesPerRow = 2
    const articleSpacingX = 360
    const articleSpacingY = 260
    const categorySafetyGap = 120
    const articleWidth = 300

    // Calculate dynamic subtree widths for categories
    const categorySubtreeWidths = activeCategories.map(catKey => {
        const catArticles = catKey === '_uncategorized' ? uncategorized : (categorized[catKey] || [])
        const cols = Math.min(catArticles.length, articlesPerRow)
        // Horizontal span of articles: (cols - 1) * articleSpacingX + articleWidth
        const subtreeWidth = cols > 0 ? (cols - 1) * articleSpacingX + articleWidth : articleWidth
        return subtreeWidth
    })

    // Compute total horizontal span needed
    let totalCategoriesWidth = 0
    categorySubtreeWidths.forEach((width, index) => {
        totalCategoriesWidth += width
        if (index < categorySubtreeWidths.length - 1) {
            totalCategoriesWidth += categorySafetyGap
        }
    })

    const categoryY = hasPillars ? 440 : 220
    let currentStartX = -totalCategoriesWidth / 2

    // Arrays to hold placed category positions for pillar routing
    const categoryPositions: { id: string; x: number }[] = []

    // ── 2. Pillar Nodes (placed relative to the categories below them) ──
    if (hasPillars) {
        const pillarSpacing = Math.max(340, totalCategoriesWidth / (pillars.length || 1))
        const pillarStartX = -((pillars.length - 1) * pillarSpacing) / 2

        pillars.forEach((pillar, i) => {
            const nodeId = `pillar-${pillar.id}`
            nodes.push({
                id: nodeId,
                type: 'pillarNode',
                position: { x: pillarStartX + i * pillarSpacing, y: 200 },
                data: {
                    label: pillar.title,
                    description: pillar.description,
                    slug: pillar.suggested_slug,
                    created: !!pillar.created_url,
                },
            })

            edges.push({
                id: `brand-to-${nodeId}`,
                source: 'brand',
                target: nodeId,
                type: 'smoothstep',
                style: { stroke: '#78716c', strokeWidth: 2 },
            })
        })
    }

    // ── 3. Category & Article Nodes ──────────────────────
    activeCategories.forEach((catKey, catIndex) => {
        const isUncategorized = catKey === '_uncategorized'
        const catConfig = isUncategorized
            ? { label: 'Uncategorized', tagline: 'Legacy or unclassified articles.', color: '#78716c' }
            : CATEGORIES[catKey]
        const catArticles = isUncategorized ? uncategorized : (categorized[catKey] || [])
        const nodeId = `category-${catKey.replace(/\s+/g, '-')}`
        
        const subtreeWidth = categorySubtreeWidths[catIndex]
        // Center of this category's subtree
        const catX = currentStartX + subtreeWidth / 2
        currentStartX += subtreeWidth + categorySafetyGap

        categoryPositions.push({ id: nodeId, x: catX })

        nodes.push({
            id: nodeId,
            type: 'categoryNode',
            position: { x: catX, y: categoryY },
            data: {
                label: catConfig.label,
                tagline: catConfig.tagline,
                color: catConfig.color,
                category: catKey,
                articleCount: catArticles.length,
                publishedCount: catArticles.filter(a => a.status === 'published').length,
            },
        })

        // Route category gracefully to its parent pillar to prevent crossing edges
        if (hasPillars) {
            // Map category index to parent pillar index (distribute evenly)
            const pillarIndex = Math.min(
                Math.floor((catIndex * pillars!.length) / activeCategories.length),
                pillars!.length - 1
            )
            const parentPillar = pillars![pillarIndex]
            edges.push({
                id: `pillar-${parentPillar.id}-to-${nodeId}`,
                source: `pillar-${parentPillar.id}`,
                target: nodeId,
                type: 'smoothstep',
                style: { stroke: '#a8a29e', strokeWidth: 1.5 },
            })
        } else {
            edges.push({
                id: `brand-to-${nodeId}`,
                source: 'brand',
                target: nodeId,
                type: 'smoothstep',
                style: { stroke: '#78716c', strokeWidth: 2 },
            })
        }

        // ── 4. Article Nodes under each category ──────────────
        const cols = Math.min(catArticles.length, articlesPerRow)
        const articleStartX = catX - ((cols - 1) * articleSpacingX) / 2
        const articleStartY = categoryY + 180

        catArticles.forEach((article, artIndex) => {
            const col = artIndex % articlesPerRow
            const row = Math.floor(artIndex / articlesPerRow)
            const artNodeId = `article-${article.id}`

            nodes.push({
                id: artNodeId,
                type: 'articleNode',
                position: {
                    x: articleStartX + col * articleSpacingX,
                    y: articleStartY + row * articleSpacingY,
                },
                data: { ...article },
            })

            // Category → Article edge
            edges.push({
                id: `${nodeId}-to-${artNodeId}`,
                source: nodeId,
                target: artNodeId,
                type: 'smoothstep',
                style: { stroke: '#e7e5e4', strokeWidth: 1.5 },
            })
        })
    })

    // ── 5. Connected_to Edges (Inter-Article support links) ──
    const sortedPlan = [...planData].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    const dayToNodeIdMap = new Map<number | string, string>()
    sortedPlan.forEach((item, index) => {
        const dayNum = index + 1 // 1-indexed day
        dayToNodeIdMap.set(dayNum, `article-${item.id}`)
        dayToNodeIdMap.set(dayNum.toString(), `article-${item.id}`)
        dayToNodeIdMap.set(item.id, `article-${item.id}`)
    })

    planData.forEach(article => {
        const sourceNodeId = `article-${article.id}`
        const connections = article.connected_to || []
        
        connections.forEach(conn => {
            const targetNodeId = dayToNodeIdMap.get(conn)
            if (targetNodeId && targetNodeId !== sourceNodeId) {
                edges.push({
                    id: `connection-${article.id}-to-${conn}`,
                    source: sourceNodeId,
                    target: targetNodeId,
                    type: 'default',
                    animated: true,
                    className: 'connected-edge',
                    style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5,5' },
                })
            }
        })
    })

    return { nodes, edges }
}

