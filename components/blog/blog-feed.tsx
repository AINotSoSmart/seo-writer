'use client'

import { useState } from "react"
import BlogCard from "@/components/blog-card"
import { loadMorePosts } from "@/app/blog/actions"
import { Loader2 } from "lucide-react"

interface BlogFeedProps {
    initialPosts: any[]
    initialPageInfo: {
        hasNextPage: boolean
        endCursor: string
    }
}

export function BlogFeed({ initialPosts, initialPageInfo }: BlogFeedProps) {
    const [posts, setPosts] = useState(initialPosts)
    const [pageInfo, setPageInfo] = useState(initialPageInfo)
    const [loading, setLoading] = useState(false)

    const handleLoadMore = async () => {
        if (loading || !pageInfo.hasNextPage) return

        setLoading(true)
        try {
            const { posts: newPosts, pageInfo: newPageInfo } = await loadMorePosts(pageInfo.endCursor)
            setPosts((prev) => [...prev, ...newPosts])
            setPageInfo(newPageInfo)
        } catch (error) {
            console.error("Failed to load more posts", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.length > 0 ? (
                    posts.map((post) => (
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

            {pageInfo.hasNextPage && (
                <div className="text-center mt-12">
                    <button
                        onClick={handleLoadMore}
                        disabled={loading}
                        className="cursor-pointer h-12 px-8 text-base font-semibold bg-white text-stone-900 border border-stone-200 hover:border-stone-300 hover:bg-stone-50 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            "Load More Posts"
                        )}
                    </button>
                </div>
            )}
        </>
    )
}
