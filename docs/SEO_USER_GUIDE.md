# SEO System User Guide

This guide explains how to use and customize the comprehensive SEO system built into your Next.js application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Page-Specific SEO](#page-specific-seo)
4. [Dynamic Metadata](#dynamic-metadata)
5. [Structured Data](#structured-data)
6. [Open Graph & Social Media](#open-graph--social-media)
7. [Sitemap & Robots.txt](#sitemap--robotstxt)
8. [Advanced Customization](#advanced-customization)
9. [Testing & Validation](#testing--validation)
10. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Basic Configuration

Edit `/config/seo.ts` to customize your site's basic SEO settings:

```typescript
export const defaultSEO: SEOConfig = {
  title: "Your Site Name",
  description: "Your site description",
  keywords: ["your", "keywords", "here"],
  author: "Your Name",
  siteUrl: "https://yoursite.com",
  siteName: "Your Site Name",
  // ... other settings
}
```

### 2. Environment Variables

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SITE_URL=https://yoursite.com
GOOGLE_SITE_VERIFICATION=your_google_verification_code
BING_SITE_VERIFICATION=your_bing_verification_code
```

### 3. Immediate Benefits

✅ Automatic meta tags on all pages  
✅ Dynamic sitemap at `/sitemap.xml`  
✅ Smart robots.txt at `/robots.txt`  
✅ Structured data for better search results  
✅ Open Graph tags for social sharing  

## Configuration

### SEO Config File (`/config/seo.ts`)

This is your main configuration file. Here's what each setting does:

```typescript
export const defaultSEO: SEOConfig = {
  // Basic Info
  title: "Your Site Title",           // Default page title
  description: "Your description",    // Default meta description
  keywords: ["keyword1", "keyword2"], // Default keywords
  author: "Your Name",               // Content author
  
  // URLs
  siteUrl: "https://yoursite.com",   // Your domain (no trailing slash)
  siteName: "Your Site Name",        // Brand name
  
  // Social Media
  social: {
    twitter: "@yourusername",         // Twitter handle
    facebook: "yourpage",             // Facebook page
    instagram: "yourusername",        // Instagram handle
    linkedin: "yourcompany",          // LinkedIn company
    youtube: "yourchannel"            // YouTube channel
  },
  
  // Images
  defaultImage: "/og-image.png",     // Default Open Graph image
  favicon: "/favicon.ico",           // Favicon path
  
  // Organization Info (for structured data)
  organization: {
    name: "Your Company",
    url: "https://yoursite.com",
    logo: "https://yoursite.com/logo.png",
    description: "Company description",
    address: {
      streetAddress: "123 Main St",
      addressLocality: "City",
      addressRegion: "State",
      postalCode: "12345",
      addressCountry: "US"
    },
    contactPoint: {
      telephone: "+1-555-123-4567",
      contactType: "customer service"
    }
  }
}
```

### Environment-Specific Settings

The system automatically adjusts based on your environment:

- **Development**: Robots.txt blocks all crawlers
- **Production**: Robots.txt allows crawling
- **Staging**: Robots.txt blocks crawlers but allows sitemap

## Page-Specific SEO

### Method 1: Using Metadata API (Recommended)

For any page, export metadata:

```typescript
// app/about/page.tsx
import { Metadata } from 'next'
import { commonPageMetadata } from '@/lib/seo'

export const metadata: Metadata = commonPageMetadata.about()

// Or with custom data:
export const metadata: Metadata = {
  title: "About Us - Your Company",
  description: "Learn about our company history and mission",
  keywords: ["about", "company", "history"],
  openGraph: {
    title: "About Us",
    description: "Learn about our company",
    images: ['/about-og-image.png']
  }
}
```

### Method 2: Using Helper Functions

Use the pre-built helper functions:

```typescript
// Available helpers:
export const metadata = commonPageMetadata.home()      // Homepage
export const metadata = commonPageMetadata.about()     // About page
export const metadata = commonPageMetadata.contact()   // Contact page
export const metadata = commonPageMetadata.login()     // Login page
export const metadata = commonPageMetadata.dashboard() // Dashboard
export const metadata = commonPageMetadata.pricing()   // Pricing page
```

### Method 3: Custom Metadata

For unique pages, create custom metadata:

```typescript
export const metadata: Metadata = {
  title: "Custom Page Title",
  description: "Custom page description",
  keywords: ["custom", "keywords"],
  openGraph: {
    title: "Custom OG Title",
    description: "Custom OG description",
    images: [{
      url: '/custom-og-image.png',
      width: 1200,
      height: 630,
      alt: 'Custom image description'
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: "Custom Twitter Title",
    description: "Custom Twitter description",
    images: ['/custom-twitter-image.png']
  }
}
```

## Dynamic Metadata

### For Dynamic Routes

Use `generateMetadata` for pages with dynamic content:

```typescript
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'
import { generateMetadata as generateSEOMetadata } from '@/lib/seo'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch your data
  const post = await getPost(params.slug)
  
  return generateSEOMetadata({
    title: post.title,
    description: post.excerpt,
    keywords: post.tags,
    image: post.featuredImage,
    url: `/blog/${params.slug}`,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authors: [post.author.name]
  })
}
```

### For E-commerce Products

```typescript
// app/products/[id]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.id)
  
  return generateSEOMetadata({
    title: `${product.name} - Your Store`,
    description: product.description,
    keywords: [product.category, ...product.tags],
    image: product.images[0],
    url: `/products/${params.id}`,
    type: 'product',
    price: product.price,
    currency: 'USD',
    availability: product.inStock ? 'in_stock' : 'out_of_stock'
  })
}
```

## Structured Data

### Adding Structured Data to Pages

Use the `StructuredData` component:

```typescript
// app/products/[id]/page.tsx
import { StructuredData } from '@/components/seo/StructuredData'
import { generateProductSchema } from '@/lib/seo'

export default function ProductPage({ product }) {
  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    price: product.price,
    currency: 'USD',
    features: product.features
  })

  return (
    <>
      <StructuredData data={JSON.parse(productSchema)} />
      {/* Your page content */}
    </>
  )
}
```

### Available Schema Generators

```typescript
// Organization schema (automatically added to layout)
generateOrganizationJsonLd()

// Website schema (automatically added to layout)
generateWebsiteJsonLd()

// Product schema
generateProductSchema({
  name: "Product Name",
  description: "Product description",
  price: 99.99,
  currency: "USD",
  features: ["Feature 1", "Feature 2"]
})

// Article schema
generateArticleJsonLd({
  headline: "Article Title",
  description: "Article description",
  author: "Author Name",
  publishedTime: "2024-01-01",
  modifiedTime: "2024-01-02",
  image: "/article-image.jpg"
})

// FAQ schema
generateFAQJsonLd([
  {
    question: "What is this?",
    answer: "This is the answer."
  }
])
```

## Open Graph & Social Media

### Customizing Social Sharing

```typescript
// For better social media sharing
export const metadata: Metadata = {
  title: "Your Page Title",
  description: "Your page description",
  openGraph: {
    title: "Social Media Title",        // Can be different from page title
    description: "Social description",   // Can be different from meta description
    type: 'website',                    // 'website', 'article', 'product', etc.
    url: 'https://yoursite.com/page',
    siteName: 'Your Site Name',
    images: [{
      url: '/og-image.png',             // 1200x630 recommended
      width: 1200,
      height: 630,
      alt: 'Image description'
    }],
    locale: 'en_US'
  },
  twitter: {
    card: 'summary_large_image',        // 'summary' or 'summary_large_image'
    site: '@yoursite',                  // Your Twitter handle
    creator: '@yourcreator',            // Content creator's handle
    title: "Twitter Title",
    description: "Twitter description",
    images: ['/twitter-image.png']      // 1200x600 recommended
  }
}
```

### Image Optimization Tips

- **Open Graph**: 1200x630px (1.91:1 ratio)
- **Twitter Card**: 1200x600px (2:1 ratio)
- **Format**: PNG or JPG
- **Size**: Under 1MB
- **Alt text**: Always include for accessibility

## Sitemap & Robots.txt

### Sitemap Configuration

The sitemap is automatically generated at `/sitemap.xml`. To customize:

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'
import { defaultSEO } from '@/config/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = defaultSEO.siteUrl
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Add more URLs
  ]
}
```

### Robots.txt Configuration

The robots.txt is automatically generated at `/robots.txt`. To customize:

```typescript
// app/robots.ts
import { MetadataRoute } from 'next'
import { defaultSEO } from '@/config/seo'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = defaultSEO.siteUrl
  const isProduction = process.env.NODE_ENV === 'production'
  
  if (!isProduction) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/'
      }
    }
  }
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/private/']
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`
  }
}
```

## Advanced Customization

### Creating Custom SEO Components

```typescript
// components/seo/CustomSEO.tsx
import { Metadata } from 'next'
import { StructuredData } from '@/components/seo/StructuredData'

interface CustomSEOProps {
  title: string
  description: string
  schema?: object
}

export function CustomSEO({ title, description, schema }: CustomSEOProps) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {schema && <StructuredData data={schema} />}
    </>
  )
}
```

### Multi-language SEO

```typescript
// For international sites
export const metadata: Metadata = {
  title: "Your Title",
  description: "Your description",
  alternates: {
    languages: {
      'en-US': '/en',
      'es-ES': '/es',
      'fr-FR': '/fr'
    }
  },
  openGraph: {
    locale: 'en_US',
    alternateLocale: ['es_ES', 'fr_FR']
  }
}
```

### Custom Meta Tags

```typescript
// For special meta tags
export const metadata: Metadata = {
  title: "Your Title",
  other: {
    'custom-meta': 'custom-value',
    'theme-color': '#000000',
    'apple-mobile-web-app-capable': 'yes'
  }
}
```

## Testing & Validation

### SEO Testing Tools

1. **Google Search Console**
   - Submit your sitemap
   - Monitor search performance
   - Check for crawl errors

2. **Google Rich Results Test**
   - Test structured data: https://search.google.com/test/rich-results
   - Validate schema markup

3. **Facebook Sharing Debugger**
   - Test Open Graph tags: https://developers.facebook.com/tools/debug/
   - Clear Facebook cache

4. **Twitter Card Validator**
   - Test Twitter cards: https://cards-dev.x.com/validator
   - Preview social sharing

5. **Lighthouse SEO Audit**
   - Run in Chrome DevTools
   - Check Core Web Vitals
   - Validate accessibility

### Local Testing

```bash
# Test your sitemap
curl http://localhost:3000/sitemap.xml

# Test your robots.txt
curl http://localhost:3000/robots.txt

# Check meta tags
curl -s http://localhost:3000 | grep -i "<meta"
```

### Validation Checklist

- [ ] Title tags are unique and descriptive (50-60 characters)
- [ ] Meta descriptions are compelling (150-160 characters)
- [ ] Open Graph images are properly sized (1200x630)
- [ ] Structured data validates without errors
- [ ] Sitemap includes all important pages
- [ ] Robots.txt allows crawling in production
- [ ] Page load speed is optimized
- [ ] Mobile-friendly design
- [ ] HTTPS is enabled
- [ ] Canonical URLs are set correctly

## Troubleshooting

### Common Issues

**1. Meta tags not appearing**
```typescript
// Make sure you're using the Metadata API correctly
export const metadata: Metadata = {
  title: "Your Title"
}
// NOT: <title>Your Title</title> in JSX
```

**2. Open Graph images not showing**
- Check image URL is absolute: `https://yoursite.com/image.png`
- Verify image exists and is accessible
- Use Facebook Debugger to clear cache
- Ensure image is under 1MB

**3. Structured data errors**
- Use Google's Rich Results Test
- Check for required properties
- Validate JSON syntax

**4. Sitemap not updating**
- Clear Next.js cache: `rm -rf .next`
- Restart development server
- Check sitemap.ts file for errors

**5. Robots.txt blocking crawlers in production**
- Verify NODE_ENV is set to 'production'
- Check environment variables
- Test robots.txt endpoint

### Debug Mode

Enable debug logging:

```typescript
// Add to your page component
console.log('SEO Debug:', {
  title: metadata.title,
  description: metadata.description,
  openGraph: metadata.openGraph
})
```

### Performance Tips

1. **Optimize Images**
   - Use Next.js Image component
   - Compress images before upload
   - Use WebP format when possible

2. **Minimize JavaScript**
   - Use dynamic imports for heavy components
   - Implement code splitting
   - Remove unused dependencies

3. **Cache Strategy**
   - Set proper cache headers
   - Use CDN for static assets
   - Implement service worker

## Best Practices

### Content Guidelines

1. **Title Tags**
   - Keep under 60 characters
   - Include primary keyword
   - Make each page unique
   - Put important keywords first

2. **Meta Descriptions**
   - Keep under 160 characters
   - Include call-to-action
   - Make them compelling
   - Avoid duplicate descriptions

3. **Keywords**
   - Focus on user intent
   - Use long-tail keywords
   - Avoid keyword stuffing
   - Research competitor keywords

### Technical Guidelines

1. **URL Structure**
   - Use descriptive URLs
   - Include keywords in URLs
   - Keep URLs short and clean
   - Use hyphens, not underscores

2. **Internal Linking**
   - Link to related content
   - Use descriptive anchor text
   - Create topic clusters
   - Fix broken links

3. **Site Speed**
   - Optimize Core Web Vitals
   - Use Next.js Image optimization
   - Implement lazy loading
   - Minimize render-blocking resources

### Monitoring & Maintenance

1. **Regular Audits**
   - Monthly SEO audits
   - Check for broken links
   - Monitor page speed
   - Review search console data

2. **Content Updates**
   - Keep content fresh
   - Update outdated information
   - Add new relevant keywords
   - Improve underperforming pages

3. **Technical Maintenance**
   - Update dependencies
   - Monitor error logs
   - Check sitemap accuracy
   - Validate structured data

## Support

If you need help with SEO implementation:

1. Check this documentation first
2. Review the code examples in `/lib/seo.ts`
3. Test with the validation tools mentioned above
4. Check the troubleshooting section

Remember: SEO is a long-term strategy. Focus on creating valuable content for your users, and the technical implementation will support your efforts.