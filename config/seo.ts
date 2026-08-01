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

export const defaultSEO: SEOConfig = {
  title: "FlipAEO — Evidence-Backed Content Clusters for Founder-Led B2B SaaS",
  description:
    "FlipAEO gives founder-led B2B SaaS teams a source-linked content audit and delivers every qualified cluster it measures across their confirmed business areas as one finite, interlinked program.",
  keywords: [
    "topical authority",
    "how to build topical authority",
    "topical authority tool",
    "content gap analysis",
    "content gap analysis tool",
    "topical map generator",
    "topic cluster tool",
    "topic cluster generator",
    "SEO content plan",
    "what to write next SEO",
    "content strategy tool",
    "AI internal linking",
    "semantic content map",
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
  home: {
    title: "Content Clusters for Founder-Led B2B SaaS",
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
    title: "Six-cluster program delivery speeds",
    description:
      "Choose the delivery cadence for your measured scope. Checkout appears only after an eligible audit and confirmed publishing URL pattern.",
    keywords: ["topic cluster pricing", "content program pricing"],
  },
  about: {
    title: "About FlipAEO",
    description: "Why FlipAEO uses finite, source-linked scopes instead of endless article quotas.",
    keywords: ["about FlipAEO"],
  },
  blog: {
    title: "FlipAEO content strategy notes",
    description: "Practical notes on search evidence, topic clusters, and internal linking.",
    keywords: ["topic cluster guide", "content gap research"],
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
    alt: "Content Clusters for Founder-Led B2B SaaS",
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
      "Source-linked topical audit",
      "Competitor gap evidence",
      "Finite measured-scope program",
      "Frozen internal-link graph",
      "Complete cluster delivery",
      "WordPress draft and manual delivery",
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
