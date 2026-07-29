export const FROZEN_GRAPH_VERSION = "frozen-graph-v1"

export interface GraphArticleInput {
    id: string
    clusterId: string
    title: string
    mainKeyword: string
    isPillar: boolean
    embedding: number[]
}

export interface ExistingLinkInput {
    url: string
    title: string
    embedding: number[]
}

export type LinkRelationship =
    | "pillar_to_leaf"
    | "leaf_to_pillar"
    | "sibling"
    | "existing_page"

export interface FrozenArticle {
    id: string
    clusterId: string
    slug: string
    targetUrl: string
}

export interface FrozenEdge {
    sourceArticleId: string
    targetArticleId: string | null
    targetUrl: string
    anchorText: string
    relationship: LinkRelationship
}

export interface FrozenGraph {
    version: typeof FROZEN_GRAPH_VERSION
    publicationUrlPattern: string
    articles: FrozenArticle[]
    edges: FrozenEdge[]
}

export class LinkGraphError extends Error {
    readonly code: string

    constructor(message: string, code: string) {
        super(message)
        this.code = code
        this.name = "LinkGraphError"
    }
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || a.length !== b.length) return 0
    let dot = 0
    let normA = 0
    let normB = 0
    for (let index = 0; index < a.length; index += 1) {
        dot += a[index] * b[index]
        normA += a[index] * a[index]
        normB += b[index] * b[index]
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function normalizeHost(value: string): string {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "")
}

export function validatePublicationUrlPattern(
    pattern: string,
    subjectUrl: string,
): string {
    if (typeof pattern !== "string" || pattern.split("{slug}").length !== 2) {
        throw new LinkGraphError(
            "The publishing URL pattern must contain {slug} exactly once.",
            "invalid_url_pattern",
        )
    }
    const sentinel = "flipaeo-slug-preview"
    let resolved: URL
    try {
        resolved = new URL(pattern.replace("{slug}", sentinel))
    } catch {
        throw new LinkGraphError(
            "The publishing URL pattern is not a valid absolute URL.",
            "invalid_url_pattern",
        )
    }
    if (resolved.protocol !== "https:") {
        throw new LinkGraphError(
            "The publishing URL pattern must use HTTPS.",
            "invalid_url_pattern",
        )
    }
    if (
        !resolved.pathname.includes(sentinel) ||
        resolved.search ||
        resolved.hash ||
        resolved.username ||
        resolved.password
    ) {
        throw new LinkGraphError(
            "The {slug} placeholder must be in a clean URL path, not a host, query, or fragment.",
            "invalid_url_pattern",
        )
    }
    if (normalizeHost(resolved.toString()) !== normalizeHost(subjectUrl)) {
        throw new LinkGraphError(
            "The publishing URL pattern must use the audited website host.",
            "host_mismatch",
        )
    }
    return pattern.trim()
}

export function slugifyArticle(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72)
        .replace(/-+$/g, "") || "article"
}

function canonicalUrl(value: string): string {
    const url = new URL(value)
    url.hash = ""
    url.search = ""
    url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    return url.toString()
}

function createUniqueSlugs(
    articles: GraphArticleInput[],
    publicationUrlPattern: string,
    reservedUrls: string[],
): Map<string, string> {
    const counts = new Map<string, number>()
    const slugs = new Map<string, string>()
    const usedUrls = new Set(
        reservedUrls.flatMap((url) => {
            try {
                return [canonicalUrl(url)]
            } catch {
                return []
            }
        }),
    )
    for (const article of articles) {
        const base = slugifyArticle(article.mainKeyword || article.title)
        let count = (counts.get(base) || 0) + 1
        let slug = count === 1 ? base : `${base}-${count}`
        while (
            usedUrls.has(
                canonicalUrl(publicationUrlPattern.replace("{slug}", slug)),
            )
        ) {
            count += 1
            slug = `${base}-${count}`
        }
        counts.set(base, count)
        slugs.set(article.id, slug)
        usedUrls.add(
            canonicalUrl(publicationUrlPattern.replace("{slug}", slug)),
        )
    }
    return slugs
}

function anchorWords(value: string): string[] {
    const words = value.trim().split(/\s+/).filter(Boolean).slice(0, 8)
    if (words.length === 0) return ["related", "guide"]
    if (words.length === 1) return [words[0], "guide"]
    return words
}

function uniqueAnchor(
    sourceArticleId: string,
    candidates: string[],
    usedBySource: Map<string, Set<string>>,
): string {
    const used = usedBySource.get(sourceArticleId) || new Set<string>()
    usedBySource.set(sourceArticleId, used)
    for (const candidate of candidates) {
        const anchor = anchorWords(candidate).join(" ")
        if (!used.has(anchor.toLowerCase())) {
            used.add(anchor.toLowerCase())
            return anchor
        }
    }
    const base = anchorWords(candidates[0] || "related guide").slice(0, 7)
    const anchor = [...base, String(used.size + 1)].slice(0, 8).join(" ")
    used.add(anchor.toLowerCase())
    return anchor
}

function addEdge(
    edges: FrozenEdge[],
    seen: Set<string>,
    edge: FrozenEdge,
): void {
    if (edge.targetArticleId === edge.sourceArticleId) return
    const key = `${edge.sourceArticleId}|${edge.targetUrl}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push(edge)
}

export function buildFrozenGraph(
    publicationUrlPattern: string,
    subjectUrl: string,
    articles: GraphArticleInput[],
    existingLinks: ExistingLinkInput[] = [],
): FrozenGraph {
    const pattern = validatePublicationUrlPattern(publicationUrlPattern, subjectUrl)
    const slugs = createUniqueSlugs(
        articles,
        pattern,
        existingLinks.map((link) => link.url),
    )
    const frozenArticles: FrozenArticle[] = articles.map((article) => ({
        id: article.id,
        clusterId: article.clusterId,
        slug: slugs.get(article.id)!,
        targetUrl: pattern.replace("{slug}", slugs.get(article.id)!),
    }))
    const frozenById = new Map(frozenArticles.map((article) => [article.id, article]))
    const edges: FrozenEdge[] = []
    const seen = new Set<string>()
    const usedAnchorsBySource = new Map<string, Set<string>>()

    const clusterIds = Array.from(new Set(articles.map((article) => article.clusterId)))
    for (const clusterId of clusterIds) {
        const members = articles.filter((article) => article.clusterId === clusterId)
        if (members.length < 3 || members.length > 15) {
            throw new LinkGraphError(
                `Cluster ${clusterId} has ${members.length} articles; qualified clusters require 3-15.`,
                "unqualified_cluster",
            )
        }
        const pillars = members.filter((article) => article.isPillar)
        if (pillars.length !== 1) {
            throw new LinkGraphError(
                `Cluster ${clusterId} must contain exactly one pillar.`,
                "invalid_pillar_count",
            )
        }
        const pillar = pillars[0]
        const leaves = members.filter((article) => article.id !== pillar.id)

        for (const leaf of leaves) {
            addEdge(edges, seen, {
                sourceArticleId: pillar.id,
                targetArticleId: leaf.id,
                targetUrl: frozenById.get(leaf.id)!.targetUrl,
                anchorText: uniqueAnchor(
                    pillar.id,
                    [leaf.mainKeyword, leaf.title],
                    usedAnchorsBySource,
                ),
                relationship: "pillar_to_leaf",
            })
            addEdge(edges, seen, {
                sourceArticleId: leaf.id,
                targetArticleId: pillar.id,
                targetUrl: frozenById.get(pillar.id)!.targetUrl,
                anchorText: uniqueAnchor(
                    leaf.id,
                    [pillar.mainKeyword, pillar.title],
                    usedAnchorsBySource,
                ),
                relationship: "leaf_to_pillar",
            })

            const siblings = leaves
                .filter((candidate) => candidate.id !== leaf.id)
                .map((candidate) => ({
                    article: candidate,
                    similarity: cosineSimilarity(leaf.embedding, candidate.embedding),
                }))
                .sort(
                    (a, b) =>
                        b.similarity - a.similarity ||
                        a.article.mainKeyword.localeCompare(b.article.mainKeyword),
                )
                .slice(0, 2)

            for (const sibling of siblings) {
                addEdge(edges, seen, {
                    sourceArticleId: leaf.id,
                    targetArticleId: sibling.article.id,
                    targetUrl: frozenById.get(sibling.article.id)!.targetUrl,
                    anchorText: uniqueAnchor(
                        leaf.id,
                        [sibling.article.mainKeyword, sibling.article.title],
                        usedAnchorsBySource,
                    ),
                    relationship: "sibling",
                })
            }
        }
    }

    const subjectHost = normalizeHost(subjectUrl)
    for (const article of articles) {
        const closest = existingLinks
            .filter((link) => {
                try {
                    return normalizeHost(link.url) === subjectHost
                } catch {
                    return false
                }
            })
            .map((link) => ({
                link,
                similarity: cosineSimilarity(article.embedding, link.embedding),
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 2)

        for (const match of closest) {
            const targetWords = match.link.title.trim().split(/\s+/).slice(0, 8)
            if (targetWords.length < 2) continue
            addEdge(edges, seen, {
                sourceArticleId: article.id,
                targetArticleId: null,
                targetUrl: match.link.url,
                anchorText: uniqueAnchor(
                    article.id,
                    [targetWords.join(" "), match.link.title],
                    usedAnchorsBySource,
                ),
                relationship: "existing_page",
            })
        }
    }

    validateFrozenGraph({
        version: FROZEN_GRAPH_VERSION,
        publicationUrlPattern: pattern,
        articles: frozenArticles,
        edges,
    })
    return {
        version: FROZEN_GRAPH_VERSION,
        publicationUrlPattern: pattern,
        articles: frozenArticles,
        edges,
    }
}

export function validateFrozenGraph(graph: FrozenGraph): void {
    const articleById = new Map(graph.articles.map((article) => [article.id, article]))
    if (articleById.size !== graph.articles.length) {
        throw new LinkGraphError(
            "The graph contains a duplicate article.",
            "duplicate_article",
        )
    }
    const seen = new Set<string>()
    const patternHost = normalizeHost(graph.publicationUrlPattern.replace("{slug}", "check"))

    for (const article of graph.articles) {
        if (!article.slug || !article.targetUrl) {
            throw new LinkGraphError("A graph article lacks its frozen URL.", "missing_target")
        }
        if (normalizeHost(article.targetUrl) !== patternHost) {
            throw new LinkGraphError("A graph article targets another host.", "host_mismatch")
        }
    }
    for (const edge of graph.edges) {
        if (!articleById.has(edge.sourceArticleId)) {
            throw new LinkGraphError("A graph edge has an unknown source.", "unknown_source")
        }
        if (edge.targetArticleId && !articleById.has(edge.targetArticleId)) {
            throw new LinkGraphError("A graph edge has an unknown target.", "unknown_target")
        }
        if (normalizeHost(edge.targetUrl) !== patternHost) {
            throw new LinkGraphError("A graph edge targets another host.", "host_mismatch")
        }
        const key = `${edge.sourceArticleId}|${edge.targetUrl}`
        if (seen.has(key)) {
            throw new LinkGraphError("The graph contains a duplicate edge.", "duplicate_edge")
        }
        seen.add(key)
        const words = edge.anchorText.trim().split(/\s+/)
        if (words.length < 2 || words.length > 8) {
            throw new LinkGraphError("Graph anchors must contain 2-8 words.", "invalid_anchor")
        }
    }

    // Every planned target must resolve to the frozen URL of the target row.
    for (const edge of graph.edges.filter((item) => item.targetArticleId)) {
        if (articleById.get(edge.targetArticleId!)!.targetUrl !== edge.targetUrl) {
            throw new LinkGraphError("A graph edge does not resolve to its target.", "unresolved_edge")
        }
        if (
            edge.relationship !== "existing_page" &&
            articleById.get(edge.sourceArticleId)!.clusterId !==
                articleById.get(edge.targetArticleId!)!.clusterId
        ) {
            throw new LinkGraphError(
                "A cluster edge crosses into another cluster.",
                "cross_cluster_edge",
            )
        }
    }

    const clusterIds = Array.from(
        new Set(graph.articles.map((article) => article.clusterId)),
    )
    for (const clusterId of clusterIds) {
        const members = graph.articles.filter(
            (article) => article.clusterId === clusterId,
        )
        if (members.length < 3 || members.length > 15) {
            throw new LinkGraphError(
                "A frozen cluster must contain 3-15 articles.",
                "unqualified_cluster",
            )
        }
        const memberIds = new Set(members.map((article) => article.id))
        const clusterEdges = graph.edges.filter((edge) =>
            memberIds.has(edge.sourceArticleId),
        )
        const pillarCandidates = new Set(
            clusterEdges
                .filter((edge) => edge.relationship === "pillar_to_leaf")
                .map((edge) => edge.sourceArticleId),
        )
        if (pillarCandidates.size !== 1) {
            throw new LinkGraphError(
                "A frozen cluster must contain one linked pillar.",
                "invalid_pillar_count",
            )
        }
        const pillarId = Array.from(pillarCandidates)[0]
        const leafIds = members
            .map((article) => article.id)
            .filter((id) => id !== pillarId)

        for (const leafId of leafIds) {
            const pillarToLeaf = clusterEdges.some(
                (edge) =>
                    edge.sourceArticleId === pillarId &&
                    edge.targetArticleId === leafId &&
                    edge.relationship === "pillar_to_leaf",
            )
            const leafToPillar = clusterEdges.some(
                (edge) =>
                    edge.sourceArticleId === leafId &&
                    edge.targetArticleId === pillarId &&
                    edge.relationship === "leaf_to_pillar",
            )
            if (!pillarToLeaf || !leafToPillar) {
                throw new LinkGraphError(
                    "Every leaf must link with the pillar in both directions.",
                    "incomplete_pillar_graph",
                )
            }

            const expectedSiblingCount = Math.min(2, leafIds.length - 1)
            const siblingTargets = new Set(
                clusterEdges
                    .filter(
                        (edge) =>
                            edge.sourceArticleId === leafId &&
                            edge.relationship === "sibling" &&
                            edge.targetArticleId &&
                            memberIds.has(edge.targetArticleId),
                    )
                    .map((edge) => edge.targetArticleId),
            )
            if (siblingTargets.size !== expectedSiblingCount) {
                throw new LinkGraphError(
                    "Every leaf must link to the available sibling targets.",
                    "incomplete_sibling_graph",
                )
            }
        }
    }
}
