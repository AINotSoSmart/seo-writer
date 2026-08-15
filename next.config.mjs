/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['isomorphic-dompurify', 'html-encoding-sniffer', '@exodus/bytes'],
  
  serverExternalPackages: ["jsdom"],

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "blog.flipaeo.com" },
      { protocol: "http", hostname: "localhost" },
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
}

export default nextConfig
