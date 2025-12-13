import type { Metadata } from "next"
import PublicHeader from '@/components/Header'
import MainFooter from "@/components/MainFooter"
import BlogCard from "@/components/blog-card"
import { OfflineBanner } from "@/components/network-status"
import { getAllPosts, formatDate, calculateReadingTime, extractExcerpt, type WordPressPost } from "@/lib/wordpress"
import { Suspense } from "react"

export const dynamic = 'force-static'
export const revalidate = 600 // 10 minutes

export const metadata: Metadata = {
  title: "The Unrealshot AI Blog",
  description:
    "Actionable guides and insights on AI photography. Get the latest tips for creating stunning AI headshots, professional photos for LinkedIn, and authentic, high-quality images for your social and dating profiles.",
  robots: "index, follow",
  openGraph: {
    title: "The Unrealshot AI Blog",
    description: "Your definitive guide to mastering your digital identity. In The Studio, we share expert tips, creative inspiration, and deep dives into the art of the perfect AI photoshoot.",
    type: "website",
    url: "https://www.unrealshot.com/blog",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Unrealshot AI Blog",
    description: "Your definitive guide to mastering your digital identity. In The Studio, we share expert tips, creative inspiration, and deep dives into the art of the perfect AI photoshoot.",
  },
}

// Transform WordPress post to blog card format
function transformWordPressPost(post: WordPressPost, index: number) {
  return {
    title: post.title,
    excerpt: post.excerpt ? extractExcerpt(post.excerpt, 160) : extractExcerpt(post.content, 160),
    slug: post.slug,
    publishedAt: formatDate(post.date),
    readTime: calculateReadingTime(post.content),
    category: post.categories.nodes[0]?.name || "General",
    image: post.featuredImage?.node?.sourceUrl || "/placeholder.svg?height=400&width=600&text=Blog+Post",
    featured: index === 0, // First post is featured
    author: post.author.node.name,
  }
}



async function BlogContent() {
  try {
    const { posts } = await getAllPosts(20) // Fetch 20 posts
    const blogPosts = posts.map(transformWordPressPost)

    return (
      <BlogPageContent blogPosts={blogPosts} />
    )
  } catch (error) {
    console.error('Error fetching blog posts:', error)
    // Fallback to empty state
    return (
      <BlogPageContent blogPosts={[]} />
    )
  }
}

function BlogPageContent({ blogPosts }: { blogPosts: any[] }) {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4">
          {/* Offline Banner */}
          <OfflineBanner />

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-black mb-4">The Unrealshot AI Blog</h1>
            <p className="text-gray-600 max-w-xl mx-auto">
              Your definitive guide to mastering your digital identity. In The Studio, we share expert tips, creative inspiration, and deep dives into the art of the perfect AI photoshoot.
            </p>
          </div>

          {/* Blog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.length > 0 ? (
              blogPosts.map((post) => (
                <BlogCard
                  key={post.slug}
                  title={post.title}
                  excerpt={post.excerpt}
                  slug={post.slug}
                  publishedAt={post.publishedAt}
                  readTime={post.readTime}
                  category={post.category}
                  image={post.image}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500 text-lg">No blog posts available at the moment.</p>
                <p className="text-gray-400 text-sm mt-2">Please check your internet connection and try again.</p>
              </div>
            )}
          </div>

          {/* Load More Button - Only show if more than 8 posts */}
          {blogPosts.length > 8 && (
            <div className="text-center mt-12">
              <button className="cursor-pointer bg-black text-white px-8 py-3 rounded-full hover:bg-gray-800 transition-all duration-200 font-medium hover:shadow-lg">
                Load More Posts
              </button>
            </div>
          )}
        </div>

      </main>

      <MainFooter />
    </div>
  )
}

export default function BlogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <main className="pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Photo Restoration Blog
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Loading latest articles...
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-96"></div>
              ))}
            </div>
          </div>
        </main>
        <MainFooter />
      </div>
    }>
      <BlogContent />
    </Suspense>
  )
}