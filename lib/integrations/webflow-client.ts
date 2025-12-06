/**
 * Webflow CMS API Client for publishing articles
 * Uses Bearer token authentication with Webflow API v2
 */

const WEBFLOW_API_BASE = 'https://api.webflow.com/v2'

interface WebflowCredentials {
    apiToken: string
    siteId: string
    collectionId: string
}

interface WebflowSite {
    id: string
    displayName: string
    shortName: string
}

interface WebflowCollection {
    id: string
    displayName: string
    slug: string
}

interface WebflowCollectionItem {
    id: string
    fieldData: Record<string, any>
}

interface CreateItemParams {
    name: string        // Title
    slug: string        // URL slug
    content: string     // Rich text content (HTML)
    excerpt?: string    // Post summary
    [key: string]: any  // Additional custom fields
}

/**
 * Make authenticated request to Webflow API
 */
async function webflowFetch(
    endpoint: string,
    apiToken: string,
    options: RequestInit = {}
): Promise<Response> {
    return fetch(`${WEBFLOW_API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            'accept-version': '2.0.0',
            ...options.headers,
        },
    })
}

/**
 * Test Webflow connection by fetching authorized user info
 */
export async function testConnection(apiToken: string): Promise<{
    success: boolean
    error?: string
}> {
    try {
        const response = await webflowFetch('/token/authorized_by', apiToken)

        if (!response.ok) {
            if (response.status === 401) {
                return { success: false, error: 'Invalid API token' }
            }
            return { success: false, error: `Connection failed: ${response.status}` }
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to connect' }
    }
}

/**
 * List all sites accessible with the API token
 */
export async function listSites(apiToken: string): Promise<{
    sites: WebflowSite[]
    error?: string
}> {
    try {
        const response = await webflowFetch('/sites', apiToken)

        if (!response.ok) {
            return { sites: [], error: `Failed to fetch sites: ${response.status}` }
        }

        const data = await response.json()
        return {
            sites: (data.sites || []).map((s: any) => ({
                id: s.id,
                displayName: s.displayName || s.shortName,
                shortName: s.shortName,
            }))
        }
    } catch (error: any) {
        return { sites: [], error: error.message }
    }
}

/**
 * List all CMS collections for a site
 */
export async function listCollections(
    apiToken: string,
    siteId: string
): Promise<{
    collections: WebflowCollection[]
    error?: string
}> {
    try {
        const response = await webflowFetch(`/sites/${siteId}/collections`, apiToken)

        if (!response.ok) {
            return { collections: [], error: `Failed to fetch collections: ${response.status}` }
        }

        const data = await response.json()
        return {
            collections: (data.collections || []).map((c: any) => ({
                id: c.id,
                displayName: c.displayName,
                slug: c.slug,
            }))
        }
    } catch (error: any) {
        return { collections: [], error: error.message }
    }
}

/**
 * Create a collection item (blog post) in Webflow
 */
export async function createCollectionItem(
    credentials: WebflowCredentials,
    params: CreateItemParams,
    fieldMapping: Record<string, string> = {}
): Promise<{
    success: boolean
    item?: WebflowCollectionItem
    error?: string
}> {
    const { apiToken, collectionId } = credentials

    // Build fieldData based on mapping
    const fieldData: Record<string, any> = {
        name: params.name,
        slug: params.slug,
    }

    // Map content to the configured field (default: 'post-body')
    const contentField = fieldMapping.content || 'post-body'
    fieldData[contentField] = params.content

    // Map excerpt to the configured field (default: 'post-summary')
    if (params.excerpt) {
        const excerptField = fieldMapping.excerpt || 'post-summary'
        fieldData[excerptField] = params.excerpt
    }

    try {
        // Create as staged item first (not live)
        const response = await webflowFetch(
            `/collections/${collectionId}/items`,
            apiToken,
            {
                method: 'POST',
                body: JSON.stringify({
                    fieldData,
                    isDraft: false, // Create as staged, not draft
                }),
            }
        )

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return {
                success: false,
                error: errorData.message || errorData.err || `Failed to create item: ${response.status}`
            }
        }

        const item = await response.json()
        return {
            success: true,
            item: {
                id: item.id,
                fieldData: item.fieldData,
            }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Publish staged items to make them live
 */
export async function publishItems(
    apiToken: string,
    collectionId: string,
    itemIds: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await webflowFetch(
            `/collections/${collectionId}/items/publish`,
            apiToken,
            {
                method: 'POST',
                body: JSON.stringify({ itemIds }),
            }
        )

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return {
                success: false,
                error: errorData.message || `Failed to publish: ${response.status}`
            }
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Full publish flow: create item
 */
export async function publishToWebflow(
    credentials: WebflowCredentials,
    article: {
        title: string
        content: string
        slug?: string
        excerpt?: string
    },
    fieldMapping: Record<string, string> = {}
): Promise<{
    success: boolean
    itemId?: string
    error?: string
}> {
    // Generate slug from title if not provided
    const slug = article.slug || article.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

    // Create the collection item
    const result = await createCollectionItem(
        credentials,
        {
            name: article.title,
            slug,
            content: article.content,
            excerpt: article.excerpt,
        },
        fieldMapping
    )

    if (!result.success || !result.item) {
        return { success: false, error: result.error }
    }

    return {
        success: true,
        itemId: result.item.id,
    }
}
