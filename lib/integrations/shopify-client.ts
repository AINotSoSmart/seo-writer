/**
 * Shopify Admin API Client for publishing blog articles
 * Uses Custom App access token for authentication
 */

const SHOPIFY_API_VERSION = '2024-10'

interface ShopifyCredentials {
    storeDomain: string  // e.g., mystore.myshopify.com
    accessToken: string
}

interface ShopifyBlog {
    id: number
    handle: string
    title: string
}

interface ShopifyArticle {
    id: number
    title: string
    handle: string
    blog_id: number
    published_at: string | null
}

interface CreateArticleParams {
    title: string
    author: string
    body_html: string
    tags?: string
    published?: boolean
    image?: {
        src?: string      // URL to image
        alt?: string
    }
}

/**
 * Make authenticated request to Shopify Admin API
 */
async function shopifyFetch(
    storeDomain: string,
    endpoint: string,
    accessToken: string,
    options: RequestInit = {}
): Promise<Response> {
    const url = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}${endpoint}`

    return fetch(url, {
        ...options,
        headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    })
}

/**
 * Test Shopify connection by fetching shop info
 */
export async function testConnection(credentials: ShopifyCredentials): Promise<{
    success: boolean
    shopName?: string
    error?: string
}> {
    const { storeDomain, accessToken } = credentials

    try {
        const response = await shopifyFetch(
            storeDomain,
            '/shop.json',
            accessToken
        )

        if (!response.ok) {
            if (response.status === 401) {
                return { success: false, error: 'Invalid access token' }
            }
            if (response.status === 404) {
                return { success: false, error: 'Store not found. Check the store domain.' }
            }
            return { success: false, error: `Connection failed: ${response.status}` }
        }

        const data = await response.json()
        return {
            success: true,
            shopName: data.shop?.name || storeDomain
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to connect' }
    }
}

/**
 * List all blogs in the store
 */
export async function listBlogs(credentials: ShopifyCredentials): Promise<{
    blogs: ShopifyBlog[]
    error?: string
}> {
    const { storeDomain, accessToken } = credentials

    try {
        const response = await shopifyFetch(
            storeDomain,
            '/blogs.json',
            accessToken
        )

        if (!response.ok) {
            return { blogs: [], error: `Failed to fetch blogs: ${response.status}` }
        }

        const data = await response.json()
        return {
            blogs: (data.blogs || []).map((b: any) => ({
                id: b.id,
                handle: b.handle,
                title: b.title,
            }))
        }
    } catch (error: any) {
        return { blogs: [], error: error.message }
    }
}

/**
 * Create a blog article
 */
export async function createArticle(
    credentials: ShopifyCredentials,
    blogId: string,
    params: CreateArticleParams
): Promise<{
    success: boolean
    article?: ShopifyArticle
    articleUrl?: string
    error?: string
}> {
    const { storeDomain, accessToken } = credentials

    try {
        const articleData: any = {
            title: params.title,
            author: params.author,
            body_html: params.body_html,
            published: params.published ?? false,
        }

        if (params.tags) {
            articleData.tags = params.tags
        }

        if (params.image?.src) {
            articleData.image = {
                src: params.image.src,
                alt: params.image.alt || params.title,
            }
        }

        const response = await shopifyFetch(
            storeDomain,
            `/blogs/${blogId}/articles.json`,
            accessToken,
            {
                method: 'POST',
                body: JSON.stringify({ article: articleData }),
            }
        )

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return {
                success: false,
                error: errorData.errors || `Failed to create article: ${response.status}`
            }
        }

        const data = await response.json()
        const article = data.article

        // Construct article URL
        const articleUrl = `https://${storeDomain}/blogs/${article.blog_id}/articles/${article.id}`

        return {
            success: true,
            article: {
                id: article.id,
                title: article.title,
                handle: article.handle,
                blog_id: article.blog_id,
                published_at: article.published_at,
            },
            articleUrl,
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Full publish flow for Shopify
 */
export async function publishToShopify(
    credentials: ShopifyCredentials,
    blogId: string,
    article: {
        title: string
        content: string
        author?: string
        tags?: string
        featuredImageUrl?: string | null
    },
    publishAsDraft: boolean = true
): Promise<{
    success: boolean
    articleId?: number
    articleUrl?: string
    error?: string
}> {
    const result = await createArticle(credentials, blogId, {
        title: article.title,
        author: article.author || 'Admin',
        body_html: article.content,
        tags: article.tags,
        published: !publishAsDraft,
        image: article.featuredImageUrl ? {
            src: article.featuredImageUrl,
            alt: article.title,
        } : undefined,
    })

    if (!result.success) {
        return { success: false, error: result.error }
    }

    return {
        success: true,
        articleId: result.article?.id,
        articleUrl: result.articleUrl,
    }
}
