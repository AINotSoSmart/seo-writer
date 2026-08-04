export interface SEOConfig {
  title: string
  description: string
  keywords: string[]
  author: string
  siteUrl: string
  siteName: string
  locale: string
  type: string
  robots: string
  googleSiteVerification?: string
  bingSiteVerification?: string
  yandexVerification?: string
}

/**
 * Positioning is deliberately layered, not single-note. Three earlier passes
 * each collapsed the whole site onto one idea and each was wrong for the same
 * reason: a landing page has to answer four questions in order, and only the
 * first one is the category.
 *
 *   1. What is this?      -> topical authority: complete, interlinked coverage
 *                            of a subject. This is the deliverable and the
 *                            reason the brand is called FlipAEO.
 *   2. Does it work?      -> the first-party BringBack case study.
 *   3. Versus what?       -> a $3,000-$15,000/month agency, or a $19 bulk
 *                            writer. This closes the sale; it does not define
 *                            the product.
 *   4. Why believe you?   -> source-linked gaps and evidence-bound writing.
 *
 * Keywords follow the same order: the deliverable leads, the answer-engine
 * terms carry the timing argument, the agency terms handle the comparison.
 */
export const defaultSEO: SEOConfig = {
  title: "FlipAEO — Build Topical Authority Google and AI Both Trust",
  description:
    "Search engines and AI assistants favour sites that cover a subject completely. FlipAEO finds every question your market asks that your site misses, then writes and delivers them as complete, interlinked clusters — the work an agency bills $3,000-$15,000 a month for, from $249.",
  keywords: [
    "topical authority",
    "how to build topical authority",
    "topical authority tool",
    "topical map",
    "topic clusters seo",
    "answer engine optimization",
    "generative engine optimization",
    "aeo",
    "saas seo",
    "saas seo agency alternative",
    "b2b saas content marketing agency",
    "done for you seo content",
    "content gap analysis",
  ],
  author: "FlipAEO",
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || "https://flipaeo.com",
  siteName: "FlipAEO",
  locale: "en_US",
  type: "website",
  robots: "index, follow",
  googleSiteVerification: "",
  yandexVerification: "",
}

export const socialConfig = {
  twitter: {
    handle: "@flipaeo",
    site: "@flipaeo",
    cardType: "summary_large_image" as const,
  },
  linkedin: { handle: "flipaeo" },
}

export const organizationSchema = {
  "@type": "Organization",
  name: "FlipAEO",
  url: defaultSEO.siteUrl,
  logo: `${defaultSEO.siteUrl}/site-logo.png`,
  description: defaultSEO.description,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "support@flipaeo.com",
  },
  sameAs: ["https://x.com/flipaeo"],
}

export const pageSEO = {
  // The one page that must keep naming the buyer explicitly: positioning is
  // founder-led B2B SaaS, and it must not drift between founders, agencies,
  // marketers and bloggers page to page.
  home: {
    title: "Topical Authority for Founder-Led B2B SaaS",
    description: defaultSEO.description,
    keywords: defaultSEO.keywords,
  },
  login: {
    title: "Sign in to FlipAEO",
    description: "Sign in to review your audit and finite delivery program.",
    keywords: ["FlipAEO login"],
  },
  dashboard: {
    title: "Program dashboard",
    description: "Track generated, delivered, and published program articles separately.",
    keywords: ["content program dashboard"],
    robots: "noindex, nofollow",
  },
  pricing: {
    title: "Pricing — One Agency Month, Your Whole Programme",
    description:
      "From $249 a month, against the $3,000-$15,000 a B2B SaaS content agency charges. Your audit sets the size, the tier sets the speed, and billing ends when the work does.",
    keywords: [
      "saas seo agency pricing",
      "b2b saas content marketing cost",
      "seo agency alternative pricing",
      "content program pricing",
    ],
  },
  about: {
    title: "About FlipAEO",
    description: "Why we sell a content programme that ends instead of a retainer that never does.",
    keywords: ["about FlipAEO", "saas seo agency alternative"],
  },
  blog: {
    title: "FlipAEO content strategy notes",
    description: "Practical notes on SaaS SEO, search evidence, topic clusters, and internal linking.",
    keywords: ["saas seo", "topic cluster guide", "content gap research"],
  },
  privacyPolicy: {
    title: "Privacy Policy",
    description: "How FlipAEO processes account data, public website content, and audit links.",
    keywords: ["FlipAEO privacy"],
  },
  terms: {
    title: "Terms of Service",
    description: "Terms for finite FlipAEO audit and delivery programs.",
    keywords: ["FlipAEO terms"],
  },
  refundPolicy: {
    title: "Refund Policy",
    description: "Refund terms for FlipAEO finite delivery programs.",
    keywords: ["FlipAEO refund"],
  },
  subscribe: {
    title: "Choose program delivery speed",
    description:
      "Confirm the frozen publication URL pattern and choose delivery speed for an eligible measured scope.",
    keywords: ["FlipAEO program"],
    robots: "noindex, nofollow",
  },
}

export const openGraphImages = {
  default: {
    url: `${defaultSEO.siteUrl}/og-image.png`,
    width: 1200,
    height: 630,
    alt: "FlipAEO — the SaaS SEO agency alternative for founder-led B2B SaaS",
  },
  logo: {
    url: `${defaultSEO.siteUrl}/site-logo.png`,
    width: 400,
    height: 400,
    alt: "FlipAEO logo",
  },
}

export const robotsConfig = {
  rules: {
    userAgent: "*",
    allow: "/",
    disallow: [
      "/api/",
      "/account/",
      "/settings/",
      "/onboarding/",
      "/content-plan/",
      "/articles/",
      "/subscribe/",
      "/founder/",
      "/claim/",
      "/audit/",
      "/compare/",
    ],
  },
  sitemap: `${defaultSEO.siteUrl}/sitemap.xml`,
}

export const sitemapConfig = {
  siteUrl: defaultSEO.siteUrl,
  generateRobotsTxt: true,
  exclude: ["/api/*", "/auth/*", "/account/*", "/settings/*", "/onboarding/*"],
  additionalPaths: async () => [],
}

export const schemaTemplates = {
  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: defaultSEO.siteName,
    url: defaultSEO.siteUrl,
    description: defaultSEO.description,
    publisher: { "@type": "Organization", name: organizationSchema.name },
  },
  softwareApplication: {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: defaultSEO.siteName,
    description: defaultSEO.description,
    url: defaultSEO.siteUrl,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Content Marketing Software",
    operatingSystem: "Web Browser",
    featureList: [
      "Content gap audit with a source link on every finding",
      "Competitor coverage comparison",
      "Done-for-you SEO article writing",
      "Internal links written and verified before delivery",
      "Complete batch delivery, never partial",
      "WordPress publishing and export",
      "Programme that cancels itself when the scope is delivered",
    ],
    publisher: organizationSchema,
  },
  service: (service: {
    name: string
    description: string
    url: string
    serviceType: string
    provider: unknown
  }) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    ...service,
  }),
}

export const seoUtils = {
  generateTitle: (title?: string) =>
    title ? `${title} | ${defaultSEO.siteName}` : defaultSEO.title,
  generateCanonicalUrl: (path: string, baseUrl?: string) =>
    `${baseUrl || defaultSEO.siteUrl}${path.startsWith("/") ? path : `/${path}`}`,
  generateOgUrl: (path: string) =>
    `${defaultSEO.siteUrl}${path.startsWith("/") ? path : `/${path}`}`,
  mergeSEOConfig: (pageConfig: Partial<SEOConfig>): SEOConfig => ({
    ...defaultSEO,
    ...pageConfig,
  }),
}
