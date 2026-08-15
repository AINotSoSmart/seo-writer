const API_URL = process.env.WORDPRESS_API_URL

async function fetchAPI(query: string, { variables }: { variables?: any } = {}): Promise<any> {
  const headers = { "Content-Type": "application/json" }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const res = await fetch(API_URL!, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.error(`HTTP error! status: ${res.status}`)
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    const json = await res.json()

    if (json.errors) {
      console.error(JSON.stringify(json.errors, null, 2))
      throw new Error("Failed to fetch API")
    }

    return json.data
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('WordPress API request timed out')
      throw new Error('WordPress API request timed out')
    }
    console.error('WordPress API error:', error)
    throw error
  }
}

export async function getAllPosts(page = 1, perPage = 8): Promise<PostsResponse> {
  const data = await fetchAPI(
    `
    query AllPosts($first: Int!, $after: String) {
      posts(first: $first, after: $after, where: { orderby: { field: DATE, order: DESC }, status: PUBLISH }) {
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            id
            date
            title
            slug
            excerpt
            featuredImage {
              node {
                sourceUrl(size: LARGE)
                altText
              }
            }
            author {
              node {
                name
                avatar {
                  url
                }
              }
            }
            categories {
              edges {
                node {
                  name
                  slug
                }
              }
            }
          }
        }
      }
    }
  `,
    {
      variables: {
        first: perPage,
        after: page > 1 ? btoa(`arrayconnection:${(page - 1) * perPage - 1}`) : null,
      },
    },
  )
  return data?.posts
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const data = await fetchAPI(
    `
    query PostBySlug($id: ID!, $idType: PostIdType!) {
      post(id: $id, idType: $idType) {
        id
        date
        modified
        title
        content(format: RENDERED)
        slug
        excerpt(format: RENDERED)
        featuredImage {
          node {
            sourceUrl(size: LARGE)
            altText
          }
        }
        author {
          node {
            name
            avatar {
              url
            }
          }
        }
        categories {
          edges {
            node {
              name
              slug
            }
          }
        }
      }
    }
  `,
    {
      variables: {
        id: slug,
        idType: "SLUG",
      },
    },
  )
  return data?.post
}

export async function searchPosts(searchQuery: string, page = 1, perPage = 8): Promise<PostsResponse> {
  const data = await fetchAPI(
    `
    query SearchPosts($first: Int!, $after: String, $search: String!) {
      posts(first: $first, after: $after, where: { search: $search, orderby: { field: DATE, order: DESC }, status: PUBLISH }) {
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            id
            date
            title
            slug
            excerpt
            featuredImage {
              node {
                sourceUrl(size: LARGE)
                altText
              }
            }
            author {
              node {
                name
                avatar {
                  url
                }
              }
            }
            categories {
              edges {
                node {
                  name
                  slug
                }
              }
            }
          }
        }
      }
    }
  `,
    {
      variables: {
        first: perPage,
        after: page > 1 ? btoa(`arrayconnection:${(page - 1) * perPage - 1}`) : null,
        search: searchQuery,
      },
    },
  )
  return data?.posts
}

export interface Post {
  id: string
  date: string
  modified: string
  title: string
  content: string
  slug: string
  excerpt: string
  featuredImage: {
    node: {
      sourceUrl: string
      altText: string
    }
  }
  author: {
    node: {
      name: string
      avatar: {
        url: string
      }
    }
  }
  categories: {
    edges: Array<{
      node: {
        name: string
        slug: string
      }
    }>
  }
}

export interface PostsResponse {
  pageInfo: {
    endCursor: string
    hasNextPage: boolean
  }
  edges: Array<{
    node: Post
  }>
}

