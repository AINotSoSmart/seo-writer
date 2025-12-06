# SEO Configuration Guide

This guide explains how to customize and manage SEO settings in your Next.js application. The SEO system is built using modern Next.js 13+ features and industry best practices.

## Overview

The SEO system consists of:
- **Centralized Configuration**: All SEO settings in one place
- **Next.js 13+ Metadata API**: Modern, type-safe metadata management
- **Structured Data**: JSON-LD schema markup for rich snippets
- **Automatic Sitemap**: Dynamic sitemap generation
- **Robots.txt**: Configurable crawler directives
- **Reusable Components**: Easy-to-use SEO components

## Quick Start

### 1. Basic Configuration

Edit `/config/seo.ts` to customize your site's SEO:

```typescript
export const defaultSEO: SEOConfig = {
  title: 'Your SaaS Platform - Powerful Tools for Modern Businesses',
  description: 'Transform your business with our comprehensive SaaS platform.',
  keywords: ['SaaS platform', 'business tools', 'productivity'],
  author: 'Your Company Name',
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com',
  siteName: 'Your SaaS Platform',
  locale: 'en_US',
  type: 'website',
  robots: 'index, follow',
}
```

### 2. Social Media Configuration

```typescript
export const socialConfig: SocialConfig = {
  twitter: {
    handle: '@yourhandle',
    site: '@yourhandle',
    cardType: 'summary_large_image',
  },
  facebook: {
    appId: 'your-facebook-app-id',
  },
  linkedin: {
    companyId: 'your-linkedin-company-id',
  },
}
```

### 3. Organization Schema

```typescript
export const organizationSchema: OrganizationSchema = {
  '@type': 'Organization',
  name: 'Your Company Name',
  url: defaultSEO.siteUrl,
  logo: `${defaultSEO.siteUrl}/logo.png`,
  description: defaultSEO.description,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '123 Business Street',
    addressLocality: 'Your City',
    addressRegion: 'Your State',
    postalCode: '12345',
    addressCountry: 'US',
  },
}
```

## Page-Specific SEO

### Using Pre-configured Pages

For common pages, use the pre-configured metadata:

```typescript
// In your page component
import { Metadata } from 'next'
import { commonPageMetadata } from '@/lib/seo'

export const metadata: Metadata = commonPageMetadata.home()
```

Available pre-configured pages:
- `home()` - Homepage
- `login()` - Login page
- `dashboard()` - Dashboard (noindex)
- `buyCredits()` - Purchase page
- `account()` - Account settings (noindex)
- `reports()` - Reports page (noindex)

### Custom Page Metadata

For custom pages, use the `generateMetadata` function:

```typescript
import { generateMetadata } from '@/lib/seo'

export const metadata = generateMetadata({
  title: 'Custom Page Title',
  description: 'Custom page description',
  keywords: ['custom', 'keywords'],
  path: '/custom-page',
  type: 'article',
})
```

### Dynamic Metadata

For dynamic pages (e.g., blog posts, products):

```typescript
import { Metadata } from 'next'
import { generateMetadata } from '@/lib/seo'

type Props = {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch your data
  const post = await getPost(params.slug)
  
  return generateMetadata({
    title: post.title,
    description: post.excerpt,
    keywords: post.tags,
    path: `/blog/${params.slug}`,
    type: 'article',
    image: post.featuredImage,
  })
}
```

## Structured Data

### Using Structured Data Components

Add structured data to your pages:

```tsx
import { StructuredData } from '@/components/seo/StructuredData'
import { generateArticleSchema, generateProductSchema } from '@/lib/seo'

export default function BlogPost({ post }) {
  return (
    <>
      <StructuredData
        data={generateArticleSchema({
          headline: post.title,
          description: post.excerpt,
          author: post.author,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          image: post.featuredImage,
        })}
      />
      {/* Your page content */}
    </>
  )
}
```

### Available Schema Types

- `generateOrganizationSchema()` - Organization info
- `generateWebsiteSchema()` - Website info
- `generateSoftwareApplicationSchema()` - App info
- `generateBreadcrumbSchema()` - Navigation breadcrumbs
- `generateFAQSchema()` - FAQ sections
- `generateProductSchema()` - Product/service pages
- `generateArticleSchema()` - Blog posts/articles

## Environment Variables

Set these environment variables:

```env
# Required
NEXT_PUBLIC_APP_URL=https://yourapp.com

# Optional - Search Console Verification
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=your-verification-code
NEXT_PUBLIC_BING_SITE_VERIFICATION=your-verification-code
NEXT_PUBLIC_YANDEX_VERIFICATION=your-verification-code

# Optional - Social Media
NEXT_PUBLIC_FACEBOOK_APP_ID=your-facebook-app-id
```

## Open Graph Images

### Default Images

Place these images in your `/public` folder:
- `/public/og-image.png` (1200x630px) - Default Open Graph image
- `/public/logo.png` (400x400px) - Logo for structured data
- `/public/favicon.ico` - Favicon

### Custom Images

For custom Open Graph images:

```typescript
export const metadata = generateMetadata({
  title: 'Page Title',
  description: 'Page description',
  image: '/custom-og-image.png', // Custom image
  path: '/page-path',
})
```

## Sitemap Configuration

The sitemap is automatically generated at `/sitemap.xml`. To customize:

1. Edit `/app/sitemap.ts`
2. Add dynamic pages:

```typescript
// Add this function to sitemap.ts
async function getDynamicPages() {
  const posts = await getBlogPosts()
  return posts.map(post => ({
    url: `${defaultSEO.siteUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))
}

// Update the main function
export default async function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [...] // existing static pages
  const dynamicPages = await getDynamicPages()
  
  return [...staticPages, ...dynamicPages]
}
```

## Robots.txt Configuration

Customize crawler behavior in `/config/seo.ts`:

```typescript
export const robotsConfig = {
  rules: {
    userAgent: '*',
    allow: '/',
    disallow: [
      '/api/',
      '/blog-writer/',
      '/account/',
      '/admin/',
    ],
  },
  sitemap: `${defaultSEO.siteUrl}/sitemap.xml`,
}
```

## SEO Best Practices

### 1. Title Tags
- Keep titles under 60 characters
- Include primary keywords
- Make them unique and descriptive
- Use the format: "Page Title - Site Name"

### 2. Meta Descriptions
- Keep under 160 characters
- Include a call-to-action
- Summarize page content
- Include relevant keywords naturally

### 3. Keywords
- Focus on 3-5 primary keywords per page
- Use long-tail keywords
- Avoid keyword stuffing
- Research competitor keywords

### 4. Structured Data
- Add relevant schema markup
- Test with Google's Rich Results Test
- Use specific schema types for your content
- Keep data accurate and up-to-date

### 5. Images
- Use descriptive alt text
- Optimize image sizes
- Use WebP format when possible
- Include images in structured data

## Testing Your SEO

### Tools to Use
1. **Google Search Console** - Monitor search performance
2. **Google Rich Results Test** - Test structured data
3. **Facebook Sharing Debugger** - Test Open Graph
4. **Twitter Card Validator** - Test Twitter cards
5. **Lighthouse** - Overall SEO audit

### Local Testing

```bash
# Build and start production server
npm run build
npm start

# Test URLs
curl http://localhost:3000/sitemap.xml
curl http://localhost:3000/robots.txt
```

## Troubleshooting

### Common Issues

1. **Missing Open Graph Images**
   - Ensure images exist in `/public` folder
   - Check image dimensions (1200x630 for OG)
   - Verify image URLs are absolute

2. **Sitemap Not Updating**
   - Clear Next.js cache: `rm -rf .next`
   - Rebuild the application
   - Check for TypeScript errors

3. **Structured Data Errors**
   - Use Google's Rich Results Test
   - Validate JSON-LD syntax
   - Ensure required properties are present

4. **Meta Tags Not Appearing**
   - Check if page has `export const metadata`
   - Verify imports are correct
   - Clear browser cache

### Getting Help

If you encounter issues:
1. Check the browser console for errors
2. Validate your configuration in `/config/seo.ts`
3. Test with SEO tools mentioned above
4. Review Next.js metadata documentation

## Advanced Customization

### Custom Schema Types

To add custom schema types:

```typescript
// In lib/seo.ts
export function generateCustomSchema(data: CustomSchemaData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'YourCustomType',
    // Your custom properties
  }
}
```

### Multi-language SEO

For international sites:

```typescript
// Add to your metadata
export const metadata = generateMetadata({
  title: 'Page Title',
  description: 'Page description',
  path: '/page',
  alternates: {
    languages: {
      'en-US': '/en/page',
      'es-ES': '/es/page',
      'fr-FR': '/fr/page',
    },
  },
})
```

### Custom Metadata Generation

For complex metadata logic:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchPageData(params)
  
  return {
    title: `${data.title} - ${defaultSEO.siteName}`,
    description: data.description,
    keywords: data.tags?.join(', '),
    openGraph: {
      title: data.title,
      description: data.description,
      images: [{
        url: data.image || openGraphImages.default.url,
        width: 1200,
        height: 630,
        alt: data.title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description: data.description,
      images: [data.image || openGraphImages.default.url],
    },
  }
}
```

This SEO system provides a solid foundation that can be easily customized and extended as your application grows.