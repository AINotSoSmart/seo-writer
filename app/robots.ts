import { MetadataRoute } from 'next'
import { robotsConfig } from '@/config/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: robotsConfig.rules.userAgent,
      allow: robotsConfig.rules.allow,
      disallow: robotsConfig.rules.disallow,
    },
    sitemap: robotsConfig.sitemap,
  }
}