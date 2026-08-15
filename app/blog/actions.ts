'use server'

import { getAllPosts, transformWordPressPost } from "@/lib/wordpress"

export async function loadMorePosts(cursor: string | null) {
    const { posts, pageInfo } = await getAllPosts(6, cursor || undefined)

    // Transform the posts
    const transformedPosts = posts.map((post, index) => transformWordPressPost(post, index + 1)) // Index doesn't matter much here efficiently, but kept for type safety

    return {
        posts: transformedPosts,
        pageInfo
    }
}
