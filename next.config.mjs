/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "blog.unrealshot.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "astria.ai" },
      { protocol: "https", hostname: "api.astria.ai" },
      { protocol: "https", hostname: "sdbooth2-production.s3.amazonaws.com" },
      { protocol: "https", hostname: "xdka2sdembhhqc3o.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "norpsr0wtvuo7qpe.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "replicate.com" },
      { protocol: "https", hostname: "fal.ai" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "v3.fal.media" },
      { protocol: "https", hostname: "agenwrite.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "cloudflarestorage.com" },
      { protocol: "https", hostname: "r2.cloudflarestorage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/ai-influencer-generator/",
        destination: "/ai-influencer-generator",
        permanent: true,
      },
    ];
  },
}

export default nextConfig
