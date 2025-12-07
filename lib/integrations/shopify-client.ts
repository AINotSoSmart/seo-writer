/**
 * Shopify Admin API Client for publishing blog articles
 * Uses Custom App access token for authentication
 * 
 * Setup: Shopify Admin → Settings → Apps → Develop apps → Create an app
 * Scopes needed: read_content, write_content
 */

const SHOPIFY_API_VERSION = '2024-10'

interface ShopifyCredentials {
    storeDomain: string  // e.g., mystore.myshopify.com OR just "mystore"
    accessToken: string  // Admin API access token (starts with shpat_)
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
        attachment?: string // Base64 encoded image
        alt?: string
    }
}

/**
 * Normalize store domain to always be in format: store.myshopify.com
 */
function normalizeStoreDomain(input: string): string {
    // Remove any protocol
    let domain = input.replace(/^https?:\/\//, '').trim()

    // Remove trailing slashes
    domain = domain.replace(/\/+$/, '')

    // If already has .myshopify.com, use as-is
    if (domain.includes('.myshopify.com')) {
        return domain
    }

    // If it's just the store name, append .myshopify.com
    // Handle case where user enters "mystore" or "mystore.com"
    const storeName = domain.split('.')[0]
    return `${storeName}.myshopify.com`
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
    const normalizedDomain = normalizeStoreDomain(storeDomain)
    const url = `https://${normalizedDomain}/admin/api/${SHOPIFY_API_VERSION}${endpoint}`

    console.log(`[Shopify] Requesting: ${url}`)

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
    normalizedDomain?: string
    error?: string
}> {
    const { storeDomain, accessToken } = credentials
    const normalizedDomain = normalizeStoreDomain(storeDomain)

    // Validate token format with specific help messages
    if (!accessToken) {
        return { success: false, error: 'Access token is required' }
    }

    if (accessToken.startsWith('shpss_')) {
        return {
            success: false,
            error: 'You entered the Client Secret (starts with shpss_). Please use the "Admin API access token" which starts with "shpat_". Go to API credentials tab → Install app → Reveal token.'
        }
    }

    if (accessToken.startsWith('shpua_')) {
        return {
            success: false,
            error: 'You entered a User Access Token (starts with shpua_). Please use the "Admin API access token" which starts with "shpat_".'
        }
    }

    if (!accessToken.startsWith('shpat_') && accessToken.length < 30) {
        return { success: false, error: 'Invalid access token format. It should start with "shpat_"' }
    }

    try {
        const response = await shopifyFetch(
            storeDomain,
            '/shop.json',
            accessToken
        )

        if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            console.error('[Shopify] Connection error:', response.status, errorText)

            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    error: 'Invalid access token. Make sure you copied the Admin API access token (starts with shpat_) and the app has read_content scope.'
                }
            }
            if (response.status === 404) {
                return {
                    success: false,
                    error: `Store not found at ${normalizedDomain}. Check the store domain.`
                }
            }
            return { success: false, error: `Connection failed: ${response.status} - ${response.statusText}` }
        }

        const data = await response.json()
        return {
            success: true,
            shopName: data.shop?.name || normalizedDomain,
            normalizedDomain,
        }
    } catch (error: any) {
        console.error('[Shopify] Connection exception:', error)
        return { success: false, error: `Network error: ${error.message}` }
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
            const errorText = await response.text().catch(() => '')
            console.error('[Shopify] Failed to fetch blogs:', response.status, errorText)

            if (response.status === 401 || response.status === 403) {
                return { blogs: [], error: 'Access denied. Make sure the app has read_content scope.' }
            }
            return { blogs: [], error: `Failed to fetch blogs: ${response.status}` }
        }

        const data = await response.json()
        const blogs = (data.blogs || []).map((b: any) => ({
            id: b.id,
            handle: b.handle,
            title: b.title,
        }))

        if (blogs.length === 0) {
            return { blogs: [], error: 'No blogs found. Create a blog in your Shopify store first (Online Store → Blog posts → Manage blogs).' }
        }

        return { blogs }
    } catch (error: any) {
        console.error('[Shopify] listBlogs exception:', error)
        return { blogs: [], error: `Network error: ${error.message}` }
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
    const normalizedDomain = normalizeStoreDomain(storeDomain)

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

        if (params.image) {
            articleData.image = {
                alt: params.image.alt || params.title,
            }
            if (params.image.src) {
                articleData.image.src = params.image.src
            } else if (params.image.attachment) {
                articleData.image.attachment = params.image.attachment
            }
        }

        console.log('[Shopify] Creating article:', { blogId, title: params.title })

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
            console.error('[Shopify] Failed to create article:', response.status, errorData)

            if (response.status === 401 || response.status === 403) {
                return { success: false, error: 'Access denied. Make sure the app has write_content scope.' }
            }

            // Shopify returns errors in different formats
            const errorMessage = typeof errorData.errors === 'string'
                ? errorData.errors
                : JSON.stringify(errorData.errors || errorData)

            return {
                success: false,
                error: `Failed to create article: ${errorMessage || response.status}`
            }
        }

        const data = await response.json()
        const article = data.article

        // Construct proper article URL using blog handle
        // Format: https://store.myshopify.com/blogs/news/article-handle
        const blogHandle = article.handle ? article.handle : 'news'
        const articleUrl = `https://${normalizedDomain.replace('.myshopify.com', '')}.myshopify.com/blogs/${blogHandle}`

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
        console.error('[Shopify] createArticle exception:', error)
        return { success: false, error: `Network error: ${error.message}` }
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
        featuredImageAttachment?: string | null // Base64
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
        image: article.featuredImageAttachment ? {
            attachment: article.featuredImageAttachment,
            alt: article.title,
        } : (article.featuredImageUrl ? {
            src: article.featuredImageUrl,
            alt: article.title,
        } : undefined),
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
