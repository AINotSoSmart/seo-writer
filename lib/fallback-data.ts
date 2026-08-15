// Fallback data for when network requests fail
export const fallbackBlogPosts = [
  {
    id: "fallback-1",
    title: "What is Generative Engine Optimization (GEO)? A Complete Guide",
    excerpt: "Learn how GEO differs from traditional SEO and why optimizing for AI search engines like ChatGPT and Perplexity is critical for your brand's visibility.",
    content: "Generative Engine Optimization is the practice of optimizing content to be cited by AI-powered search engines...",
    slug: "what-is-generative-engine-optimization",
    date: "2026-02-01T10:00:00Z",
    modified: "2026-02-01T10:00:00Z",
    author: {
      node: {
        name: "FlipAEO Team",
        avatar: {
          url: "/placeholder.svg?height=40&width=40&text=Author"
        }
      }
    },
    featuredImage: {
      node: {
        sourceUrl: "/placeholder.svg?height=400&width=600&text=GEO+Guide",
        altText: "Generative Engine Optimization guide"
      }
    },
    categories: {
      nodes: [
        {
          name: "GEO",
          slug: "geo"
        }
      ]
    }
  },
  {
    id: "fallback-2",
    title: "How to Get Your Brand Cited by ChatGPT and Perplexity",
    excerpt: "Discover proven strategies to increase your brand's visibility in AI-generated responses and become a trusted source for AI search engines.",
    content: "Getting cited by AI search engines requires a different approach than traditional SEO...",
    slug: "get-cited-by-ai-search-engines",
    date: "2026-01-25T14:30:00Z",
    modified: "2026-01-25T14:30:00Z",
    author: {
      node: {
        name: "FlipAEO Team",
        avatar: {
          url: "/placeholder.svg?height=40&width=40&text=Author"
        }
      }
    },
    featuredImage: {
      node: {
        sourceUrl: "/placeholder.svg?height=400&width=600&text=AI+Citations",
        altText: "How to get cited by AI search engines"
      }
    },
    categories: {
      nodes: [
        {
          name: "Strategy",
          slug: "strategy"
        }
      ]
    }
  },
  {
    id: "fallback-3",
    title: "AI Content Strategy: Building Authority with AI-First SEO",
    excerpt: "Learn how to create content that establishes your brand as an authority source that AI engines trust and cite in their responses.",
    content: "Building authority in the age of AI search requires strategic content planning...",
    slug: "ai-content-strategy-authority-building",
    date: "2026-01-20T09:15:00Z",
    modified: "2026-01-20T09:15:00Z",
    author: {
      node: {
        name: "FlipAEO Team",
        avatar: {
          url: "/placeholder.svg?height=40&width=40&text=Author"
        }
      }
    },
    featuredImage: {
      node: {
        sourceUrl: "/placeholder.svg?height=400&width=600&text=AI+Content+Strategy",
        altText: "AI content strategy guide"
      }
    },
    categories: {
      nodes: [
        {
          name: "Content Strategy",
          slug: "content-strategy"
        }
      ]
    }
  }
];

// Offline detection utility
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true; // Assume online on server
}