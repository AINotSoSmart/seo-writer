import { MetadataRoute } from 'next'
import { defaultSEO } from '@/config/seo'
import { getAllPostSlugs } from '@/lib/wordpress'
import { getAllToolSlugs } from '@/lib/tools'
import { solutions } from '@/app/solutions/data'
import { features } from '@/app/features/data'
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

  // Dynamically include Tools
  const toolSlugs = await getAllToolSlugs().catch(() => [])
  const toolPages: MetadataRoute.Sitemap = toolSlugs.map((slug) => ({
    url: `${baseUrl}/tools/${slug}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Add main tools page if not already in extraRoutes
  const toolsIndexPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/tools`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }]

  // Dynamically include Solutions
  const solutionSlugs = Object.keys(solutions)
  const solutionPages: MetadataRoute.Sitemap = solutionSlugs.map((slug) => ({
    url: `${baseUrl}/solutions/${slug}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  const solutionsIndexPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/solutions`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }]

  // Dynamically include Features
  const featureSlugs = Object.keys(features)
  const featurePages: MetadataRoute.Sitemap = featureSlugs.map((slug) => ({
    url: `${baseUrl}/features/${slug}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  const featuresIndexPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/features`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }]

  // Note: Protected pages like /blog-writer, /account are intentionally excluded

  return [...staticPages, ...additionalPages, ...blogPages, ...toolPages, ...toolsIndexPage, ...solutionsIndexPage, ...solutionPages, ...featuresIndexPage, ...featurePages]
}
