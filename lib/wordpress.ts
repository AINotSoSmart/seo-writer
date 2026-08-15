interface WordPressPost {
  id: string
  title: string
  excerpt: string
  content: string
  slug: string
  date: string
  modified: string
  author: {
    node: {
      name: string
      description?: string
      avatar: {
        url: string
      }
    }
  }
  featuredImage: {
    node: {
      sourceUrl: string
      altText: string
    }
  } | null
  categories: {
    nodes: Array<{
      name: string
      slug: string
    }>
  }
}

interface WordPressResponse {
  data: {
    posts: {
      nodes: WordPressPost[]
      pageInfo: {
        hasNextPage: boolean
        hasPreviousPage: boolean
        startCursor: string
        endCursor: string
      }
    }
  }
}

interface WordPressSinglePostResponse {
  data: {
    post: WordPressPost | null
  }
}

const WORDPRESS_GRAPHQL_URL = 'https://blog.flipaeo.com/graphql'

// GraphQL query to fetch all posts
const GET_POSTS_QUERY = `
  query GetPosts($first: Int, $after: String) {
    posts(first: $first, after: $after, where: { status: PUBLISH }) {
      nodes {
        id
        title
        excerpt
        content
        slug
        date
        modified
        author {
          node {
            name
            description
            avatar {
              url
            }
          }
        }
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
        categories {
          nodes {
            name
            slug
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`

// GraphQL query to fetch a single post by slug
const GET_POST_BY_SLUG_QUERY = `
  query GetPostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      id
      title
      content
      excerpt
      slug
      date
      modified
      author {
        node {
          name
          description
          avatar {
            url
          }
        }
      }
      featuredImage {
        node {
          sourceUrl
          altText
        }
      }
      categories {
        nodes {
          name
          slug
        }
      }
    }
  }
`

// GraphQL query to get all post slugs for static generation
const GET_ALL_SLUGS_QUERY = `
  query GetAllSlugs {
    posts(first: 1000, where: { status: PUBLISH }) {
      nodes {
        slug
      }
    }
  }
`

// Helper function to make GraphQL requests
async function fetchGraphQL(query: string, variables: Record<string, any> = {}, retries: number = 3) {
  // Shorter timeout to avoid crawler timeouts; retry on transient failures
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(WORDPRESS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      signal: controller.signal,
      next: {
        revalidate: 300, // Revalidate every 5 minutes
      },
    })

    clearTimeout(timeoutId)

    // Retry on 5xx responses
    if (!response.ok) {
      const status = response.status
      if (status >= 500 && retries > 0) {
        await new Promise((r) => setTimeout(r, 500))
        return fetchGraphQL(query, variables, retries - 1)
      }
      throw new Error(`HTTP error! status: ${status}`)
    }

    const json = await response.json()

    if (json.errors) {
      // GraphQL layer errors are usually transient; retry a couple times
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 500))
        return fetchGraphQL(query, variables, retries - 1)
      }
      throw new Error('GraphQL query failed')
    }

    return json
  } catch (error) {
    clearTimeout(timeoutId)

    // Retry logic for network errors and timeouts
    if (retries > 0 && (error instanceof TypeError || (error as Error).name === 'AbortError')) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return fetchGraphQL(query, variables, retries - 1)
    }

    throw error
  }
}

// Fetch all published posts
export async function getAllPosts(first: number = 10, after?: string): Promise<{
  posts: WordPressPost[]
  pageInfo: {
    hasNextPage: boolean
    hasPreviousPage: boolean
    startCursor: string
    endCursor: string
  }
}> {
  try {
    const response: WordPressResponse = await fetchGraphQL(GET_POSTS_QUERY, {
      first,
      after,
    })

    return {
      posts: response.data.posts.nodes,
      pageInfo: response.data.posts.pageInfo,
    }
  } catch (error) {
    console.warn('Failed to fetch posts from WordPress, using fallback data:', error)

    // Import fallback data dynamically to avoid circular dependencies
    const { fallbackBlogPosts } = await import('./fallback-data')

    return {
      posts: fallbackBlogPosts.slice(0, first),
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: '',
        endCursor: ''
      }
    }
  }
}

// Fetch a single post by slug
export async function getPostBySlug(slug: string): Promise<WordPressPost | null> {
  try {
    const response: WordPressSinglePostResponse = await fetchGraphQL(GET_POST_BY_SLUG_QUERY, {
      slug,
    })
    return response.data.post
  } catch (error) {
    console.warn('getPostBySlug failed, returning null:', error)
    return null
  }
}

// Get all post slugs for static generation
export async function getAllPostSlugs(): Promise<string[]> {
  const response = await fetchGraphQL(GET_ALL_SLUGS_QUERY)
  return response.data.posts.nodes.map((post: { slug: string }) => post.slug)
}

// Helper function to format WordPress date
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Helper function to calculate reading time
export function calculateReadingTime(content: string): string {
  if (!content) return '1 min read'
  const wordsPerMinute = 200
  const textContent = content.replace(/<[^>]*>/g, '') // Strip HTML tags
  const wordCount = textContent.split(/\s+/).length
  const readingTime = Math.ceil(wordCount / wordsPerMinute)
  return `${readingTime} min read`
}

// Helper function to extract excerpt from content if not provided
export function extractExcerpt(content: string, length: number = 160): string {
  if (!content) return ''
  // Strip HTML tags
  let textContent = content.replace(/<[^>]*>/g, '')

  // Clean up WordPress auto-generated excerpt suffixes BEFORE truncating
  textContent = textContent
    .replace(/\[\.\.\.\]/g, '') // Remove [...]
    .replace(/&hellip;/g, '')   // Remove HTML entity ellipsis
    .replace(/\s+Read more.*$/i, '') // Remove "Read more" links commonly found
    .trim()

  // Decode common HTML entities
  textContent = textContent
    .replace(/&#8217;/g, "'")   // Right single quote
    .replace(/&#8216;/g, "'")   // Left single quote
    .replace(/&#8220;/g, '"')   // Left double quote
    .replace(/&#8221;/g, '"')   // Right double quote
    .replace(/&#8211;/g, '–')   // En dash
    .replace(/&#8212;/g, '—')   // Em dash
    .replace(/&amp;/g, '&')     // Ampersand
    .replace(/&nbsp;/g, ' ')    // Non-breaking space
    .replace(/&quot;/g, '"')    // Quote
    .replace(/&#039;/g, "'")    // Apostrophe

  return textContent.length > length
    ? textContent.substring(0, length).trim() + '...'
    : textContent
}

export type { WordPressPost }

// Transform WordPress post to blog card format
export function transformWordPressPost(post: WordPressPost, index: number = 0) {
  return {
    title: post.title,
    excerpt: post.excerpt ? extractExcerpt(post.excerpt, 160) : "",
    slug: post.slug,
    publishedAt: formatDate(post.date),
    readTime: calculateReadingTime(post.content),
    category: post.categories.nodes[0]?.name || "General",
    image: post.featuredImage?.node?.sourceUrl || "/placeholder.svg?height=400&width=600&text=Blog+Post",
    featured: index === 0, // First post is featured
    author: post.author.node.name,
  }
}