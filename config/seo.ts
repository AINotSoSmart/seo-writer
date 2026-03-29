/**
 * SEO Configuration for FlipAEO
 * 
 * This file contains all SEO-related configurations for FlipAEO,
 * the Strategic Content Engine for Generative Engine Optimization (GEO).
 */

export interface SEOConfig {
  title: string;
  description: string;
  keywords: string[];
  author: string;
  siteUrl: string;
  siteName: string;
  locale: string;
  type: string;
  robots: string;
  googleSiteVerification?: string;
  bingSiteVerification?: string;
  yandexVerification?: string;
}

export interface SocialConfig {
  twitter: {
    handle: string;
    site: string;
    cardType: 'summary' | 'summary_large_image' | 'app' | 'player';
  };
  linkedin: {
    handle?: string;
  };
}

export interface OrganizationSchema {
  '@type': string;
  name: string;
  url: string;
  logo: string;
  description: string;
  address?: {
    '@type': string;
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  contactPoint?: {
    '@type': string;
    telephone?: string;
    contactType?: string;
    email?: string;
  };
  sameAs?: string[];
}

// Default SEO Configuration
export const defaultSEO: SEOConfig = {
  title: 'FlipAEO - The First Answer Engine Optimization (AEO) Writer',
  description: 'FlipAEO is the only automated AEO platform that builds topical authority and forces structured data to get your brand cited by Perplexity, ChatGPT, and AI Search. 30 articles/month on autopilot.',
  keywords: [
    'Answer Engine Optimization tool',
    'GEO Content Writer',
    'Optimize for Perplexity AI',
    'AI content engine',
    'AI article generator',
    'authority content',
    'AI visibility',
    'content strategy',
    'SEO AI tool',
    'ChatGPT ranking',
    'Perplexity optimization',
    'AI citations',
    'B2B content marketing',
    'automated content creation',
    'brand authority'
  ],
  author: 'FlipAEO',
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://flipaeo.com',
  siteName: 'FlipAEO',
  locale: 'en_US',
  type: 'website',
  robots: 'index, follow',
  // Add your verification codes here
  googleSiteVerification: '',
  yandexVerification: '',
};

// Social Media Configuration
export const socialConfig: SocialConfig = {
  twitter: {
    handle: '@flipaeo',
    site: '@flipaeo',
    cardType: 'summary_large_image',
  },
  linkedin: {
    handle: 'flipaeo',
  },
};

// Organization Schema for Structured Data
export const organizationSchema: OrganizationSchema = {
  '@type': 'Organization',
  name: 'FlipAEO',
  url: defaultSEO.siteUrl,
  logo: `${defaultSEO.siteUrl}/site-logo.png`,
  description: 'Strategic Content Engine for Generative Engine Optimization. Helping businesses dominate AI search with authority-building content.',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'support@flipaeo.com',
  },
  sameAs: [
    'https://x.com/flipaeo',
  ],
};

// --- Page-specific SEO configurations ---
export const pageSEO = {
  home: {
    title: 'FlipAEO - The First Answer Engine Optimization (AEO) Writer | Get Cited by AI',
    description: 'Stop fighting for Google\'s blue links. FlipAEO is the only automated AEO platform that builds topical authority, forces structured data, and guarantees E-E-A-T to get your brand cited by Perplexity, ChatGPT, and Google AI Overviews.',
    keywords: ['Answer Engine Optimization tool', 'GEO Content Writer', 'Optimize for Perplexity AI', 'AI Citation Builder', 'Automated AEO Writer', 'content strategy'],
  },
  login: {
    title: 'Sign In - FlipAEO',
    description: 'Sign in to your FlipAEO account to access your content dashboard and generate AI-researched articles.',
    keywords: ['login', 'sign in', 'FlipAEO account', 'content dashboard'],
  },
  dashboard: {
    title: 'Content Dashboard - FlipAEO',
    description: 'Access your FlipAEO dashboard to manage your content strategy, generate articles, and publish to your CMS.',
    keywords: ['dashboard', 'content management', 'article generation'],
    robots: 'noindex, nofollow',
  },
  pricing: {
    title: 'Pricing - FlipAEO | $79/Month for dominating Google and AI search engines',
    description: 'Simple, transparent pricing for FlipAEO. One plan with everything you need: 30 AI-generated articles/month, automated content strategy, CMS integration, and priority support. 14-day money-back guarantee.',
    keywords: ['FlipAEO pricing', 'AI seo content generation pricing', 'AI Search visibility pricing', 'content engine cost', 'article generation pricing'],
  },
  about: {
    title: 'About FlipAEO - Our Mission to Democratize AI Visibility',
    description: 'Learn the story behind FlipAEO and our mission to help businesses of all sizes win in the age of AI search through strategic, authority-building content.',
    keywords: ['about FlipAEO', 'AI content company', 'GEO company', 'content strategy team'],
  },
  blog: {
    title: 'Blog - FlipAEO | AEO/GEO & AI Content Strategy Insights',
    description: 'Expert insights on Generative Engine Optimization (GEO), AI search visibility, content strategy, and how to get cited by AI search engines like ChatGPT and Perplexity.',
    keywords: ['AEO guides', 'GEO guides', 'AI SEO tips', 'content strategy blog', 'AI visibility insights', 'generative engine optimization guide'],
  },
  privacyPolicy: {
    title: 'Privacy Policy - FlipAEO',
    description: 'Learn how FlipAEO collects, uses, and protects your personal data. We integrate with Google services including OAuth and Google Search Console.',
    keywords: ['FlipAEO privacy', 'data protection', 'GDPR compliance', 'Google API privacy'],
  },
  terms: {
    title: 'Terms of Service - FlipAEO',
    description: 'Review the terms and conditions for using FlipAEO, the Strategic Content Engine for Generative Engine Optimization.',
    keywords: ['FlipAEO terms', 'terms of service', 'user agreement', 'content license'],
  },
  refundPolicy: {
    title: 'Refund Policy - FlipAEO | 14-Day Money-Back Guarantee',
    description: 'FlipAEO offers a 14-day money-back guarantee. If you are not satisfied with the quality of your articles, we will refund you in full.',
    keywords: ['FlipAEO refund', 'money-back guarantee', 'refund policy', 'cancellation'],
  },
  subscribe: {
    title: 'Subscribe - FlipAEO | Start Your Content Strategy',
    description: 'Subscribe to FlipAEO and start generating authority-building articles that AI search engines cite. 30 articles/month, automated strategy, 1-click CMS publishing.',
    keywords: ['subscribe FlipAEO', 'start content strategy', 'AI content subscription'],
    robots: 'noindex, nofollow',
  },
};

// Open Graph Image Configuration
export const openGraphImages = {
  default: {
    url: `${defaultSEO.siteUrl}/og-image.png`,
    width: 1200,
    height: 630,
    alt: 'FlipAEO - Strategic Content Engine for AI Search Domination',
  },
  logo: {
    url: `${defaultSEO.siteUrl}/site-logo.png`,
    width: 400,
    height: 400,
    alt: 'FlipAEO Logo',
  },
};

// Robots.txt Configuration
export const robotsConfig = {
  rules: {
    userAgent: '*',
    allow: '/',
    disallow: [
      '/api/',
      '/blog-writer/',
      '/account/',
      '/settings/',
      '/admin/',
      '/onboarding/',
    ],
  },
  sitemap: `${defaultSEO.siteUrl}/sitemap.xml`,
};

// Sitemap Configuration
export const sitemapConfig = {
  siteUrl: defaultSEO.siteUrl,
  generateRobotsTxt: true,
  exclude: [
    '/blog-writer/*',
    '/account/*',
    '/reports/*',
    '/settings/*',
    '/api/*',
    '/auth/*',
    '/error',
    '/admin/*',
    '/onboarding/*',
    '/subscribe/*',
  ],
  additionalPaths: async () => {
    return [];
  },
};

// JSON-LD Schema Templates
export const schemaTemplates = {
  website: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: defaultSEO.siteName,
    url: defaultSEO.siteUrl,
    description: defaultSEO.description,
    publisher: {
      '@type': 'Organization',
      name: organizationSchema.name,
    },
  },
  softwareApplication: {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: defaultSEO.siteName,
    description: 'Strategic Content Engine for Generative Engine Optimization (GEO). Generate authority-building articles that AI search engines cite and recommend.',
    url: defaultSEO.siteUrl,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Content Marketing Software',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '59',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      priceValidUntil: '2026-02-29',
    },
    publisher: organizationSchema,
    featureList: [
      '30 AI-generated articles per month',
      'Automated content strategy based on competitor analysis',
      'CMS integration (WordPress, Webflow, Shopify)',
      'On-brand AI images',
      'Smart internal linking',
      'Real-time research with verified citations',
      'Answer-first content structure for AI visibility',
      'Priority support',
    ],
  },
  service: (service: { name: string, description: string, url: string, serviceType: string, provider: any }) => ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    url: service.url,
    serviceType: service.serviceType,
    provider: service.provider,
    areaServed: {
      '@type': 'Place',
      name: 'Worldwide'
    },
    offers: {
      '@type': 'Offer',
      price: '59',
      priceCurrency: 'USD'
    }
  })
};

// SEO Utility Functions
export const seoUtils = {
  /**
   * Generate page title with site name
   */
  generateTitle: (pageTitle?: string): string => {
    if (!pageTitle) return defaultSEO.title;
    return `${pageTitle} | ${defaultSEO.siteName}`;
  },

  /**
   * Generate canonical URL
   */
  generateCanonicalUrl: (path: string, baseUrl?: string): string => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = baseUrl || defaultSEO.siteUrl;
    return `${url}${cleanPath}`;
  },

  /**
   * Generate Open Graph URL
   */
  generateOgUrl: (path: string): string => {
    return seoUtils.generateCanonicalUrl(path);
  },

  /**
   * Merge SEO config with page-specific overrides
   */
  mergeSEOConfig: (pageConfig: Partial<SEOConfig>): SEOConfig => {
    return { ...defaultSEO, ...pageConfig };
  },
};