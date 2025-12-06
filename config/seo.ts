/**
 * SEO Configuration for Next.js Application
 * 
 * This file contains all SEO-related configurations that can be easily customized
 * by users of this boilerplate. All settings are centralized here for easy management.
 * 
 * To customize SEO for your application:
 * 1. Update the defaultSEO object with your brand information
 * 2. Modify social media handles and URLs
 * 3. Update the organization schema with your company details
 * 4. Customize page-specific SEO in the pageSEO object
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
  instagram: {
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
  title: 'AI Coloring Book Builder | Drawgle',
  description: "Create stunning AI coloring books with Drawgle's AI Coloring Book Builder. Turn your selfies into vibrant, realistic colorings in seconds.",
  keywords: [
    'AI coloring book builder',
    'AI coloring books',
    'realistic AI coloring',
    'AI colorings from selfies',
    'professional AI coloring',
    'AI coloring generator',
    'AI colorings',
    'studio-quality AI coloring',
    'LinkedIn coloring book',
    'dating profile picture'
  ],  
    author: 'Drawgle',
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.drawgle.com',
  siteName: 'Drawgle',
  locale: 'en_US',
  type: 'website',
  robots: 'index, follow',
  // Add your verification codes here
  googleSiteVerification: 'c76eab1a4ae6fb83',
  yandexVerification: '47ba7543cebfc90b',
};

// Social Media Configuration
export const socialConfig: SocialConfig = {
  twitter: {
    handle: '@drawgle', // Replace with your actual Twitter handle
    site: '@drawgle', // Replace with your actual Twitter handle
    cardType: 'summary_large_image',
  },
  instagram: {
    handle: '@drawgle', // Replace with your actual Instagram handle
  },
};

// Organization Schema for Structured Data
export const organizationSchema: OrganizationSchema = {
  '@type': 'Organization',
  name: 'Drawgle',
  url: defaultSEO.siteUrl,
  logo: `${defaultSEO.siteUrl}/logo.png`, // Ensure this path is correct
  description: defaultSEO.description,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Sadabad',
    addressLocality: 'Sadabad',
    addressRegion: 'Hathras, UP',
    postalCode: '281306',
    addressCountry: 'IN',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'support@drawgle.com', // Replace with your support email
  },
  sameAs: [
    'https://x.com/drawgle', // Replace with your actual social links
    'https://instagram.com/drawgle',
  ],
};
// --- Page-specific SEO configurations ---
// Tailored meta for each important page.

export const pageSEO = {
  home: {
    title: defaultSEO.title,
    description: defaultSEO.description,
    keywords: defaultSEO.keywords,
  },
  login: {
    title: 'Sign In - Unrealshot AI',
    description: 'Sign in to your Unrealshot account to access your AI photoshoots and create new ones.',
    keywords: ['login', 'sign in', 'unrealshot account', 'user portal'],
  },
  dashboard: {
    title: 'My Photoshoots - Unrealshot AI',
    description: 'Access your dashboard to view, download, and manage all your AI-generated photoshoots.',
    keywords: ['dashboard', 'my account', 'my photoshoots'],
    robots: 'noindex, nofollow', // Correctly kept private
  },
  pricing: {
    title: 'Pricing Plans - Unrealshot AI',
    description: 'Find the perfect plan for your AI photoshoot. Get a complete portfolio of stunning images for a fraction of the cost of a traditional studio.',
    keywords: ['pricing', 'plans', 'ai photoshoot cost', 'packages'],
  },
  buyCredits: { // Renamed from pricing page, assuming this is the one-time purchase page
    title: 'Start Your Photoshoot - Unrealshot AI',
    description: 'Choose your package and get started. Transform your selfies into a complete, professional AI photoshoot in minutes.',
    keywords: ['buy credits', 'start photoshoot', 'purchase', 'packages'],
  },
  account: {
    title: 'Account Settings - Unrealshot AI',
    description: 'Manage your Unrealshot account settings, view past orders, and update your information.',
    keywords: ['account', 'settings', 'profile', 'orders'],
    robots: 'noindex, nofollow',
  },
  landingPages: {
    'ai-real-estate-headshots': {
        title: 'AI Real Estate Headshots That Help Close the Deal',
        description: 'Your face is your brand in real estate. Create trustworthy, approachable AI headshots that help you win more listings and connect with clients instantly.',
        keywords: ['ai real estate headshots', 'realtor headshots', 'ai headshots for realtors', 'real estate agent headshots', 'professional realtor photos'],
    },
    'ai-chef-headshots': {
        title: 'AI Chef Headshots That Elevate Your Culinary Brand',
        description: 'Present a credible, camera-ready image with clean, modern portraits tailored to your kitchen’s vibe - ideal for menus, press features, and personal branding.',
        keywords: ['ai chef headshots', 'chef portraits', 'culinary headshots', 'ai headshots for chefs', 'restaurant branding photos'],
    },
    'ai-yearbook': {
        title: 'Create Your 90s AI Yearbook Photos that capture Nostalgia',
        description: 'Relive the glory days. Get hilarious and iconic 90s-style AI yearbook photos that are perfect for sharing. The only thing missing is the bad hair gel.',
        keywords: ['ai yearbook photos', '90s yearbook trend', 'ai yearbook generator', '90s ai photos', 'viral yearbook photos'],
    },
    'ai-doctor-headshots': {
        title: 'Professional AI Doctor Headshots That Inspire Trust',
        description: "Project the compassion and professionalism you're known for. Get warm, high-quality AI headshots for your practice, hospital profile, or speaking engagements instantly.",
        keywords: ['ai doctor headshots', 'medical headshots', 'professional portraits for doctors', 'healthcare professional headshots'],
    },
    'founder-headshots': {
        title: 'Professional AI Founder Headshots That Inspire Trust',
        description: "You're paid for your decisions, not your time. Make the right one for your brand. Generate confident AI founder headshots for press, pitches, and profiles.",
        keywords: ['ai founder headshots', 'startup headshots', 'professional portraits for founders', 'entrepreneur headshots'],
    },
    'linkedin-headshots': {
        title: 'AI LinkedIn Headshots That Get You Noticed',
        description: 'Boost credibility with polished, realistic headshots that match your professional brand. Perfect for LinkedIn, bios, and speaker pages.',
        keywords: ['ai linkedin headshots', 'linkedin profile photo', 'professional headshots', 'ai headshot generator', 'business headshots'],
    },
    'corporate-headshots': {
        title: 'AI Corporate Headshots Ready for LinkedIn & Teams',
        description: 'Get consistent, polished corporate headshots for LinkedIn, Slack, and company profiles—no studio booking needed.',
        keywords: ['ai corporate headshots', 'company headshots', 'team headshots', 'professional business photos', 'linkedin headshots'],
    },
    'lawyer-headshots': {
        title: 'AI Lawyer Headshots That Command Respect',
        description: 'Present authority and trust with clean, modern AI headshots for law firm websites, LinkedIn, and legal directories.',
        keywords: ['ai lawyer headshots', 'attorney headshots', 'law firm portraits', 'professional legal headshots', 'linkedin headshots'],
    },
    'professional-headshots': {
        title: 'Selfies to Professional Headshots in 15 Minutes',
        description: 'Transform simple selfies into studio-quality professional headshots ready for resumes, LinkedIn, and websites.',
        keywords: ['professional headshots', 'ai headshot generator', 'linkedin photo', 'resume headshot', 'studio-quality'],
    },
    'resume-headshots': {
        title: 'AI Resume Headshots That Land Interviews',
        description: 'Make your application stand out with clean, realistic headshots optimized for resumes, job portals, and personal websites—no studio booking required.',
        keywords: ['ai resume headshots', 'resume photo', 'job application headshot', 'professional headshots', 'career profile photo'],
    },
    'personal-branding-photoshoot': {
        title: 'Personal Branding Photos That Attract Your Next Big Opportunity',
        description: 'Stop using outdated headshots. Build a powerful personal brand by turning selfies into professional photos that build credibility and help you attract clients, partners, and gigs.',
        keywords: ['personal branding photos', 'ai photoshoot', 'professional portraits', 'brand credibility', 'social media photos'],
    },
    'ai-dating-photoshoot': {
        title: 'AI Dating Photoshoot That Get Noticed',
        description: 'Stop using old selfies. We turn your photos into a magnetic AI dating photoshoot that shows your best self, boosts your confidence, and gets you more matches.',
        keywords: ['ai dating photoshoot', 'dating profile pictures', 'tinder photos', 'profile photo generator', 'get more matches'],
    },
    'ai-instagram-photoshoot': {
        title: 'AI Instagram Photoshoots That Stop the Scroll',
        description: 'Create thumb-stopping content with authentic, high-quality AI images tailored for your vibe. Perfect for reels, posts, and profile pictures that grow your instagram audience.',
        keywords: ['ai instagram photoshoot', 'instagram content', 'reels photos', 'profile pictures', 'social media growth'],
    },
    'ai-influencer-generator': {
        title: 'Create Your Digital Twin with our AI Influencer Generator',
        description: 'Generate a realistic AI version of yourself and become a virtual influencer. Create stunning content, grow your audience, and explore new digital frontiers without ever leaving your home.',
        keywords: ['ai influencer generator', 'digital twin', 'virtual influencer', 'ai persona', 'content creation'],
    },
    'ai-fantasy-photoshoot': {
        title: 'AI Fantasy Photoshoot for cosplay, editorials, and viral feeds',
        description: 'Transform simple photos into high-fashion fantasy worlds. Get scroll-stopping portraits designed to showcase characters, campaigns, and your most imaginative looks.',
        keywords: ['ai fantasy photoshoot', 'cosplay ai photos', 'editorial portraits', 'high fashion ai', 'viral portraits'],
    },
    'ai-maternity-photoshoot': {
        title: 'AI Maternity Photoshoots That Beautifully Capture Your Glow',
        description: 'Celebrate your journey with a beautiful AI maternity shoot. Get stunning, tasteful, and timeless portraits that capture your glow, all from the comfort of your home.',
        keywords: ['ai maternity photoshoot', 'pregnancy portraits', 'maternity pictures', 'glow portraits', 'timeless photos'],
    },
    'ai-diwali-photoshoot': {
        title: 'Create Radiant AI Diwali Photoshoots in Minutes',
        description: 'Celebrate the festival of lights with a stunning new look. Create vibrant, traditional portraits from your selfies to share with loved ones and light up your feed.',
        keywords: ['ai diwali photoshoot', 'festival of lights photos', 'traditional portraits', 'diwali pictures', 'vibrant ai images'],
    },
    'ai-halloween-photoshoot': {
        title: 'Hauntingly Good AI Halloween Photoshoot, No Costume Needed',
        description: 'Summon cinematic Halloween portraits—ghostly, glam, or gothic. Pick your vibe and get a hauntingly good set for costumes, parties, and social feeds.',
        keywords: ['ai halloween photoshoot', 'spooky portraits', 'haunting photos', 'costume pictures', 'gothic ai'],
    },
    'ai-botanic-illustrations': {
        title: 'AI Botanic Illustrations That Show the World of Nature',
        description: 'Explore the world of botany with AI-generated illustrations. Get stunning, detailed portraits of plants, flowers, and other natural wonders.',
        keywords: ['ai botanic illustrations', 'botany portraits', 'natural illustrations', 'plant photos', 'flower illustrations'],
    },
    'neutral-muse-photoshoot': {
        title: 'AI Neutral Muse Portraits That Embody Quiet Luxury',
        description: 'Embrace the power of minimalism. This AI photoshoot creates sophisticated portraits with a clean, neutral palette that highlights your features with timeless style.',
        keywords: ['neutral muse portraits', 'quiet luxury photos', 'minimalist portraits', 'ai fashion photos', 'clean aesthetic'],
    },
    'natural-looks-photoshoot': {
        title: 'AI Portraits That Showcase Your True Natural Beauty',
        description: 'Your natural beauty, perfectly captured. This AI photoshoot creates authentic, minimalist portraits that look like you on your very best day. Simple, clean, and real.',
        keywords: ['natural looks portraits', 'authentic ai portraits', 'minimalist headshots', 'realistic photos', 'true beauty'],
    },
    'street-style-photoshoot': {
        title: 'Elegant AI Street Style Photos from Your Selfies',
        description: 'Capture that effortless urban edge. Turn your selfies into a high-fashion street style photoshoot that looks like it was ripped from a magazine.',
        keywords: ['street style photoshoot', 'urban fashion portraits', 'magazine style photos', 'ai street style', 'high fashion'],
    },
    'denim-wear-photoshoot': {
        title: 'Denim Wear Photoshoot - The Iconic Denim Look, Reimagined',
        description: 'Get that timeless, effortlessly cool denim photoshoot. From classic portraits to modern styles, create stunning images that showcase this iconic wardrobe staple.',
        keywords: ['denim photoshoot', 'jeans fashion portraits', 'iconic denim look', 'ai fashion photos', 'cool portraits'],
    },
    'stylish-ai-portraits': {
        title: 'Stylish AI Portraits That Stop the Scroll',
        description: 'Go beyond the standard portrait. Create artistic, magazine-worthy AI portraits that capture your unique style and personality, ready for any platform.',
        keywords: ['stylish ai portraits', 'magazine-worthy photos', 'artistic portraits', 'ai headshots', 'scroll-stopping images'],
    },
    'office-outfit-photoshoot': {
        title: 'Office Outfit Photoshoot – Power Dressing, Perfected by AI',
        description: 'Showcase your professional style beyond the basic headshot. Generate polished, full-body shots in your best office wear for a modern, confident corporate brand.',
        keywords: ['office outfit photoshoot', 'corporate branding photos', 'full-body office wear', 'professional style portraits', 'ai corporate photos'],
    },
    'ai-christmas-photoshoot': {
        title: 'Create Magical AI Christmas Photoshoots Online',
        description: 'Transform your photos into festive Christmas masterpieces. Get a collection of high-quality, holiday-themed photos for your cards, social media, and more.',
        keywords: ['ai christmas photoshoot', 'holiday photos', 'festive portraits', 'christmas cards images', 'holiday-themed ai'],
    },
    'vintage-photoshoot': {
        title: 'Vintage AI Portraits That Bring Old Hollywood to Life',
        description: 'Classic Hollywood glamour is yours. Create elegant, nostalgic AI photos with a vintage aesthetic that captures the charm and style of another time.',
        keywords: ['vintage ai portraits', 'old hollywood glamour', 'nostalgic photos', 'vintage aesthetic', 'elegant portraits'],
    },
    'black-swan-photoshoot': {
        title: 'AI Black Swan Photoshoot That Unleash Your Dark Elegance',
        description: 'Capture the breathtaking artistry of the Black Swan. This AI photoshoot creates stunning, dramatic, and elegant portraits that are a true work of art.',
        keywords: ['black swan photoshoot', 'dark elegance portraits', 'dramatic ai photos', 'artistic portraits', 'ballet inspired ai'],
    },
    'ai-speaker-photoshoot': {
        title: 'AI Speaker Photoshoots That Win Audiences',
        description: 'Get dynamic, engaging speaker photos for your bio, website, and event promos. Our AI creates shots that show your stage presence and command attention.',
        keywords: ['ai speaker photos', 'public speaker headshots', 'event promo photos', 'bio photos', 'stage presence'],
    },
    'ai-glamour-photoshoot': {
        title: 'AI Glamour Photoshoot Generator – Selfies to Model-Quality Portraits',
        description: 'Unleash your inner celebrity. Get stunning, high-fashion glamour shots without a team of stylists. Perfect for when you need to look and feel absolutely incredible.',
        keywords: ['ai glamour photoshoot', 'high-fashion portraits', 'model-quality ai', 'glamour shots', 'celebrity look'],
    },
    'profile-photo-maker': {
        title: 'Free Profile Photo Maker – Professional PFPs from Your Selfies',
        description: 'Create clean, realistic profile photos for LinkedIn, resumes, and social media. Upload selfies and get studio-quality headshots in minutes—no photoshoot needed.',
        keywords: ['profile photo maker', 'ai pfp generator', 'linkedin profile picture', 'professional headshots', 'ai headshot generator', 'free profile photo maker', 'instagram profile picture maker', 'pfpmaker for insta'],
    }
  }
};
// Open Graph Image Configuration
export const openGraphImages = {
  default: {
    url: `${defaultSEO.siteUrl}/og-image.png`,
    width: 1200,
    height: 630,
    alt: defaultSEO.title,
  },
  logo: {
    url: `${defaultSEO.siteUrl}/logo.png`,
    width: 400,
    height: 400,
    alt: `${defaultSEO.siteName} Logo`,
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
    '/trained-models/*',
    '/buy-credits/*',
    '/payment-success',
    
  ],
  additionalPaths: async () => {
    // Add dynamic paths here if needed
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
    description: defaultSEO.description,
    url: defaultSEO.siteUrl,
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    publisher: organizationSchema,
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
        '@type': 'WorldWide'
    },
    offers: {
        '@type': 'Offer',
        price: '19.99', // Example price, should be dynamic
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