import { MetadataRoute } from 'next'
import { defaultSEO } from '@/config/seo'
import { getAllPostSlugs } from '@/lib/wordpress'

// Regenerate sitemap periodically to auto-include newly published WordPress posts
export const revalidate = 600 // seconds

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = defaultSEO.siteUrl
  const currentDate = new Date()

  // Static public pages only (no protected routes)
  const staticPages = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: currentDate,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
  ]

  // Targeted fix: include key public pages and landing pages
  const extraRoutes = [
    // Core public pages
    '/pricing',
    '/about',
    '/privacy-policy',
    '/terms',
    '/refund-policy',
    '/blog',
    // Landing pages (present in /app)
    '/ai-doctor-headshots',
    '/founder-headshots',
    '/ai-chef-headshots',
    '/ai-real-estate-headshots',
    '/ai-botanic-illustrations',
    '/ai-christmas-photoshoot',
    '/ai-dating-photoshoot',
    '/ai-diwali-photoshoot',
    '/ai-fantasy-photoshoot',
    '/ai-glamour-photoshoot',
    '/ai-halloween-photoshoot',
    '/ai-influencer-generator',
    '/ai-instagram-photoshoot',
    '/ai-maternity-photoshoot',
    '/ai-yearbook',
    '/black-swan-photoshoot',
    '/corporate-headshots',
    '/denim-wear-photoshoot',
    '/ai-lawyer-headshots',
    '/linkedin-headshots',
    '/natural-looks-photoshoot',
    '/neutral-muse-photoshoot',
    '/office-outfit-photoshoot',
    '/personal-branding-photoshoot',
    '/professional-headshots',
    '/profile-photo-maker',
    '/resume-headshots',
    '/street-style-photoshoot',
    '/stylish-ai-portraits',
    '/vintage-photoshoot',
  ]

  const additionalPages: MetadataRoute.Sitemap = extraRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: currentDate,
    // Policies monthly, landings weekly
    changeFrequency: ['privacy-policy', 'terms', 'refund-policy'].some((p) => path.includes(p))
      ? ('monthly' as const)
      : ('weekly' as const),
    priority: ['privacy-policy', 'terms', 'refund-policy'].some((p) => path.includes(p))
      ? 0.5
      : 0.7,
  }))

  // Dynamically include WordPress blog posts
  const blogSlugs = await getAllPostSlugs().catch(() => [])
  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // Note: Protected pages like /blog-writer, /account are intentionally excluded

  return [...staticPages, ...additionalPages, ...blogPages]
}