/**
 * WordPress REST API Client for publishing articles
 * Uses Application Passwords for authentication
 */

interface WordPressCredentials {
    siteUrl: string
    username: string
    appPassword: string
}

interface WordPressPost {
    id: number
    link: string
    status: string
    title: { rendered: string }
}

interface CreatePostParams {
    title: string
    content: string
    excerpt?: string
    slug?: string
    status?: 'draft' | 'publish' | 'pending' | 'private'
    featured_media?: number
}

interface UploadMediaResult {
    id: number
    source_url: string
}

/**
 * Create Basic Auth header from credentials
 */
function createAuthHeader(username: string, appPassword: string): string {
    const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64')
    return `Basic ${credentials}`
}

/**
 * Test WordPress connection by fetching current user
 */
export async function testConnection(credentials: WordPressCredentials): Promise<{ success: boolean; error?: string; siteName?: string }> {
    const { siteUrl, username, appPassword } = credentials

    try {
        // Normalize URL
        const baseUrl = siteUrl.replace(/\/+$/, '')
        const apiUrl = `${baseUrl}/wp-json/wp/v2/users/me`

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': createAuthHeader(username, appPassword),
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            if (response.status === 401) {
                return { success: false, error: 'Invalid credentials. Check username and application password.' }
            }
            if (response.status === 404) {
                return { success: false, error: 'WordPress REST API not found. Make sure permalinks are enabled.' }
            }
            return { success: false, error: `Connection failed: ${response.status} ${response.statusText}` }
        }

        const user = await response.json()

        // Fetch site name
        const siteResponse = await fetch(`${baseUrl}/wp-json`, {
            headers: { 'Authorization': createAuthHeader(username, appPassword) },
        })
        const siteInfo = await siteResponse.json()

        return {
            success: true,
            siteName: siteInfo?.name || siteUrl
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to connect to WordPress site'
        }
    }
}

/**
 * Upload media (featured image) to WordPress
 */
export async function uploadMedia(
    credentials: WordPressCredentials,
    imageUrl: string,
    filename: string
): Promise<UploadMediaResult | null> {
    const { siteUrl, username, appPassword } = credentials

    try {
        // Fetch the image
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
            console.error('Failed to fetch image:', imageUrl)
            return null
        }

        const imageBuffer = await imageResponse.arrayBuffer()
        const contentType = imageResponse.headers.get('content-type') || 'image/png'

        // Upload to WordPress
        const baseUrl = siteUrl.replace(/\/+$/, '')
        const apiUrl = `${baseUrl}/wp-json/wp/v2/media`

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': createAuthHeader(username, appPassword),
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': contentType,
            },
            body: Buffer.from(imageBuffer),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Failed to upload media:', errorText)
            return null
        }

        const media = await response.json()
        return {
            id: media.id,
            source_url: media.source_url,
        }
    } catch (error) {
        console.error('Error uploading media:', error)
        return null
    }
}

/**
 * Create a new post in WordPress
 */
export async function createPost(
    credentials: WordPressCredentials,
    params: CreatePostParams
): Promise<{ success: boolean; post?: WordPressPost; error?: string }> {
    const { siteUrl, username, appPassword } = credentials

    try {
        const baseUrl = siteUrl.replace(/\/+$/, '')
        const apiUrl = `${baseUrl}/wp-json/wp/v2/posts`

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': createAuthHeader(username, appPassword),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: params.title,
                content: params.content,
                excerpt: params.excerpt || '',
                slug: params.slug || '',
                status: params.status || 'draft',
                featured_media: params.featured_media || 0,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return {
                success: false,
                error: errorData.message || `Failed to create post: ${response.status}`
            }
        }

        const post = await response.json()
        return {
            success: true,
            post: {
                id: post.id,
                link: post.link,
                status: post.status,
                title: post.title,
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to create post'
        }
    }
}

/**
 * Full publish flow: upload featured image + create post
 */
export async function publishToWordPress(
    credentials: WordPressCredentials,
    article: {
        title: string
        content: string
        excerpt?: string
        slug?: string
        featuredImageUrl?: string | null
    },
    publishStatus: 'draft' | 'publish' = 'draft'
): Promise<{ success: boolean; post?: WordPressPost; error?: string }> {
    let featuredMediaId: number | undefined

    // 1. Upload featured image if available
    if (article.featuredImageUrl) {
        const filename = `featured-${article.slug || 'image'}.png`
        const mediaResult = await uploadMedia(credentials, article.featuredImageUrl, filename)
        if (mediaResult) {
            featuredMediaId = mediaResult.id
        }
    }

    // 2. Create the post
    return createPost(credentials, {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        slug: article.slug,
        status: publishStatus,
        featured_media: featuredMediaId,
    })
}
