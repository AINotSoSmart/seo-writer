import type { Metadata } from "next"
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from "@/components/landing/Footer"
import { BlogFeed } from "@/components/blog/blog-feed"
import { OfflineBanner } from "@/components/network-status"
import { getAllPosts, transformWordPressPost } from "@/lib/wordpress"
import { Suspense } from "react"
import { defaultSEO } from "@/config/seo"

export const dynamic = 'force-static'
export const revalidate = 600 // 10 minutes

export const metadata: Metadata = {
  title: "Blog - FlipAEO | GEO & AI Content Strategy Insights",
  description:
    "Expert insights on Generative Engine Optimization (GEO), AI search visibility, content strategy, and how to get cited by AI search engines like ChatGPT and Perplexity.",
  robots: "index, follow",
  openGraph: {
    title: "Blog - FlipAEO | GEO & AI Content Strategy Insights",
    description: "Expert insights on Generative Engine Optimization, AI search visibility, and content strategy. Learn how to get cited by AI search engines.",
    type: "website",
    url: `${defaultSEO.siteUrl}/blog`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog - FlipAEO | GEO & AI Content Strategy Insights",
    description: "Expert insights on Generative Engine Optimization, AI search visibility, and content strategy. Learn how to get cited by AI search engines.",
  },
}

// Transform WordPress post to blog card format - Removed as it's now imported

async function BlogContent() {
  try {
    const { posts, pageInfo } = await getAllPosts(6) // Fetch initial 6 posts
    const blogPosts = posts.map((post, index) => transformWordPressPost(post, index))

    return (
      <BlogPageContent blogPosts={blogPosts} pageInfo={pageInfo} />
    )
  } catch (error) {
    console.error('Error fetching blog posts:', error)
    // Fallback to empty state
    return (
      <BlogPageContent blogPosts={[]} pageInfo={{ hasNextPage: false, hasPreviousPage: false, startCursor: '', endCursor: '' }} />
    )
  }
}

function BlogPageContent({ blogPosts, pageInfo }: { blogPosts: any[], pageInfo: any }) {
  return (
    <div className="min-h-screen w-full flex flex-col overflow-x-hidden font-sans bg-stone-50/50">
      <Navbar />

      <main className="flex-grow flex flex-col items-center w-full pt-12">
        {/* Hero Section */}
        <section className="w-full py-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-block bg-stone-100 text-stone-800 border border-stone-200 rounded-full px-4 py-1.5 mb-6 text-sm font-medium tracking-wide">
              <span className="font-display font-bold text-xs uppercase tracking-widest">Blog</span>
            </div>
            <h1 className="font-display text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black text-4xl sm:text-5xl md:text-6xl leading-tight uppercase mb-4">
              GEO & Content Strategy Insights
            </h1>
            <p className="font-sans text-gray-600 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
              Expert insights on Generative Engine Optimization, AI search visibility, and how to create authority-building content that AI search engines cite.
            </p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 pb-20 w-full">
          {/* Offline Banner */}
          <OfflineBanner />

          {/* Blog Feed */}
          <BlogFeed initialPosts={blogPosts} initialPageInfo={pageInfo} />
        </div>

      </main>

      <Footer />
    </div>
  )
}

export default function BlogPage() {
  return (
    <Suspense fallback={
      <div className="landing-page min-h-screen w-full flex flex-col overflow-x-hidden font-sans">
        <Navbar />
        <main className="flex-grow flex flex-col items-center w-full pt-12">
          <section className="w-full py-16 px-4">
            <div className="max-w-5xl mx-auto text-center">
              <div className="inline-block bg-brand-orange text-white border-2 border-black shadow-neo-sm px-4 py-1.5 mb-6 transform -rotate-2">
                <span className="font-display font-bold text-xs uppercase tracking-widest">Blog</span>
              </div>
              <h1 className="font-display text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black text-4xl sm:text-5xl md:text-6xl leading-tight uppercase mb-4">
                GEO & Content Strategy Insights
              </h1>
              <p className="font-sans text-gray-600 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                Loading latest articles...
              </p>
            </div>
          </section>
          <div className="max-w-7xl mx-auto px-4 pb-20 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-96"></div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    }>
      <BlogContent />
    </Suspense>
  )
}