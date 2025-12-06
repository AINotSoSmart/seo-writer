/**
 * SEO Utilities and Metadata Generation
 * 
 * This file contains utility functions for generating SEO metadata
 * using Next.js 13+ Metadata API. These functions help create
 * consistent and optimized metadata across all pages.
 */

import { Metadata } from 'next';
import {
  defaultSEO,
  socialConfig,
  organizationSchema,
  openGraphImages,
  schemaTemplates,
  seoUtils,
  type SEOConfig,
  pageSEO,
} from '@/config/seo';

export interface PageSEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  jsonLd?: Record<string, any> | Record<string, any>[];
  baseUrl?: string;
}

/**
 * Generate comprehensive metadata for a page
 */
export function generateMetadata(props: PageSEOProps = {}): Metadata {
  const {
    title,
    description = defaultSEO.description,
    keywords = defaultSEO.keywords,
    canonical,
    noindex = false,
    nofollow = false,
    ogImage,
    ogType = 'website',
    twitterCard = socialConfig.twitter.cardType,
  } = props;

  const pageTitle = title ? seoUtils.generateTitle(title) : defaultSEO.title;
  const canonicalUrl = canonical ? seoUtils.generateCanonicalUrl(canonical, props.baseUrl) : defaultSEO.siteUrl;
  const ogImageUrl = ogImage || openGraphImages.default.url;

  // Generate robots directive
  const robots = {
    index: !noindex,
    follow: !nofollow,
    googleBot: {
      index: !noindex,
      follow: !nofollow,
    },
  };

  const metadata: Metadata = {
    title: pageTitle,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: defaultSEO.author }],
    creator: defaultSEO.author,
    publisher: defaultSEO.author,
    robots,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: ogType,
      title: pageTitle,
      description,
      url: canonicalUrl,
      siteName: defaultSEO.siteName,
      locale: defaultSEO.locale,
      images: [
        {
          url: ogImageUrl,
          width: openGraphImages.default.width,
          height: openGraphImages.default.height,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: twitterCard,
      site: socialConfig.twitter.site,
      creator: socialConfig.twitter.handle,
      title: pageTitle,
      description,
      images: [ogImageUrl],
    },
    ...(defaultSEO.googleSiteVerification && {
       verification: {
         google: defaultSEO.googleSiteVerification,
         ...(defaultSEO.bingSiteVerification || defaultSEO.yandexVerification ? {
           other: {
             ...(defaultSEO.bingSiteVerification && {
               'msvalidate.01': defaultSEO.bingSiteVerification,
             }),
             ...(defaultSEO.yandexVerification && {
               'yandex-verification': defaultSEO.yandexVerification,
             }),
           },
         } : {}),
       },
     }),
     other: {
      'theme-color': '#000000',
      'color-scheme': 'light dark',
      'format-detection': 'telephone=no',
    },
  };

  return metadata;
}

/**
 * Generate JSON-LD structured data
 */
export function generateJsonLd(schema: Record<string, any> | Record<string, any>[]): string {
  return JSON.stringify(schema, null, 0);
}

/**
 * Generate organization JSON-LD
 */
export function generateOrganizationJsonLd(): string {
  const schema = {
    '@context': 'https://schema.org',
    ...organizationSchema,
  };
  return generateJsonLd(schema);
}

/**
 * Generate website JSON-LD
 */
export function generateWebsiteJsonLd(): string {
  return generateJsonLd(schemaTemplates.website);
}

/**
 * Generate Software Application JSON-LD
 */
export function generateSoftwareApplicationJsonLd(): string {
  return generateJsonLd(schemaTemplates.softwareApplication);
}

/**
 * Generate Web Application JSON-LD for home page
 */
export function generateLandingPageWebApplicationJsonLd(slug: string): string {
  const cfg = (pageSEO as any)?.landingPages?.[slug];
  const props = cfg
    ? { title: cfg.title, description: cfg.description, urlPath: `/${slug}`, keywords: cfg.keywords }
    : { urlPath: `/${slug}` };
  return generateWebApplicationJsonLd(props);
}
export function generateWebApplicationJsonLd(props?: { title?: string; description?: string; urlPath?: string; keywords?: string[] }): string {
  const name = props?.title || defaultSEO.title;
  const description = props?.description || defaultSEO.description;
  const url = props?.urlPath ? seoUtils.generateCanonicalUrl(props.urlPath) : defaultSEO.siteUrl;
  const keywords = props?.keywords ? props.keywords.join(', ') : defaultSEO.keywords.join(', ');

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": name,
    "description": description,
    "url": url,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web Browser",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "softwareVersion": "1.0",
    "inLanguage": "en-US",
    "keywords": keywords,

    "screenshot": [
      `${process.env.NEXT_PUBLIC_APP_URL}/images/screenshot.png`,
      `${process.env.NEXT_PUBLIC_APP_URL}/images/screenshot-dashboard.png`
    ],

    "featureList": [
      "AI Model Training from Selfies",
      "Multiple Style Packs (Corporate, Glamour, Dating, etc.)",
      "High-Resolution Photo Generation",
      "Fast Delivery (Results in 15-20 minutes)",
      "Automatic Deletion of Uploaded Photos for Privacy"
    ],

    "author": {
      "@type": "Organization",
      "name": organizationSchema.name,
      "url": organizationSchema.url
    },
    "publisher": {
      "@type": "Organization",
      "name": "Unrealshot AI",
      "logo": {
        "@type": "ImageObject",
        "url": `${process.env.NEXT_PUBLIC_APP_URL}/site-logo.png`
      }
    },
   "offers": [
    {
      "@type": "Offer",
      "name": "Starter Pack",
      "price": "9.99",
      "priceCurrency": "USD",
      "description": "Includes 30 credits for one AI model training and 20 AI-generated photos."
    },
    {
      "@type": "Offer",
      "name": "Pro Pack",
      "price": "17.99",
      "priceCurrency": "USD",
      "description": "Includes 60 credits for 80 photos with one model, or 40 photos with two separate models."
    }
],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "bestRating": "5",
      "ratingCount": "312"
    },
    "review": [
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Sachin Singh",
          "jobTitle": "Influencer"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        },
        "reviewBody": "I got my perfect Instagram profile photo in just 40 minutes. The quality is amazing!"
      },
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Mariah Edwards",
          "jobTitle": "Marketing Director"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        },
        "reviewBody": "The transformation is unbelievable. My LinkedIn profile looks so professional now!"
      },
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Sumesh",
          "jobTitle": "Tech Enthusiast"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        },
        "reviewBody": "I've tried many AI photo tools, but Unrealshot AI gives the most natural-looking results."
      },
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Emma Thompson",
          "jobTitle": "Model"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        },
        "reviewBody": "Being a model, having standout photos is everything. After using this AI tool, my portfolio photos look more polished and professional!"
      },
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Manoj",
          "jobTitle": "Photographer"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        },
        "reviewBody": "The customer service is as impressive as the AI. They helped me choose the perfect style."
      },
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Shrey Singh",
          "jobTitle": "HR Manager"
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        },
        "reviewBody": "Our entire team uses Unrealshot AI for our corporate headshots. Consistent quality every time!"
      }
    ]
  };

  return generateJsonLd(webAppSchema);
}

/**
 * Generate Service JSON-LD for landing pages
 */
export function generateServiceJsonLd(service: { name: string, description: string, url: string, serviceType: string, provider: any }): string {
  const schema = schemaTemplates.service(service);
  return generateJsonLd(schema);
}

/**
 * Generate breadcrumb JSON-LD
 */
export function generateBreadcrumbJsonLd(items: Array<{ name: string; url: string }>): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return generateJsonLd(schema);
}

/**
 * Generate FAQ JSON-LD
 */
export function generateFAQJsonLd(faqs: Array<{ question: string; answer: string }>): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  return generateJsonLd(schema);
}

/**
 * Generate product JSON-LD for pricing pages
 */
export function generateProductJsonLd(product: {
  name: string;
  description: string;
  price: number;
  currency: string;
  features: string[];
}): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    offers: {
      '@type': 'Offer',
      price: product.price.toString(),
      priceCurrency: product.currency,
      availability: 'https://schema.org/InStock',
      seller: organizationSchema,
    },
    additionalProperty: product.features.map((feature) => ({
      '@type': 'PropertyValue',
      name: 'Feature',
      value: feature,
    })),
  };
  return generateJsonLd(schema);
}

/**
 * Generate article JSON-LD for blog posts
 */
export function generateArticleJsonLd(article: {
  title: string;
  description: string;
  author: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
}): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: organizationSchema,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
    },
    ...(article.image && {
      image: {
        '@type': 'ImageObject',
        url: article.image,
      },
    }),
  };
  return generateJsonLd(schema);
}

/**
 * SEO validation utilities
 */
export const seoValidation = {
  /**
   * Validate title length (recommended: 50-60 characters)
   */
  validateTitle: (title: string): { isValid: boolean; message?: string } => {
    if (title.length < 30) {
      return { isValid: false, message: 'Title is too short (minimum 30 characters)' };
    }
    if (title.length > 60) {
      return { isValid: false, message: 'Title is too long (maximum 60 characters)' };
    }
    return { isValid: true };
  },

  /**
   * Validate description length (recommended: 150-160 characters)
   */
  validateDescription: (description: string): { isValid: boolean; message?: string } => {
    if (description.length < 120) {
      return { isValid: false, message: 'Description is too short (minimum 120 characters)' };
    }
    if (description.length > 160) {
      return { isValid: false, message: 'Description is too long (maximum 160 characters)' };
    }
    return { isValid: true };
  },

  /**
   * Validate keywords count (recommended: 5-10 keywords)
   */
  validateKeywords: (keywords: string[]): { isValid: boolean; message?: string } => {
    if (keywords.length < 3) {
      return { isValid: false, message: 'Too few keywords (minimum 3)' };
    }
    if (keywords.length > 15) {
      return { isValid: false, message: 'Too many keywords (maximum 15)' };
    }
    return { isValid: true };
  },
};

/**
 * Pre-configured metadata for common pages
 */
// Export alias for backward compatibility
export const generateProductSchema = generateProductJsonLd;

export const commonPageMetadata = {
  home: () => generateMetadata({
    title: '',
    description: defaultSEO.description,
    canonical: '/',
    ogType: 'website',
  }),

  login: () => generateMetadata({
    title: 'Sign In',
    description: 'Sign in to your account to access dashboard',
    canonical: '/login',
    noindex: true,
  }),

  dashboard: () => generateMetadata({
    title: 'Dashboard',
    description: 'Access your dashboard to train ai model and create ai images',
    canonical: '/blog-writer',
    noindex: true,
    nofollow: true,
  }),

  pricing: () => generateMetadata({
    title: 'Pricing Plans',
    description: 'Choose the perfect plan for your photoshoot. Flexible credit based pricing options.',
    canonical: '/pricing',
    keywords: ['pricing', 'plans', 'credits', 'photoshoot plans', 'cost'],
  }),

  buyCredits: () => generateMetadata({
    title: 'Buy Credits',
    description: 'Purchase credits to unlock premium features and expand your usage limits.',
    canonical: '/buy-credits',
    keywords: ['buy credits', 'purchase', 'premium features', 'upgrade'],
  }),

  account: () => generateMetadata({
    title: 'Account Settings',
    description: 'Manage your account settings, billing information, and preferences.',
    canonical: '/account',
    noindex: true,
    nofollow: true,
  }),

  // New: Landing page-specific metadata using config/pageSEO.landingPages
  landingPage: (slug: string) => {
    const cfg = (pageSEO as any)?.landingPages?.[slug];
    const title = cfg?.title || defaultSEO.title;
    const description = cfg?.description || defaultSEO.description;
    const keywords = cfg?.keywords || defaultSEO.keywords;
    return generateMetadata({
      title,
      description,
      keywords,
      canonical: `/${slug}`,
      ogType: 'website',
      baseUrl: defaultSEO.siteUrl,
    });
  },

  profilePhotoMaker: () => {
    const cfg = (pageSEO as any)?.landingPages?.['profile-photo-maker'];
    const title = cfg?.title || defaultSEO.title;
    const description = cfg?.description || defaultSEO.description;
    const keywords = cfg?.keywords || defaultSEO.keywords;
    return generateMetadata({
      title,
      description,
      keywords,
      canonical: '/profile-photo-maker',
      ogType: 'website',
    });
  },

 
};